import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const CORS = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

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

    const { session_id, reason } = await req.json() as {
      session_id: string;
      reason:     string;
    };

    // Verifica se a sessão existe e está ativa
    const { data: session, error: sessErr } = await supabase
      .from('sessions')
      .select('id, instructor_id, student_id')
      .eq('id', session_id)
      .eq('status', 'active')
      .single();

    if (sessErr || !session) {
      return new Response(
        JSON.stringify({ error: 'Sessão não encontrada ou já encerrada.' }),
        { status: 404, headers: { ...CORS, 'Content-Type': 'application/json' } },
      );
    }

    // Interrompe a sessão e restaura crédito de plano (se houver)
    const { error: rpcErr } = await supabase.rpc('interrupt_session', {
      p_session_id:    session_id,
      p_reason:        reason,
      p_refund_credit: true,
    });
    if (rpcErr) throw rpcErr;

    // Notifica o aluno para fazer a escolha (estornar ou reagendar)
    try {
      const { data: sp } = await supabase
        .from('profiles')
        .select('push_token')
        .eq('id', session.student_id)
        .single();

      const title = 'Aula interrompida por imprevisto';
      const body  = 'Seu instrutor precisou interromper a aula. Abra o app para escolher entre estornar o valor ou reagendar.';

      await supabase.from('notifications').insert({
        user_id: session.student_id,
        type:    'session_interrupted_pending',
        title,
        body,
        data:    { session_id, type: 'session_interrupted_pending' },
      });

      await sendPushNotification(sp?.push_token, title, body, {
        type:       'session_interrupted_pending',
        session_id,
      });
    } catch (e) {
      console.error('Notification error (non-blocking):', e);
    }

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
