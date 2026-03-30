import { useState, useEffect, useRef, useCallback } from 'react';
import { AppState } from 'react-native';
import { supabase } from '../lib/supabase';
import { logger } from '../utils/logger';

const CHECK_INTERVAL_MS = 60_000;   // verifica a cada 1 minuto
const ALERT_BEFORE_MIN  = 15;       // avisa com até 15 min de antecedência
const ALERT_GRACE_MIN   = 5;        // continua mostrando até 5 min após o horário

/**
 * Retorna a próxima aula iminente do usuário (como instrutor ou aluno).
 * upcomingClass: null | { event, minutesUntil }
 */
export function useClassAlert(user) {
  const [upcomingClass, setUpcomingClass] = useState(null);
  const intervalRef  = useRef(null);
  const dismissedRef = useRef(new Set()); // IDs de eventos já descartados nesta sessão
  const appStateRef  = useRef(AppState.currentState);

  const check = useCallback(async () => {
    if (!user?.id) return;

    try {
      const now = new Date();
      const windowStart = new Date(now.getTime() - ALERT_GRACE_MIN  * 60_000).toISOString();
      const windowEnd   = new Date(now.getTime() + ALERT_BEFORE_MIN * 60_000).toISOString();

      // Busca aulas do usuário (como instrutor ou como aluno) na janela de alerta
      const column = user.role === 'instructor' ? 'instructor_id' : 'student_id';
      const { data: events, error } = await supabase
        .from('events')
        .select('id, title, start_datetime, end_datetime, instructor_id, student_id, meeting_point, location')
        .eq(column, user.id)
        .eq('status', 'scheduled')
        .gte('start_datetime', windowStart)
        .lte('start_datetime', windowEnd)
        .order('start_datetime', { ascending: true })
        .limit(1);

      if (error) throw error;

      if (!events || events.length === 0) {
        setUpcomingClass(null);
        return;
      }

      const event = events[0];

      // Usuário já descartou este alerta manualmente
      if (dismissedRef.current.has(event.id)) return;

      const minutesUntil = Math.round(
        (new Date(event.start_datetime).getTime() - now.getTime()) / 60_000
      );

      setUpcomingClass({ event, minutesUntil });
    } catch (err) {
      logger.error('useClassAlert check error:', err.message);
    }
  }, [user?.id, user?.role]);

  // Roda ao montar, toda vez que o app volta ao foco, e a cada minuto
  useEffect(() => {
    if (!user?.id) return;

    check();

    intervalRef.current = setInterval(check, CHECK_INTERVAL_MS);

    const subscription = AppState.addEventListener('change', (nextState) => {
      if (appStateRef.current !== 'active' && nextState === 'active') {
        check();
      }
      appStateRef.current = nextState;
    });

    return () => {
      clearInterval(intervalRef.current);
      subscription.remove();
    };
  }, [check]);

  const dismiss = useCallback((eventId) => {
    if (eventId) dismissedRef.current.add(eventId);
    setUpcomingClass(null);
  }, []);

  return { upcomingClass, dismiss };
}
