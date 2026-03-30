export const MeetingPointType = {
  STUDENT_HOME: 'student_home',
  INSTRUCTOR_LOCATION: 'instructor_location',
  CUSTOM: 'custom',
  GPS_LOCATION: 'gps_location',
};

export const ContactStatus = {
  ACTIVE: 'active',
  INACTIVE: 'inactive',
  PENDING: 'pending',
};

export const EventType = {
  CLASS: 'class',
  MEETING: 'meeting',
  APPOINTMENT: 'appointment',
  PERSONAL: 'personal',
  OTHER: 'other',
};

export const EventPriority = {
  LOW: 'low',
  MEDIUM: 'medium',
  HIGH: 'high',
  URGENT: 'urgent',
};

export const formatDateTime = (dateTimeString) => {
  const date = new Date(dateTimeString);
  return {
    date: date.toLocaleDateString('pt-BR'),
    time: date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
    dateTime: date.toLocaleString('pt-BR'),
  };
};

export const getEventColor = (type) => {
  const colors = {
    class: '#3B82F6',
    meeting: '#7C3AED',
    appointment: '#22C55E',
    personal: '#EAB308',
    other: '#6B7280',
  };
  return colors[type] || colors.other;
};
