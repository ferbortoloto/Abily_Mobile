import React, { useState, useMemo, useEffect, useRef } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, Alert,
  ScrollView, Modal, TextInput, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../hooks/useAuth';
import { useSchedule } from '../../context/ScheduleContext';
import { usePlans } from '../../context/PlansContext';
import AvailabilityViewer from '../../components/user/AvailabilityViewer';
import Avatar from '../../components/shared/Avatar';
import { MeetingPointType } from '../../data/scheduleData';
import { geocodeAddress } from '../../utils/geocoding';
import { makeShadow } from '../../constants/theme';
import { toast } from '../../utils/toast';
import { logger } from '../../utils/logger';

const PRIMARY = '#1D4ED8';

const DAYS_PT = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
const MONTHS_PT = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];

function formatSlotDate(date) {
  if (!date) return '';
  return `${DAYS_PT[date.getDay()]}, ${date.getDate()} ${MONTHS_PT[date.getMonth()]}`;
}

function formatSlots(slots) {
  if (!slots || slots.length === 0) return '';
  const sorted = [...slots].sort();
  if (sorted.length === 1) return sorted[0];
  return `${sorted[0]} – ${sorted[sorted.length - 1]}`;
}

function toSlotTimestamp(date, slot) {
  if (!date || !slot) return null;
  const localDate = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  const tzOffset = -new Date().getTimezoneOffset();
  const tzSign = tzOffset >= 0 ? '+' : '-';
  const tzHH = String(Math.floor(Math.abs(tzOffset) / 60)).padStart(2, '0');
  const tzMM = String(Math.abs(tzOffset) % 60).padStart(2, '0');
  return `${localDate}T${slot}:00${tzSign}${tzHH}:${tzMM}`;
}

