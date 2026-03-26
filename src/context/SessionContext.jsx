import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';
import { useAuth } from '../hooks/useAuth';
import { logger } from '../utils/logger';
import {
  createSession,
  getPendingSession,
  getPendingSessionForStudent,
  startSessionByCode,
  endSession,
  subscribeToSession,
} from '../services/session.service';

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

  const startRealtime = () => {
    if (!user) return;
    unsubscribeRef.current = subscribeToSession(
      user.id,
      user.role,
      (updatedSession) => {
        if (updatedSession.status === 'active') {
          setActiveSession(updatedSession);
          setPendingSession(null);
          setElapsedSeconds(0);
        } else if (updatedSession.status === 'completed') {
          setActiveSession(null);
          setPendingSession(null);
          setCompletedSession(updatedSession);
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
  const generateCode = useCallback(async ({ studentId, eventId, durationMinutes }) => {
    if (!user) return null;
    try {
      const session = await createSession({
        eventId,
        instructorId: user.id,
        studentId,
        durationMinutes: durationMinutes || user.class_duration || 60,
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
      setActiveSession(session);
      setPendingSession(null);
      setElapsedSeconds(0);
      return true;
    } catch (error) {
      logger.error('Erro ao iniciar sessão:', error.message);
      return false;
    }
  }, [user]);

  // Encerra sessão ativa
  const endActiveSession = useCallback(async () => {
    if (!activeSession) return;
    try {
      const sessionToComplete = activeSession;
      await endSession(activeSession.id);
      setActiveSession(null);
      setElapsedSeconds(0);
      setCompletedSession(sessionToComplete);
    } catch (error) {
      logger.error('Erro ao encerrar sessão:', error.message);
    }
  }, [activeSession]);

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
