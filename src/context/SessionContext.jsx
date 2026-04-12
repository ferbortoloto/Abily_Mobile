import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';
import { useAuth } from '../hooks/useAuth';
import { logger } from '../utils/logger';
import {
  createSession,
  getPendingSession,
  getPendingSessionForStudent,
  startSessionByCode,
  endSession,
  reportIncident,
  subscribeToSession,
  getSessionProfiles,
} from '../services/session.service';
import { hasReviewedSession } from '../services/instructors.service';
import { toast } from '../utils/toast';

const REVIEW_WINDOW_DAYS = 7;

async function canShowReview(session, role) {
  if (!session) return false;
  const endedAt = session.ended_at ? new Date(session.ended_at) : new Date();
  const daysSince = (Date.now() - endedAt.getTime()) / 86400000;
  if (daysSince > REVIEW_WINDOW_DAYS) return false;
  try {
    const reviewerRole = role === 'instructor' ? 'instructor' : 'student';
    const already = await hasReviewedSession(
      session.instructor_id, session.student_id, session.event_id, reviewerRole,
    );
    return !already;
  } catch {
    return true; // em caso de erro na rede, deixa mostrar
  }
}

const SessionContext = createContext(null);

export function SessionProvider({ children }) {
  const { user, isAuthenticated } = useAuth();
  const [activeSession, setActiveSession] = useState(null);
  const [pendingSession, setPendingSession] = useState(null); // sessão com código gerado aguardando aluno
  const [completedSession, setCompletedSession] = useState(null); // sessão que acabou de ser concluída (trigger do modal de avaliação)
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const intervalRef = useRef(null);
  const unsubscribeRef = useRef(null);

  // Carrega sessão pendente/ativa ao autenticar
  useEffect(() => {
    if (!isAuthenticated || !user) {
      setActiveSession(null);
      setPendingSession(null);
      return;
    }
    // Carrega sessão pendente para qualquer papel
    loadPendingSession();
    // Assina realtime para receber atualizações de sessão
    startRealtime();
    return () => stopRealtime();
  }, [isAuthenticated, user?.id]);

  // Timer da sessão ativa
  useEffect(() => {
    if (activeSession) {
      intervalRef.current = setInterval(() => {
        setElapsedSeconds(s => s + 1);
      }, 1000);
    } else {
      clearInterval(intervalRef.current);
      setElapsedSeconds(0);
    }
    return () => clearInterval(intervalRef.current);
  }, [activeSession]);

  const loadPendingSession = async () => {
    if (!user) return;
    try {
      const session = user.role === 'instructor'
        ? await getPendingSession(user.id)
        : await getPendingSessionForStudent(user.id);
      if (session) setPendingSession(session);
    } catch (error) {
      logger.error('Erro ao carregar sessão pendente:', error.message);
    }
  };

  const enrichSession = async (session) => {
    if (!session) return session;
    try {
      const names = await getSessionProfiles(session.instructor_id, session.student_id);
      return { ...session, ...names };
    } catch {
      return session;
    }
  };

  const startRealtime = () => {
    if (!user) return;
    unsubscribeRef.current = subscribeToSession(
      user.id,
      user.role,
      async (updatedSession) => {
        if (updatedSession.status === 'active') {
          const enriched = await enrichSession(updatedSession);
          setActiveSession(enriched);
          setPendingSession(null);
          setElapsedSeconds(0);
        } else if (updatedSession.status === 'completed') {
          setActiveSession(null);
          setPendingSession(null);
          const show = await canShowReview(updatedSession, user.role);
          if (show) setCompletedSession(updatedSession);
        } else if (updatedSession.status === 'interrupted') {
          setActiveSession(null);
          setPendingSession(null);
          if (updatedSession.credit_refunded) {
            toast.error('Aula interrompida. Seu crédito foi devolvido automaticamente.');
          } else {
            toast.error('Aula interrompida por emergência.');
          }
        } else if (updatedSession.status === 'missed') {
          setActiveSession(null);
          setPendingSession(null);
          toast.error('A aula foi marcada como perdida pois o horário expirou.');
        } else if (updatedSession.status === 'student_no_show') {
          setActiveSession(null);
          setPendingSession(null);
          if (user.role === 'instructor') {
            toast.error('Aluno não compareceu. Aula registrada como falta.');
          } else {
            toast.error('Você não compareceu à aula. O crédito foi consumido.');
          }
        } else if (updatedSession.status === 'instructor_no_show') {
          setActiveSession(null);
          setPendingSession(null);
          if (user.role === 'instructor') {
            toast.error('Você foi marcado como ausente. O crédito do aluno foi devolvido.');
          } else {
            toast.error('Seu instrutor não compareceu. Seu crédito foi devolvido automaticamente.');
          }
        } else if (updatedSession.status === 'pending') {
          setPendingSession(updatedSession);
        }
      }
    );
  };

  const stopRealtime = () => {
    if (unsubscribeRef.current) {
      unsubscribeRef.current();
      unsubscribeRef.current = null;
    }
  };

  // Instrutor gera código e cria sessão no banco
  const generateCode = useCallback(async ({ studentId, eventId, durationMinutes, scheduledStartAt }) => {
    if (!user) return null;
    try {
      const session = await createSession({
        eventId,
        instructorId: user.id,
        studentId,
        durationMinutes: durationMinutes || user.class_duration || 50,
        scheduledStartAt: scheduledStartAt || null,
      });
      setPendingSession(session);
      return session.code;
    } catch (error) {
      logger.error('Erro ao gerar código:', error.message);
      return null;
    }
  }, [user]);

  // Instrutor (ou aluno) entra com código e ativa a sessão
  const startSession = useCallback(async (code) => {
    if (!user) return false;
    try {
      const session = await startSessionByCode(code, user.id, user.role);
      if (!session) return false;
      const enriched = await enrichSession(session);
      setActiveSession(enriched);
      setPendingSession(null);
      setElapsedSeconds(0);
      return true;
    } catch (error) {
      if (error.message?.startsWith('TOO_EARLY|')) {
        const [, scheduledTime, limitTime] = error.message.split('|');
        toast.error(`Aula agendada para ${scheduledTime}. Você poderá iniciar a partir das ${limitTime}.`);
      } else if (error.message?.startsWith('TOO_LATE|')) {
        const [, scheduledTime] = error.message.split('|');
        toast.error(`Horário da aula (${scheduledTime}) expirou. A aula foi marcada como perdida.`);
        setPendingSession(null);
      } else {
        logger.error('Erro ao iniciar sessão:', error.message);
      }
      return false;
    }
  }, [user]);

  // Registra emergência e interrompe sessão ativa
  const interruptSession = useCallback(async (reason, refundCredit) => {
    if (!activeSession) return;
    try {
      await reportIncident(activeSession.id, reason, refundCredit);
      setActiveSession(null);
      setElapsedSeconds(0);
    } catch (error) {
      logger.error('Erro ao registrar emergência:', error.message);
    }
  }, [activeSession]);

  // Encerra sessão ativa
  const endActiveSession = useCallback(async () => {
    if (!activeSession) return;
    try {
      const sessionToComplete = activeSession;
      await endSession(activeSession.id);
      setActiveSession(null);
      setElapsedSeconds(0);
      const show = await canShowReview(
        { ...sessionToComplete, ended_at: new Date().toISOString() },
        user.role,
      );
      if (show) setCompletedSession(sessionToComplete);
    } catch (error) {
      logger.error('Erro ao encerrar sessão:', error.message);
    }
  }, [activeSession, user]);

  const clearCompletedSession = useCallback(() => {
    setCompletedSession(null);
  }, []);

  const isCompleted = activeSession?.duration_minutes
    ? elapsedSeconds >= activeSession.duration_minutes * 60
    : false;

  return (
    <SessionContext.Provider value={{
      activeSession,
      pendingSession,
      completedSession,
      elapsedSeconds,
      isCompleted,
      generateCode,
      startSession,
      endSession: endActiveSession,
      interruptSession,
      clearCompletedSession,
    }}>
      {children}
    </SessionContext.Provider>
  );
}

export function useSession() {
  const ctx = useContext(SessionContext);
  if (!ctx) throw new Error('useSession must be used within SessionProvider');
  return ctx;
}
