import React, { createContext, useContext, useState, useCallback, useEffect, useRef } from 'react';
import { useAuth } from '../hooks/useAuth';
import { logger } from '../utils/logger';
import { supabase } from '../lib/supabase';
import {
  getPlansByInstructor,
  getActivePlansByInstructor,
  createPlan as createPlanService,
  updatePlan as updatePlanService,
  deactivatePlan as deactivatePlanService,
  purchasePlan as purchasePlanService,
  getPurchasesByStudent,
  getPurchasesByInstructor,
  setAllPlansActive as setAllPlansActiveService,
  requestRefund as requestRefundService,
} from '../services/plans.service';

const PlansContext = createContext(null);

// Mapeia registro do banco (snake_case) para formato do app (camelCase)
const toAppPlan = (p) => ({
  id: p.id,
  instructorId: p.instructor_id,
  name: p.name,
  description: p.description || '',
  classCount: p.class_count,
  classType: p.class_type,
  price: p.price,
  validityDays: p.validity_days,
  isActive: p.is_active,
  purchasedBy: p.purchased_by || 0,
});

export function PlansProvider({ children }) {
  const { user, isAuthenticated } = useAuth();
  const [plansByInstructor, setPlansByInstructor] = useState({});
  const [purchases, setPurchases] = useState([]);
  const [purchasesLoading, setPurchasesLoading] = useState(true);
  const [instructorPurchases, setInstructorPurchases] = useState([]);
  const channelRef = useRef(null);

  useEffect(() => {
    if (!isAuthenticated || !user) {
      setPlansByInstructor({});
      setPurchases([]);
      setPurchasesLoading(true);
      if (channelRef.current) { supabase.removeChannel(channelRef.current); channelRef.current = null; }
      return;
    }
    if (user.role === 'instructor') {
      loadPlansForInstructor(user.id);
      loadInstructorPurchases(user.id);
    } else {
      loadPurchases();
      // Realtime: atualiza contador de aulas quando o instrutor aceita a solicitação
      const channel = supabase
        .channel(`purchases_${user.id}`)
        .on('postgres_changes', {
          event: 'UPDATE',
          schema: 'public',
          table: 'purchases',
          filter: `student_id=eq.${user.id}`,
        }, (payload) => {
          setPurchases(prev => prev.map(p =>
            p.id === payload.new.id ? { ...p, ...payload.new } : p
          ));
        })
        .subscribe();
      channelRef.current = channel;
    }
    return () => {
      if (channelRef.current) { supabase.removeChannel(channelRef.current); channelRef.current = null; }
    };
  }, [isAuthenticated, user?.id]);

  const loadInstructorPurchases = useCallback(async (instructorId) => {
    try {
      const data = await getPurchasesByInstructor(instructorId);
      setInstructorPurchases(data);
    } catch (error) {
      logger.error('Erro ao carregar pacotes dos alunos:', error.message);
    }
  }, []);

  const loadPlansForInstructor = useCallback(async (instructorId) => {
    try {
      const data = await getPlansByInstructor(instructorId);
      setPlansByInstructor(prev => ({ ...prev, [instructorId]: data.map(toAppPlan) }));
    } catch (error) {
      logger.error('Erro ao carregar planos:', error.message);
    }
  }, []);

  const loadPurchases = useCallback(async () => {
    if (!user) return;
    setPurchasesLoading(true);
    try {
      const data = await getPurchasesByStudent(user.id, ['active', 'refund_requested']);
      setPurchases(data);
    } catch (error) {
      logger.error('Erro ao carregar compras:', error.message);
    } finally {
      setPurchasesLoading(false);
    }
  }, [user]);

  const addPlan = useCallback(async (planData) => {
    if (!user) return null;
    try {
      const plan = await createPlanService({
        instructor_id: user.id,
        name: planData.name,
        description: planData.description || null,
        class_count: planData.classCount,
        class_type: planData.classType,
        price: planData.price,
        validity_days: planData.validityDays,
        is_active: true,
      });
      const appPlan = toAppPlan(plan);
      setPlansByInstructor(prev => ({
        ...prev,
        [user.id]: [...(prev[user.id] || []), appPlan],
      }));
      return appPlan;
    } catch (error) {
      logger.error('Erro ao criar plano:', error.message);
      throw error;
    }
  }, [user]);

  const updatePlan = useCallback(async (planData) => {
    try {
      const { id } = planData;
      const updated = await updatePlanService(id, {
        name: planData.name,
        description: planData.description || null,
        class_count: planData.classCount,
        class_type: planData.classType,
        price: planData.price,
        validity_days: planData.validityDays,
      });
      const appPlan = toAppPlan(updated);
      const iid = updated.instructor_id;
      setPlansByInstructor(prev => ({
        ...prev,
        [iid]: (prev[iid] || []).map(p => p.id === id ? appPlan : p),
      }));
    } catch (error) {
      logger.error('Erro ao atualizar plano:', error.message);
      throw error;
    }
  }, []);

  const togglePlan = useCallback(async (planId) => {
    if (!user) return;
    const plans = plansByInstructor[user.id] || [];
    const plan = plans.find(p => p.id === planId);
    if (!plan) return;
    try {
      if (plan.isActive) {
        await deactivatePlanService(planId);
        setPlansByInstructor(prev => ({
          ...prev,
          [user.id]: (prev[user.id] || []).map(p =>
            p.id === planId ? { ...p, isActive: false } : p
          ),
        }));
      } else {
        const updated = await updatePlanService(planId, { is_active: true });
        setPlansByInstructor(prev => ({
          ...prev,
          [user.id]: (prev[user.id] || []).map(p =>
            p.id === planId ? toAppPlan(updated) : p
          ),
        }));
      }
    } catch (error) {
      logger.error('Erro ao alternar plano:', error.message);
      throw error;
    }
  }, [user, plansByInstructor]);

  const purchasePlan = useCallback(async ({ plan, instructor, paymentMethod }) => {
    if (!user) return null;
    try {
      const purchase = await purchasePlanService({
        planId: plan.id,
        studentId: user.id,
        instructorId: instructor.id,
        plan: {
          price: plan.price,
          validity_days: plan.validityDays,
          class_count: plan.classCount,
        },
      });
      setPurchases(prev => [purchase, ...prev]);
      return purchase;
    } catch (error) {
      logger.error('Erro ao comprar plano:', error.message);
      throw error;
    }
  }, [user]);

  const requestRefund = useCallback(async (purchaseId) => {
    if (!user) return;
    await requestRefundService(purchaseId, user.id);
    setPurchases(prev => prev.map(p =>
      p.id === purchaseId ? { ...p, status: 'refund_requested', refund_requested_at: new Date().toISOString() } : p
    ));
  }, [user]);

  const pauseAllPlans = useCallback(async () => {
    if (!user) return;
    await setAllPlansActiveService(user.id, false);
    setPlansByInstructor(prev => ({
      ...prev,
      [user.id]: (prev[user.id] || []).map(p => ({ ...p, isActive: false })),
    }));
  }, [user]);

  const resumeAllPlans = useCallback(async () => {
    if (!user) return;
    await setAllPlansActiveService(user.id, true);
    // Recarrega do banco para pegar o estado atualizado
    await loadPlansForInstructor(user.id);
  }, [user, loadPlansForInstructor]);

  // Retorna planos de um instrutor; carrega do banco se não está em cache
  const getInstructorPlans = useCallback((instructorId) => {
    if (!plansByInstructor[instructorId]) {
      loadPlansForInstructor(instructorId);
      return [];
    }
    return plansByInstructor[instructorId] || [];
  }, [plansByInstructor, loadPlansForInstructor]);

  const getActivePlans = useCallback((instructorId) => {
    if (!plansByInstructor[instructorId]) {
      loadPlansForInstructor(instructorId);
      return [];
    }
    return (plansByInstructor[instructorId] || []).filter(p => p.isActive);
  }, [plansByInstructor, loadPlansForInstructor]);

  return (
    <PlansContext.Provider value={{
      instructorPlans: plansByInstructor[user?.id] || [],
      purchases,
      purchasesLoading,
      loadPurchases,
      addPlan,
      updatePlan,
      togglePlan,
      purchasePlan,
      getInstructorPlans,
      getActivePlans,
      requestRefund,
      instructorPurchases,
      loadInstructorPurchases,
      getUserPurchases: () => purchases,
      loadPlansForInstructor,
      pauseAllPlans,
      resumeAllPlans,
    }}>
      {children}
    </PlansContext.Provider>
  );
}

export function usePlans() {
  const ctx = useContext(PlansContext);
  if (!ctx) throw new Error('usePlans must be used inside PlansProvider');
  return ctx;
}
