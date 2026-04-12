import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const ASAAS_API_KEY  = Deno.env.get('ASAAS_API_KEY')!;
const ASAAS_BASE_URL = Deno.env.get('ASAAS_ENV') === 'production'
  ? 'https://api.asaas.com/api/v3'
  : 'https://sandbox.asaas.com/api/v3';

const MINIMUM_WITHDRAWAL = 20; // R$20 mínimo

const CORS = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Mapeamento de tipo de chave Pix para o formato da Asaas
const PIX_KEY_TYPE_MAP: Record<string, string> = {
  cpf:    'CPF',
  email:  'EMAIL',
  phone:  'PHONE',
  random: 'EVP',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    const body = await req.json() as {
      instructor_id: string;
      amount:        number;
      pix_type:      string;
      pix_key:       string;
    };

    const { instructor_id, amount, pix_type, pix_key } = body;

    // Validações básicas
    if (!instructor_id || !pix_key || !pix_type) {
      throw new Error('Dados incompletos.');
    }
    if (amount < MINIMUM_WITHDRAWAL) {
      throw new Error(`Valor mínimo para saque é R$ ${MINIMUM_WITHDRAWAL},00.`);
    }

    // Verifica saldo atual do instrutor
    const { data: profile } = await supabase
      .from('profiles')
      .select('wallet_balance, name')
      .eq('id', instructor_id)
      .single();

    if (!profile) throw new Error('Instrutor não encontrado.');
    if ((profile.wallet_balance || 0) < amount) {
      throw new Error('Saldo insuficiente.');
    }

    // Dispara transferência Pix via Asaas
    const pixKeyType = PIX_KEY_TYPE_MAP[pix_type] || 'CPF';

    // Asaas exige celular no formato E.164: +5511999999999
    let normalizedPixKey = pix_key;
    if (pix_type === 'phone') {
      const digits = pix_key.replace(/\D/g, '');
      normalizedPixKey = digits.startsWith('55') ? `+${digits}` : `+55${digits}`;
    }

    const transferRes = await fetch(`${ASAAS_BASE_URL}/transfers`, {
      method: 'POST',
      headers: {
        'access_token': ASAAS_API_KEY,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        value:              amount,
        pixAddressKey:      normalizedPixKey,
        pixAddressKeyType:  pixKeyType,
        description:        `Saque instrutor ${profile.name}`,
      }),
    });

    const transfer = await transferRes.json();
    if (!transferRes.ok) {
      throw new Error(`Asaas transfer error: ${JSON.stringify(transfer)}`);
    }

    // Debita o saldo da carteira
    await supabase.rpc('increment_instructor_wallet', {
      p_instructor_id: instructor_id,
      p_amount: -amount,
    });

    // Registra a transação
    await supabase.from('wallet_transactions').insert({
      instructor_id,
      amount:      -amount,
      type:        'withdrawal',
      description: `Saque via Pix (${pix_key})`,
    });

    // Registra o pedido de saque como processado
    await supabase.from('withdrawal_requests').insert({
      instructor_id,
      amount,
      bank_info:          { pix_type, pix_key },
      status:             'processing',
      asaas_transfer_id:  transfer.id,
    });

    return new Response(
      JSON.stringify({ success: true, transfer_id: transfer.id }),
      { headers: { ...CORS, 'Content-Type': 'application/json' } },
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: (err as Error).message }),
      { status: 400, headers: { ...CORS, 'Content-Type': 'application/json' } },
    );
  }
});
