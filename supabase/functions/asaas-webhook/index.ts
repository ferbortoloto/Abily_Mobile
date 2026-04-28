import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const WEBHOOK_TOKEN = Deno.env.get('ASAAS_WEBHOOK_TOKEN');

// Mesma lógica de tiers que o app usa no ProfileScreen
function getPlatformFeePct(pricePerHour: number): number {
  if (pricePerHour <= 60)  return 0.20;
  if (pricePerHour <= 80)  return 0.15;
  if (pricePerHour <= 100) return 0.12;
  return 0.10;
}

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

        // Busca preço/hora do instrutor para calcular taxa
        const { data: instructor } = await supabase
          .from('profiles')
          .select('price_per_hour')
          .eq('id', purchase.instructor_id)
          .single();

        const pricePerHour = instructor?.price_per_hour || 80;
        const feePct       = getPlatformFeePct(pricePerHour);
        const grossAmount  = purchase.price_paid;
        const billingType  = event.payment.billingType || 'PIX';
        const minFee       = getMinPlatformFee(billingType);
        const platformFee  = Math.max(Math.round(grossAmount * feePct * 100) / 100, minFee);
        const netAmount    = Math.round((grossAmount - platformFee) * 100) / 100;

        await supabase.rpc('increment_instructor_wallet', {
          p_instructor_id: purchase.instructor_id,
          p_amount: netAmount,
        });

        await supabase.from('wallet_transactions').insert({
          instructor_id: purchase.instructor_id,
          amount:        netAmount,
          gross_amount:  grossAmount,
          platform_fee:  platformFee,
          fee_pct:       feePct * 100,
          type:          'credit',
          description:   'Compra de plano',
        });
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

        // Estorna o líquido que havia sido creditado
        const { data: tx } = await supabase
          .from('wallet_transactions')
          .select('amount')
          .eq('type', 'credit')
          .ilike('description', '%plano%')
          .eq('instructor_id', purchase.instructor_id)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        const refundAmount = tx?.amount || purchase.price_paid;

        await supabase.rpc('increment_instructor_wallet', {
          p_instructor_id: purchase.instructor_id,
          p_amount: -refundAmount,
        });

        await supabase.from('wallet_transactions').insert({
          instructor_id: purchase.instructor_id,
          amount:        -refundAmount,
          type:          'withdrawal',
          description:   'Estorno — plano reembolsado',
        });
      }

      // ── Reembolso avulsa ──────────────────────────────────────────────────────
      const { data: avulsa } = await supabase
        .from('avulsa_payments')
        .select('instructor_id, price')
        .eq('asaas_payment_id', paymentId)
        .maybeSingle();

      if (avulsa) {
        await supabase
          .from('avulsa_payments')
          .update({ status: 'refunded' })
          .eq('asaas_payment_id', paymentId);

        const { data: tx } = await supabase
          .from('wallet_transactions')
          .select('amount')
          .eq('type', 'credit')
          .ilike('description', '%avulsa%')
          .eq('instructor_id', avulsa.instructor_id)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        const refundAmount = tx?.amount || avulsa.price;

        await supabase.rpc('increment_instructor_wallet', {
          p_instructor_id: avulsa.instructor_id,
          p_amount: -refundAmount,
        });

        await supabase.from('wallet_transactions').insert({
          instructor_id: avulsa.instructor_id,
          amount:        -refundAmount,
          type:          'withdrawal',
          description:   'Estorno — aula avulsa reembolsada',
        });
      }
    }

    return new Response('OK', { status: 200 });
  } catch (err) {
    console.error('Webhook error:', err);
    return new Response('Internal Error', { status: 500 });
  }
});
