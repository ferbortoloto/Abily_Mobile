import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { getPlatformFeePct, calcInstructorNet } from '../_shared/fees.ts';

const WEBHOOK_TOKEN = Deno.env.get('ASAAS_WEBHOOK_TOKEN');

// Mínimo para ter R$12 líquido após taxa Asaas por método
function getMinPlatformFee(billingType: string): number {
  const NET_PROFIT = 12;
  if (billingType === 'PIX')    return NET_PROFIT + 3.00;   // R$3 taxa PIX Asaas
  if (billingType === 'BOLETO') return NET_PROFIT + 3.49;   // taxa boleto Asaas
  return NET_PROFIT + 3.00; // fallback
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') return new Response('Method Not Allowed', { status: 405 });

  if (WEBHOOK_TOKEN) {
    const incomingToken = req.headers.get('asaas-access-token');
    if (incomingToken !== WEBHOOK_TOKEN) return new Response('Unauthorized', { status: 401 });
  }

  try {
    const event = await req.json() as {
      event:   string;
      payment: { id: string; status: string; billingType: string };
    };

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    const paymentId = event.payment?.id;
    if (!paymentId) return new Response('OK', { status: 200 });

    const isPaid   = ['PAYMENT_CONFIRMED', 'PAYMENT_RECEIVED'].includes(event.event);
    const isRefund = ['PAYMENT_REFUNDED', 'PAYMENT_CHARGEBACK_REQUESTED', 'PAYMENT_CHARGEBACK_DISPUTE'].includes(event.event);

    if (isPaid) {
      // ── Plano ────────────────────────────────────────────────────────────────
      const { data: purchase } = await supabase
        .from('purchases')
        .select('id, instructor_id, price_paid')
        .eq('asaas_payment_id', paymentId)
        .eq('status', 'pending_payment')
        .maybeSingle();

      if (purchase) {
        await supabase
          .from('purchases')
          .update({ status: 'active' })
          .eq('asaas_payment_id', paymentId);
        // Crédito ao instrutor ocorre por sessão concluída (trigger credit_instructor_on_session_complete)
      }

      // ── Avulsa ───────────────────────────────────────────────────────────────
      const { data: avulsa } = await supabase
        .from('avulsa_payments')
        .select('*')
        .eq('asaas_payment_id', paymentId)
        .eq('status', 'pending_payment')
        .maybeSingle();

      if (avulsa) {
        // Marca pagamento como confirmado
        await supabase
          .from('avulsa_payments')
          .update({ status: 'paid' })
          .eq('id', avulsa.id);

        if (avulsa.class_request_id) {
          // Novo fluxo: class_request já existe em 'awaiting_payment'
          // → muda para 'pending' para que o instrutor possa aceitar
          // A carteira só é creditada quando o instrutor aceitar (accept-avulsa)
          await supabase
            .from('class_requests')
            .update({ status: 'pending' })
            .eq('id', avulsa.class_request_id);
        } else {
          // Fluxo legado: cria class_request a partir do request_data
          const requestData = avulsa.request_data as Record<string, unknown>;
          await supabase
            .from('class_requests')
            .insert({ ...requestData, student_id: avulsa.student_id });
        }
      }
    }

    if (isRefund) {
      // ── Reembolso plano ───────────────────────────────────────────────────────
      const { data: purchase } = await supabase
        .from('purchases')
        .select('instructor_id, price_paid')
        .eq('asaas_payment_id', paymentId)
        .maybeSingle();

      if (purchase) {
        await supabase
          .from('purchases')
          .update({ status: 'refunded' })
          .eq('asaas_payment_id', paymentId);

        // Soma todos os créditos por sessão já creditados para este plano
        const { data: txs } = await supabase
          .from('wallet_transactions')
          .select('amount')
          .eq('type', 'credit')
          .eq('plan_purchase_id', purchase.id)
          .eq('instructor_id', purchase.instructor_id);

        const totalCredited = txs?.reduce((sum, t) => sum + t.amount, 0) ?? 0;

        if (totalCredited > 0) {
          await supabase.rpc('increment_instructor_wallet', {
            p_instructor_id: purchase.instructor_id,
            p_amount: -totalCredited,
          });

          await supabase.from('wallet_transactions').insert({
            instructor_id: purchase.instructor_id,
            amount:        -totalCredited,
            type:          'withdrawal',
            description:   'Estorno — plano reembolsado',
          });
        }
      }

      // ── Reembolso avulsa ──────────────────────────────────────────────────────
      const { data: avulsa } = await supabase
        .from('avulsa_payments')
        .select('id, instructor_id, price')
        .eq('asaas_payment_id', paymentId)
        .maybeSingle();

      if (avulsa) {
        await supabase
          .from('avulsa_payments')
          .update({ status: 'refunded' })
          .eq('asaas_payment_id', paymentId);

        // Busca pelo reference_id preciso — só existe se o instrutor aceitou e a carteira foi creditada
        const { data: tx } = await supabase
          .from('wallet_transactions')
          .select('amount')
          .eq('type', 'credit')
          .eq('reference_id', avulsa.id)
          .maybeSingle();

        // Só estorna se a carteira foi de fato creditada (evita saldo negativo)
        if (tx) {
          await supabase.rpc('increment_instructor_wallet', {
            p_instructor_id: avulsa.instructor_id,
            p_amount: -tx.amount,
          });

          await supabase.from('wallet_transactions').insert({
            instructor_id: avulsa.instructor_id,
            amount:        -tx.amount,
            type:          'withdrawal',
            description:   'Estorno — aula avulsa reembolsada',
          });
        }
      }
    }

    return new Response('OK', { status: 200 });
  } catch (err) {
    console.error('Webhook error:', err);
    return new Response('Internal Error', { status: 500 });
  }
});
