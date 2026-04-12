/**
 * notify-expired-requests
 *
 * Chamada a cada 15 min pelo pg_cron.
 * Busca solicitações que expiraram desde a última execução,
 * envia push notification ao instrutor e marca expiry_notified_at.
 */
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const CORS = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';

// Janela: solicitações expiradas nos últimos 20 min ainda não notificadas
const WINDOW_MINUTES = 20;

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    const windowStart = new Date(Date.now() - WINDOW_MINUTES * 60_000).toISOString();

    // 1. Busca as requests expiradas recentemente e ainda não notificadas
    const { data: expired, error } = await supabase
      .from('class_requests')
      .select('id, instructor_id, student_id, type, profiles!student_id(name)')
      .eq('status', 'expired')
      .is('expiry_notified_at', null)
      .gte('expires_at', windowStart); // só as recentes (evita reprocessar antigas)

    if (error) throw error;
    if (!expired || expired.length === 0) {
      return new Response(JSON.stringify({ notified: 0 }), {
        status: 200, headers: { ...CORS, 'Content-Type': 'application/json' },
      });
    }

    // 2. Coleta push tokens dos instrutores
    const instructorIds = [...new Set(expired.map((r: any) => r.instructor_id))];
    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, name, push_token')
      .in('id', instructorIds);

    const profileMap = new Map((profiles ?? []).map((p: any) => [p.id, p]));

    // 3. Monta mensagens
    const messages: any[] = [];
    const notifiedIds: string[] = [];

    for (const req of expired as any[]) {
      const instructor = profileMap.get(req.instructor_id);
      const studentName = req.profiles?.name || 'Aluno';

      if (instructor?.push_token?.startsWith('ExponentPushToken')) {
        messages.push({
          to:       instructor.push_token,
          title:    '⏰ Solicitação expirada',
          body:     `A solicitação de ${studentName} expirou sem resposta e foi removida automaticamente.`,
          data:     { type: 'request_expired', request_id: req.id },
          sound:    'default',
          priority: 'high',
        });
      }
      notifiedIds.push(req.id);
    }

    // 4. Envia push notifications
    if (messages.length > 0) {
      await fetch(EXPO_PUSH_URL, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body:    JSON.stringify(messages),
      });
    }

    // 5. Marca como notificadas
    if (notifiedIds.length > 0) {
      await supabase
        .from('class_requests')
        .update({ expiry_notified_at: new Date().toISOString() })
        .in('id', notifiedIds);
    }

    return new Response(
      JSON.stringify({ notified: notifiedIds.length }),
      { status: 200, headers: { ...CORS, 'Content-Type': 'application/json' } },
    );
  } catch (err) {
    console.error('notify-expired-requests error:', err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500, headers: { ...CORS, 'Content-Type': 'application/json' },
    });
  }
});
