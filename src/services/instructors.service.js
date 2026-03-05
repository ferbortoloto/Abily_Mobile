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
 * Busca as avaliações de um instrutor.
 */
export async function getReviews(instructorId) {
  const { data, error } = await supabase
    .from('reviews')
    .select('*, profiles!student_id(name, avatar_url)')
    .eq('instructor_id', instructorId)
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
