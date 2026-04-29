import { supabase } from '../lib/supabase';

/**
 * Gera um código de sessão de 6 dígitos criptograficamente seguro.
 * Usa crypto.getRandomValues() (disponível no Hermes/React Native ≥ 0.71).
 * Fallback para Math.random() em ambientes sem suporte (não deve ocorrer no Expo 52).
 */
function generateSessionCode() {
  let n;
  if (typeof crypto !== 'undefined' && typeof crypto.getRandomValues === 'function') {
    const buf = new Uint32Array(1);
    crypto.getRandomValues(buf);
    n = 100000 + (buf[0] % 900000);
  } else {
    n = Math.floor(100000 + Math.random() * 900000);
  }
  return String(n).padStart(6, '0');
}

/**
 * Cria uma sessão pendente com código de 6 dígitos.
 */
// Minutos de antecedência permitidos para iniciar a sessão antes do horário agendado
const EARLY_START_MINUTES = 30;

export async function createSession({ eventId, instructorId, studentId, durationMinutes, scheduledStartAt }) {
  const code = generateSessionCode();

  const { data, error } = await supabase
    .from('sessions')
    .insert({
      event_id: eventId || null,
      instructor_id: instructorId,
      student_id: studentId,
      code,
      duration_minutes: durationMinutes || 50,
      status: 'pending',
      scheduled_start_at: scheduledStartAt || null,
    })
    .select()
    .single();
  if (error) throw error;
  return data;
}

/**
 * Busca a sessão pendente de um instrutor (para mostrar o código gerado).
 */
export async function getPendingSession(instructorId) {
  const { data, error } = await supabase
    .from('sessions')
    .select('*')
    .eq('instructor_id', instructorId)
    .eq('status', 'pending')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data;
}

/**
 * Busca a sessão pendente de um aluno (para mostrar o código gerado pelo instrutor).
 * Retorna a sessão com horário agendado mais próximo; sessões sem horário vêm por último.
 */
export async function getPendingSessionForStudent(studentId) {
  const { data, error } = await supabase
    .from('sessions')
    .select('*')
    .eq('student_id', studentId)
    .eq('status', 'pending')
    .order('scheduled_start_at', { ascending: true, nullsFirst: false })
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data;
}

/**
 * Inicia a sessão usando o código de 6 dígitos.
 * - Instrutor entra com o código que o aluno mostra na tela
 * - Valida por instructor_id (para instrutor) ou student_id (para aluno)
 * Retorna a sessão ativada ou null se o código for inválido.
 */
export async function startSessionByCode(code, userId, role) {
  const idField = role === 'instructor' ? 'instructor_id' : 'student_id';
  const normalizedCode = String(code).replace(/\s/g, '').padStart(6, '0');
  const { data: session, error: findError } = await supabase
    .from('sessions')
    .select('*')
    .eq('code', normalizedCode)
    .eq('status', 'pending')
    .eq(idField, userId)
    .maybeSingle();
  if (findError) throw findError;
  if (!session) return null;

  // Valida janela de horário: ±30 min do horário agendado
  if (session.scheduled_start_at) {
    const scheduledStart = new Date(session.scheduled_start_at);
    const now = new Date();
    const fmt = (d) => d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    const earlyLimit = new Date(scheduledStart.getTime() - EARLY_START_MINUTES * 60 * 1000);
    const lateLimit  = new Date(scheduledStart.getTime() + EARLY_START_MINUTES * 60 * 1000);

    if (now < earlyLimit) {
      throw new Error(`TOO_EARLY|${fmt(scheduledStart)}|${fmt(earlyLimit)}`);
    }

    if (now > lateLimit) {
      // Não marca aqui — detect_no_shows (pg_cron) classifica automaticamente aos 15 min
      throw new Error(`TOO_LATE|${fmt(scheduledStart)}`);
    }
  }

  const { data, error } = await supabase
    .from('sessions')
    .update({ status: 'active', started_at: new Date().toISOString() })
    .eq('id', session.id)
    .select()
    .single();
  if (error) throw error;
  return data;
}

/**
 * Encerra uma sessão ativa.
 */
/**
 * Busca nome do instrutor e do aluno de uma sessão.
 */
