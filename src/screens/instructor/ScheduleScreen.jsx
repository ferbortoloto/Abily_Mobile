import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Modal, Pressable, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { makeShadow, ms } from '../../constants/theme';
import CalendarView from '../../components/schedule/CalendarView';
import AvailabilityManager from '../../components/schedule/AvailabilityManager';
import EventList from '../../components/schedule/EventList';
import ContactList from '../../components/schedule/ContactList';
import { useSchedule } from '../../context/ScheduleContext';
import { useAvailabilityGuard } from '../../context/AvailabilityGuardContext';

const PRIMARY = '#1D4ED8';

const TABS = [
  { key: 'calendar',     label: 'Calendário', icon: 'calendar-outline', iconActive: 'calendar'  },
  { key: 'availability', label: 'Horários',   icon: 'time-outline',     iconActive: 'time'      },
  { key: 'events',       label: 'Aulas',      icon: 'book-outline',     iconActive: 'book'      },
  { key: 'contacts',     label: 'Alunos',     icon: 'people-outline',   iconActive: 'people'    },
];

export default function ScheduleScreen() {
  const [activeTab, setActiveTab] = useState('calendar');
  const [pendingTab, setPendingTab] = useState(null);
  const [saving, setSaving] = useState(false);
  const { events, students } = useSchedule();
  const { isDirty, saveRef } = useAvailabilityGuard();

  const handleTabPress = (tabKey) => {
    if (activeTab === 'availability' && tabKey !== 'availability' && isDirty) {
      setPendingTab(tabKey);
      return;
    }
    setActiveTab(tabKey);
  };

  const handleSaveAndLeave = async () => {
    setSaving(true);
    try {
      await saveRef.current?.();
    } finally {
      setSaving(false);
    }
    setActiveTab(pendingTab);
    setPendingTab(null);
  };

  const handleDiscardAndLeave = () => {
    setActiveTab(pendingTab);
    setPendingTab(null);
  };

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
              onPress={() => handleTabPress(tab.key)}
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

      <UnsavedModal
        visible={!!pendingTab}
        saving={saving}
        onSave={handleSaveAndLeave}
        onDiscard={handleDiscardAndLeave}
        onCancel={() => setPendingTab(null)}
      />
    </SafeAreaView>
  );
}

function UnsavedModal({ visible, saving, onSave, onDiscard, onCancel }) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <Pressable style={modalStyles.overlay} onPress={() => !saving && onCancel()}>
        <Pressable style={modalStyles.card} onPress={() => {}}>
          <View style={modalStyles.iconWrap}>
            <Ionicons name="warning" size={32} color="#F59E0B" />
          </View>
          <Text style={modalStyles.title}>Alterações não salvas</Text>
          <Text style={modalStyles.body}>
            Você modificou sua disponibilidade mas ainda não salvou.{'\n'}O que deseja fazer?
          </Text>
          <TouchableOpacity
            style={[modalStyles.btnSave, saving && { opacity: 0.7 }]}
            onPress={onSave}
            disabled={saving}
          >
            {saving
              ? <ActivityIndicator color="#FFF" size="small" />
              : <Ionicons name="checkmark-circle-outline" size={18} color="#FFF" />
            }
            <Text style={modalStyles.btnSaveText}>
              {saving ? 'Salvando...' : 'Salvar e sair'}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity style={modalStyles.btnDiscard} onPress={onDiscard} disabled={saving}>
            <Text style={modalStyles.btnDiscardText}>Sair sem salvar</Text>
          </TouchableOpacity>
          <TouchableOpacity style={modalStyles.btnCancel} onPress={onCancel} disabled={saving}>
            <Text style={modalStyles.btnCancelText}>Cancelar</Text>
          </TouchableOpacity>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

export { UnsavedModal };

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#F9FAFB' },
  header: {
    backgroundColor: '#FFF', paddingHorizontal: ms(16), paddingVertical: 12,
    borderBottomWidth: 1, borderBottomColor: '#F3F4F6',
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start',
  },
  headerTitle: { fontSize: ms(20), fontWeight: '800', color: '#111827' },
  headerSub: { fontSize: ms(12), color: '#6B7280', marginTop: 2 },
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

const modalStyles = StyleSheet.create({
  overlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'center', alignItems: 'center', padding: 24,
  },
  card: {
    backgroundColor: '#FFF', borderRadius: 20, padding: 28,
    width: '100%', alignItems: 'center',
    ...makeShadow('#000', 20, 0.15, 24, 8),
  },
  iconWrap: {
    width: 64, height: 64, borderRadius: 32,
    backgroundColor: '#FFFBEB', alignItems: 'center', justifyContent: 'center',
    marginBottom: 16,
  },
  title: { fontSize: 18, fontWeight: '800', color: '#111827', marginBottom: 10 },
  body: {
    fontSize: 14, color: '#4B5563', textAlign: 'center',
    lineHeight: 22, marginBottom: 24,
  },
  btnSave: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    width: '100%', paddingVertical: 14, borderRadius: 12,
    backgroundColor: PRIMARY, marginBottom: 10,
    ...makeShadow(PRIMARY, 4, 0.25, 8, 4),
  },
  btnSaveText: { fontSize: 15, fontWeight: '700', color: '#FFF' },
  btnDiscard: {
    width: '100%', paddingVertical: 13, borderRadius: 12,
    borderWidth: 1.5, borderColor: '#FCA5A5',
    alignItems: 'center', marginBottom: 8,
  },
  btnDiscardText: { fontSize: 14, fontWeight: '700', color: '#EF4444' },
  btnCancel: {
    width: '100%', paddingVertical: 11, alignItems: 'center',
  },
  btnCancelText: { fontSize: 14, fontWeight: '600', color: '#9CA3AF' },
});
