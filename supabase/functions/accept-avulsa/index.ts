import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const CORS = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function getPlatformFeePct(pricePerHour: number): number {
  if (pricePerHour <= 60)  return 0.20;
  if (pricePerHour <= 80)  return 0.15;
  if (pricePerHour <= 100) return 0.12;
  return 0.10;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    const { class_request_id, instructor_id } = await req.json() as {
      class_request_id: string;
      instructor_id:    string;
    };

    // Busca o pagamento vinculado à solicitação
    const { data: avulsa, error: avulsaErr } = await supabase
      .from('avulsa_payments')
      .select('id, price, status')
      .eq('class_request_id', class_request_id)
      .maybeSingle();

    if (avulsaErr || !avulsa) {
      return new Response(JSON.stringify({ error: 'Pagamento não encontrado.' }), {
        status: 404, headers: { ...CORS, 'Content-Type': 'application/json' },
      });
    }

    if (avulsa.status !== 'paid') {
      return new Response(JSON.stringify({ error: 'Pagamento ainda não confirmado pelo aluno.' }), {
        status: 400, headers: { ...CORS, 'Content-Type': 'application/json' },
      });
    }

    // Busca taxa do instrutor com base no preço/hora
    const { data: profile } = await supabase
      .from('profiles')
      .select('price_per_hour')
      .eq('id', instructor_id)
      .single();

    const pricePerHour = (profile as Record<string, number>)?.price_per_hour || 80;
    const feePct       = getPlatformFeePct(pricePerHour);
    const grossAmount  = avulsa.price;
    const platformFee  = Math.round(grossAmount * feePct * 100) / 100;
    const netAmount    = Math.round((grossAmount - platformFee) * 100) / 100;

    // Aceita a solicitação
    await supabase
      .from('class_requests')
      .update({ status: 'accepted' })
      .eq('id', class_request_id);

    // Credita carteira do instrutor
    await supabase.rpc('increment_instructor_wallet', {
      p_instructor_id: instructor_id,
      p_amount: netAmount,
    });

    await supabase.from('wallet_transactions').insert({
      instructor_id: instructor_id,
      amount:        netAmount,
      gross_amount:  grossAmount,
      platform_fee:  platformFee,
      fee_pct:       feePct * 100,
      type:          'credit',
      description:   'Aula avulsa',
      reference_id:  avulsa.id,
    });

    return new Response(
      JSON.stringify({ success: true, net_amount: netAmount }),
      { headers: { ...CORS, 'Content-Type': 'application/json' } },
    );
  } catch (err) {
    console.error('accept-avulsa error:', err);
    return new Response(
      JSON.stringify({ error: (err as Error).message }),
      { status: 500, headers: { ...CORS, 'Content-Type': 'application/json' } },
    );
  }
});
