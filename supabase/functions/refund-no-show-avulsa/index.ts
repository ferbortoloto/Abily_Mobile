/**
 * refund-no-show-avulsa
 *
 * Chamada a cada 5 min via pg_cron.
 * Busca sessões marcadas como instructor_no_show ou missed onde
 * a aula era avulsa (purchase_id IS NULL) e o pagamento ainda não
 * foi estornado. Emite o estorno no Asaas e notifica o aluno.
 */
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const ASAAS_API_KEY  = Deno.env.get('ASAAS_API_KEY')!;
const ASAAS_BASE_URL = Deno.env.get('ASAAS_ENV') === 'production'
  ? 'https://api.asaas.com/api/v3'
  : 'https://sandbox.asaas.com/api/v3';

const CORS = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

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

    // Busca sessões no-show que têm pagamento avulsa ainda não estornado.
    // Match por instructor_id + student_id entre sessions e avulsa_payments.
    // Filtra avulsa_payments.status = 'paid' para evitar reprocessar estornos já feitos.
    const { data: candidates, error: queryErr } = await supabase.rpc(
      'get_avulsa_no_show_refunds',
    );

    if (queryErr) throw queryErr;
    if (!candidates || candidates.length === 0) {
      return new Response(JSON.stringify({ processed: 0 }), {
        headers: { ...CORS, 'Content-Type': 'application/json' },
      });
    }

    let processed = 0;

    for (const row of candidates as Array<{
      avulsa_payment_id: string;
      asaas_payment_id:  string | null;
      student_id:        string;
      push_token:        string | null;
      session_status:    string;
    }>) {
      try {
        // Estorna no Asaas (apenas se havia cobrança registrada)
        if (row.asaas_payment_id) {
          await refundAsaasPayment(row.asaas_payment_id);
        }

        // Marca como estornado no banco
        await supabase
          .from('avulsa_payments')
          .update({ status: 'refunded' })
          .eq('id', row.avulsa_payment_id);

        // Notificação para o aluno
        const isInstructorNoShow = row.session_status === 'instructor_no_show';
        const title = isInstructorNoShow
          ? 'Instrutor não compareceu'
          : 'Aula não realizada';
        const body  = isInstructorNoShow
          ? 'Seu instrutor não apareceu. O valor da aula avulsa foi estornado automaticamente.'
          : 'A aula não foi realizada. O valor foi estornado automaticamente.';

        await supabase.from('notifications').insert({
          user_id: row.student_id,
          type:    'class_refunded',
          title,
          body,
          data:    { avulsa_payment_id: row.avulsa_payment_id },
        });

        if (row.push_token?.startsWith('ExponentPushToken')) {
          await fetch('https://exp.host/--/api/v2/push/send', {
            method:  'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              to:       row.push_token,
              title:    `💰 ${title}`,
              body,
              sound:    'default',
              priority: 'high',
              data:     { type: 'class_refunded' },
            }),
          });
        }

        processed++;
      } catch (err) {
        console.error(`Erro ao processar avulsa_payment ${row.avulsa_payment_id}:`, err);
        // Continua para os próximos — falha isolada não para o lote
      }
    }

    return new Response(JSON.stringify({ processed }), {
      headers: { ...CORS, 'Content-Type': 'application/json' },
    });

  } catch (err) {
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 500,
      headers: { ...CORS, 'Content-Type': 'application/json' },
    });
  }
});
