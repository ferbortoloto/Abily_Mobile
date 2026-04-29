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

// value: se informado, faz estorno parcial; senão, estorno total
async function refundAsaasPayment(asaasPaymentId: string, value?: number) {
  const reqBody = value !== undefined ? JSON.stringify({ value }) : undefined;
  const res = await fetch(`${ASAAS_BASE_URL}/payments/${asaasPaymentId}/refund`, {
    method:  'POST',
    headers: { 'access_token': ASAAS_API_KEY, 'Content-Type': 'application/json' },
    body:    reqBody,
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Asaas refund error: ${body}`);
  }
}

async function sendPushNotification(pushToken: string, title: string, body: string, data: Record<string, unknown>) {
  if (!pushToken?.startsWith('ExponentPushToken')) return;
  await fetch('https://exp.host/--/api/v2/push/send', {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ to: pushToken, title, body, sound: 'default', priority: 'high', data }),
  });
}

// ── Regras de cancelamento ────────────────────────────────────────────────────
// • Instrutor cancela (imprevisto/recusa): estorno 100% ao aluno (sem taxa)
// • Aluno cancela:                         taxa fixa de R$5,00 (qualquer prazo)
function calculateRefundAmount(grossAmount: number, isInstructorCancel: boolean): {
  refundAmount: number;
  feeAmount:    number;
  feeType:      'none' | 'fixed';
} {
  if (isInstructorCancel) {
    return { refundAmount: grossAmount, feeAmount: 0, feeType: 'none' };
  }
  const refund = Math.max(0, Math.round((grossAmount - 5.00) * 100) / 100);
  return { refundAmount: refund, feeAmount: Math.min(5.00, grossAmount), feeType: 'fixed' };
}

// Debita R$5 de penalidade da carteira do instrutor (pode ficar negativa)
async function applyInstructorPenalty(supabase: ReturnType<typeof createClient>, instructor_id: string, reference_id: string) {
  await supabase.rpc('increment_instructor_wallet', { p_instructor_id: instructor_id, p_amount: -5.00 });
  await supabase.from('wallet_transactions').insert({
    instructor_id,
    amount:       5.00,
    type:         'debit',
    description:  'Penalidade por recusa de aula',
    reference_id,
  });
  // Notifica o instrutor sobre a penalidade
  try {
    const { data: ip } = await supabase.from('profiles').select('push_token').eq('id', instructor_id).single();
    await sendPushNotification(
      ip?.push_token,
      'Taxa de cancelamento aplicada',
      'Uma taxa de R$5,00 foi debitada da sua carteira por recusa de aula.',
      { type: 'instructor_cancel_penalty', reference_id },
    );
  } catch { /* non-blocking */ }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    const body = await req.json() as {
      purchase_id?:         string;
      student_id?:          string;
      class_request_id?:    string;
      instructor_cancel?:   boolean;
      cancellation_reason?: 'emergency' | 'refused';
    };

    // ── MODO AVULSA / SOLICITAÇÃO ─────────────────────────────────────────────────
    if (body.class_request_id) {
      const { data: classReq } = await supabase
        .from('class_requests')
        .select('student_id, instructor_id, status, purchase_id, requested_date, requested_slots')
        .eq('id', body.class_request_id)
        .maybeSingle();
      const student_id    = classReq?.student_id    ?? null;
      const instructor_id = classReq?.instructor_id ?? null;

      // ── IMPREVISTO: sem estorno — aluno pode reagendar ─────────────────────────
      if (body.instructor_cancel && body.cancellation_reason === 'emergency') {
        // Cancela o evento vinculado sem tocar no pagamento
        await supabase
          .from('events')
          .update({ status: 'cancelled' })
          .eq('class_request_id', body.class_request_id);

        // Cancela sessão pendente para o código de aula sumir do app do aluno
        if (student_id && instructor_id) {
          await supabase
            .from('sessions')
            .update({ status: 'cancelled' })
            .eq('student_id', student_id)
            .eq('instructor_id', instructor_id)
            .eq('status', 'pending');
        }

        // Sinaliza o pedido com motivo de emergência (mantém status accepted)
        await supabase
          .from('class_requests')
          .update({ cancellation_reason: 'emergency' })
          .eq('id', body.class_request_id);

        if (student_id) {
          try {
            const { data: sp } = await supabase.from('profiles').select('push_token').eq('id', student_id).single();
            await supabase.from('notifications').insert({
              user_id: student_id,
              type:    'class_emergency_cancel',
              title:   'Imprevisto do instrutor',
              body:    'Seu instrutor teve um imprevisto. Você pode reagendar a aula para outro horário sem custo adicional.',
              data:    { class_request_id: body.class_request_id },
            });
            await sendPushNotification(
              sp?.push_token,
              'Imprevisto do instrutor',
              'Seu instrutor teve um imprevisto. Abra o app para reagendar sua aula.',
              { type: 'class_emergency_cancel', class_request_id: body.class_request_id },
            );
          } catch (e) { console.error('Notification error (emergency):', e); }
        }

        return new Response(
          JSON.stringify({ success: true, cancellation_reason: 'emergency' }),
          { headers: { ...CORS, 'Content-Type': 'application/json' } },
        );
      }

      const { data: avulsa, error: avulsaErr } = await supabase
        .from('avulsa_payments')
        .select('id, asaas_payment_id, status, price')
        .eq('class_request_id', body.class_request_id)
        .maybeSingle();

      // ── Sem pagamento avulsa = aula de plano: cancela pedido (trigger devolve crédito) ──
      if (avulsaErr || !avulsa) {
        if (avulsaErr) console.error('avulsa_payments query error:', avulsaErr);
        const { error: updateErr } = await supabase
          .from('class_requests')
          .update({ status: 'cancelled', cancellation_reason: body.instructor_cancel ? (body.cancellation_reason ?? null) : 'student' })
          .eq('id', body.class_request_id);
        if (updateErr) throw new Error(`Failed to update class_request: ${updateErr.message}`);

        // Cancela o evento vinculado para sumir do calendário de ambos
        await supabase
          .from('events')
          .update({ status: 'cancelled' })
          .eq('class_request_id', body.class_request_id);

        // Cancela sessão pendente para o código de aula sumir do app do aluno
        if (student_id && instructor_id) {
          await supabase
            .from('sessions')
            .update({ status: 'cancelled' })
            .eq('student_id', student_id)
            .eq('instructor_id', instructor_id)
            .eq('status', 'pending');
        }

        if (body.instructor_cancel && student_id) {
          try {
            const { data: sp } = await supabase.from('profiles').select('push_token').eq('id', student_id).single();
            await supabase.from('notifications').insert({
              user_id: student_id, type: 'class_cancelled_by_instructor',
              title: 'Aula cancelada',
              body:  'O instrutor cancelou sua aula. O crédito foi devolvido automaticamente.',
              data:  { class_request_id: body.class_request_id },
            });
            await sendPushNotification(sp?.push_token, 'Aula cancelada',
              'O instrutor cancelou sua aula. O crédito foi devolvido automaticamente.',
              { type: 'class_cancelled_by_instructor', class_request_id: body.class_request_id });
          } catch (e) { console.error('Notification error:', e); }

          // Penalidade R$5 por recusa (plano)
          if (body.cancellation_reason === 'refused' && instructor_id) {
            try { await applyInstructorPenalty(supabase, instructor_id, body.class_request_id); }
            catch (e) { console.error('Instructor penalty error (non-blocking):', e); }
          }
        } else if (!body.instructor_cancel && instructor_id) {
          // Notifica o instrutor que o aluno cancelou a aula de plano
          try {
            const { data: ip } = await supabase.from('profiles').select('push_token, name').eq('id', instructor_id).single();
            const { data: sp } = await supabase.from('profiles').select('name').eq('id', student_id).single();
            const studentName = sp?.name || 'O aluno';
            await supabase.from('notifications').insert({
              user_id: instructor_id, type: 'class_cancelled_by_student',
              title: 'Aula cancelada pelo aluno',
              body:  `${studentName} cancelou a aula. O crédito foi devolvido ao plano.`,
              data:  { class_request_id: body.class_request_id },
            });
            await sendPushNotification(ip?.push_token, 'Aula cancelada pelo aluno',
              `${studentName} cancelou a aula agendada.`,
              { type: 'class_cancelled_by_student', class_request_id: body.class_request_id });
          } catch (e) { console.error('Instructor notification error (non-blocking):', e); }
        }

        return new Response(JSON.stringify({ success: true }), {
          headers: { ...CORS, 'Content-Type': 'application/json' },
        });
      }

      // ── Pagamento avulsa encontrado ────────────────────────────────────────────
      const { refundAmount, feeAmount, feeType } = calculateRefundAmount(
        avulsa.price,
        body.instructor_cancel ?? false,
      );

      if (avulsa.asaas_payment_id) {
        if (avulsa.status === 'paid') {
          try {
            const partialValue = refundAmount < avulsa.price ? refundAmount : undefined;
            await refundAsaasPayment(avulsa.asaas_payment_id, partialValue);
          } catch (e) {
            console.error('Asaas refund failed (non-blocking):', e);
          }
        } else if (avulsa.status === 'pending_payment') {
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
        .update({ status: 'cancelled', cancellation_reason: body.instructor_cancel ? (body.cancellation_reason ?? null) : 'student' })
        .eq('id', body.class_request_id);
      if (updReqErr) throw new Error(`Failed to update class_requests: ${updReqErr.message}`);

      // Cancela o evento vinculado para sumir do calendário de ambos
      await supabase
        .from('events')
        .update({ status: 'cancelled' })
        .eq('class_request_id', body.class_request_id);

      // Cancela sessão pendente para o código de aula sumir do app do aluno
      if (student_id && instructor_id) {
        await supabase
          .from('sessions')
          .update({ status: 'cancelled' })
          .eq('student_id', student_id)
          .eq('instructor_id', instructor_id)
          .eq('status', 'pending');
      }

      // Estorna carteira do instrutor se ele já havia sido creditado (via trigger de conclusão)
      if (avulsa.status === 'paid' && instructor_id) {
        try {
          const { data: walletTx } = await supabase
            .from('wallet_transactions')
            .select('amount')
            .eq('reference_id', avulsa.id)
            .eq('type', 'credit')
            .maybeSingle();

          if (walletTx) {
            await supabase.rpc('increment_instructor_wallet', {
              p_instructor_id: instructor_id,
              p_amount:        -walletTx.amount,
            });
            await supabase.from('wallet_transactions').insert({
              instructor_id,
              amount:       walletTx.amount,
              type:         'debit',
              description:  body.instructor_cancel ? 'Cancelamento pelo instrutor' : 'Cancelamento pelo aluno',
              reference_id: avulsa.id,
            });
          }
        } catch (e) {
          console.error('Wallet debit error (non-blocking):', e);
        }
      }

      // Penalidade R$5 por recusa (avulsa)
      if (body.instructor_cancel && body.cancellation_reason === 'refused' && instructor_id) {
        try { await applyInstructorPenalty(supabase, instructor_id, body.class_request_id); }
        catch (e) { console.error('Instructor penalty error (non-blocking):', e); }
      }

      let notifBody: string;
      if (body.instructor_cancel) {
        notifBody = 'O instrutor cancelou sua aula. O valor foi estornado integralmente.';
      } else {
        notifBody = `Cancelamento processado. Taxa de R$ ${feeAmount.toFixed(2)} aplicada. Estorno de R$ ${refundAmount.toFixed(2)}.`;
      }

      if (student_id && avulsa.status === 'paid') {
        try {
          const { data: sp } = await supabase.from('profiles').select('push_token').eq('id', student_id).single();
          await supabase.from('notifications').insert({
            user_id: student_id,
            type:    body.instructor_cancel ? 'class_cancelled_by_instructor' : 'class_refunded',
            title:   'Aula cancelada',
            body:    notifBody,
            data:    { class_request_id: body.class_request_id },
          });
          await sendPushNotification(sp?.push_token, 'Aula cancelada', notifBody,
            { type: body.instructor_cancel ? 'class_cancelled_by_instructor' : 'class_refunded', class_request_id: body.class_request_id });
        } catch (e) {
          console.error('Notification error (non-blocking):', e);
        }
      }

      // Notifica o instrutor quando o aluno cancela uma avulsa
      if (!body.instructor_cancel && instructor_id) {
        try {
          const { data: ip } = await supabase.from('profiles').select('push_token, name').eq('id', instructor_id).single();
          const { data: sp } = await supabase.from('profiles').select('name').eq('id', student_id).single();
          const studentName = sp?.name || 'O aluno';
          await supabase.from('notifications').insert({
            user_id: instructor_id, type: 'class_cancelled_by_student',
            title: 'Aula cancelada pelo aluno',
            body:  `${studentName} cancelou a aula avulsa agendada.`,
            data:  { class_request_id: body.class_request_id },
          });
          await sendPushNotification(ip?.push_token, 'Aula cancelada pelo aluno',
            `${studentName} cancelou a aula avulsa.`,
            { type: 'class_cancelled_by_student', class_request_id: body.class_request_id });
        } catch (e) { console.error('Instructor notification error (non-blocking):', e); }
      }

      return new Response(
        JSON.stringify({ success: true, refund_amount: refundAmount, fee_amount: feeAmount, fee_type: feeType }),
        { headers: { ...CORS, 'Content-Type': 'application/json' } },
      );
    }

    // ── MODO PLANO (cancelar compra pendente) ──────────────────────────────────────
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
