import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';
const REMINDER_MINUTES = 15; // avisar X minutos antes

interface Event {
  id: string;
  title: string;
  instructor_id: string;
  student_id: string | null;
  start_datetime: string;
}

interface Profile {
  id: string;
  name: string;
  push_token: string | null;
}

interface ExpoPushMessage {
  to: string;
  title: string;
  body: string;
  data?: Record<string, unknown>;
  sound?: 'default';
  priority?: 'high';
}

Deno.serve(async () => {
  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    const now = new Date();
    const windowStart = new Date(now.getTime() + (REMINDER_MINUTES - 2) * 60_000);
    const windowEnd   = new Date(now.getTime() + (REMINDER_MINUTES + 3) * 60_000);

    // Busca eventos agendados que começam dentro da janela e ainda não foram notificados
    const { data: events, error } = await supabase
      .from('events')
      .select('id, title, instructor_id, student_id, start_datetime')
      .eq('status', 'scheduled')
      .is('reminder_sent_at', null)
      .gte('start_datetime', windowStart.toISOString())
      .lte('start_datetime', windowEnd.toISOString());

    if (error) throw error;
    if (!events || events.length === 0) {
      return new Response(JSON.stringify({ sent: 0 }), { status: 200 });
    }

    // Coleta todos os IDs de usuários envolvidos
    const userIds = new Set<string>();
    (events as Event[]).forEach(e => {
      userIds.add(e.instructor_id);
      if (e.student_id) userIds.add(e.student_id);
    });

    // Busca perfis (nome + push token)
    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, name, push_token')
      .in('id', [...userIds]);

    const profileMap = new Map<string, Profile>();
    (profiles ?? []).forEach((p: Profile) => profileMap.set(p.id, p));

    const messages: ExpoPushMessage[] = [];
    const notifiedEventIds: string[] = [];

    for (const event of events as Event[]) {
      const startTime = new Date(event.start_datetime)
        .toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', timeZone: 'America/Sao_Paulo' });

      const instructor = profileMap.get(event.instructor_id);
      const student    = event.student_id ? profileMap.get(event.student_id) : null;

      // Notificação para o instrutor
      if (instructor?.push_token?.startsWith('ExponentPushToken')) {
        messages.push({
          to:       instructor.push_token,
          title:    '🏎️ Sua aula começa em breve!',
          body:     `"${event.title}" começa às ${startTime}${student ? ` com ${student.name}` : ''}.`,
          data:     { type: 'class_reminder', eventId: event.id, role: 'instructor' },
          sound:    'default',
          priority: 'high',
        });
      }

      // Notificação para o aluno
      if (student?.push_token?.startsWith('ExponentPushToken')) {
        messages.push({
          to:       student.push_token,
          title:    '🏎️ Sua aula começa em breve!',
          body:     `"${event.title}" começa às ${startTime} com ${instructor?.name ?? 'seu instrutor'}.`,
          data:     { type: 'class_reminder', eventId: event.id, role: 'student' },
          sound:    'default',
          priority: 'high',
        });
      }

      notifiedEventIds.push(event.id);
    }

    // Envia todas as notificações em batch para a API do Expo
    if (messages.length > 0) {
      await fetch(EXPO_PUSH_URL, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
        body:    JSON.stringify(messages),
      });
    }

    // Marca eventos como notificados para não enviar de novo
    if (notifiedEventIds.length > 0) {
      await supabase
        .from('events')
        .update({ reminder_sent_at: now.toISOString() })
        .in('id', notifiedEventIds);
    }

    return new Response(
      JSON.stringify({ sent: messages.length, events: notifiedEventIds.length }),
      { status: 200 },
    );
  } catch (err) {
    console.error('send-class-reminders error:', err);
    return new Response(JSON.stringify({ error: String(err) }), { status: 500 });
  }
});
