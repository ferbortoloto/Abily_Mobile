import React, { useState, useEffect, useLayoutEffect } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, ScrollView, useWindowDimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../hooks/useAuth';
import { makeShadow } from '../../constants/theme';
import { toast } from '../../utils/toast';
import { getAvailability, saveAvailability } from '../../services/events.service';
import { logger } from '../../utils/logger';
import { toggleTimeAvailability, TimeSlots, WeekDays, WeekDaysShort } from '../../data/availabilityData';
import { useAvailabilityGuard } from '../../context/AvailabilityGuardContext';

const PRIMARY = '#1D4ED8';

const DAYS_ORDER = [
  WeekDays.MONDAY, WeekDays.TUESDAY, WeekDays.WEDNESDAY,
  WeekDays.THURSDAY, WeekDays.FRIDAY, WeekDays.SATURDAY, WeekDays.SUNDAY,
];

const WEEKEND = new Set([WeekDays.SATURDAY, WeekDays.SUNDAY]);

const PERIODS = [
  { label: 'Manhã',  icon: 'sunny-outline',        color: '#F59E0B', start: '06:00', end: '11:30' },
  { label: 'Tarde',  icon: 'partly-sunny-outline',  color: '#0EA5E9', start: '12:00', end: '17:30' },
  { label: 'Noite',  icon: 'moon-outline',          color: '#6366F1', start: '18:00', end: '22:30' },
];

const EMPTY_AVAILABILITY = Object.fromEntries(Object.values(WeekDays).map(d => [d, []]));

const DB_DAY_TO_APP = {
  1: WeekDays.MONDAY, 2: WeekDays.TUESDAY, 3: WeekDays.WEDNESDAY,
  4: WeekDays.THURSDAY, 5: WeekDays.FRIDAY, 6: WeekDays.SATURDAY, 7: WeekDays.SUNDAY,
};
const APP_DAY_TO_DB = Object.fromEntries(
  Object.entries(DB_DAY_TO_APP).map(([k, v]) => [v, parseInt(k)])
);

