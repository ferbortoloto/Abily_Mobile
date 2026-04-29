import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, Modal, Pressable, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../../lib/supabase';
import { makeShadow } from '../../constants/theme';
import { useSchedule } from '../../context/ScheduleContext';
import { getEventColor } from '../../data/scheduleData';
import { estimateTravelTime, checkGap, formatTravelTime } from '../../utils/travelTime';
import { toast } from '../../utils/toast';

const PRIMARY = '#1D4ED8';

const STATUS_CONFIG = {
  scheduled:     { label: 'Agendada',      color: '#2563EB', bg: '#EFF6FF' },
  'in-progress': { label: 'Em andamento',  color: '#CA8A04', bg: '#FFFBEB' },
  completed:     { label: 'Concluída',     color: '#16A34A', bg: '#F0FDF4' },
  cancelled:     { label: 'Cancelada',     color: '#DC2626', bg: '#FEF2F2' },
};

const getEffectiveStatus = (event, now) => {
  if (event.status === 'cancelled') return 'cancelled';
  const start = new Date(event.startDateTime);
  const end   = new Date(event.endDateTime);
  if (now >= end)   return 'completed';
  if (now >= start) return 'in-progress';
  return 'scheduled';
};

export default function EventList() {
  const { events, updateEvent, getContactById } = useSchedule();
  const [cancelTarget, setCancelTarget] = useState(null);
  // 'choose' = exibindo opções; 'emergency' | 'refused' = confirmando a escolha
  const [cancelStep, setCancelStep] = useState(null);
  const [cancelling, setCancelling] = useState(false);
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(timer);
  }, []);

  const classEvents = events
    .filter(e => e.type === 'class' || e.type === 'CLASS')
    .sort((a, b) => new Date(a.startDateTime) - new Date(b.startDateTime));

  const handleCancel = (event) => {
    setCancelTarget(event);
    // Se o evento tem class_request vinculado, exige escolha do motivo
    setCancelStep(event.classRequestId ? 'choose' : 'simple');
  };

  const confirmCancel = async (reason) => {
    setCancelling(true);
    try {
      if (cancelTarget.classRequestId) {
        const { data, error } = await supabase.functions.invoke('cancel-payment', {
          body: {
            class_request_id:    cancelTarget.classRequestId,
            instructor_cancel:   true,
            cancellation_reason: reason,
          },
        });
        if (error || data?.error) throw new Error(data?.error || error?.message);
      }
      // Para emergency o evento já foi cancelado pela edge function,
      // mas chamamos updateEvent de qualquer forma para atualizar o estado local.
      await updateEvent({ ...cancelTarget, status: 'cancelled' });
    } catch {
      toast.error('Não foi possível cancelar a aula. Tente novamente.');
    } finally {
      setCancelling(false);
      setCancelTarget(null);
      setCancelStep(null);
    }
  };

  const buildRenderList = () => {
    const result = [];
    for (let i = 0; i < classEvents.length; i++) {
      result.push({ type: 'event', data: classEvents[i] });

      if (i < classEvents.length - 1) {
        const curr = classEvents[i];
        const next = classEvents[i + 1];
        if (getEffectiveStatus(curr, now) === 'cancelled' || getEffectiveStatus(next, now) === 'cancelled') continue;

        const currEnd   = new Date(curr.endDateTime);
        const nextStart = new Date(next.startDateTime);
        const gapMin    = Math.round((nextStart.getTime() - currEnd.getTime()) / 60000);

        if (gapMin >= 0 && gapMin <= 240) {
          const coordA   = curr.meetingPoint?.coordinates || null;
          const coordB   = next.meetingPoint?.coordinates || null;
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
    const contact        = item.contactId ? getContactById(item.contactId) : null;
    const color          = getEventColor(item.type);
    const effectiveStatus = getEffectiveStatus(item, now);
    const isCancelled    = effectiveStatus === 'cancelled';
    const isDone         = effectiveStatus === 'completed';
    const statusCfg      = STATUS_CONFIG[effectiveStatus] || STATUS_CONFIG.scheduled;

    return (
      <View style={[styles.eventCard, isCancelled && styles.eventCardCancelled]}>
        <View style={[styles.eventColorBar, { backgroundColor: (isCancelled || isDone) ? '#D1D5DB' : color }]} />
        <View style={styles.eventBody}>
          <View style={styles.eventTop}>
            <View style={[styles.statusBadge, { backgroundColor: statusCfg.bg }]}>
              <Text style={[styles.statusBadgeText, { color: statusCfg.color }]}>{statusCfg.label}</Text>
            </View>
            {!isCancelled && !isDone && (
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
                name={item.meetingPoint.type === 'gps_location' ? 'navigate-outline' : 'location-outline'}
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
    const bg    = sep.status === 'conflict' ? '#FEF2F2' : sep.status === 'warning' ? '#FFFBEB' : '#F9FAFB';
    const icon  = sep.status === 'conflict' ? 'close-circle-outline' : sep.status === 'warning' ? 'warning-outline' : 'car-outline';
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

  const renderList  = buildRenderList();
  const cancelDate  = cancelTarget
    ? new Date(cancelTarget.startDateTime).toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long' })
    : '';

  const isModalVisible = !!cancelTarget && !!cancelStep;

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

      {/* ── Modal: seleção de motivo ou confirmação simples ── */}
      <Modal visible={isModalVisible} transparent animationType="fade" onRequestClose={() => { if (!cancelling) { setCancelTarget(null); setCancelStep(null); } }}>
        <Pressable style={styles.modalOverlay} onPress={() => { if (!cancelling) { setCancelTarget(null); setCancelStep(null); } }}>
          <Pressable style={styles.modalCard} onPress={() => {}}>

            {/* ── Tela de escolha do motivo (evento com class_request) ── */}
            {cancelStep === 'choose' && (
              <>
                <View style={styles.modalIconWrap}>
                  <Ionicons name="alert-circle" size={36} color="#D97706" />
                </View>
                <Text style={styles.modalTitle}>Cancelar aula</Text>
                <Text style={styles.modalBody}>
                  Aula de{'\n'}<Text style={styles.modalHighlight}>{cancelDate}</Text>
                </Text>
                <Text style={styles.modalSub}>Qual o motivo do cancelamento?</Text>

                {/* Opção 1: Imprevisto */}
                <TouchableOpacity
                  style={styles.reasonBtn}
                  onPress={() => setCancelStep('emergency')}
                  activeOpacity={0.85}
                >
                  <View style={styles.reasonIconWrap}>
                    <Ionicons name="car-outline" size={22} color="#D97706" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.reasonTitle}>Imprevisto</Text>
                    <Text style={styles.reasonDesc}>Carro quebrou, emergência pessoal, etc. O aluno poderá reagendar sem custo adicional.</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={16} color="#9CA3AF" />
                </TouchableOpacity>

                {/* Opção 2: Recusar */}
                <TouchableOpacity
                  style={[styles.reasonBtn, styles.reasonBtnDanger]}
                  onPress={() => setCancelStep('refused')}
                  activeOpacity={0.85}
                >
                  <View style={[styles.reasonIconWrap, styles.reasonIconDanger]}>
                    <Ionicons name="close-circle-outline" size={22} color="#DC2626" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.reasonTitle, { color: '#DC2626' }]}>Recusar esta aula</Text>
                    <Text style={styles.reasonDesc}>O valor é estornado ao aluno. Uma taxa de R$5,00 será debitada da sua carteira.</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={16} color="#9CA3AF" />
                </TouchableOpacity>

                <TouchableOpacity style={styles.btnBack} onPress={() => { setCancelTarget(null); setCancelStep(null); }}>
                  <Text style={styles.btnBackText}>Voltar</Text>
                </TouchableOpacity>
              </>
            )}

            {/* ── Confirmação: Imprevisto ── */}
            {cancelStep === 'emergency' && (
              <>
                <View style={[styles.modalIconWrap, { backgroundColor: '#FFFBEB' }]}>
                  <Ionicons name="car-outline" size={36} color="#D97706" />
                </View>
                <Text style={styles.modalTitle}>Confirmar imprevisto</Text>
                <Text style={styles.modalBody}>
                  Aula de{'\n'}<Text style={styles.modalHighlight}>{cancelDate}</Text>
                </Text>
                <Text style={styles.modalWarning}>
                  O aluno será notificado e poderá escolher um novo horário. Nenhum valor será estornado agora.
                </Text>
                <View style={styles.modalActions}>
                  <TouchableOpacity style={styles.btnBack} onPress={() => setCancelStep('choose')} disabled={cancelling}>
                    <Text style={styles.btnBackText}>Voltar</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.btnConfirm, { backgroundColor: '#D97706' }]}
                    onPress={() => confirmCancel('emergency')}
                    disabled={cancelling}
                  >
                    {cancelling
                      ? <ActivityIndicator size="small" color="#FFF" />
                      : <>
                          <Ionicons name="car-outline" size={16} color="#FFF" />
                          <Text style={styles.btnConfirmText}>Confirmar</Text>
                        </>
                    }
                  </TouchableOpacity>
                </View>
              </>
            )}

            {/* ── Confirmação: Recusar ── */}
            {cancelStep === 'refused' && (
              <>
                <View style={styles.modalIconWrap}>
                  <Ionicons name="close-circle" size={36} color="#EF4444" />
                </View>
                <Text style={styles.modalTitle}>Confirmar recusa</Text>
                <Text style={styles.modalBody}>
                  Aula de{'\n'}<Text style={styles.modalHighlight}>{cancelDate}</Text>
                </Text>
                <Text style={styles.modalWarning}>
                  O valor será estornado integralmente ao aluno. Uma taxa de R$5,00 será debitada da sua carteira Abily.
                </Text>
                <View style={styles.modalActions}>
                  <TouchableOpacity style={styles.btnBack} onPress={() => setCancelStep('choose')} disabled={cancelling}>
                    <Text style={styles.btnBackText}>Voltar</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.btnConfirm} onPress={() => confirmCancel('refused')} disabled={cancelling}>
                    {cancelling
                      ? <ActivityIndicator size="small" color="#FFF" />
                      : <>
                          <Ionicons name="close-circle-outline" size={16} color="#FFF" />
                          <Text style={styles.btnConfirmText}>Recusar aula</Text>
                        </>
                    }
                  </TouchableOpacity>
                </View>
              </>
            )}

            {/* ── Cancelamento simples (sem class_request) ── */}
            {cancelStep === 'simple' && (
              <>
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
                  <TouchableOpacity style={styles.btnBack} onPress={() => { setCancelTarget(null); setCancelStep(null); }} disabled={cancelling}>
                    <Text style={styles.btnBackText}>Voltar</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.btnConfirm} onPress={() => confirmCancel(null)} disabled={cancelling}>
                    {cancelling
                      ? <ActivityIndicator size="small" color="#FFF" />
                      : <>
                          <Ionicons name="close-circle-outline" size={16} color="#FFF" />
                          <Text style={styles.btnConfirmText}>Cancelar aula</Text>
                        </>
                    }
                  </TouchableOpacity>
                </View>
              </>
            )}

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
    backgroundColor: '#FFF', borderRadius: 20, padding: 24,
    width: '100%', alignItems: 'center',
    ...makeShadow('#000', 20, 0.15, 24, 8),
  },
  modalIconWrap: {
    width: 64, height: 64, borderRadius: 32,
    backgroundColor: '#FEF2F2', alignItems: 'center', justifyContent: 'center',
    marginBottom: 14,
  },
  modalTitle: { fontSize: 18, fontWeight: '800', color: '#111827', marginBottom: 8 },
  modalBody: { fontSize: 14, color: '#4B5563', textAlign: 'center', lineHeight: 22, marginBottom: 4 },
  modalHighlight: { fontWeight: '700', color: '#111827' },
  modalSub: { fontSize: 13, color: '#6B7280', marginBottom: 16, textAlign: 'center' },
  modalWarning: { fontSize: 12, color: '#9CA3AF', marginBottom: 20, textAlign: 'center', lineHeight: 18 },
  modalActions: { flexDirection: 'row', gap: 10, width: '100%' },

  // ── Reason buttons ──
  reasonBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    width: '100%', padding: 14, marginBottom: 10,
    borderRadius: 14, borderWidth: 1.5, borderColor: '#E5E7EB',
    backgroundColor: '#FFFBEB',
  },
  reasonBtnDanger: { backgroundColor: '#FEF2F2', borderColor: '#FECACA' },
  reasonIconWrap: {
    width: 42, height: 42, borderRadius: 21,
    backgroundColor: '#FEF9C3', alignItems: 'center', justifyContent: 'center',
  },
  reasonIconDanger: { backgroundColor: '#FEE2E2' },
  reasonTitle: { fontSize: 14, fontWeight: '700', color: '#111827', marginBottom: 3 },
  reasonDesc: { fontSize: 12, color: '#6B7280', lineHeight: 16 },

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
