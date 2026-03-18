import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import CalendarView from '../../components/schedule/CalendarView';
import AvailabilityManager from '../../components/schedule/AvailabilityManager';
import EventList from '../../components/schedule/EventList';
import ContactList from '../../components/schedule/ContactList';
import { useSchedule } from '../../context/ScheduleContext';

const PRIMARY = '#1D4ED8';

const TABS = [
  { key: 'calendar',     label: 'Calendário', icon: 'calendar-outline', iconActive: 'calendar'  },
  { key: 'availability', label: 'Horários',   icon: 'time-outline',     iconActive: 'time'      },
  { key: 'events',       label: 'Aulas',      icon: 'book-outline',     iconActive: 'book'      },
  { key: 'contacts',     label: 'Alunos',     icon: 'people-outline',   iconActive: 'people'    },
];

export default function ScheduleScreen() {
  const [activeTab, setActiveTab] = useState('calendar');
  const { events, students } = useSchedule();

  const badgeCounts = {
    events: events.length,
    contacts: students.length,
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>Agenda</Text>
          <Text style={styles.headerSub}>Gerencie suas aulas e alunos</Text>
        </View>
        <View style={styles.headerStats}>
          <View style={styles.statPill}>
            <Ionicons name="calendar" size={14} color={PRIMARY} />
            <Text style={styles.statPillText}>{events.length} aulas</Text>
          </View>
          <View style={styles.statPill}>
            <Ionicons name="people" size={14} color={PRIMARY} />
            <Text style={styles.statPillText}>{students.length} alunos</Text>
          </View>
        </View>
      </View>

      {/* Tab Bar — 4 colunas fixas, sempre visíveis */}
      <View style={styles.tabBar}>
        {TABS.map(tab => {
          const isActive = activeTab === tab.key;
          const badge = badgeCounts[tab.key];
          return (
            <TouchableOpacity
              key={tab.key}
              style={[styles.tab, isActive && styles.tabActive]}
              onPress={() => setActiveTab(tab.key)}
              activeOpacity={0.75}
            >
              <View style={styles.tabIconWrap}>
                <Ionicons
                  name={isActive ? tab.iconActive : tab.icon}
                  size={21}
                  color={isActive ? PRIMARY : '#9CA3AF'}
                />
                {badge > 0 && !isActive && (
                  <View style={styles.tabDot} />
                )}
              </View>
              <Text style={[styles.tabText, isActive && styles.tabTextActive]}>
                {tab.label}
              </Text>
              {badge > 0 && isActive && (
                <View style={styles.tabBadge}>
                  <Text style={styles.tabBadgeText}>{badge}</Text>
                </View>
              )}
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Tab content */}
      <View style={styles.content}>
        {activeTab === 'calendar' && <CalendarView />}
        {activeTab === 'availability' && <AvailabilityManager />}
        {activeTab === 'events' && <EventList />}
        {activeTab === 'contacts' && <ContactList />}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#F9FAFB' },
  header: {
    backgroundColor: '#FFF', paddingHorizontal: 20, paddingVertical: 14,
    borderBottomWidth: 1, borderBottomColor: '#F3F4F6',
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start',
  },
  headerTitle: { fontSize: 22, fontWeight: '800', color: '#111827' },
  headerSub: { fontSize: 13, color: '#6B7280', marginTop: 2 },
  headerStats: { flexDirection: 'column', alignItems: 'flex-end', gap: 4 },
  statPill: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: '#EFF6FF', borderRadius: 20, paddingHorizontal: 8, paddingVertical: 4,
  },
  statPillText: { fontSize: 11, fontWeight: '700', color: PRIMARY },

  tabBar: {
    flexDirection: 'row',
    backgroundColor: '#FFF',
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    gap: 3,
    borderBottomWidth: 2.5,
    borderBottomColor: 'transparent',
  },
  tabActive: { borderBottomColor: PRIMARY },
  tabIconWrap: { position: 'relative' },
  tabDot: {
    position: 'absolute', top: -1, right: -3,
    width: 7, height: 7, borderRadius: 4,
    backgroundColor: '#EF4444',
    borderWidth: 1, borderColor: '#FFF',
  },
  tabText: { fontSize: 10, fontWeight: '600', color: '#9CA3AF' },
  tabTextActive: { color: PRIMARY, fontWeight: '700' },
  tabBadge: {
    backgroundColor: `${PRIMARY}20`, borderRadius: 8,
    paddingHorizontal: 5, paddingVertical: 1,
  },
  tabBadgeText: { fontSize: 9, fontWeight: '800', color: PRIMARY },

  content: { flex: 1, backgroundColor: '#F9FAFB' },
});
