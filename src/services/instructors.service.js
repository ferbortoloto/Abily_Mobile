import { supabase } from '../lib/supabase';

/**
 * Busca todos os instrutores ativos.
 */
export async function getInstructors() {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('role', 'instructor')
    .eq('is_accepting_requests', true)
    .order('rating', { ascending: false });
  if (error) throw error;
  return data;
}

/**
 * Busca um instrutor pelo ID.
 */
export async function getInstructorById(id) {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', id)
    .eq('role', 'instructor')
    .single();
  if (error) throw error;
  return data;
}

/**
 * Busca os slots de disponibilidade de um instrutor.
 * Retorna objeto { [dayOfWeek]: string[] }
 */
export async function getInstructorAvailability(instructorId) {
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
 * Busca slots já reservados (aceitos) de um instrutor a partir de hoje.
 * Retorna objeto { [dateStr: 'YYYY-MM-DD']: string[] }
 */
export async function getBookedSlotsByInstructor(instructorId) {
  const d = new Date();
  const todayStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

  const { data, error } = await supabase
    .from('class_requests')
    .select('requested_date, requested_slots')
    .eq('instructor_id', instructorId)
    .in('status', ['accepted', 'pending'])
    .gte('requested_date', todayStr);
  if (error) throw error;

  const map = {};
  for (const row of data || []) {
    if (!row.requested_date || !Array.isArray(row.requested_slots)) continue;
    if (!map[row.requested_date]) map[row.requested_date] = [];
    map[row.requested_date].push(...row.requested_slots);
  }
  return map;
}

/**
 * Busca as avaliações de um instrutor.
 */
export async function getReviews(instructorId) {
  const { data, error } = await supabase
    .from('reviews')
    .select('*, profiles!student_id(name, avatar_url)')
    .eq('instructor_id', instructorId)
    .eq('reviewer_role', 'student')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data;
}

/**
 * Cria uma avaliação de um aluno para um instrutor.
 */
export async function createReview({ instructorId, studentId, eventId, rating, comment }) {
  const { data, error } = await supabase
    .from('reviews')
    .insert({ instructor_id: instructorId, student_id: studentId, event_id: eventId || null, rating, comment })
    .select()
    .single();
  if (error) throw error;
  return data;
}

/**
 * Verifica se já existe avaliação para uma sessão/par instrutor-aluno.
 * reviewerRole: 'student' | 'instructor'
 */
export async function hasReviewedSession(instructorId, studentId, eventId, reviewerRole) {
  let query = supabase
    .from('reviews')
    .select('id', { count: 'exact', head: true })
    .eq('instructor_id', instructorId)
    .eq('student_id', studentId);

  if (eventId) query = query.eq('event_id', eventId);

  query = query.eq('reviewer_role', reviewerRole === 'instructor' ? 'instructor' : 'student');

  const { count } = await query;
  return (count ?? 0) > 0;
}

/**
 * Cria uma avaliação de um instrutor para um aluno.
 */
export async function createInstructorReview({ instructorId, studentId, eventId, rating, comment }) {
  const { data, error } = await supabase
    .from('reviews')
    .insert({ instructor_id: instructorId, student_id: studentId, event_id: eventId || null, rating, comment, reviewer_role: 'instructor' })
    .select()
    .single();
  if (error) throw error;
  return data;
}