export async function getSessionProfiles(instructorId, studentId) {
  const { data } = await supabase
    .from('profiles')
    .select('id, name')
    .in('id', [instructorId, studentId]);
  if (!data) return {};
  const byId = Object.fromEntries(data.map(p => [p.id, p.name]));
  return {
    instructorName: byId[instructorId] || null,
    studentName: byId[studentId] || null,
  };
}

export async function endSession(sessionId) {
  const { data, error } = await supabase
    .from('sessions')
    .update({ status: 'completed', ended_at: new Date().toISOString() })
    .eq('id', sessionId)
    .select()
    .single();
  if (error) throw error;
  return data;
}

/**
 * Escuta mudanças de status numa sessão (Realtime).
 * - Instrutor: filtra por instructor_id para detectar quando o aluno entrou
 * - Aluno: filtra por student_id para detectar quando o instrutor gerou o código
 * Retorna função de unsubscribe.
 */
/**
 * Busca a sessão pendente vinculada a um evento (para o PreClassCard).
 */
export async function getSessionForEvent(eventId) {
  const { data, error } = await supabase
    .from('sessions')
    .select('id, instructor_checked_in_at, student_checked_in_at, status')
    .eq('event_id', eventId)
    .eq('status', 'pending')
    .maybeSingle();
  if (error) throw error;
  return data;
}

/**
 * Confirma presença do instrutor ou chegada do aluno antes da aula.
 * role: 'instructor' | 'student'
 */
export async function confirmPresence(sessionId, role) {
  const field = role === 'instructor' ? 'instructor_checked_in_at' : 'student_checked_in_at';
  const { data, error } = await supabase
    .from('sessions')
    .update({ [field]: new Date().toISOString() })
    .eq('id', sessionId)
    .eq('status', 'pending')
    .select()
    .single();
  if (error) throw error;
  return data;
}

/**
 * Registra interrupção de emergência durante a aula (chamado pelo instrutor).
 * A escolha de estornar ou reagendar fica a cargo do aluno via resolveInterruptedSession.
 */
export async function reportIncident(sessionId, reason) {
  const { data, error } = await supabase.functions.invoke('interrupt-session', {
    body: { session_id: sessionId, reason },
  });
  if (error) throw error;
  return data;
}

/**
 * Busca sessão interrompida pendente de resolução pelo aluno.
 */
export async function getInterruptedSessionForStudent(studentId) {
  const { data, error } = await supabase
    .from('sessions')
    .select(`
      id, instructor_id, student_id, incident_reason, ended_at,
      profiles!instructor_id ( name )
    `)
    .eq('student_id', studentId)
    .eq('status', 'interrupted')
    .is('student_resolution', null)
    .order('ended_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data;
}

/**
 * Registra a escolha do aluno para sessão interrompida.
 * action: 'refund' → estorna valor (R$5 taxa Asaas para avulsas)
 * action: 'reschedule' → permite reagendamento sem custo adicional
 */
export async function resolveInterruptedSession(sessionId, action, studentId) {
  const { data, error } = await supabase.functions.invoke('resolve-session', {
    body: { session_id: sessionId, action, student_id: studentId },
  });
  if (error) throw error;
  return data;
}

/**
 * Busca o histórico de aulas de um aluno (todas exceto pending/active).
 */
export async function getStudentClassHistory(studentId) {
  const { data, error } = await supabase
    .from('sessions')
    .select(`
      id, status, scheduled_start_at, started_at, ended_at,
      duration_minutes, incident_reason, credit_refunded,
      instructor_id,
      profiles!instructor_id ( name, avatar_url )
    `)
    .eq('student_id', studentId)
    .not('status', 'in', '(pending,active)')
    .order('scheduled_start_at', { ascending: false, nullsFirst: false })
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export function subscribeToSession(userId, role, onUpdate) {
  const filterField = role === 'instructor' ? 'instructor_id' : 'student_id';
  const channel = supabase
    .channel(`session:${role}:${userId}`)
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'sessions',
        filter: `${filterField}=eq.${userId}`,
      },
      (payload) => onUpdate(payload.new)
    )
    .subscribe();

  return () => supabase.removeChannel(channel);
}