function dbToApp(dbAvailability) {
  const result = { ...EMPTY_AVAILABILITY };
  for (const [day, slots] of Object.entries(dbAvailability)) {
    const appDay = DB_DAY_TO_APP[parseInt(day)];
    if (appDay !== undefined) result[appDay] = slots;
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

function AvailabilityManager() {
  const { user } = useAuth();
  const { width } = useWindowDimensions();
  const { setIsDirty, saveRef } = useAvailabilityGuard();

  // Layout: 16px padding each side, 48px time column, rest split into 7 day columns
  const PADDING = 16;
  const TIME_COL = 48;
  const DAY_COL = Math.floor((width - PADDING * 2 - TIME_COL) / 7);

  const [availability, setAvailability] = useState(EMPTY_AVAILABILITY);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const save = async () => {
    if (!user?.id) return;
    setSaving(true);
    try {
      await saveAvailability(user.id, appToDb(availability));
      setIsDirty(false);
      toast.success('Disponibilidade atualizada com sucesso!');
    } catch (e) {
      logger.error('Erro ao salvar disponibilidade:', e.message);
      toast.error('Não foi possível salvar a disponibilidade.');
    } finally {
      setSaving(false);
    }
  };

  // Keep saveRef always pointing to the latest save (captures fresh availability)
  useLayoutEffect(() => { saveRef.current = save; });

  useEffect(() => {
    if (!user?.id) return;
    getAvailability(user.id)
      .then(dbData => { setAvailability(dbToApp(dbData)); setIsDirty(false); })
      .catch(e => logger.error('Erro ao carregar disponibilidade:', e.message))
      .finally(() => setLoading(false));
  }, [user?.id]);

  // Clear dirty flag when unmounting (e.g. after discarding)
  useEffect(() => () => { setIsDirty(false); saveRef.current = null; }, []);

  const toggle = (day, time) => {
    setAvailability(prev => toggleTimeAvailability(prev, day, time));
    setIsDirty(true);
  };

  // Tapping day header → toggle all slots for that day
  const toggleDay = (day) => {
    const slots = availability[day] || [];
    const allSelected = slots.length === TimeSlots.length;
    setAvailability(prev => ({ ...prev, [day]: allSelected ? [] : [...TimeSlots] }));
    setIsDirty(true);
  };

  // Tapping time label → toggle that time across all days
  const toggleTime = (time) => {
    const allSelected = DAYS_ORDER.every(d => (availability[d] || []).includes(time));
    setAvailability(prev => {
      const updated = { ...prev };
      DAYS_ORDER.forEach(d => {
        const current = updated[d] || [];
        if (allSelected) {
          updated[d] = current.filter(t => t !== time);
        } else if (!current.includes(time)) {
          updated[d] = [...current, time].sort();
        }
      });
      return updated;
    });
    setIsDirty(true);
  };

  const totalSlots = Object.values(availability).reduce((acc, s) => acc + s.length, 0);
  const daysWithSlots = Object.values(availability).filter(s => s.length > 0).length;
  const totalHours = (totalSlots * 0.5).toFixed(1).replace('.0', '');

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <Text style={styles.loadingText}>Carregando disponibilidade...</Text>
      </View>
    );
  }

  const renderGrid = () => (
    PERIODS.map(period => {
      const periodSlots = TimeSlots.filter(t => t >= period.start && t <= period.end);
      return (
        <View key={period.label}>
          {/* Period separator */}
          <View style={[styles.periodRow, { borderLeftColor: period.color }]}>
            <Ionicons name={period.icon} size={13} color={period.color} />
            <Text style={[styles.periodLabel, { color: period.color }]}>{period.label}</Text>
          </View>

          {/* Slots for this period */}
          {periodSlots.map((time, rowIdx) => {
            const allDaysHaveTime = DAYS_ORDER.every(d => (availability[d] || []).includes(time));
            return (
              <View key={time} style={[styles.row, rowIdx % 2 === 1 && styles.rowAlt]}>
                {/* Time label — tap to toggle across all days */}
                <TouchableOpacity
                  style={[styles.timeCell, { width: TIME_COL }, allDaysHaveTime && styles.timeCellFull]}
                  onPress={() => toggleTime(time)}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.timeText, allDaysHaveTime && styles.timeTextFull]}>{time}</Text>
                </TouchableOpacity>

                {/* Day cells */}
                {DAYS_ORDER.map(day => {
                  const active = (availability[day] || []).includes(time);
                  const isWeekend = WEEKEND.has(day);
                  return (
                    <TouchableOpacity
                      key={day}
                      style={[
                        styles.cell,
                        { width: DAY_COL },
                        isWeekend && styles.cellWeekend,
                        active && styles.cellActive,
                      ]}
                      onPress={() => toggle(day, time)}
                      activeOpacity={0.65}
                    >
                      {active && (
                        <View style={styles.cellDot} />
                      )}
                    </TouchableOpacity>
                  );
                })}
              </View>
            );
          })}
        </View>
      );
    })
  );

  return (
    <View style={styles.container}>
      {/* Stats strip */}
      <View style={styles.stats}>
        <View style={styles.statItem}>
          <Text style={styles.statValue}>{totalHours}h</Text>
          <Text style={styles.statLabel}>Total disponível</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.statItem}>
          <Text style={styles.statValue}>{daysWithSlots}</Text>
          <Text style={styles.statLabel}>Dias ativos</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.statItem}>
          <Text style={styles.statValue}>{totalSlots}</Text>
          <Text style={styles.statLabel}>Horários</Text>
        </View>
      </View>

      {/* Hint */}
      <Text style={styles.hint}>
        Toque em um dia para marcar todos os horários · Toque no horário para marcar todos os dias
      </Text>

      {/* Fixed header row with days */}
      <View style={[styles.headerRow, { paddingHorizontal: PADDING }]}>
        <View style={{ width: TIME_COL }} />
        {DAYS_ORDER.map(day => {
          const count = (availability[day] || []).length;
          const allSelected = count === TimeSlots.length;
          const hasAny = count > 0;
          const isWeekend = WEEKEND.has(day);
          return (
            <TouchableOpacity
              key={day}
              style={[
                styles.dayHeaderCell,
                { width: DAY_COL },
                isWeekend && styles.dayHeaderWeekend,
                hasAny && styles.dayHeaderActive,
                allSelected && styles.dayHeaderFull,
              ]}
              onPress={() => toggleDay(day)}
              activeOpacity={0.75}
            >
              <Text style={[
                styles.dayHeaderText,
                hasAny && styles.dayHeaderTextActive,
                allSelected && styles.dayHeaderTextFull,
              ]}>
                {WeekDaysShort[day]}
              </Text>
              {hasAny && (
                <Text style={[
                  styles.dayCount,
                  allSelected && styles.dayCountFull,
                ]}>
                  {count}
                </Text>
              )}
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Scrollable grid */}
      <ScrollView
        style={styles.gridScroll}
        contentContainerStyle={[styles.gridContent, { paddingHorizontal: PADDING }]}
        showsVerticalScrollIndicator={false}
      >
        {renderGrid()}

        {/* Save button */}
        <TouchableOpacity
          style={[styles.saveBtn, saving && { opacity: 0.7 }]}
          onPress={save}
          disabled={saving}
        >
          {saving
            ? <Text style={styles.saveBtnText}>Salvando...</Text>
            : (
              <>
                <Ionicons name="checkmark-circle-outline" size={18} color="#FFF" />
                <Text style={styles.saveBtnText}>Salvar Disponibilidade</Text>
              </>
            )
          }
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

export default AvailabilityManager;

const CELL_H = 30;

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F9FAFB' },
  loadingContainer: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  loadingText: { fontSize: 14, color: '#9CA3AF' },

  stats: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#FFF', marginHorizontal: 16, marginTop: 12,
    borderRadius: 14, paddingVertical: 12,
    ...makeShadow('#000', 1, 0.06, 4, 2),
  },
  statItem: { flex: 1, alignItems: 'center' },
  statValue: { fontSize: 20, fontWeight: '800', color: PRIMARY },
  statLabel: { fontSize: 10, color: '#9CA3AF', marginTop: 2 },
  statDivider: { width: 1, height: 30, backgroundColor: '#E5E7EB' },

  hint: {
    fontSize: 10, color: '#9CA3AF', textAlign: 'center',
    marginHorizontal: 16, marginTop: 8, marginBottom: 6, lineHeight: 15,
  },

  headerRow: {
    flexDirection: 'row', alignItems: 'flex-end',
    backgroundColor: '#F9FAFB', paddingBottom: 6, paddingTop: 2,
    borderBottomWidth: 1, borderBottomColor: '#E5E7EB',
  },
  dayHeaderCell: {
    alignItems: 'center', justifyContent: 'center',
    paddingVertical: 6, borderRadius: 8,
    gap: 2,
  },
  dayHeaderWeekend: { backgroundColor: '#F3F4F6' },
  dayHeaderActive: { backgroundColor: '#EFF6FF' },
  dayHeaderFull: { backgroundColor: PRIMARY },
  dayHeaderText: { fontSize: 11, fontWeight: '700', color: '#9CA3AF' },
  dayHeaderTextActive: { color: PRIMARY },
  dayHeaderTextFull: { color: '#FFF' },
  dayCount: { fontSize: 9, fontWeight: '700', color: PRIMARY },
  dayCountFull: { color: 'rgba(255,255,255,0.8)' },

  gridScroll: { flex: 1 },
  gridContent: { paddingBottom: 32 },

  periodRow: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    borderLeftWidth: 3, paddingLeft: 8,
    marginTop: 14, marginBottom: 4,
  },
  periodLabel: { fontSize: 11, fontWeight: '800', letterSpacing: 0.5, textTransform: 'uppercase' },

  row: {
    flexDirection: 'row', alignItems: 'center',
    height: CELL_H,
    backgroundColor: '#FFF',
  },
  rowAlt: { backgroundColor: '#FAFAFA' },

  timeCell: {
    height: CELL_H, alignItems: 'center', justifyContent: 'center',
    paddingRight: 4,
  },
  timeCellFull: {},
  timeText: { fontSize: 10, fontWeight: '600', color: '#9CA3AF' },
  timeTextFull: { color: PRIMARY, fontWeight: '800' },

  cell: {
    height: CELL_H - 2,
    marginVertical: 1,
    marginHorizontal: 1,
    borderRadius: 5,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cellWeekend: { backgroundColor: '#EEF2FF' },
  cellActive: { backgroundColor: PRIMARY },
  cellDot: {
    width: 6, height: 6, borderRadius: 3,
    backgroundColor: 'rgba(255,255,255,0.85)',
  },

  saveBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: PRIMARY, borderRadius: 14, paddingVertical: 16,
    marginTop: 20, marginBottom: 8,
    ...makeShadow('#1D4ED8', 4, 0.3, 8, 6),
  },
  saveBtnText: { color: '#FFF', fontSize: 15, fontWeight: '700' },
});
