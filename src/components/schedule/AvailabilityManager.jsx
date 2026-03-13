import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, Alert, useWindowDimensions } from 'react-native';
import { useAuth } from '../../hooks/useAuth';
import { makeShadow } from '../../constants/theme';
import { getAvailability, saveAvailability } from '../../services/events.service';
import { logger } from '../../utils/logger';
import {
  toggleTimeAvailability, TimeSlots,
  WeekDays, WeekDaysNames, WeekDaysShort,
} from '../../data/availabilityData';

const PRIMARY = '#1D4ED8';
const DAYS_ORDER = [
  WeekDays.MONDAY, WeekDays.TUESDAY, WeekDays.WEDNESDAY,
  WeekDays.THURSDAY, WeekDays.FRIDAY, WeekDays.SATURDAY, WeekDays.SUNDAY,
];

const EMPTY_AVAILABILITY = Object.fromEntries(
  Object.values(WeekDays).map(d => [d, []])
);

// Converte formato do banco { [dayOfWeek]: ['08:00', ...] } para o formato do app
// dayOfWeek do banco é número (1=Seg ... 7=Dom), WeekDays usa strings.
// Mantemos o formato do app (WeekDays) como chave.
const DB_DAY_TO_APP = {
  1: WeekDays.MONDAY,
  2: WeekDays.TUESDAY,
  3: WeekDays.WEDNESDAY,
  4: WeekDays.THURSDAY,
  5: WeekDays.FRIDAY,
  6: WeekDays.SATURDAY,
  7: WeekDays.SUNDAY,
};

const APP_DAY_TO_DB = Object.fromEntries(
  Object.entries(DB_DAY_TO_APP).map(([k, v]) => [v, parseInt(k)])
);

function dbToApp(dbAvailability) {
  const result = { ...EMPTY_AVAILABILITY };
  for (const [day, slots] of Object.entries(dbAvailability)) {
    const appDay = DB_DAY_TO_APP[parseInt(day)];
    if (appDay) result[appDay] = slots;
  }
  return result;
}

function appToDb(appAvailability) {
  const result = {};
  for (const [appDay, slots] of Object.entries(appAvailability)) {
    const dbDay = APP_DAY_TO_DB[appDay];
    if (dbDay !== undefined) result[dbDay] = slots;
  }
  return result;
}

