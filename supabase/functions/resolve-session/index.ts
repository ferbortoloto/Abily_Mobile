import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const ASAAS_API_KEY  = Deno.env.get('ASAAS_API_KEY')!;
const ASAAS_BASE_URL = Deno.env.get('ASAAS_ENV') === 'production'
  ? 'https://api.asaas.com/v3'
  : 'https://sandbox.asaas.com/api/v3';

const CORS = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const INTERRUPT_FEE = 5.00;

async function refundAsaasPayment(asaasPaymentId: string, value: number) {
  const res = await fetch(`${ASAAS_BASE_URL}/payments/${asaasPaymentId}/refund`, {
    method:  'POST',
    headers: { 'access_token': ASAAS_API_KEY, 'Content-Type': 'application/json' },
    body:    JSON.stringify({ value }),
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Asaas refund error: ${body}`);
  }
}

async function sendPushNotification(
  pushToken: string,
  title: string,
  body: string,
  data: Record<string, unknown>,
) {
  if (!pushToken?.startsWith('ExponentPushToken')) return;
  await fetch('https://exp.host/--/api/v2/push/send', {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ to: pushToken, title, body, sound: 'default', priority: 'high', data }),
  });
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    const { session_id, action, student_id } = await req.json() as {
      session_id: string;
      action:     'refund' | 'reschedule';
      student_id: string;
    };

    // Busca a sessão interrompida pertencente ao aluno, sem resolução ainda
    const { data: session, error: sessErr } = await supabase
      .from('sessions')
      .select('id, instructor_id, student_id, class_request_id, event_id, student_resolution')
      .eq('id', session_id)
      .eq('status', 'interrupted')
      .eq('student_id', student_id)
      .single();

    if (sessErr || !session) {
      return new Response(
        JSON.stringify({ error: 'Sessão não encontrada.' }),
        { status: 404, headers: { ...CORS, 'Content-Type': 'application/json' } },
      );
    }

    if (session.student_resolution !== null) {
      return new Response(
        JSON.stringify({ error: 'Esta sessão já foi resolvida.' }),
        { status: 409, headers: { ...CORS, 'Content-Type': 'application/json' } },
      );
    }

    // Resolve class_request_id (campo direto → via evento)
    let classRequestId: string | null = session.class_request_id ?? null;
    if (!classRequestId && session.event_id) {
      const { data: evt } = await supabase
        .from('events')
        .select('class_request_id')
        .eq('id', session.event_id)
        .single();
      classRequestId = evt?.class_request_id ?? null;
    }

    // Processa pagamento avulsa se ação for estorno
    let refundAmount: number | null = null;
    if (action === 'refund' && classRequestId) {
      const { data: avulsa } = await supabase
        .from('avulsa_payments')
        .select('id, asaas_payment_id, price, status')
        .eq('class_request_id', classRequestId)
        .eq('status', 'paid')
        .maybeSingle();

      if (avulsa) {
        refundAmount = Math.max(0, Math.round((avulsa.price - INTERRUPT_FEE) * 100) / 100);
        try {
          if (avulsa.asaas_payment_id) {
            await refundAsaasPayment(avulsa.asaas_payment_id, refundAmount);
          }
          await supabase
            .from('avulsa_payments')
            .update({ status: 'refunded' })
            .eq('id', avulsa.id);
        } catch (e) {
          console.error('Asaas refund error (non-blocking):', e);
        }
      }
      // Se for aula de plano (sem avulsa_payment): crédito já foi restaurado pelo interrupt_session RPC.
    }
    // action === 'reschedule': avulsa permanece 'paid'; aluno agenda nova sessão sem novo pagamento.

    // Registra resolução do aluno na sessão
    await supabase
      .from('sessions')
      .update({ student_resolution: action })
      .eq('id', session_id);

    // Notifica o instrutor da escolha do aluno
    try {
      const { data: ip } = await supabase
        .from('profiles')
        .select('push_token, name')
        .eq('id', session.instructor_id)
        .single();
      const { data: sp } = await supabase
        .from('profiles')
        .select('name')
        .eq('id', student_id)
        .single();

      const studentName = sp?.name ?? 'Aluno';
      const instrTitle = action === 'refund'
        ? `${studentName} solicitou estorno`
        : `${studentName} quer reagendar`;
      const instrBody = action === 'refund'
        ? `O estorno de R$ ${refundAmount !== null ? refundAmount.toFixed(2).replace('.', ',') : '—'} foi processado (R$ 5,00 de taxa Asaas).`
        : 'O aluno optou por reagendar a aula. Entre em contato para combinar o novo horário.';

      await supabase.from('notifications').insert({
        user_id: session.instructor_id,
        type:    action === 'refund' ? 'student_chose_refund' : 'student_chose_reschedule',
        title:   instrTitle,
        body:    instrBody,
        data:    { session_id, action, refund_amount: refundAmount },
      });
      await sendPushNotification(ip?.push_token, instrTitle, instrBody, {
        type: action === 'refund' ? 'student_chose_refund' : 'student_chose_reschedule',
        session_id,
      });
    } catch (e) {
      console.error('Instructor notification error (non-blocking):', e);
    }

    return new Response(
      JSON.stringify({ success: true, refund_amount: refundAmount }),
      { headers: { ...CORS, 'Content-Type': 'application/json' } },
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: (err as Error).message }),
      { status: 500, headers: { ...CORS, 'Content-Type': 'application/json' } },
    );
  }
});
