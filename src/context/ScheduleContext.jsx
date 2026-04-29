import { logger } from '../utils/logger';
import React, { createContext, useContext, useReducer, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '../hooks/useAuth';
import { supabase } from '../lib/supabase';
import {
  getEventsByInstructor,
  getEventsByStudent,
  createEvent,
  updateEvent,
  deleteEvent,
  getRequestsByInstructor,
  getRequestsByStudent,
  createRequest,
  createBulkRequests,
  cancelRequest as cancelRequestService,
  updateRequestStatus,
} from '../services/events.service';
import { estimateTravelTime, checkGap, DEFAULT_TRAVEL_TIME } from '../utils/travelTime';

const ScheduleContext = createContext();

const ACTIONS = {
  SET_EVENTS: 'SET_EVENTS',
  ADD_EVENT: 'ADD_EVENT',
  UPDATE_EVENT: 'UPDATE_EVENT',
  DELETE_EVENT: 'DELETE_EVENT',
  SET_REQUESTS: 'SET_REQUESTS',
  ADD_REQUEST: 'ADD_REQUEST',
  UPDATE_REQUEST: 'UPDATE_REQUEST',
  SET_SELECTED_DATE: 'SET_SELECTED_DATE',
  SET_VIEW_MODE: 'SET_VIEW_MODE',
  SET_FILTER: 'SET_FILTER',
  SET_LOADING: 'SET_LOADING',
  ADD_CONTACT: 'ADD_CONTACT',
  UPDATE_CONTACT: 'UPDATE_CONTACT',
  DELETE_CONTACT: 'DELETE_CONTACT',
};

const initialState = {
  events: [],
  requests: [],
  contacts: [],
  selectedDate: new Date(),
  viewMode: 'month',
  filters: { eventType: 'all', priority: 'all', status: 'all' },
  loading: false,
};

const scheduleReducer = (state, action) => {
  switch (action.type) {
    case ACTIONS.SET_EVENTS:
      return { ...state, events: action.payload };
    case ACTIONS.ADD_EVENT:
      return { ...state, events: [...state.events, action.payload] };
    case ACTIONS.UPDATE_EVENT:
      return { ...state, events: state.events.map(e => e.id === action.payload.id ? action.payload : e) };
    case ACTIONS.DELETE_EVENT:
      return { ...state, events: state.events.filter(e => e.id !== action.payload) };
    case ACTIONS.SET_REQUESTS:
      return { ...state, requests: action.payload };
    case ACTIONS.ADD_REQUEST:
      return { ...state, requests: [action.payload, ...state.requests] };
    case ACTIONS.UPDATE_REQUEST:
      return { ...state, requests: state.requests.map(r => r.id === action.payload.id ? { ...r, ...action.payload } : r) };
    case ACTIONS.ADD_CONTACT:
      return { ...state, contacts: [...state.contacts, { ...action.payload, id: Date.now().toString() }] };
    case ACTIONS.UPDATE_CONTACT:
      return { ...state, contacts: state.contacts.map(c => c.id === action.payload.id ? action.payload : c) };
    case ACTIONS.DELETE_CONTACT:
      return { ...state, contacts: state.contacts.filter(c => c.id !== action.payload) };
    case ACTIONS.SET_SELECTED_DATE:
      return { ...state, selectedDate: action.payload };
    case ACTIONS.SET_VIEW_MODE:
      return { ...state, viewMode: action.payload };
    case ACTIONS.SET_FILTER:
      return { ...state, filters: { ...state.filters, ...action.payload } };
    case ACTIONS.SET_LOADING:
      return { ...state, loading: action.payload };
    default:
      return state;
  }
};

// Formata tempo relativo (ex: "5 min atrás", "2h atrás")
const toRelativeTime = (iso) => {
  const date = new Date(iso);
  const diffMin = Math.floor((Date.now() - date.getTime()) / 60000);
  if (diffMin < 1) return 'agora';
  if (diffMin < 60) return `${diffMin} min atrás`;
  if (diffMin < 24 * 60) return `${Math.floor(diffMin / 60)}h atrás`;
  const MONTHS = ['jan','fev','mar','abr','mai','jun','jul','ago','set','out','nov','dez'];
  const hh = String(date.getHours()).padStart(2, '0');
  const mm = String(date.getMinutes()).padStart(2, '0');
  const diffDays = Math.floor(diffMin / (24 * 60));
  if (diffDays === 1) return `Ontem ${hh}:${mm}`;
  return `${date.getDate()} ${MONTHS[date.getMonth()]}, ${hh}:${mm}`;
};

// Converte registro de class_request do banco para formato usado no app
const toAppRequest = (r) => ({
  id: r.id,
  student_id: r.student_id,
  instructor_id: r.instructor_id,
  studentName: r.profiles?.name || 'Aluno',
  studentAvatar: r.profiles?.avatar_url || null,
  instructorName: r.profiles?.name || null,
  instructorAvatar: r.profiles?.avatar_url || null,
  location: r.meeting_point?.address || r.profiles?.address || '',
  type: r.type || 'Aula Prática',
  price: r.price || 0,
  rating: r.profiles?.rating ?? null,
  phone: r.profiles?.phone || '',
  studentRenach: r.profiles?.renach || null,
  studentGender: r.profiles?.gender || null,
  status: r.status,
  requestTime: toRelativeTime(r.created_at),
  carOption: r.car_option || 'instructor',
  coordinates: r.profiles?.coordinates || { latitude: -23.5505, longitude: -46.6333 },
  meetingPoint: r.meeting_point || null,
  requestedSlots: r.requested_slots || [],
  requestedDate: r.requested_date || null,
  // Dados de plano (se a solicitação veio de um plano comprado)
  purchaseId: r.purchase_id || null,
  planName: r.purchases?.plans?.name || null,
  classesTotal: r.purchases?.classes_total || null,
  classesRemaining: r.purchases?.classes_remaining || null,
  // Dados de aula avulsa (pagamento pós-aceitação)
  is_avulsa:       r.is_avulsa       || false,
  payment_method:  r.payment_method  || null,
  avulsa_price:    r.avulsa_price    || null,
  createdAt:       r.created_at      || null,
  expiresAt:       r.expires_at      || null,
  // Categoria CNH alvo desta aula
  licenseCategory: r.license_category || null,
  // Reagendamento solicitado pelo aluno
  rescheduleRequested: r.reschedule_requested || false,
  rescheduleDate:      r.reschedule_date      || null,
  rescheduleSlots:     r.reschedule_slots     || [],
  // Motivo de cancelamento pelo instrutor ('emergency' | 'refused' | null)
  cancellationReason: r.cancellation_reason || null,
});

// Converte snake_case do banco para camelCase usado no app
const toAppEvent = (e) => ({
  id: e.id,
  title: e.title,
  type: e.type,
  priority: e.priority,
  startDateTime: e.start_datetime,
  endDateTime: e.end_datetime,
  location: e.location,
  meetingPoint: e.meeting_point,
  description: e.description,
  status: e.status,
  contactId: e.student_id,
  instructorId: e.instructor_id,
  carOption: e.car_option || 'instructor',
  createdAt: e.created_at,
  updatedAt: e.updated_at,
  classRequestId: e.class_request_id || null,
});

// Converte camelCase do app para snake_case do banco
const toDbEvent = (e, instructorId) => ({
  instructor_id:    instructorId,
  student_id:       e.contactId || e.studentId || null,
  title:            e.title,
  type:             e.type || 'class',
  priority:         e.priority || 'medium',
  start_datetime:   e.startDateTime,
  end_datetime:     e.endDateTime,
  location:         e.location || null,
  meeting_point:    e.meetingPoint || null,
  description:      e.description || null,
  status:           e.status || 'scheduled',
  car_option:       e.carOption || 'instructor',
  class_request_id: e.classRequestId || null,
});

export const ScheduleProvider = ({ children }) => {
  const { user, isAuthenticated } = useAuth();
  const [state, dispatch] = useReducer(scheduleReducer, initialState);
  const channelRef = useRef(null);
  // Callbacks registrados pelo Dashboard para reagir a expirações em tempo real
  const expiredCallbacksRef = useRef([]);
  const onRequestExpired = useCallback((cb) => {
    expiredCallbacksRef.current.push(cb);
    return () => {
      expiredCallbacksRef.current = expiredCallbacksRef.current.filter(fn => fn !== cb);
    };
  }, []);

  useEffect(() => {
    if (!isAuthenticated || !user) return;
    loadData();

    // Subscription em tempo real para class_requests e events
    const eventsFilter = user.role === 'instructor'
      ? `instructor_id=eq.${user.id}`
      : `student_id=eq.${user.id}`;

    const channel = supabase
      .channel(`requests_${user.id}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'class_requests',
          filter: eventsFilter,
        },
        (payload) => {
          // Ignora inserções de aulas avulsas que ainda aguardam pagamento
          if (user.role === 'instructor' && payload.new?.status === 'awaiting_payment') return;
          // Recarrega as requests para pegar dados com JOIN do perfil do aluno
          if (user.role === 'instructor') {
            getRequestsByInstructor(user.id)
              .then(requests => dispatch({ type: ACTIONS.SET_REQUESTS, payload: requests.map(toAppRequest) }))
              .catch(e => logger.error('Realtime reload error:', e.message));
          } else {
            getRequestsByStudent(user.id)
              .then(requests => dispatch({ type: ACTIONS.SET_REQUESTS, payload: requests.map(toAppRequest) }))
              .catch(e => logger.error('Realtime reload error:', e.message));
          }
        },
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'class_requests',
          filter: eventsFilter,
        },
        (payload) => {
          dispatch({
            type: ACTIONS.UPDATE_REQUEST,
            payload: {
              id:                 payload.new.id,
              status:             payload.new.status,
              cancellationReason: payload.new.cancellation_reason || null,
              rescheduleRequested: payload.new.reschedule_requested || false,
              rescheduleDate:     payload.new.reschedule_date || null,
              rescheduleSlots:    payload.new.reschedule_slots || [],
            },
          });
          if (payload.new.status === 'expired') {
            expiredCallbacksRef.current.forEach(fn => fn(payload.new));
          }
        },
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'events',
          filter: eventsFilter,
        },
        (payload) => {
          if (payload.new.status === 'cancelled') {
            dispatch({ type: ACTIONS.DELETE_EVENT, payload: payload.new.id });
          } else {
            dispatch({ type: ACTIONS.UPDATE_EVENT, payload: toAppEvent(payload.new) });
          }
        },
      )
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'events',
          filter: eventsFilter,
        },
        (payload) => {
          dispatch({ type: ACTIONS.ADD_EVENT, payload: toAppEvent(payload.new) });
        },
      )
      .subscribe();

    channelRef.current = channel;
    return () => { supabase.removeChannel(channel); };
  }, [isAuthenticated, user?.id]);

  const loadData = async () => {
    dispatch({ type: ACTIONS.SET_LOADING, payload: true });
    try {
      if (user.role === 'instructor') {
        const [events, requests] = await Promise.all([
          getEventsByInstructor(user.id),
          getRequestsByInstructor(user.id),
        ]);
        dispatch({ type: ACTIONS.SET_EVENTS, payload: events.map(toAppEvent) });
        dispatch({ type: ACTIONS.SET_REQUESTS, payload: requests.map(toAppRequest) });
      } else {
        const [events, requests] = await Promise.all([
          getEventsByStudent(user.id),
          getRequestsByStudent(user.id),
        ]);
        dispatch({ type: ACTIONS.SET_EVENTS, payload: events.map(toAppEvent) });
        dispatch({ type: ACTIONS.SET_REQUESTS, payload: requests.map(toAppRequest) });
      }
    } catch (error) {
      logger.error('Erro ao carregar agenda:', error.message);
    } finally {
      dispatch({ type: ACTIONS.SET_LOADING, payload: false });
    }
  };

  const addEvent = useCallback(async (event) => {
    const dbEvent = toDbEvent(event, user.id);
    const created = await createEvent(dbEvent);
    const appEvent = toAppEvent(created);
    dispatch({ type: ACTIONS.ADD_EVENT, payload: appEvent });
    return appEvent;
  }, [user]);

  const updateEventAction = useCallback(async (event) => {
    const { id, ...fields } = event;
    const updated = await updateEvent(id, {
      title: fields.title,
      type: fields.type,
      priority: fields.priority,
      start_datetime: fields.startDateTime,
      end_datetime: fields.endDateTime,
      location: fields.location,
      meeting_point: fields.meetingPoint,
      description: fields.description,
      status: fields.status,
      student_id: fields.contactId || null,
    });
    dispatch({ type: ACTIONS.UPDATE_EVENT, payload: toAppEvent(updated) });
  }, []);

  const deleteEventAction = useCallback(async (id) => {
    await deleteEvent(id);
    dispatch({ type: ACTIONS.DELETE_EVENT, payload: id });
  }, []);

  const addRequest = useCallback(async (requestData) => {
    const created = await createRequest({ ...requestData, student_id: user.id });
    dispatch({ type: ACTIONS.ADD_REQUEST, payload: toAppRequest(created) });
    return created;
  }, [user]);

  const addBulkRequests = useCallback(async (requestsData) => {
    const created = await createBulkRequests(
      requestsData.map(r => ({ ...r, student_id: user.id }))
    );
    created.forEach(r => dispatch({ type: ACTIONS.ADD_REQUEST, payload: toAppRequest(r) }));
    return created;
  }, [user]);

  const cancelRequest = useCallback(async (requestId) => {
    await cancelRequestService(requestId);
    dispatch({ type: ACTIONS.UPDATE_REQUEST, payload: { id: requestId, status: 'cancelled' } });
  }, []);

  const acceptRequest = useCallback(async (requestId) => {
    await updateRequestStatus(requestId, 'accepted');
    dispatch({ type: ACTIONS.UPDATE_REQUEST, payload: { id: requestId, status: 'accepted' } });
  }, []);

  const rejectRequest = useCallback(async (requestId) => {
    await updateRequestStatus(requestId, 'rejected');
    dispatch({ type: ACTIONS.UPDATE_REQUEST, payload: { id: requestId, status: 'rejected' } });
  }, []);

  const getEventsForDate = useCallback((date) => {
    const target = new Date(date);
    target.setHours(0, 0, 0, 0);
    const next = new Date(target);
    next.setDate(next.getDate() + 1);
    return state.events.filter(e => {
      const d = new Date(e.startDateTime);
      return d >= target && d < next;
    });
  }, [state.events]);

  const getFilteredEvents = useCallback(() =>
    state.events.filter(e => {
      if (state.filters.eventType !== 'all' && e.type !== state.filters.eventType) return false;
      if (state.filters.priority !== 'all' && e.priority !== state.filters.priority) return false;
      if (state.filters.status !== 'all' && e.status !== state.filters.status) return false;
      return true;
    }), [state.events, state.filters]);

  const checkTravelConflict = useCallback((newStartISO, newEndISO, meetingCoordinates) => {
    const newStart = new Date(newStartISO).getTime();
    const newEnd = new Date(newEndISO).getTime();
    const classEvents = state.events.filter(e => e.type === 'class' || e.type === 'CLASS');
    const sorted = [...classEvents].sort(
      (a, b) => new Date(a.startDateTime).getTime() - new Date(b.startDateTime).getTime()
    );

    const prevEvent = sorted.reduce((best, e) => {
      const end = new Date(e.endDateTime).getTime();
      if (end <= newStart) {
        if (!best || end > new Date(best.endDateTime).getTime()) return e;
      }
      return best;
    }, null);

    const nextEvent = sorted.find(e => new Date(e.startDateTime).getTime() >= newEnd) || null;

    const prevCoords = prevEvent?.meetingPoint?.coordinates || null;
    const nextCoords = nextEvent?.meetingPoint?.coordinates || null;

    const travelTimeToPrev = prevCoords && meetingCoordinates
      ? estimateTravelTime(prevCoords, meetingCoordinates) : DEFAULT_TRAVEL_TIME;
    const travelTimeToNext = nextCoords && meetingCoordinates
      ? estimateTravelTime(meetingCoordinates, nextCoords) : DEFAULT_TRAVEL_TIME;

    const prevGap = prevEvent
      ? Math.round((newStart - new Date(prevEvent.endDateTime).getTime()) / 60000) : Infinity;
    const nextGap = nextEvent
      ? Math.round((new Date(nextEvent.startDateTime).getTime() - newEnd) / 60000) : Infinity;

    const prevCheck = checkGap(prevGap === Infinity ? 999 : prevGap, travelTimeToPrev);
    const nextCheck = checkGap(nextGap === Infinity ? 999 : nextGap, travelTimeToNext);

    return {
      prevEvent, nextEvent,
      travelTimeToPrev, travelTimeToNext,
      prevGap: prevGap === Infinity ? null : prevGap,
      nextGap: nextGap === Infinity ? null : nextGap,
      prevCheck, nextCheck,
      hasIssue: !prevCheck.ok || !nextCheck.ok,
    };
  }, [state.events]);

  const addContact = useCallback((contact) => {
    dispatch({ type: ACTIONS.ADD_CONTACT, payload: contact });
  }, []);

  const updateContact = useCallback((contact) => {
    dispatch({ type: ACTIONS.UPDATE_CONTACT, payload: contact });
  }, []);

  const deleteContact = useCallback((id) => {
    dispatch({ type: ACTIONS.DELETE_CONTACT, payload: id });
  }, []);

  const getContactById = useCallback((id) => {
    return state.contacts.find(c => c.id === id) || null;
  }, [state.contacts]);

  // Alunos reais: derivados de requests aceitas (com nome/avatar/telefone do DB)
  // + events como fallback para alunos que não têm request aceita visível
  const students = (() => {
    const byId = {};
    state.requests
      .filter(r => r.status === 'accepted')
      .forEach(r => {
        if (!r.student_id) return;
        if (!byId[r.student_id]) {
          byId[r.student_id] = {
            id: r.student_id,
            name: r.studentName || 'Aluno',
            avatar: r.studentAvatar || null,
            phone: r.phone || '',
            status: 'active',
            classCount: 0,
            // Dados de plano (preenchidos se a solicitação veio de um plano)
            planName: r.planName || null,
            classesTotal: r.classesTotal || null,
            classesRemaining: r.classesRemaining || null,
          };
        }
        byId[r.student_id].classCount += 1;
        // Atualiza dados de plano com o mais recente, se existir
        if (r.planName && !byId[r.student_id].planName) {
          byId[r.student_id].planName = r.planName;
          byId[r.student_id].classesTotal = r.classesTotal;
          byId[r.student_id].classesRemaining = r.classesRemaining;
        }
      });
    state.events
      .filter(e => (e.type === 'class' || e.type === 'CLASS') && e.contactId)
      .forEach(e => {
        if (!byId[e.contactId]) {
          byId[e.contactId] = { id: e.contactId, name: 'Aluno', avatar: null, phone: '', status: 'active', classCount: 0 };
        }
        byId[e.contactId].classCount += 1;
      });
    return Object.values(byId);
  })();

  const value = {
    ...state,
    students,
    loadData,
    addEvent,
    updateEvent: updateEventAction,
    deleteEvent: deleteEventAction,
    addRequest,
    addBulkRequests,
    cancelRequest,
    acceptRequest,
    rejectRequest,
    addContact,
    updateContact,
    deleteContact,
    setSelectedDate: (date) => dispatch({ type: ACTIONS.SET_SELECTED_DATE, payload: date }),
    setViewMode: (mode) => dispatch({ type: ACTIONS.SET_VIEW_MODE, payload: mode }),
    setFilter: (filter) => dispatch({ type: ACTIONS.SET_FILTER, payload: filter }),
    getEventsForDate,
    getFilteredEvents,
    getContactById,
    checkTravelConflict,
    onRequestExpired,
  };

  return <ScheduleContext.Provider value={value}>{children}</ScheduleContext.Provider>;
};

export const useSchedule = () => {
  const ctx = useContext(ScheduleContext);
  if (!ctx) throw new Error('useSchedule must be used within ScheduleProvider');
  return ctx;
};
