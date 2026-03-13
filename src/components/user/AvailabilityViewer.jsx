import React, { useState, useEffect, useMemo } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, ActivityIndicator, useWindowDimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { getInstructorAvailability } from '../../services/instructors.service';
import { logger } from '../../utils/logger';

const PRIMARY = '#1D4ED8';

const DAY_NAMES = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
const MONTH_NAMES = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];

// Converte dia da semana JS (0=Dom, 1=Seg ... 6=Sáb) para o formato do banco (1=Seg ... 7=Dom)
function jsDayToDb(jsDay) {
  if (jsDay === 0) return 7; // Domingo
  return jsDay;              // 1-6 = Seg-Sáb
}

export default function AvailabilityViewer({ instructorId, onSlotsSelected }) {
  const { width } = useWindowDimensions();
  // 4 colunas com gap de 8px entre elas (3 gaps = 24px) + padding 32px
  const slotWidth = Math.floor((width - 32 - 24) / 4);

  const today = new Date();
  const days = useMemo(() => {
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(today);
      d.setDate(today.getDate() + i);
      return d;
    });
  }, []);

  const [selectedDayIndex, setSelectedDayIndex] = useState(0);
  const [selectedSlots, setSelectedSlots] = useState([]);
  const [availability, setAvailability] = useState({}); // { [dbDay]: string[] }
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!instructorId) return;
    setLoading(true);
    getInstructorAvailability(instructorId)
      .then(data => setAvailability(data))
      .catch(e => {
        logger.error('Erro ao carregar disponibilidade do instrutor:', e.message);
        setAvailability({});
      })
      .finally(() => setLoading(false));
  }, [instructorId]);

  const getAvailableSlots = (date) => {
    const dbDay = jsDayToDb(date.getDay());
    return availability[dbDay] || [];
  };

  const selectedDate = days[selectedDayIndex];
  const availableSlots = useMemo(
    () => getAvailableSlots(selectedDate),
    [selectedDate, availability],
  );

  const toggleSlot = (slot) => {
    setSelectedSlots(prev => {
      const next = prev.includes(slot) ? prev.filter(s => s !== slot) : [...prev, slot];
      onSlotsSelected?.(next, selectedDate);
      return next;
    });
  };

  const handleDaySelect = (index) => {
    setSelectedDayIndex(index);
    setSelectedSlots([]);
    onSlotsSelected?.([], days[index]);
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator color={PRIMARY} size="small" />
        <Text style={styles.loadingText}>Carregando horários...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Day picker */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.dayScroll}
        contentContainerStyle={styles.dayScrollContent}
      >
        {days.map((day, index) => {
          const isSelected = selectedDayIndex === index;
          const isToday = index === 0;
          const slots = getAvailableSlots(day);
          const hasSlots = slots.length > 0;
          return (
            <TouchableOpacity
              key={index}
              style={[styles.dayPill, isSelected && styles.dayPillActive, !hasSlots && styles.dayPillUnavailable]}
              onPress={() => hasSlots && handleDaySelect(index)}
              activeOpacity={hasSlots ? 0.75 : 1}
            >
              <Text style={[styles.dayPillWeekday, isSelected && styles.dayPillTextActive, !hasSlots && styles.dayPillTextUnavailable]}>
                {isToday ? 'Hoje' : DAY_NAMES[day.getDay()]}
              </Text>
              <Text style={[styles.dayPillDate, isSelected && styles.dayPillTextActive, !hasSlots && styles.dayPillTextUnavailable]}>
                {day.getDate()}
              </Text>
              <Text style={[styles.dayPillMonth, isSelected && styles.dayPillTextActive, !hasSlots && styles.dayPillTextUnavailable]}>
                {MONTH_NAMES[day.getMonth()]}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {/* Selected date label */}
      <View style={styles.dateHeader}>
        <Ionicons name="calendar-outline" size={14} color={PRIMARY} />
        <Text style={styles.dateHeaderText}>
          {DAY_NAMES[selectedDate.getDay()]}, {selectedDate.getDate()} de {MONTH_NAMES[selectedDate.getMonth()]}
        </Text>
        {selectedSlots.length > 0 && (
          <View style={styles.selectedBadge}>
            <Text style={styles.selectedBadgeText}>{selectedSlots.length} selecionado{selectedSlots.length > 1 ? 's' : ''}</Text>
          </View>
        )}
      </View>

      {/* Time slots */}
      {availableSlots.length === 0 ? (
        <View style={styles.noSlots}>
          <Ionicons name="moon-outline" size={28} color="#D1D5DB" />
          <Text style={styles.noSlotsText}>Sem disponibilidade neste dia</Text>
        </View>
      ) : (
        <View style={styles.slotsGrid}>
          {availableSlots.map(slot => {
            const isActive = selectedSlots.includes(slot);
            return (
              <TouchableOpacity
                key={slot}
                style={[styles.slot, isActive && styles.slotActive, { width: slotWidth }]}
                onPress={() => toggleSlot(slot)}
                activeOpacity={0.75}
              >
                <Text style={[styles.slotText, isActive && styles.slotTextActive]}>{slot}</Text>
              </TouchableOpacity>
            );
          })}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { },
  loadingContainer: { alignItems: 'center', justifyContent: 'center', paddingVertical: 24, gap: 8 },
  loadingText: { fontSize: 13, color: '#9CA3AF' },
  dayScroll: { flexGrow: 0 },
  dayScrollContent: { paddingHorizontal: 16, paddingVertical: 12, gap: 8 },
  dayPill: {
    alignItems: 'center', paddingHorizontal: 14, paddingVertical: 10,
    borderRadius: 14, backgroundColor: '#F3F4F6',
    minWidth: 58,
  },
  dayPillActive: { backgroundColor: PRIMARY },
  dayPillUnavailable: { backgroundColor: '#F9FAFB', opacity: 0.5 },
  dayPillWeekday: { fontSize: 10, fontWeight: '700', color: '#9CA3AF', textTransform: 'uppercase' },
  dayPillDate: { fontSize: 18, fontWeight: '800', color: '#374151', marginTop: 2 },
  dayPillMonth: { fontSize: 10, fontWeight: '600', color: '#9CA3AF', marginTop: 1 },
  dayPillTextActive: { color: '#FFF' },
  dayPillTextUnavailable: { color: '#D1D5DB' },

  dateHeader: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 16, paddingBottom: 10,
  },
  dateHeaderText: { fontSize: 13, fontWeight: '600', color: '#374151', flex: 1 },
  selectedBadge: {
    backgroundColor: `${PRIMARY}20`, borderRadius: 10, paddingHorizontal: 8, paddingVertical: 3,
  },
  selectedBadgeText: { fontSize: 11, fontWeight: '700', color: PRIMARY },

  noSlots: { alignItems: 'center', paddingVertical: 24, gap: 8 },
  noSlotsText: { fontSize: 13, color: '#9CA3AF' },

  slotsGrid: {
    flexDirection: 'row', flexWrap: 'wrap',
    paddingHorizontal: 16, paddingBottom: 8, rowGap: 8, columnGap: 8,
  },
  slot: {
    paddingVertical: 10,
    borderRadius: 10, backgroundColor: '#F9FAFB',
    borderWidth: 1.5, borderColor: '#E5E7EB',
    alignItems: 'center', justifyContent: 'center',
  },
  slotActive: { backgroundColor: `${PRIMARY}15`, borderColor: PRIMARY },
  slotText: { fontSize: 13, fontWeight: '600', color: '#6B7280' },
  slotTextActive: { color: PRIMARY, fontWeight: '700' },
});
