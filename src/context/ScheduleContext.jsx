import { logger } from '../utils/logger';
import React, { createContext, useContext, useReducer, useEffect, useCallback } from 'react';
import { useAuth } from '../hooks/useAuth';
import {
  getEventsByInstructor,
  getEventsByStudent,
  createEvent,
  updateEvent,
  deleteEvent,
  getRequestsByInstructor,
  getRequestsByStudent,
  createRequest,
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
      return { ...state, requests: state.requests.map(r => r.id === action.payload.id ? action.payload : r) };
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
  createdAt: e.created_at,
  updatedAt: e.updated_at,
});

// Converte camelCase do app para snake_case do banco
const toDbEvent = (e, instructorId) => ({
  instructor_id: instructorId,
  student_id: e.contactId || e.studentId || null,
  title: e.title,
  type: e.type || 'class',
  priority: e.priority || 'medium',
  start_datetime: e.startDateTime,
  end_datetime: e.endDateTime,
  location: e.location || null,
  meeting_point: e.meetingPoint || null,
  description: e.description || null,
  status: e.status || 'scheduled',
});

export const ScheduleProvider = ({ children }) => {
  const { user, isAuthenticated } = useAuth();
  const [state, dispatch] = useReducer(scheduleReducer, initialState);

  useEffect(() => {
    if (!isAuthenticated || !user) return;
    loadData();
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
        dispatch({ type: ACTIONS.SET_REQUESTS, payload: requests });
      } else {
        const [events, requests] = await Promise.all([
          getEventsByStudent(user.id),
          getRequestsByStudent(user.id),
        ]);
        dispatch({ type: ACTIONS.SET_EVENTS, payload: events.map(toAppEvent) });
        dispatch({ type: ACTIONS.SET_REQUESTS, payload: requests });
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
    dispatch({ type: ACTIONS.ADD_REQUEST, payload: created });
    return created;
  }, [user]);

  const acceptRequest = useCallback(async (requestId) => {
    const updated = await updateRequestStatus(requestId, 'accepted');
    dispatch({ type: ACTIONS.UPDATE_REQUEST, payload: updated });
    return updated;
  }, []);

  const rejectRequest = useCallback(async (requestId) => {
    const updated = await updateRequestStatus(requestId, 'rejected');
    dispatch({ type: ACTIONS.UPDATE_REQUEST, payload: updated });
    return updated;
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

  const value = {
    ...state,
    loadData,
    addEvent,
    updateEvent: updateEventAction,
    deleteEvent: deleteEventAction,
    addRequest,
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
    checkTravelConflict,
  };

  return <ScheduleContext.Provider value={value}>{children}</ScheduleContext.Provider>;
};

export const useSchedule = () => {
  const ctx = useContext(ScheduleContext);
  if (!ctx) throw new Error('useSchedule must be used within ScheduleProvider');
  return ctx;
};