function toLocalDate(date) {
  if (!date) return null;
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

export default function BatchScheduleScreen({ route, navigation }) {
  const { purchase, instructor } = route.params;
  const { user } = useAuth();
  const { addBulkRequests, requests, cancelRequest } = useSchedule();
  const { purchases } = usePlans();

  // Use live purchase data for real-time counter updates
  const livePurchase = purchases.find(p => p.id === purchase.id) ?? purchase;
  const classCount = Math.max(livePurchase.classes_remaining ?? livePurchase.classes_total ?? 1, 1);

  // Filter requests for this purchase
  const pendingForPurchase = useMemo(() =>
    requests
      .filter(r => r.purchaseId === purchase.id && r.status === 'pending')
      .sort((a, b) => (a.requestedDate || '').localeCompare(b.requestedDate || '')),
    [requests, purchase.id]
  );

  const acceptedForPurchase = useMemo(() =>
    requests.filter(r => r.purchaseId === purchase.id && r.status === 'accepted'),
    [requests, purchase.id]
  );

  // Track which slots were pre-filled from existing pending requests
  const initializedRef = useRef(false);
  const existingRequestMapRef = useRef({}); // index → { id, dateStr, slots }
  const [prefilledIndices, setPrefilledIndices] = useState(new Set());

  // Array de agendamentos: null = não agendada, { date, slots } = agendada
  const [scheduled, setScheduled] = useState(() => Array(classCount).fill(null));

  // Pre-fill from existing pending requests once they load
  useEffect(() => {
    if (initializedRef.current || pendingForPurchase.length === 0) return;
    initializedRef.current = true;

    // Never exceed classCount — excess pending requests are ignored in the UI
    const count = classCount;
    const newScheduled = Array(count).fill(null);
    const newMap = {};

    pendingForPurchase.forEach((req, i) => {
      if (i >= count) return;
      if (req.requestedDate) {
        const [y, m, d] = req.requestedDate.split('-').map(Number);
        newScheduled[i] = { date: new Date(y, m - 1, d), slots: req.requestedSlots || [] };
      }
      newMap[i] = { id: req.id, dateStr: req.requestedDate, slots: req.requestedSlots || [] };
    });

    existingRequestMapRef.current = newMap;
    setPrefilledIndices(new Set(Object.keys(newMap).map(Number)));
    setScheduled(newScheduled);
  }, [pendingForPurchase]);

  // When a pending request gets accepted/cancelled, clear its slot
  useEffect(() => {
    const map = existingRequestMapRef.current;
    if (Object.keys(map).length === 0) return;

    setScheduled(prev => {
      const next = [...prev];
      let changed = false;
      Object.entries(map).forEach(([idx, { id }]) => {
        const req = requests.find(r => r.id === id);
        if (req && req.status !== 'pending' && next[parseInt(idx)]) {
          next[parseInt(idx)] = null;
          changed = true;
        }
      });
      return changed ? next : prev;
    });

    setPrefilledIndices(prev => {
      let changed = false;
      const next = new Set(prev);
      Object.entries(map).forEach(([idx, { id }]) => {
        const req = requests.find(r => r.id === id);
        if (req && req.status !== 'pending' && prev.has(parseInt(idx))) {
          next.delete(parseInt(idx));
          changed = true;
        }
      });
      return changed ? next : prev;
    });
  }, [requests]);

  // Sync scheduled array length when classCount changes (real-time)
  const prevClassCount = useRef(classCount);
  useEffect(() => {
    if (prevClassCount.current === classCount) return;
    prevClassCount.current = classCount;
    setScheduled(prev => {
      if (prev.length === classCount) return prev;
      if (classCount < prev.length) return prev.slice(0, classCount);
      return [...prev, ...Array(classCount - prev.length).fill(null)];
    });
  }, [classCount]);

  // Ponto de encontro
  const [meetingType, setMeetingType] = useState(
    user?.address ? MeetingPointType.STUDENT_HOME : MeetingPointType.INSTRUCTOR_LOCATION
  );
  const [customAddress, setCustomAddress] = useState('');
  const [customCoordinates, setCustomCoordinates] = useState(null);
  const [geocoding, setGeocoding] = useState(false);

  // Modal de seleção de data/hora
  const [pickerIndex, setPickerIndex] = useState(null);
  const [tempDate, setTempDate] = useState(null);
  const [tempSlots, setTempSlots] = useState([]);

  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [submittedCount, setSubmittedCount] = useState(0);

  const scheduledCount = scheduled.filter(Boolean).length;

  const meetingAddress = useMemo(() => {
    if (meetingType === MeetingPointType.STUDENT_HOME) return user?.address || 'Minha casa';
    if (meetingType === MeetingPointType.INSTRUCTOR_LOCATION) return instructor.location || 'Local do instrutor';
    return customAddress || 'Local personalizado';
  }, [meetingType, user?.address, instructor.location, customAddress]);

  const meetingCoordinates = useMemo(() => {
    if (meetingType === MeetingPointType.STUDENT_HOME) return user?.coordinates ?? null;
    if (meetingType === MeetingPointType.INSTRUCTOR_LOCATION) return instructor.coordinates ?? null;
    return customCoordinates;
  }, [meetingType, user?.coordinates, instructor.coordinates, customCoordinates]);

  const handleGeocodeCustom = async () => {
    if (!customAddress.trim()) return;
    setGeocoding(true);
    try {
      const coords = await geocodeAddress(customAddress);
      if (coords) {
        setCustomCoordinates({ latitude: coords.latitude, longitude: coords.longitude });
        toast.success(`Endereço encontrado: ${coords.displayName.split(',').slice(0, 2).join(',')}`);
      } else {
        toast.error('Endereço não encontrado. Tente ser mais específico.');
      }
    } catch {
      toast.error('Não foi possível buscar o endereço. Verifique sua conexão.');
    } finally {
      setGeocoding(false);
    }
  };

  const _openPicker = (index) => {
    const existing = scheduled[index];
    setTempDate(existing?.date ?? null);
    setTempSlots(existing?.slots ?? []);
    setPickerIndex(index);
  };

  const openPicker = (index) => {
    if (prefilledIndices.has(index) && scheduled[index]) {
      Alert.alert(
        'Alterar solicitação',
        'Você já enviou uma solicitação para esta aula. Editar irá cancelar a anterior e enviar uma nova.',
        [
          { text: 'Voltar', style: 'cancel' },
          { text: 'Editar mesmo assim', onPress: () => _openPicker(index) },
        ]
      );
    } else {
      _openPicker(index);
    }
  };

  const confirmPicker = () => {
    if (!tempDate || tempSlots.length === 0) {
      toast.error('Selecione uma data e pelo menos um horário.');
      return;
    }
    setScheduled(prev => {
      const next = [...prev];
      next[pickerIndex] = { date: tempDate, slots: tempSlots };
      return next;
    });
    setPickerIndex(null);
  };

  const removeScheduled = (index) => {
    setScheduled(prev => {
      const next = [...prev];
      next[index] = null;
      return next;
    });
  };

  const buildRequest = ({ date, slots }) => {
    const sortedSlots = [...slots].sort();
    const firstSlot = sortedSlots[0];
    const lastSlot = sortedSlots[sortedSlots.length - 1];
    const requestedStart = toSlotTimestamp(date, firstSlot);

    let requestedEnd = null;
    if (date && lastSlot) {
      const [h, m] = lastSlot.split(':').map(Number);
      const totalMin = h * 60 + m + 30;
      const endH = String(Math.floor(totalMin / 60) % 24).padStart(2, '0');
      const endM = String(totalMin % 60).padStart(2, '0');
      const localDate = toLocalDate(date);
      const tzOffset = -new Date().getTimezoneOffset();
      const tzSign = tzOffset >= 0 ? '+' : '-';
      const tzHH = String(Math.floor(Math.abs(tzOffset) / 60)).padStart(2, '0');
      const tzMM = String(Math.abs(tzOffset) % 60).padStart(2, '0');
      requestedEnd = `${localDate}T${endH}:${endM}:00${tzSign}${tzHH}:${tzMM}`;
    }

    return {
      instructor_id: instructor.id,
      purchase_id: purchase.id,
      type: purchase.plans?.class_type || 'Aula Prática',
      status: 'pending',
      price: instructor.pricePerHour ?? 0,
      car_option: instructor.carOptions === 'student' ? 'student' : 'instructor',
      meeting_point: {
        type: meetingType,
        address: meetingAddress,
        coordinates: meetingCoordinates,
      },
      requested_slots: sortedSlots,
      requested_date: toLocalDate(date),
      requested_start: requestedStart,
      requested_end: requestedEnd,
    };
  };

  const handleSubmit = async () => {
    if (scheduledCount === 0) {
      toast.error('Agende pelo menos uma aula antes de enviar.');
      return;
    }
    if (scheduledCount > classCount) {
      toast.error(`Você só pode agendar ${classCount} aula${classCount > 1 ? 's' : ''} restante${classCount > 1 ? 's' : ''} neste plano.`);
      return;
    }
    if (meetingType === MeetingPointType.CUSTOM && !customAddress.trim()) {
      toast.error('Informe o endereço do local de encontro.');
      return;
    }

    const map = existingRequestMapRef.current;
    const toCancel = [];
    const toCreate = [];

    scheduled.forEach((slot, index) => {
      const existing = map[index];
      if (slot) {
        const dateStr = toLocalDate(slot.date);
        const slotsKey = [...slot.slots].sort().join(',');
        const existingKey = (existing?.slots || []).slice().sort().join(',');

        if (existing && dateStr === existing.dateStr && slotsKey === existingKey) {
          // Unchanged — skip
        } else {
          if (existing) toCancel.push(existing.id);
          toCreate.push(buildRequest(slot));
        }
      } else {
        if (existing) toCancel.push(existing.id);
      }
    });

    if (toCancel.length === 0 && toCreate.length === 0) {
      toast.error('Nenhuma alteração para enviar.');
      return;
    }

    setSubmitting(true);
    try {
      await Promise.all(toCancel.map(id => cancelRequest(id)));
      if (toCreate.length > 0) await addBulkRequests(toCreate);

      setSubmittedCount(toCreate.length);
      setSubmitted(true);
      setTimeout(() => navigation.goBack(), 2200);
    } catch (e) {
      logger.error('Erro ao criar solicitações em lote:', e);
      toast.error('Não foi possível enviar as solicitações. Tente novamente.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color="#374151" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Agendar Aulas</Text>
        <View style={{ width: 38 }} />
      </View>

      <ScrollView style={styles.scroll} showsVerticalScrollIndicator={false}>

        {/* Contexto do pacote */}
        <View style={styles.contextCard}>
          <Avatar uri={instructor.photo ?? instructor.avatar_url} name={instructor.name} size={44} />
          <View style={styles.contextInfo}>
            <Text style={styles.contextInstructorLabel}>Instrutor</Text>
            <Text style={styles.contextInstructor}>{instructor.name}</Text>
            <Text style={styles.contextPlan}>{purchase.plans?.name}</Text>
          </View>
          <View style={styles.contextBadge}>
            <Text style={styles.contextBadgeNum}>{classCount}</Text>
            <Text style={styles.contextBadgeLabel}>aulas</Text>
          </View>
        </View>

        {/* Ponto de encontro */}
        <Text style={styles.sectionLabel}>Ponto de encontro</Text>
        <View style={styles.meetingCard}>
          {[
            { key: MeetingPointType.STUDENT_HOME, icon: 'home-outline', label: 'Minha casa', sub: user?.address || 'Seu endereço cadastrado' },
            { key: MeetingPointType.INSTRUCTOR_LOCATION, icon: 'location-outline', label: 'Local do instrutor', sub: instructor.location || 'Endereço do instrutor' },
            { key: MeetingPointType.CUSTOM, icon: 'map-outline', label: 'Outro endereço', sub: 'Informe um endereço específico' },
          ].map(opt => (
            <TouchableOpacity
              key={opt.key}
              style={[styles.meetingOption, meetingType === opt.key && styles.meetingOptionSelected]}
              onPress={() => setMeetingType(opt.key)}
              activeOpacity={0.75}
            >
              <View style={[styles.meetingIconBox, meetingType === opt.key && styles.meetingIconBoxSelected]}>
                <Ionicons name={opt.icon} size={18} color={meetingType === opt.key ? PRIMARY : '#6B7280'} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.meetingLabel, meetingType === opt.key && styles.meetingLabelSelected]}>{opt.label}</Text>
                <Text style={styles.meetingSub} numberOfLines={1}>{opt.sub}</Text>
              </View>
              <View style={[styles.radio, meetingType === opt.key && styles.radioSelected]}>
                {meetingType === opt.key && <View style={styles.radioDot} />}
              </View>
            </TouchableOpacity>
          ))}

          {meetingType === MeetingPointType.CUSTOM && (
            <View style={styles.customAddressRow}>
              <TextInput
                style={styles.customInput}
                placeholder="Rua, número, bairro, cidade"
                placeholderTextColor="#9CA3AF"
                value={customAddress}
                onChangeText={setCustomAddress}
                onSubmitEditing={handleGeocodeCustom}
                returnKeyType="search"
              />
              <TouchableOpacity
                style={styles.geocodeBtn}
                onPress={handleGeocodeCustom}
                disabled={geocoding}
                activeOpacity={0.8}
              >
                {geocoding
                  ? <ActivityIndicator size="small" color="#FFF" />
                  : <Ionicons name="search" size={16} color="#FFF" />}
              </TouchableOpacity>
            </View>
          )}
        </View>

        {/* Aulas confirmadas pelo instrutor */}
        {acceptedForPurchase.length > 0 && (
          <>
            <Text style={[styles.sectionLabel, styles.sectionLabelConfirmed]}>
              Aulas marcadas · {acceptedForPurchase.length}
            </Text>
            <View style={styles.classesList}>
              {acceptedForPurchase.map((req) => (
                <View key={req.id} style={[styles.classCard, styles.classCardAccepted]}>
                  <View style={styles.classCardLeft}>
                    <View style={[styles.classNumber, styles.classNumberAccepted]}>
                      <Ionicons name="checkmark" size={14} color="#FFF" />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.classTitle}>Aula confirmada</Text>
                      {req.requestedDate && (
                        <Text style={[styles.classDateText, { color: '#15803D' }]}>
                          {formatSlotDate(new Date(req.requestedDate + 'T12:00:00'))}
                        </Text>
                      )}
                      {req.requestedSlots?.length > 0 && (
                        <Text style={[styles.classSlotsText, { color: '#16A34A' }]}>
                          {formatSlots(req.requestedSlots)}
                        </Text>
                      )}
                    </View>
                  </View>
                  <Ionicons name="checkmark-circle" size={22} color="#16A34A" />
                </View>
              ))}
            </View>
          </>
        )}

        {/* Banner de sucesso após submit */}
        {submitted && (
          <View style={styles.successBanner}>
            <View style={styles.successBannerIcon}>
              <Ionicons name="checkmark-circle" size={24} color="#16A34A" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.successBannerTitle}>
                {submittedCount === 1 ? '1 solicitação enviada!' : `${submittedCount} solicitações enviadas!`}
              </Text>
              <Text style={styles.successBannerSub}>
                Aguardando confirmação de {instructor.name}
              </Text>
            </View>
          </View>
        )}

        {/* Lista de aulas a agendar */}
        <Text style={styles.sectionLabel}>
          {submitted
            ? 'Aulas solicitadas'
            : `Selecione as datas${scheduledCount > 0 ? ` · ${scheduledCount} de ${classCount} agendada${scheduledCount > 1 ? 's' : ''}` : ''}`}
        </Text>

        <View style={styles.classesList}>
          {scheduled.map((item, index) => {
            const isSent = submitted && Boolean(item);
            const isPrefilled = prefilledIndices.has(index) && Boolean(item) && !submitted;
            return (
              <View
                key={index}
                style={[
                  styles.classCard,
                  item && styles.classCardFilled,
                  isSent && styles.classCardSent,
                  isPrefilled && styles.classCardPrefilled,
                ]}
              >
                <View style={styles.classCardLeft}>
                  <View style={[
                    styles.classNumber,
                    item && styles.classNumberFilled,
                    isSent && styles.classNumberSent,
                  ]}>
                    {(isSent || item)
                      ? <Ionicons name="checkmark" size={14} color="#FFF" />
                      : <Text style={styles.classNumberText}>{index + 1}</Text>}
                  </View>
                  <View style={{ flex: 1 }}>
                    <View style={styles.classTitleRow}>
                      <Text style={styles.classTitle}>Aula {index + 1}</Text>
                      {isPrefilled && (
                        <View style={styles.pendingBadge}>
                          <Ionicons name="time-outline" size={10} color="#D97706" />
                          <Text style={styles.pendingBadgeText}>Aguardando</Text>
                        </View>
                      )}
                    </View>
                    {isSent ? (
                      <>
                        <Text style={styles.classDateText}>{formatSlotDate(item.date)}</Text>
                        <Text style={styles.classSentText}>Solicitação enviada · aguardando confirmação</Text>
                      </>
                    ) : item ? (
                      <>
                        <Text style={styles.classDateText}>{formatSlotDate(item.date)}</Text>
                        <Text style={styles.classSlotsText}>{formatSlots(item.slots)}</Text>
                      </>
                    ) : (
                      <Text style={styles.classEmptyText}>Toque para agendar</Text>
                    )}
                  </View>
                </View>

                {!submitted && (
                  <View style={styles.classCardActions}>
                    {item ? (
                      <>
                        <TouchableOpacity style={styles.classEditBtn} onPress={() => openPicker(index)} activeOpacity={0.75}>
                          <Ionicons name="pencil-outline" size={15} color={PRIMARY} />
                        </TouchableOpacity>
                        <TouchableOpacity style={styles.classRemoveBtn} onPress={() => removeScheduled(index)} activeOpacity={0.75}>
                          <Ionicons name="close" size={15} color="#EF4444" />
                        </TouchableOpacity>
                      </>
                    ) : (
                      <TouchableOpacity style={styles.classAddBtn} onPress={() => openPicker(index)} activeOpacity={0.8}>
                        <Ionicons name="add" size={16} color={PRIMARY} />
                        <Text style={styles.classAddBtnText}>Agendar</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                )}

                {isSent && (
                  <View style={styles.sentIcon}>
                    <Ionicons name="time-outline" size={18} color="#16A34A" />
                  </View>
                )}
              </View>
            );
          })}
        </View>

        <View style={{ height: 100 }} />
      </ScrollView>

      {/* Footer */}
      <View style={styles.footer}>
        {submitted ? (
          <View style={styles.footerSubmitted}>
            <Ionicons name="checkmark-circle" size={18} color="#16A34A" />
            <Text style={styles.footerSubmittedText}>Voltando para seus planos...</Text>
          </View>
        ) : (
          <>
            <View style={styles.footerInfo}>
              <Text style={styles.footerCount}>
                {scheduledCount === 0
                  ? 'Nenhuma aula selecionada'
                  : `${scheduledCount} aula${scheduledCount > 1 ? 's' : ''} selecionada${scheduledCount > 1 ? 's' : ''}`}
              </Text>
              {scheduledCount < classCount && (
                <Text style={styles.footerHint}>{classCount - scheduledCount} podem ser agendadas depois</Text>
              )}
            </View>
            <TouchableOpacity
              style={[styles.submitBtn, (scheduledCount === 0 || submitting) && styles.submitBtnDisabled]}
              onPress={handleSubmit}
              disabled={scheduledCount === 0 || submitting}
              activeOpacity={0.85}
            >
              {submitting
                ? <ActivityIndicator size="small" color="#FFF" />
                : <>
                    <Ionicons name="send-outline" size={17} color="#FFF" />
                    <Text style={styles.submitBtnText}>
                      {prefilledIndices.size > 0 ? 'Atualizar solicitações' : 'Enviar solicitações'}
                    </Text>
                  </>}
            </TouchableOpacity>
          </>
        )}
      </View>

      {/* Modal de seleção de data/hora */}
      <Modal visible={pickerIndex !== null} animationType="slide" transparent>
        <View style={styles.pickerOverlay}>
          <View style={styles.pickerSheet}>
            <View style={styles.pickerHandle} />

            <View style={styles.pickerHeader}>
              <Text style={styles.pickerTitle}>
                {pickerIndex !== null ? `Aula ${pickerIndex + 1}` : ''}
              </Text>
              <TouchableOpacity onPress={() => setPickerIndex(null)} style={styles.pickerCloseBtn}>
                <Ionicons name="close" size={20} color="#374151" />
              </TouchableOpacity>
            </View>

            <AvailabilityViewer
              key={pickerIndex}
              instructorId={instructor.id}
              onSlotsSelected={(slots, date) => {
                setTempSlots(slots);
                setTempDate(date);
              }}
            />

            <View style={styles.pickerFooter}>
              {tempDate && tempSlots.length > 0 ? (
                <Text style={styles.pickerSelection}>
                  {formatSlotDate(tempDate)} · {formatSlots(tempSlots)}
                </Text>
              ) : (
                <Text style={styles.pickerHint}>Selecione data e horário acima</Text>
              )}
              <TouchableOpacity
                style={[styles.pickerConfirmBtn, (!tempDate || tempSlots.length === 0) && styles.pickerConfirmBtnDisabled]}
                onPress={confirmPicker}
                disabled={!tempDate || tempSlots.length === 0}
                activeOpacity={0.85}
              >
                <Ionicons name="checkmark-circle-outline" size={18} color="#FFF" />
                <Text style={styles.pickerConfirmBtnText}>Confirmar</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#F9FAFB' },

  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 12,
    backgroundColor: '#FFF', borderBottomWidth: 1, borderBottomColor: '#F3F4F6',
  },
  backBtn: { width: 38, height: 38, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: 17, fontWeight: '800', color: '#111827' },

  scroll: { flex: 1 },

  contextCard: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: '#FFF', margin: 16, marginBottom: 0,
    borderRadius: 16, padding: 14,
    ...makeShadow('#000', 2, 0.06, 6, 3),
  },
  contextInfo: { flex: 1 },
  contextInstructorLabel: { fontSize: 10, fontWeight: '700', color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: 0.5 },
  contextInstructor: { fontSize: 15, fontWeight: '700', color: '#111827', marginTop: 1 },
  contextPlan: { fontSize: 12, color: '#6B7280', marginTop: 2 },
  contextBadge: {
    alignItems: 'center', backgroundColor: '#EFF6FF',
    borderRadius: 12, paddingHorizontal: 12, paddingVertical: 6,
  },
  contextBadgeNum: { fontSize: 20, fontWeight: '800', color: PRIMARY },
  contextBadgeLabel: { fontSize: 10, color: '#2563EB', fontWeight: '600' },

  sectionLabel: {
    fontSize: 13, fontWeight: '700', color: '#374151',
    marginHorizontal: 16, marginTop: 20, marginBottom: 8,
  },
  sectionLabelConfirmed: { color: '#15803D' },

  meetingCard: {
    backgroundColor: '#FFF', marginHorizontal: 16, borderRadius: 16,
    overflow: 'hidden',
    ...makeShadow('#000', 1, 0.05, 4, 2),
  },
  meetingOption: {
    flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14,
    borderBottomWidth: 1, borderBottomColor: '#F3F4F6',
  },
  meetingOptionSelected: { backgroundColor: '#EFF6FF' },
  meetingIconBox: {
    width: 36, height: 36, borderRadius: 10, backgroundColor: '#F3F4F6',
    alignItems: 'center', justifyContent: 'center',
  },
  meetingIconBoxSelected: { backgroundColor: '#DBEAFE' },
  meetingLabel: { fontSize: 14, fontWeight: '600', color: '#374151' },
  meetingLabelSelected: { color: PRIMARY },
  meetingSub: { fontSize: 11, color: '#9CA3AF', marginTop: 1 },
  radio: {
    width: 20, height: 20, borderRadius: 10, borderWidth: 2, borderColor: '#D1D5DB',
    alignItems: 'center', justifyContent: 'center',
  },
  radioSelected: { borderColor: PRIMARY },
  radioDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: PRIMARY },
  customAddressRow: {
    flexDirection: 'row', gap: 8, padding: 12, paddingTop: 8,
  },
  customInput: {
    flex: 1, height: 42, borderWidth: 1.5, borderColor: '#E5E7EB',
    borderRadius: 10, paddingHorizontal: 12, fontSize: 13, color: '#111827',
    backgroundColor: '#FAFAFA',
  },
  geocodeBtn: {
    width: 42, height: 42, borderRadius: 10, backgroundColor: PRIMARY,
    alignItems: 'center', justifyContent: 'center',
  },

  classesList: { marginHorizontal: 16, gap: 10 },
  classCard: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: '#FFF', borderRadius: 14, padding: 14,
    borderWidth: 1.5, borderColor: '#E5E7EB',
    ...makeShadow('#000', 1, 0.04, 4, 2),
  },
  classCardFilled: { borderColor: PRIMARY + '40', backgroundColor: '#FAFEFF' },
  classCardPrefilled: { borderColor: '#FCD34D', backgroundColor: '#FFFBEB' },
  classCardSent: { borderColor: '#16A34A40', backgroundColor: '#F0FDF4' },
  classCardAccepted: { borderColor: '#86EFAC', backgroundColor: '#F0FDF4' },
  classCardLeft: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 12 },
  classNumber: {
    width: 30, height: 30, borderRadius: 15, backgroundColor: '#F3F4F6',
    alignItems: 'center', justifyContent: 'center', flexShrink: 0,
  },
  classNumberFilled: { backgroundColor: PRIMARY },
  classNumberSent: { backgroundColor: '#16A34A' },
  classNumberAccepted: { backgroundColor: '#16A34A' },
  classNumberText: { fontSize: 13, fontWeight: '700', color: '#6B7280' },
  classTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' },
  classTitle: { fontSize: 14, fontWeight: '700', color: '#111827' },
  classDateText: { fontSize: 12, color: PRIMARY, fontWeight: '600', marginTop: 2 },
  classSlotsText: { fontSize: 11, color: '#6B7280', marginTop: 1 },
  classEmptyText: { fontSize: 12, color: '#9CA3AF', marginTop: 2 },
  classSentText: { fontSize: 11, color: '#16A34A', fontWeight: '600', marginTop: 2 },
  sentIcon: { padding: 4 },

  pendingBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 3,
    backgroundColor: '#FFFBEB', borderRadius: 6,
    borderWidth: 1, borderColor: '#FCD34D',
    paddingHorizontal: 5, paddingVertical: 2,
  },
  pendingBadgeText: { fontSize: 9, fontWeight: '700', color: '#D97706' },

  successBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: '#F0FDF4', borderRadius: 14, marginHorizontal: 16, marginTop: 16,
    padding: 14, borderWidth: 1.5, borderColor: '#BBF7D0',
  },
  successBannerIcon: {
    width: 40, height: 40, borderRadius: 20, backgroundColor: '#DCFCE7',
    alignItems: 'center', justifyContent: 'center',
  },
  successBannerTitle: { fontSize: 14, fontWeight: '800', color: '#15803D' },
  successBannerSub: { fontSize: 12, color: '#16A34A', marginTop: 2 },

  classCardActions: { flexDirection: 'row', gap: 6, alignItems: 'center' },
  classEditBtn: {
    width: 32, height: 32, borderRadius: 8, backgroundColor: '#EFF6FF',
    alignItems: 'center', justifyContent: 'center',
  },
  classRemoveBtn: {
    width: 32, height: 32, borderRadius: 8, backgroundColor: '#FEF2F2',
    alignItems: 'center', justifyContent: 'center',
  },
  classAddBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: '#EFF6FF', borderRadius: 8,
    paddingHorizontal: 10, paddingVertical: 7,
  },
  classAddBtnText: { fontSize: 12, fontWeight: '700', color: PRIMARY },

  footer: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 14,
    backgroundColor: '#FFF', borderTopWidth: 1, borderTopColor: '#F3F4F6',
    ...makeShadow('#000', -2, 0.06, 8, 8),
  },
  footerInfo: { flex: 1, marginRight: 12 },
  footerCount: { fontSize: 14, fontWeight: '700', color: '#111827' },
  footerHint: { fontSize: 11, color: '#9CA3AF', marginTop: 2 },
  footerSubmitted: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
  },
  footerSubmittedText: { fontSize: 14, fontWeight: '600', color: '#16A34A' },
  submitBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 7,
    backgroundColor: PRIMARY, borderRadius: 14,
    paddingHorizontal: 18, paddingVertical: 13,
    ...makeShadow(PRIMARY, 3, 0.3, 6, 4),
  },
  submitBtnDisabled: { backgroundColor: '#D1D5DB', ...makeShadow('#000', 0, 0, 0, 0) },
  submitBtnText: { color: '#FFF', fontSize: 14, fontWeight: '700' },

  pickerOverlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end',
  },
  pickerSheet: {
    backgroundColor: '#FFF', borderTopLeftRadius: 24, borderTopRightRadius: 24,
    paddingBottom: 24, maxHeight: '85%',
  },
  pickerHandle: {
    width: 36, height: 4, borderRadius: 2, backgroundColor: '#D1D5DB',
    alignSelf: 'center', marginTop: 10, marginBottom: 4,
  },
  pickerHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingVertical: 12,
    borderBottomWidth: 1, borderBottomColor: '#F3F4F6',
  },
  pickerTitle: { fontSize: 16, fontWeight: '800', color: '#111827' },
  pickerCloseBtn: { padding: 4 },
  pickerFooter: {
    paddingHorizontal: 16, paddingTop: 12, gap: 10,
  },
  pickerSelection: { fontSize: 13, color: PRIMARY, fontWeight: '700', textAlign: 'center' },
  pickerHint: { fontSize: 12, color: '#9CA3AF', textAlign: 'center' },
  pickerConfirmBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: PRIMARY, borderRadius: 14, paddingVertical: 14,
    ...makeShadow(PRIMARY, 2, 0.25, 6, 4),
  },
  pickerConfirmBtnDisabled: { backgroundColor: '#D1D5DB', ...makeShadow('#000', 0, 0, 0, 0) },
  pickerConfirmBtnText: { color: '#FFF', fontSize: 15, fontWeight: '700' },
});