export default function AvailabilityManager() {
  const { user } = useAuth();
  const { width } = useWindowDimensions();
  // 4 colunas com gap de 8px entre elas (3 gaps = 24px) + padding 32px
  const slotWidth = Math.floor((width - 32 - 24) / 4);
  const [selectedDay, setSelectedDay] = useState(WeekDays.MONDAY);
  const [availability, setAvailability] = useState(EMPTY_AVAILABILITY);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!user?.id) return;
    getAvailability(user.id)
      .then(dbData => setAvailability(dbToApp(dbData)))
      .catch(e => logger.error('Erro ao carregar disponibilidade:', e.message))
      .finally(() => setLoading(false));
  }, [user?.id]);

  const toggle = (time) => {
    setAvailability(prev => toggleTimeAvailability(prev, selectedDay, time));
  };

  const selectAll = () => {
    setAvailability(prev => ({ ...prev, [selectedDay]: [...TimeSlots] }));
  };

  const clearAll = () => {
    setAvailability(prev => ({ ...prev, [selectedDay]: [] }));
  };

  const save = async () => {
    if (!user?.id) return;
    setSaving(true);
    try {
      await saveAvailability(user.id, appToDb(availability));
      Alert.alert('Salvo!', 'Disponibilidade atualizada com sucesso.');
    } catch (e) {
      logger.error('Erro ao salvar disponibilidade:', e.message);
      Alert.alert('Erro', 'Não foi possível salvar a disponibilidade.');
    } finally {
      setSaving(false);
    }
  };

  const currentSlots = availability[selectedDay] || [];
  const totalSlots = Object.values(availability).reduce((acc, slots) => acc + slots.length, 0);
  const daysWithSlots = Object.values(availability).filter(s => s.length > 0).length;

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <Text style={styles.loadingText}>Carregando disponibilidade...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Day selector */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.dayScroll} contentContainerStyle={styles.dayScrollContent}>
        {DAYS_ORDER.map(day => (
          <TouchableOpacity
            key={day}
            style={[styles.dayPill, selectedDay === day && styles.dayPillActive]}
            onPress={() => setSelectedDay(day)}
          >
            <Text style={[styles.dayPillText, selectedDay === day && styles.dayPillTextActive]}>
              {WeekDaysShort[day]}
            </Text>
            {availability[day]?.length > 0 && (
              <View style={[styles.dayDot, selectedDay === day && styles.dayDotActive]} />
            )}
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Day label + actions */}
      <View style={styles.dayHeader}>
        <Text style={styles.dayTitle}>{WeekDaysNames[selectedDay]}</Text>
        <View style={styles.dayActions}>
          <TouchableOpacity style={styles.actionBtn} onPress={selectAll}>
            <Text style={styles.actionBtnText}>Todos</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.actionBtn, styles.actionBtnClear]} onPress={clearAll}>
            <Text style={[styles.actionBtnText, styles.actionBtnClearText]}>Limpar</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Stats */}
      <View style={styles.stats}>
        <View style={styles.statItem}>
          <Text style={styles.statValue}>{totalSlots}</Text>
          <Text style={styles.statLabel}>Horários disponíveis</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.statItem}>
          <Text style={styles.statValue}>{daysWithSlots}</Text>
          <Text style={styles.statLabel}>Dias com disponibilidade</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.statItem}>
          <Text style={styles.statValue}>{currentSlots.length}</Text>
          <Text style={styles.statLabel}>Horários hoje</Text>
        </View>
      </View>

      {/* Time slots grid */}
      <ScrollView style={styles.slotsScroll} showsVerticalScrollIndicator={false}>
        <View style={styles.slotsGrid}>
          {TimeSlots.map(time => {
            const isActive = currentSlots.includes(time);
            return (
              <TouchableOpacity
                key={time}
                style={[styles.slot, isActive && styles.slotActive, { width: slotWidth }]}
                onPress={() => toggle(time)}
                activeOpacity={0.75}
              >
                <Text style={[styles.slotText, isActive && styles.slotTextActive]}>{time}</Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Save button */}
        <TouchableOpacity style={[styles.saveBtn, saving && { opacity: 0.7 }]} onPress={save} disabled={saving}>
          <Text style={styles.saveBtnText}>{saving ? 'Salvando...' : 'Salvar Disponibilidade'}</Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  loadingContainer: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  loadingText: { fontSize: 14, color: '#9CA3AF' },
  dayScroll: { flexGrow: 0, borderBottomWidth: 1, borderBottomColor: '#F3F4F6' },
  dayScrollContent: { paddingHorizontal: 12, paddingVertical: 10, gap: 8 },
  dayPill: {
    paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20,
    backgroundColor: '#F3F4F6', alignItems: 'center', position: 'relative',
  },
  dayPillActive: { backgroundColor: PRIMARY },
  dayPillText: { fontSize: 13, fontWeight: '600', color: '#6B7280' },
  dayPillTextActive: { color: '#FFF' },
  dayDot: {
    position: 'absolute', top: 4, right: 4,
    width: 6, height: 6, borderRadius: 3, backgroundColor: PRIMARY,
  },
  dayDotActive: { backgroundColor: '#FFF' },

  dayHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 16, paddingVertical: 12,
  },
  dayTitle: { fontSize: 16, fontWeight: '800', color: '#111827' },
  dayActions: { flexDirection: 'row', gap: 8 },
  actionBtn: {
    paddingHorizontal: 12, paddingVertical: 6,
    backgroundColor: '#EFF6FF', borderRadius: 8,
  },
  actionBtnClear: { backgroundColor: '#FEF2F2' },
  actionBtnText: { fontSize: 12, fontWeight: '700', color: PRIMARY },
  actionBtnClearText: { color: '#EF4444' },

  stats: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#FFF', marginHorizontal: 16, borderRadius: 12,
    padding: 12, marginBottom: 12,
    ...makeShadow('#000', 1, 0.06, 4, 2),
  },
  statItem: { flex: 1, alignItems: 'center' },
  statValue: { fontSize: 18, fontWeight: '800', color: PRIMARY },
  statLabel: { fontSize: 10, color: '#6B7280', textAlign: 'center', marginTop: 2 },
  statDivider: { width: 1, height: 32, backgroundColor: '#E5E7EB' },

  slotsScroll: { flex: 1, paddingHorizontal: 16 },
  slotsGrid: { flexDirection: 'row', flexWrap: 'wrap', paddingBottom: 16, rowGap: 8, columnGap: 8 },
  slot: {
    paddingVertical: 10,
    borderRadius: 10, backgroundColor: '#F9FAFB',
    borderWidth: 1.5, borderColor: '#E5E7EB',
    alignItems: 'center', justifyContent: 'center',
  },
  slotActive: { backgroundColor: '#EFF6FF', borderColor: PRIMARY },
  slotText: { fontSize: 13, fontWeight: '600', color: '#6B7280' },
  slotTextActive: { color: PRIMARY },

  saveBtn: {
    backgroundColor: PRIMARY, borderRadius: 14, paddingVertical: 16,
    alignItems: 'center', marginBottom: 24, marginTop: 8,
    ...makeShadow('#1D4ED8', 4, 0.3, 8, 6),
  },
  saveBtnText: { color: '#FFF', fontSize: 15, fontWeight: '700' },
});
