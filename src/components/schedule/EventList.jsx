import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, Modal, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { makeShadow } from '../../constants/theme';
import { useSchedule } from '../../context/ScheduleContext';
import { getEventColor } from '../../data/scheduleData';
import { estimateTravelTime, checkGap, formatTravelTime } from '../../utils/travelTime';

const PRIMARY = '#1D4ED8';

const STATUS_CONFIG = {
  scheduled:     { label: 'Agendada',      color: '#2563EB', bg: '#EFF6FF' },
  'in-progress': { label: 'Em andamento',  color: '#CA8A04', bg: '#FFFBEB' },
  completed:     { label: 'Concluída',     color: '#16A34A', bg: '#F0FDF4' },
  cancelled:     { label: 'Cancelada',     color: '#DC2626', bg: '#FEF2F2' },
};

export default function EventList() {
  const { events, updateEvent, getContactById } = useSchedule();
  const [cancelTarget, setCancelTarget] = useState(null);

  // Somente aulas, ordenadas por data
  const classEvents = events
    .filter(e => e.type === 'class' || e.type === 'CLASS')
    .sort((a, b) => new Date(a.startDateTime) - new Date(b.startDateTime));

  const handleCancel = (event) => setCancelTarget(event);

  const confirmCancel = () => {
    updateEvent({ ...cancelTarget, status: 'cancelled' });
    setCancelTarget(null);
  };

  const buildRenderList = () => {
    const result = [];
    for (let i = 0; i < classEvents.length; i++) {
      result.push({ type: 'event', data: classEvents[i] });

      if (i < classEvents.length - 1) {
        const curr = classEvents[i];
        const next = classEvents[i + 1];
        if (curr.status === 'cancelled' || next.status === 'cancelled') continue;

        const currEnd = new Date(curr.endDateTime);
        const nextStart = new Date(next.startDateTime);
        const gapMin = Math.round((nextStart.getTime() - currEnd.getTime()) / 60000);

        if (gapMin >= 0 && gapMin <= 240) {
          const coordA = curr.meetingPoint?.coordinates || null;
          const coordB = next.meetingPoint?.coordinates || null;
          const travelMin = coordA && coordB ? estimateTravelTime(coordA, coordB) : null;
          if (travelMin !== null) {
            const gap = checkGap(gapMin, travelMin);
            result.push({ type: 'separator', gapMin, travelMin, status: gap.status, margin: gap.margin });
          }
        }
      }
    }
    return result;
  };

  const renderEvent = (item) => {
    const contact = item.contactId ? getContactById(item.contactId) : null;
    const color = getEventColor(item.type);
    const isCancelled = item.status === 'cancelled';
    const statusCfg = STATUS_CONFIG[item.status] || STATUS_CONFIG.scheduled;

    return (
      <View style={[styles.eventCard, isCancelled && styles.eventCardCancelled]}>
        <View style={[styles.eventColorBar, { backgroundColor: isCancelled ? '#D1D5DB' : color }]} />
        <View style={styles.eventBody}>
          <View style={styles.eventTop}>
            <View style={[styles.statusBadge, { backgroundColor: statusCfg.bg }]}>
              <Text style={[styles.statusBadgeText, { color: statusCfg.color }]}>{statusCfg.label}</Text>
            </View>
            {!isCancelled && (
              <TouchableOpacity onPress={() => handleCancel(item)} style={styles.cancelBtn}>
                <Ionicons name="close-circle-outline" size={20} color="#EF4444" />
              </TouchableOpacity>
            )}
          </View>

          <Text style={[styles.eventTitle, isCancelled && styles.eventTitleCancelled]} numberOfLines={2}>
            {item.title}
          </Text>

          <View style={styles.eventDetail}>
            <Ionicons name="time-outline" size={15} color="#9CA3AF" />
            <Text style={styles.eventDetailText}>
              {new Date(item.startDateTime).toLocaleDateString('pt-BR')} ·{' '}
              {new Date(item.startDateTime).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
              {' – '}
              {new Date(item.endDateTime).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
            </Text>
          </View>

          {item.meetingPoint?.address ? (
            <View style={styles.eventDetail}>
              <Ionicons
                name={item.meetingPoint.type === 'student_home' ? 'home-outline' :
                      item.meetingPoint.type === 'instructor_location' ? 'business-outline' :
                      'location-outline'}
                size={15} color="#9CA3AF"
              />
              <Text style={styles.eventDetailText} numberOfLines={1}>{item.meetingPoint.address}</Text>
            </View>
          ) : item.location ? (
            <View style={styles.eventDetail}>
              <Ionicons name="location-outline" size={15} color="#9CA3AF" />
              <Text style={styles.eventDetailText} numberOfLines={1}>{item.location}</Text>
            </View>
          ) : null}

          {contact && (
            <View style={styles.eventDetail}>
              <Ionicons name="person-outline" size={15} color="#9CA3AF" />
              <Text style={styles.eventDetailText}>{contact.name}</Text>
            </View>
          )}
        </View>
      </View>
    );
  };

  const renderSeparator = (sep) => {
    const color = sep.status === 'conflict' ? '#EF4444' : sep.status === 'warning' ? '#D97706' : '#6B7280';
    const bg = sep.status === 'conflict' ? '#FEF2F2' : sep.status === 'warning' ? '#FFFBEB' : '#F9FAFB';
    const icon = sep.status === 'conflict' ? 'close-circle-outline' : sep.status === 'warning' ? 'warning-outline' : 'car-outline';
    return (
      <View style={[styles.travelSeparator, { backgroundColor: bg, borderColor: `${color}40` }]}>
        <View style={styles.travelSepLine} />
        <View style={[styles.travelSepPill, { borderColor: `${color}50` }]}>
          <Ionicons name={icon} size={13} color={color} />
          <Text style={[styles.travelSepText, { color }]}>
            {formatTravelTime(sep.travelMin)} de deslocamento
          </Text>
          {sep.status !== 'ok' && (
            <Text style={[styles.travelSepSub, { color }]}>· gap: {sep.gapMin} min</Text>
          )}
        </View>
        <View style={styles.travelSepLine} />
      </View>
    );
  };

  const renderList = buildRenderList();

  const cancelDate = cancelTarget
    ? new Date(cancelTarget.startDateTime).toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long' })
    : '';

  return (
    <View style={styles.container}>
      {classEvents.length === 0 ? (
        <View style={styles.emptyState}>
          <Ionicons name="calendar-outline" size={48} color="#D1D5DB" />
          <Text style={styles.emptyTitle}>Nenhuma aula encontrada</Text>
          <Text style={styles.emptyText}>As aulas aceitas no painel aparecem aqui</Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.list} showsVerticalScrollIndicator={false}>
          {renderList.map((entry, idx) =>
            entry.type === 'event'
              ? <View key={`e-${entry.data.id}`}>{renderEvent(entry.data)}</View>
              : <View key={`s-${idx}`}>{renderSeparator(entry)}</View>
          )}
        </ScrollView>
      )}

      <Modal visible={!!cancelTarget} transparent animationType="fade" onRequestClose={() => setCancelTarget(null)}>
        <Pressable style={styles.modalOverlay} onPress={() => setCancelTarget(null)}>
          <Pressable style={styles.modalCard} onPress={() => {}}>
            <View style={styles.modalIconWrap}>
              <Ionicons name="close-circle" size={36} color="#EF4444" />
            </View>
            <Text style={styles.modalTitle}>Cancelar aula</Text>
            <Text style={styles.modalBody}>
              Tem certeza que deseja cancelar a aula de{'\n'}
              <Text style={styles.modalHighlight}>{cancelDate}</Text>?
            </Text>
            <Text style={styles.modalWarning}>Essa ação não pode ser desfeita.</Text>
            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.btnBack} onPress={() => setCancelTarget(null)}>
                <Text style={styles.btnBackText}>Voltar</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.btnConfirm} onPress={confirmCancel}>
                <Ionicons name="close-circle-outline" size={16} color="#FFF" />
                <Text style={styles.btnConfirmText}>Cancelar aula</Text>
              </TouchableOpacity>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  list: { padding: 16, gap: 14, paddingBottom: 32 },
  eventCard: {
    flexDirection: 'row', backgroundColor: '#FFF', borderRadius: 16, overflow: 'hidden',
    ...makeShadow('#000', 2, 0.08, 8, 4),
  },
  eventCardCancelled: { opacity: 0.55 },
  eventColorBar: { width: 6 },
  eventBody: { flex: 1, padding: 16 },
  eventTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  statusBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  statusBadgeText: { fontSize: 12, fontWeight: '700' },
  cancelBtn: { padding: 2 },
  eventTitle: { fontSize: 16, fontWeight: '700', color: '#111827', marginBottom: 10, lineHeight: 22 },
  eventTitleCancelled: { textDecorationLine: 'line-through', color: '#9CA3AF' },
  eventDetail: { flexDirection: 'row', alignItems: 'center', gap: 7, marginBottom: 5 },
  eventDetailText: { fontSize: 13, color: '#6B7280', flex: 1 },

  emptyState: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: 60, gap: 10 },
  emptyTitle: { fontSize: 16, fontWeight: '700', color: '#374151' },
  emptyText: { fontSize: 13, color: '#9CA3AF', textAlign: 'center', paddingHorizontal: 32 },

  travelSeparator: {
    flexDirection: 'row', alignItems: 'center',
    borderRadius: 10, borderWidth: 1,
    paddingVertical: 6, paddingHorizontal: 10, gap: 8,
  },
  travelSepLine: { flex: 1, height: 1, backgroundColor: '#E5E7EB' },
  travelSepPill: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    borderWidth: 1, borderRadius: 20,
    paddingHorizontal: 10, paddingVertical: 4,
    backgroundColor: '#FFF',
  },
  travelSepText: { fontSize: 11, fontWeight: '700' },
  travelSepSub: { fontSize: 10, fontWeight: '500' },

  modalOverlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'center', alignItems: 'center', padding: 24,
  },
  modalCard: {
    backgroundColor: '#FFF', borderRadius: 20, padding: 28,
    width: '100%', alignItems: 'center',
    ...makeShadow('#000', 20, 0.15, 24, 8),
  },
  modalIconWrap: {
    width: 64, height: 64, borderRadius: 32,
    backgroundColor: '#FEF2F2', alignItems: 'center', justifyContent: 'center',
    marginBottom: 16,
  },
  modalTitle: { fontSize: 18, fontWeight: '800', color: '#111827', marginBottom: 10 },
  modalBody: { fontSize: 14, color: '#4B5563', textAlign: 'center', lineHeight: 22, marginBottom: 6 },
  modalHighlight: { fontWeight: '700', color: '#111827' },
  modalWarning: { fontSize: 12, color: '#9CA3AF', marginBottom: 24 },
  modalActions: { flexDirection: 'row', gap: 10, width: '100%' },
  btnBack: {
    flex: 1, paddingVertical: 13, borderRadius: 12,
    borderWidth: 1.5, borderColor: '#E5E7EB',
    alignItems: 'center', justifyContent: 'center',
  },
  btnBackText: { fontSize: 14, fontWeight: '700', color: '#374151' },
  btnConfirm: {
    flex: 1.4, paddingVertical: 13, borderRadius: 12,
    backgroundColor: '#EF4444',
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
  },
  btnConfirmText: { fontSize: 14, fontWeight: '700', color: '#FFF' },
});
