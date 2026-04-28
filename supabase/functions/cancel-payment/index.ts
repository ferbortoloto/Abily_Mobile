import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const ASAAS_API_KEY  = Deno.env.get('ASAAS_API_KEY')!;
const ASAAS_BASE_URL = Deno.env.get('ASAAS_ENV') === 'production'
  ? 'https://api.asaas.com/v3'
  : 'https://sandbox.asaas.com/api/v3';

const CORS = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

async function cancelAsaasPayment(asaasPaymentId: string) {
  const res = await fetch(`${ASAAS_BASE_URL}/payments/${asaasPaymentId}`, {
    method:  'DELETE',
    headers: { 'access_token': ASAAS_API_KEY },
  });
  if (!res.ok && res.status !== 404) {
    const body = await res.text();
    throw new Error(`Asaas cancel error: ${body}`);
  }
}

async function refundAsaasPayment(asaasPaymentId: string) {
  const res = await fetch(`${ASAAS_BASE_URL}/payments/${asaasPaymentId}/refund`, {
    method:  'POST',
    headers: { 'access_token': ASAAS_API_KEY, 'Content-Type': 'application/json' },
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Asaas refund error: ${body}`);
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    const body = await req.json() as {
      purchase_id?:       string;
      student_id?:        string;
      class_request_id?:  string; // modo avulsa
    };

    // ── MODO AVULSA (estorno quando instrutor rejeita ou aluno cancela) ─────────
    if (body.class_request_id) {
      // Busca student_id do request para notificar
      const { data: classReq } = await supabase
        .from('class_requests')
        .select('student_id, status')
        .eq('id', body.class_request_id)
        .maybeSingle();
      const student_id = classReq?.student_id ?? null;

      const { data: avulsa, error: avulsaErr } = await supabase
        .from('avulsa_payments')
        .select('id, asaas_payment_id, status, price')
        .eq('class_request_id', body.class_request_id)
        .maybeSingle();

      // Se houve erro na query ou pagamento não encontrado → cancela direto sem estorno
      if (avulsaErr || !avulsa) {
        if (avulsaErr) console.error('avulsa_payments query error:', avulsaErr);
        const { error: updateErr } = await supabase
          .from('class_requests')
          .update({ status: 'cancelled' })
          .eq('id', body.class_request_id);

        if (updateErr) {
          throw new Error(`Failed to update class_request to cancelled: ${updateErr.message}`);
        }

        return new Response(JSON.stringify({ success: true }), {
          headers: { ...CORS, 'Content-Type': 'application/json' },
        });
      }

      if (avulsa.asaas_payment_id) {
        if (avulsa.status === 'paid') {
          // Pagamento confirmado → tenta estorno real (non-blocking em caso de falha)
          try {
            await refundAsaasPayment(avulsa.asaas_payment_id);
          } catch (refundErr) {
            console.error('Asaas refund failed (non-blocking):', refundErr);
          }
        } else if (avulsa.status === 'pending_payment') {
          // Ainda não pago → cancela a cobrança (non-blocking — pode já ter expirado)
          try { await cancelAsaasPayment(avulsa.asaas_payment_id); } catch { /* expired ok */ }
        }
      }

      const { error: updAvulsaErr } = await supabase
        .from('avulsa_payments')
        .update({ status: 'refunded' })
        .eq('id', avulsa.id);
      
      if (updAvulsaErr) throw new Error(`Failed to update avulsa_payments: ${updAvulsaErr.message}`);

      const { error: updReqErr } = await supabase
        .from('class_requests')
        .update({ status: 'cancelled' })
        .eq('id', body.class_request_id);

      if (updReqErr) throw new Error(`Failed to update class_requests: ${updReqErr.message}`);

      // Notifica o aluno que o dinheiro foi estornado (apenas se havia pagamento)
      if (student_id && avulsa.status === 'paid') {
        try {
          const { data: studentProfile } = await supabase
            .from('profiles')
            .select('push_token')
            .eq('id', student_id)
            .single();

          await supabase.from('notifications').insert({
            user_id: student_id,
            type: 'class_rejected',
            title: 'Aula não confirmada',
            body: 'Sua solicitação não foi aceita. O valor foi estornado automaticamente.',
            data: { class_request_id: body.class_request_id },
          });

          if (studentProfile?.push_token?.startsWith('ExponentPushToken')) {
            await fetch('https://exp.host/--/api/v2/push/send', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                to: studentProfile.push_token,
                title: '❌ Aula não confirmada',
                body: 'Sua solicitação não foi aceita. O valor foi estornado automaticamente.',
                sound: 'default',
                priority: 'high',
                data: { type: 'class_rejected', class_request_id: body.class_request_id },
              }),
            });
          }
        } catch (notifErr) {
          console.error('Notification error (non-blocking):', notifErr);
        }
      }

      return new Response(
        JSON.stringify({ success: true }),
        { headers: { ...CORS, 'Content-Type': 'application/json' } },
      );
    }

    // ── MODO PLANO (cancelar compra pendente) ──────────────────────────────────
    const { purchase_id, student_id } = body;

    const { data: purchase, error: fetchErr } = await supabase
      .from('purchases')
      .select('id, asaas_payment_id, status, student_id, payment_method')
      .eq('id', purchase_id)
      .single();

    if (fetchErr || !purchase) {
      return new Response(JSON.stringify({ error: 'Compra não encontrada.' }), {
        status: 404, headers: { ...CORS, 'Content-Type': 'application/json' },
      });
    }

    if (purchase.student_id !== student_id) {
      return new Response(JSON.stringify({ error: 'Acesso negado.' }), {
        status: 403, headers: { ...CORS, 'Content-Type': 'application/json' },
      });
    }

    if (purchase.status !== 'pending_payment') {
      return new Response(
        JSON.stringify({ error: 'Somente compras com pagamento pendente podem ser canceladas.' }),
        { status: 400, headers: { ...CORS, 'Content-Type': 'application/json' } },
      );
    }

    if (purchase.asaas_payment_id) {
      await cancelAsaasPayment(purchase.asaas_payment_id);
    }

    await supabase
      .from('purchases')
      .update({ status: 'cancelled' })
      .eq('id', purchase_id);

    return new Response(
      JSON.stringify({ success: true }),
      { headers: { ...CORS, 'Content-Type': 'application/json' } },
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: (err as Error).message }),
      { status: 500, headers: { ...CORS, 'Content-Type': 'application/json' } },
    );
  }
});
