import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { makeShadow } from '../../constants/theme';
import { useSchedule } from '../../context/ScheduleContext';
import { getEventColor } from '../../data/scheduleData';

const PRIMARY = '#1D4ED8';
const MONTHS = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
];
const DAYS_SHORT = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

export default function CalendarView() {
  const { events, selectedDate, setSelectedDate } = useSchedule();
  const [viewMonth, setViewMonth] = useState(() => {
    const d = new Date(selectedDate);
    return new Date(d.getFullYear(), d.getMonth(), 1);
  });

  const year = viewMonth.getFullYear();
  const month = viewMonth.getMonth();

  const firstDayOfWeek = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const cells = [];
  for (let i = 0; i < firstDayOfWeek; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(new Date(year, month, d));

  const getEventsForDay = (date) => {
    if (!date) return [];
    return events.filter(e => {
      const ed = new Date(e.startDateTime);
      return ed.getFullYear() === date.getFullYear() &&
        ed.getMonth() === date.getMonth() &&
        ed.getDate() === date.getDate();
    });
  };

  const isSelected = (date) => {
    if (!date) return false;
    const sel = new Date(selectedDate);
    return date.getFullYear() === sel.getFullYear() &&
      date.getMonth() === sel.getMonth() &&
      date.getDate() === sel.getDate();
  };

  const isToday = (date) => {
    if (!date) return false;
    const t = new Date();
    return date.getFullYear() === t.getFullYear() &&
      date.getMonth() === t.getMonth() &&
      date.getDate() === t.getDate();
  };

  const isPast = (event) => new Date(event.endDateTime) < new Date();

  const eventsForSelected = getEventsForDay(new Date(selectedDate));

  const prevMonth = () => setViewMonth(new Date(year, month - 1, 1));
  const nextMonth = () => setViewMonth(new Date(year, month + 1, 1));

  const weeks = [];
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));

  return (
    <ScrollView showsVerticalScrollIndicator={false}>
      {/* Month Navigator */}
      <View style={styles.monthNav}>
        <TouchableOpacity onPress={prevMonth} style={styles.navBtn}>
          <Ionicons name="chevron-back" size={22} color="#374151" />
        </TouchableOpacity>
        <Text style={styles.monthTitle}>{MONTHS[month]} {year}</Text>
        <TouchableOpacity onPress={nextMonth} style={styles.navBtn}>
          <Ionicons name="chevron-forward" size={22} color="#374151" />
        </TouchableOpacity>
      </View>

      {/* Day labels */}
      <View style={styles.weekLabels}>
        {DAYS_SHORT.map(d => (
          <Text key={d} style={styles.weekLabel}>{d}</Text>
        ))}
      </View>

      {/* Calendar grid */}
      <View style={styles.grid}>
        {weeks.map((week, wi) => (
          <View key={wi} style={styles.weekRow}>
            {week.map((date, di) => {
              const dayEvents = getEventsForDay(date);
              const selected = isSelected(date);
              const today = isToday(date);
              return (
                <TouchableOpacity
                  key={di}
                  style={[
                    styles.dayCell,
                    selected && styles.dayCellSelected,
                    today && !selected && styles.dayCellToday,
                  ]}
                  onPress={() => date && setSelectedDate(date)}
                  disabled={!date}
                  activeOpacity={0.7}
                >
                  {date && (
                    <>
                      <Text style={[
                        styles.dayNumber,
                        selected && styles.dayNumberSelected,
                        today && !selected && styles.dayNumberToday,
                      ]}>
                        {date.getDate()}
                      </Text>
                      {dayEvents.length > 0 && (
                        <View style={styles.dotsRow}>
                          {dayEvents.slice(0, 3).map((e, ei) => (
                            <View
                              key={ei}
                              style={[styles.dot, { backgroundColor: selected ? '#FFF' : isPast(e) ? '#D1D5DB' : getEventColor(e.type) }]}
                            />
                          ))}
                        </View>
                      )}
                    </>
                  )}
                </TouchableOpacity>
              );
            })}
            {/* fill remaining cells */}
            {Array.from({ length: 7 - week.length }, (_, i) => (
              <View key={`empty-${i}`} style={styles.dayCell} />
            ))}
          </View>
        ))}
      </View>

      {/* Events for selected day */}
      <View style={styles.selectedSection}>
        <Text style={styles.selectedTitle}>
          {new Date(selectedDate).toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long' })}
        </Text>

        {eventsForSelected.length === 0 ? (
          <View style={styles.noEventsBox}>
            <Ionicons name="calendar-outline" size={32} color="#D1D5DB" />
            <Text style={styles.noEventsText}>Nenhuma aula neste dia</Text>
          </View>
        ) : (
          eventsForSelected.map(event => {
            const past = isPast(event);
            return (
              <View key={event.id} style={[styles.eventItem, past && styles.eventItemPast]}>
                <View style={[styles.eventBar, { backgroundColor: past ? '#D1D5DB' : getEventColor(event.type) }]} />
                <View style={styles.eventContent}>
                  <View style={styles.eventTitleRow}>
                    <Text style={[styles.eventTitle, past && styles.eventTitlePast]} numberOfLines={1}>
                      {event.title}
                    </Text>
                    {past && (
                      <View style={styles.pastBadge}>
                        <Ionicons name="checkmark-circle" size={11} color="#9CA3AF" />
                        <Text style={styles.pastBadgeText}>Concluída</Text>
                      </View>
                    )}
                  </View>
                  <Text style={[styles.eventTime, past && styles.eventTimePast]}>
                    {new Date(event.startDateTime).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                    {' – '}
                    {new Date(event.endDateTime).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                  </Text>
                  {event.location && (
                    <View style={styles.eventLocation}>
                      <Ionicons name="location-outline" size={12} color="#C4C9D4" />
                      <Text style={[styles.eventLocationText, past && { color: '#C4C9D4' }]} numberOfLines={1}>
                        {event.location}
                      </Text>
                    </View>
                  )}
                </View>
              </View>
            );
          })
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  monthNav: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12 },
  navBtn: { padding: 8, borderRadius: 10, backgroundColor: '#F3F4F6' },
  monthTitle: { fontSize: 17, fontWeight: '800', color: '#111827' },
  weekLabels: { flexDirection: 'row', paddingHorizontal: 8, marginBottom: 4 },
  weekLabel: { flex: 1, textAlign: 'center', fontSize: 12, fontWeight: '700', color: '#9CA3AF', textTransform: 'uppercase' },
  grid: { paddingHorizontal: 8 },
  weekRow: { flexDirection: 'row', marginBottom: 2 },
  dayCell: { flex: 1, aspectRatio: 1, alignItems: 'center', justifyContent: 'center', borderRadius: 10, margin: 1 },
  dayCellSelected: { backgroundColor: PRIMARY },
  dayCellToday: { backgroundColor: '#F5F0FF' },
  dayNumber: { fontSize: 14, fontWeight: '600', color: '#374151' },
  dayNumberSelected: { color: '#FFF', fontWeight: '800' },
  dayNumberToday: { color: PRIMARY, fontWeight: '800' },
  dotsRow: { flexDirection: 'row', gap: 2, marginTop: 2 },
  dot: { width: 4, height: 4, borderRadius: 2 },

  selectedSection: { padding: 16 },
  selectedTitle: { fontSize: 14, fontWeight: '700', color: '#374151', marginBottom: 12, textTransform: 'capitalize' },
  noEventsBox: { alignItems: 'center', paddingVertical: 24, gap: 8 },
  noEventsText: { fontSize: 14, color: '#9CA3AF' },
  eventItem: {
    flexDirection: 'row', alignItems: 'stretch', backgroundColor: '#FFF',
    borderRadius: 12, marginBottom: 10, overflow: 'hidden',
    ...makeShadow('#000', 1, 0.06, 4, 2),
  },
  eventItemPast: { backgroundColor: '#F9FAFB', opacity: 0.75 },
  eventBar: { width: 4, minHeight: 56 },
  eventContent: { flex: 1, padding: 12 },
  eventTitleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 3 },
  eventTitle: { fontSize: 14, fontWeight: '700', color: '#111827', flex: 1 },
  eventTitlePast: { color: '#9CA3AF' },
  eventTime: { fontSize: 12, color: '#6B7280', marginBottom: 4 },
  eventTimePast: { color: '#C4C9D4' },
  eventLocation: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  eventLocationText: { fontSize: 11, color: '#9CA3AF', flex: 1 },
  pastBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 3,
    backgroundColor: '#F3F4F6', borderRadius: 20,
    paddingHorizontal: 7, paddingVertical: 2, marginLeft: 8,
  },
  pastBadgeText: { fontSize: 10, fontWeight: '600', color: '#9CA3AF' },
});
