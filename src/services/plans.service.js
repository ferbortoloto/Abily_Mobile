import { supabase } from '../lib/supabase';

/**
 * Busca TODOS os planos de um instrutor (ativos e inativos).
 * Usado no dashboard do instrutor para gerenciar os próprios planos.
 */
export async function getPlansByInstructor(instructorId) {
  const { data, error } = await supabase
    .from('plans')
    .select('*')
    .eq('instructor_id', instructorId)
    .order('price', { ascending: true });
  if (error) throw error;
  return data;
}

/**
 * Busca apenas os planos ativos de um instrutor.
 * Usado na tela do aluno para exibir planos disponíveis para compra.
 */
export async function getActivePlansByInstructor(instructorId) {
  const { data, error } = await supabase
    .from('plans')
    .select('*')
    .eq('instructor_id', instructorId)
    .eq('is_active', true)
    .order('price', { ascending: true });
  if (error) throw error;
  return data;
}

/**
 * Cria um novo plano (pelo instrutor).
 */
export async function createPlan(planData) {
  const { data, error } = await supabase
    .from('plans')
    .insert(planData)
    .select()
    .single();
  if (error) throw error;
  return data;
}

/**
 * Atualiza um plano existente.
 */
export async function updatePlan(planId, fields) {
  const { data, error } = await supabase
    .from('plans')
    .update(fields)
    .eq('id', planId)
    .select()
    .single();
  if (error) throw error;
  return data;
}

/**
 * Desativa um plano (soft delete).
 */
export async function deactivatePlan(planId) {
  const { error } = await supabase
    .from('plans')
    .update({ is_active: false })
    .eq('id', planId);
  if (error) throw error;
}

/**
 * Registra a compra de um plano por um aluno.
 */
export async function purchasePlan({ planId, studentId, instructorId, plan }) {
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + plan.validity_days);

  const { data, error } = await supabase
    .from('purchases')
    .insert({
      plan_id: planId,
      student_id: studentId,
      instructor_id: instructorId,
      price_paid: plan.price,
      classes_total: plan.class_count,
      classes_remaining: plan.class_count,
      expires_at: expiresAt.toISOString(),
      status: 'active',
    })
    .select()
    .single();
  if (error) throw error;
  return data;
}

/**
 * Busca as compras ativas de um aluno.
 */
export async function getPurchasesByStudent(studentId) {
  const { data, error } = await supabase
    .from('purchases')
    .select('*, plans(*), profiles!instructor_id(name, avatar_url)')
    .eq('student_id', studentId)
    .eq('status', 'active')
    .order('purchased_at', { ascending: false });
  if (error) throw error;
  return data;
}

/**
 * Ativa ou desativa todos os planos de um instrutor de uma vez.
 * Usado ao pausar/reativar o instrutor.
 */
export async function setAllPlansActive(instructorId, isActive) {
  const { error } = await supabase
    .from('plans')
    .update({ is_active: isActive })
    .eq('instructor_id', instructorId);
  if (error) throw error;
}

/**
 * Decrementa uma aula do saldo de uma compra.
 */
export async function decrementClass(purchaseId, currentRemaining) {
  const newRemaining = currentRemaining - 1;
  const { data, error } = await supabase
    .from('purchases')
    .update({
      classes_remaining: newRemaining,
      status: newRemaining <= 0 ? 'expired' : 'active',
    })
    .eq('id', purchaseId)
    .select()
    .single();
  if (error) throw error;
  return data;
}
