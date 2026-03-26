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
export async function createSession({ eventId, instructorId, studentId, durationMinutes }) {
  const code = generateSessionCode();

  const { data, error } = await supabase
    .from('sessions')
    .insert({
      event_id: eventId || null,
      instructor_id: instructorId,
      student_id: studentId,
      code,
      duration_minutes: durationMinutes || 60,
      status: 'pending',
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
 */
export async function getPendingSessionForStudent(studentId) {
  const { data, error } = await supabase
    .from('sessions')
    .select('*')
    .eq('student_id', studentId)
    .eq('status', 'pending')
    .order('created_at', { ascending: false })
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
