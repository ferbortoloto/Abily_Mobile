import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';


const ASAAS_API_KEY  = Deno.env.get('ASAAS_API_KEY')!;
const ASAAS_BASE_URL = Deno.env.get('ASAAS_ENV') === 'production'
  ? 'https://api.asaas.com/v3'
  : 'https://sandbox.asaas.com/api/v3';

const CORS = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// ---------- helpers ----------

async function asaas<T>(path: string, method = 'GET', body?: unknown): Promise<T> {
  const res = await fetch(`${ASAAS_BASE_URL}${path}`, {
    method,
    headers: { 'access_token': ASAAS_API_KEY, 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
  let data: unknown;
  try {
    data = await res.json();
  } catch {
    const text = await res.text().catch(() => '(vazio)');
    throw new Error(`Asaas ${method} ${path} [HTTP ${res.status}]: resposta inválida: ${text.slice(0, 300)}`);
  }
  if (!res.ok) throw new Error(`Asaas ${method} ${path} [${res.status}]: ${JSON.stringify(data)}`);
  return data as T;
}

async function getOrCreateCustomer(
  supabase: ReturnType<typeof createClient>,
  studentId: string,
  profile: Record<string, string>,
): Promise<string> {
  if (profile.asaas_customer_id) return profile.asaas_customer_id;

  const nameParts = (profile.name || '').trim().split(/\s+/).filter(Boolean);
  if (nameParts.length < 2) {
    throw new Error('Perfil incompleto: informe seu nome completo (nome e sobrenome) na aba Perfil antes de pagar.');
  }
  if (!profile.email?.trim()) {
    throw new Error('Perfil incompleto: e-mail não encontrado. Tente sair e entrar novamente no app.');
  }

  const cpfCnpj = profile.cpf ? profile.cpf.replace(/\D/g, '') : undefined;
  const mobilePhone = profile.phone ? profile.phone.replace(/\D/g, '') : undefined;

  const customer = await asaas<{ id: string }>('/customers', 'POST', {
    name:        profile.name,
    email:       profile.email,
    cpfCnpj,
    mobilePhone,
  });

  await supabase
    .from('profiles')
    .update({ asaas_customer_id: customer.id })
    .eq('id', studentId);

  return customer.id;
}

async function fetchPixData(paymentId: string) {
  const pix = await asaas<{ encodedImage: string; payload: string }>(
    `/payments/${paymentId}/pixQrCode`,
  );
  return { pixQrcode: pix.encodedImage, pixCopyPaste: pix.payload };
}

async function fetchBoletoBarcode(paymentId: string): Promise<string | null> {
  try {
    const boleto = await asaas<{ identificationField: string }>(
      `/payments/${paymentId}/identificationField`,
    );
    return boleto.identificationField;
  } catch {
    return null;
  }
}



// ---------- handler ----------

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    const body = await req.json() as {
      // plano
      plan_id?:          string;
      // avulsa (fluxo imediato — legado)
      avulsa?:           boolean;
      price?:            number;
      description?:      string;
      request_data?:     Record<string, unknown>;
      // avulsa pós-aceitação (novo fluxo)
      class_request_id?: string;
      // cartão de crédito (dados diretos, sem redirect)
      credit_card_data?: {
        holderName:  string;
        number:      string;
        expiryMonth: string;
        expiryYear:  string;
        ccv:         string;
      };
      // parcelamento (cartão de crédito apenas)
      installment_count?: number;
      // comum
      student_id:      string;
      instructor_id:   string;
      payment_method:  'pix' | 'boleto' | 'credit_card';
    };

    const { student_id, instructor_id, payment_method } = body;
    const isAvulsa = body.avulsa === true;

    // Fetch student profile
    const { data: profile, error: profileErr } = await supabase
      .from('profiles').select('*').eq('id', student_id).single();
    if (profileErr || !profile) throw new Error('Perfil não encontrado');

    const customerId = await getOrCreateCustomer(supabase, student_id, profile);

    const dueDate = new Date();
    if (payment_method !== 'credit_card') dueDate.setDate(dueDate.getDate() + 1);
    const dueDateStr = dueDate.toISOString().split('T')[0];

    const billingType =
      payment_method === 'pix'        ? 'PIX'         :
      payment_method === 'boleto'     ? 'BOLETO'      :
      /* credit_card */                 'CREDIT_CARD';

    // Monta campos extras para cartão de crédito tokenizado
    // Asaas CC tokenizado requer installmentCount + installmentValue (não usa value/dueDate)
    const installmentCount = (body.installment_count && body.installment_count > 1)
      ? body.installment_count
      : 1;

    // Ajuste de preço por forma de pagamento (idêntico ao frontend):
    // PIX → 3% de desconto
    // Cartão parcelado → +1% por parcela adicional (2x=+1%, 3x=+2%, …, 12x=+11%)
    const applyPricing = (base: number): number => {
      if (payment_method === 'pix')
        return Math.round(base * 0.97 * 100) / 100;
      if (payment_method === 'credit_card' && installmentCount > 1)
        return Math.round(base * (1 + (installmentCount - 1) * 0.01) * 100) / 100;
      return base;
    };

    const creditCardFields = (payment_method === 'credit_card' && body.credit_card_data)
      ? {
          creditCard: {
            holderName:  body.credit_card_data.holderName,
            number:      body.credit_card_data.number,
            expiryMonth: body.credit_card_data.expiryMonth,
            expiryYear:  body.credit_card_data.expiryYear,
            ccv:         body.credit_card_data.ccv,
          },
          creditCardHolderInfo: {
            name:          body.credit_card_data.name || profile.name,
            email:         body.credit_card_data.email || profile.email,
            cpfCnpj:       (body.credit_card_data.cpfCnpj || profile.cpf || '').replace(/\D/g, ''),
            phone:         (body.credit_card_data.phone || profile.phone || '').replace(/\D/g, ''),
            postalCode:    (body.credit_card_data.postalCode || profile.cep || '00000000').replace(/\D/g, ''),
            addressNumber: body.credit_card_data.addressNumber || profile.address_number || '0',
          },
          installmentCount,
        }
      : {};

    // Helper: monta body Asaas aplicando ajuste de preço por método
    const asaasBody = (basePrice: number, description: string) => {
      const fp = applyPricing(basePrice);
      return payment_method === 'credit_card'
        ? {
            customer:         customerId,
            billingType,
            description,
            dueDate:          dueDateStr,
            installmentValue: Math.round(fp / installmentCount * 100) / 100,
            ...creditCardFields,
          }
        : {
            customer:    customerId,
            billingType,
            value:       fp,
            dueDate:     dueDateStr,
            description,
            ...creditCardFields,
          };
    };

    // ── AVULSA PÓS-ACEITAÇÃO (novo fluxo) ────────────────────────────────────
    // Instrutor aceitou → cria pagamento e vincula à class_request existente
    if (body.class_request_id) {
      if (!body.price) throw new Error('price é obrigatório');

      const charge = await asaas<{
        id: string; status: string; invoiceUrl: string; bankSlipUrl: string | null;
      }>('/payments', 'POST', asaasBody(body.price, body.description || 'Aula avulsa'));

      if (payment_method === 'credit_card' && charge.status === 'DECLINED') {
        throw new Error('Cartão recusado. Verifique os dados e tente novamente.');
      }

      let pixQrcode: string | null = null;
      let pixCopyPaste: string | null = null;
      if (payment_method === 'pix') {
        ({ pixQrcode, pixCopyPaste } = await fetchPixData(charge.id));
      }
      const boletoBarcode = payment_method === 'boleto' ? await fetchBoletoBarcode(charge.id) : null;

      const isCcConfirmed =
        payment_method === 'credit_card' &&
        (charge.status === 'CONFIRMED' || charge.status === 'RECEIVED');

      const avulsaStatus = isCcConfirmed ? 'paid' : 'pending_payment';

      const { data: avulsa, error: avulsaErr } = await supabase
        .from('avulsa_payments')
        .insert({
          student_id,
          instructor_id,
          price:             applyPricing(body.price),
          asaas_payment_id:  charge.id,
          payment_method,
          status:            avulsaStatus,
          pix_qrcode:        pixQrcode,
          pix_copy_paste:    pixCopyPaste,
          boleto_url:        charge.bankSlipUrl || null,
          boleto_barcode:    boletoBarcode,
          invoice_url:       charge.invoiceUrl  || null,
          request_data:      null,
          class_request_id:  body.class_request_id,
        })
        .select()
        .single();
      if (avulsaErr) throw avulsaErr;

      // Marca class_request como aguardando pagamento (ou já pago para cartão)
      await supabase
        .from('class_requests')
        .update({ status: isCcConfirmed ? 'accepted' : 'awaiting_payment' })
        .eq('id', body.class_request_id);

      return new Response(
        JSON.stringify({
          avulsa_payment: avulsa,
          payment: {
            id:             charge.id,
            status:         charge.status,
            pix_qrcode:     pixQrcode,
            pix_copy_paste: pixCopyPaste,
            boleto_url:     charge.bankSlipUrl,
            boleto_barcode: boletoBarcode,
            invoice_url:    charge.invoiceUrl,
          },
        }),
        { headers: { ...CORS, 'Content-Type': 'application/json' } },
      );
    }

    // ── AVULSA (pré-pagamento: aluno paga → instrutor aceita/recusa) ──────────
    if (isAvulsa) {
      if (!body.price || !body.request_data) throw new Error('price e request_data são obrigatórios para aula avulsa');

      // 1. Cria class_request imediatamente com status 'awaiting_payment'
      const { data: classRequest, error: crErr } = await supabase
        .from('class_requests')
        .insert({
          ...(body.request_data as Record<string, unknown>),
          student_id,
          status: 'awaiting_payment',
        })
        .select()
        .single();
      if (crErr) throw crErr;

      // 2. Cria cobrança no Asaas
      const charge = await asaas<{
        id: string; status: string; invoiceUrl: string; bankSlipUrl: string | null;
      }>('/payments', 'POST', asaasBody(body.price, body.description || 'Aula avulsa'));

      if (payment_method === 'credit_card' && charge.status === 'DECLINED') {
        // Desfaz a class_request criada
        await supabase.from('class_requests').delete().eq('id', classRequest.id);
        throw new Error('Cartão recusado. Verifique os dados e tente novamente.');
      }

      let pixQrcode: string | null = null;
      let pixCopyPaste: string | null = null;
      if (payment_method === 'pix') {
        ({ pixQrcode, pixCopyPaste } = await fetchPixData(charge.id));
      }

      const isCcConfirmed =
        payment_method === 'credit_card' &&
        (charge.status === 'CONFIRMED' || charge.status === 'RECEIVED');

      // 3. Cria avulsa_payment vinculado à class_request
      const { data: avulsa, error: avulsaErr } = await supabase
        .from('avulsa_payments')
        .insert({
          student_id,
          instructor_id,
          price:            body.price,
          asaas_payment_id: charge.id,
          payment_method,
          status:           isCcConfirmed ? 'paid' : 'pending_payment',
          pix_qrcode:       pixQrcode,
          pix_copy_paste:   pixCopyPaste,
          invoice_url:      charge.invoiceUrl || null,
          class_request_id: classRequest.id,
        })
        .select()
        .single();
      if (avulsaErr) throw avulsaErr;

      // 4. Se CC confirmado instantaneamente → class_request vira 'pending'
      //    (aguarda aceite do instrutor — carteira só é creditada no aceite)
      if (isCcConfirmed) {
        await supabase
          .from('class_requests')
          .update({ status: 'pending' })
          .eq('id', classRequest.id);
      }

      return new Response(
        JSON.stringify({
          avulsa_payment:   avulsa,
          class_request_id: classRequest.id,
          payment: {
            id:             charge.id,
            status:         charge.status,
            pix_qrcode:     pixQrcode,
            pix_copy_paste: pixCopyPaste,
            invoice_url:    charge.invoiceUrl,
          },
        }),
        { headers: { ...CORS, 'Content-Type': 'application/json' } },
      );
    }

    // ── PLANO ─────────────────────────────────────────────────────────────────
    const { data: plan, error: planErr } = await supabase
      .from('plans').select('*').eq('id', body.plan_id).single();
    if (planErr || !plan) throw new Error('Plano não encontrado');

    const charge = await asaas<{
      id: string; status: string; invoiceUrl: string; bankSlipUrl: string | null; nossoNumero: string | null;
    }>('/payments', 'POST', asaasBody(plan.price, `Plano: ${plan.name} (${plan.class_count} aulas)`));

    // Cartão recusado
    if (payment_method === 'credit_card' && charge.status === 'DECLINED') {
      throw new Error('Cartão recusado. Verifique os dados e tente novamente.');
    }

    let pixQrcode: string | null = null;
    let pixCopyPaste: string | null = null;
    if (payment_method === 'pix') {
      ({ pixQrcode, pixCopyPaste } = await fetchPixData(charge.id));
    }
    const boletoBarcode = payment_method === 'boleto' ? await fetchBoletoBarcode(charge.id) : null;

    const isCcConfirmed =
      payment_method === 'credit_card' &&
      (charge.status === 'CONFIRMED' || charge.status === 'RECEIVED');

    const purchaseStatus = isCcConfirmed ? 'active' : 'pending_payment';

    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + plan.validity_days);

    const { data: purchase, error: insertErr } = await supabase
      .from('purchases')
      .insert({
        plan_id:           body.plan_id,
        student_id,
        instructor_id,
        price_paid:        applyPricing(plan.price),
        classes_total:     plan.class_count,
        classes_remaining: plan.class_count,
        expires_at:        expiresAt.toISOString(),
        status:            purchaseStatus,
        asaas_payment_id:  charge.id,
        payment_method,
        pix_qrcode:        pixQrcode,
        pix_copy_paste:    pixCopyPaste,
        boleto_url:        charge.bankSlipUrl  || null,
        boleto_barcode:    boletoBarcode       || null,
        invoice_url:       charge.invoiceUrl   || null,
      })
      .select()
      .single();
    if (insertErr) throw insertErr;

    return new Response(
      JSON.stringify({
        purchase,
        payment: {
          id:             charge.id,
          status:         charge.status,
          pix_qrcode:     pixQrcode,
          pix_copy_paste: pixCopyPaste,
          boleto_url:     charge.bankSlipUrl,
          boleto_barcode: boletoBarcode,
          invoice_url:    charge.invoiceUrl,
        },
      }),
      { headers: { ...CORS, 'Content-Type': 'application/json' } },
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: (err as Error).message }),
      { status: 400, headers: { ...CORS, 'Content-Type': 'application/json' } },
    );
  }
});
