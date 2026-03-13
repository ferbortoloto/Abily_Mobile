import { supabase } from '../lib/supabase';

/**
 * Busca todos os eventos de um instrutor.
 */
export async function getEventsByInstructor(instructorId) {
  const { data, error } = await supabase
    .from('events')
    .select('*')
    .eq('instructor_id', instructorId)
    .order('start_datetime', { ascending: true });
  if (error) throw error;
  return data;
}

/**
 * Busca todos os eventos de um aluno.
 */
export async function getEventsByStudent(studentId) {
  const { data, error } = await supabase
    .from('events')
    .select('*')
    .eq('student_id', studentId)
    .order('start_datetime', { ascending: true });
  if (error) throw error;
  return data;
}

/**
 * Cria um novo evento.
 */
export async function createEvent(eventData) {
  const { data, error } = await supabase
    .from('events')
    .insert(eventData)
    .select()
    .single();
  if (error) throw error;
  return data;
}

/**
 * Atualiza um evento existente.
 */
export async function updateEvent(eventId, fields) {
  const { data, error } = await supabase
    .from('events')
    .update(fields)
    .eq('id', eventId)
    .select()
    .single();
  if (error) throw error;
  return data;
}

/**
 * Deleta um evento.
 */
export async function deleteEvent(eventId) {
  const { error } = await supabase
    .from('events')
    .delete()
    .eq('id', eventId);
  if (error) throw error;
}

// ─── AVAILABILITY ────────────────────────────────────────────

/**
 * Busca os slots de disponibilidade de um instrutor.
 * Retorna objeto { [dayOfWeek]: ['08:00', '08:30', ...] }
 */
export async function getAvailability(instructorId) {
  const { data, error } = await supabase
    .from('availability')
    .select('day_of_week, time_slot')
    .eq('instructor_id', instructorId);
  if (error) throw error;

  return data.reduce((acc, row) => {
    if (!acc[row.day_of_week]) acc[row.day_of_week] = [];
    acc[row.day_of_week].push(row.time_slot);
    return acc;
  }, {});
}

/**
 * Salva a disponibilidade completa de um instrutor.
 * Apaga os slots antigos e insere os novos.
 * @param {string} instructorId
 * @param {{ [dayOfWeek]: string[] }} availability - ex: { 1: ['08:00','09:00'], 2: [] }
 */
export async function saveAvailability(instructorId, availability) {
  const { error: deleteError } = await supabase
    .from('availability')
    .delete()
    .eq('instructor_id', instructorId);
  if (deleteError) throw deleteError;

  const rows = [];
  for (const [day, slots] of Object.entries(availability)) {
    for (const slot of slots) {
      rows.push({ instructor_id: instructorId, day_of_week: parseInt(day), time_slot: slot });
    }
  }

  if (rows.length === 0) return;

  const { error: insertError } = await supabase.from('availability').insert(rows);
  if (insertError) throw insertError;
}

// ─── CLASS REQUESTS ──────────────────────────────────────────

/**
 * Busca os pedidos de aula pendentes para um instrutor.
 */
export async function getRequestsByInstructor(instructorId) {
  const { data, error } = await supabase
    .from('class_requests')
    .select('*, profiles!student_id(name, avatar_url, phone, address, coordinates, rating), purchases(classes_total, classes_remaining, plans(name))')
    .eq('instructor_id', instructorId)
    .in('status', ['pending', 'accepted'])
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data;
}

/**
 * Busca os pedidos de aula de um aluno.
 */
export async function getRequestsByStudent(studentId) {
  const { data, error } = await supabase
    .from('class_requests')
    .select('*, profiles!instructor_id(name, avatar_url)')
    .eq('student_id', studentId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data;
}

/**
 * Cria um pedido de aula (aluno → instrutor).
 */
export async function createRequest(requestData) {
  const { data, error } = await supabase
    .from('class_requests')
    .insert(requestData)
    .select()
    .single();
  if (error) throw error;
  return data;
}

/**
 * Atualiza o status de um pedido ('accepted' ou 'rejected').
 */
export async function updateRequestStatus(requestId, status) {
  const { data, error } = await supabase
    .from('class_requests')
    .update({ status })
    .eq('id', requestId)
    .select()
    .single();
  if (error) throw error;
  return data;
}
