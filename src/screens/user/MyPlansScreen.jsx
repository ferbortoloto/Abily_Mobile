import React, { useState } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, Modal, Image,
  SectionList, ActivityIndicator, Alert, RefreshControl, Clipboard, Linking, TextInput,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { usePlans } from '../../context/PlansContext';
import { useSchedule } from '../../context/ScheduleContext';
import { useNotifications } from '../../context/NotificationsContext';
import { toast } from '../../utils/toast';
import { getInstructorById } from '../../services/instructors.service';
import Avatar from '../../components/shared/Avatar';
import { makeShadow } from '../../constants/theme';
import { supabase } from '../../lib/supabase';

const PRIMARY = '#1D4ED8';

const DAYS_PT   = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
const MONTHS_PT = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];

function toAppInstructor(p) {
  return {
    id: p.id,
    name: p.name || '',
    photo: p.avatar_url || null,
    carModel: p.car_model || '',
    carYear: p.car_year || null,
    carOptions: p.car_options || 'instructor',
    vehicleType: p.vehicle_type || 'manual',
    licenseCategory: p.license_category || 'B',
    pricePerHour: p.price_per_hour || 0,
    pricePerHourMoto: p.price_per_hour_moto || null,
    rating: p.rating ?? 0,
    isVerified: p.is_verified ?? false,
    location: p.location || '',
    reviewsCount: p.reviews_count ?? 0,
    bio: p.bio || '',
    coordinates: p.coordinates ?? null,
    isAcceptingRequests: p.is_accepting_requests ?? true,
  };
}

function formatDate(isoDate) {
  if (!isoDate) return '';
  return new Date(isoDate).toLocaleDateString('pt-BR');
}

function formatRequestDate(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr + 'T00:00:00');
  return `${DAYS_PT[d.getDay()]}, ${d.getDate()} de ${MONTHS_PT[d.getMonth()]}`;
}

function daysUntil(isoDate) {
  if (!isoDate) return null;
  return Math.ceil((new Date(isoDate) - new Date()) / (1000 * 60 * 60 * 24));
}

function daysOld(isoDate) {
  if (!isoDate) return null;
  return Math.floor((new Date() - new Date(isoDate)) / (1000 * 60 * 60 * 24));
}

// ── Plan card ──────────────────────────────────────────────────────────────────
function PurchaseCard({ purchase, onSchedule, scheduling, onRefund, refunding, onCancelBoleto, cancelling, onCopyBarcode, copied }) {
  const {
    plans: plan,
    profiles: instructorProfile,
    classes_remaining,
    classes_total,
    expires_at,
    status,
    purchased_at,
    payment_method,
    boleto_barcode,
    boleto_url,
  } = purchase;

  const isPendingBoleto   = status === 'pending_payment' && payment_method === 'boleto';
  const isRefundRequested = status === 'refund_requested';
  const age               = daysOld(purchased_at);
  const refundEligible    = !isRefundRequested
    && status === 'active'
    && age !== null && age <= 7
    && classes_remaining === classes_total;

  const progress     = classes_total > 0 ? classes_remaining / classes_total : 0;
  const days         = daysUntil(expires_at);
  const expiringSoon = days !== null && days <= 7;
  const isMisto      = plan?.class_type === 'Misto';

  return (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <Avatar uri={instructorProfile?.avatar_url} name={instructorProfile?.name} size={46} />
        <View style={styles.cardHeaderInfo}>
          <Text style={styles.instructorName}>{instructorProfile?.name}</Text>
          <Text style={styles.planName}>{plan?.name}</Text>
        </View>
        <View style={[styles.typeBadge, { backgroundColor: isMisto ? '#F3E8FF' : '#EFF6FF' }]}>
          <Ionicons name={isMisto ? 'grid-outline' : 'car-outline'} size={12} color={isMisto ? '#7C3AED' : PRIMARY} />
          <Text style={[styles.typeBadgeText, { color: isMisto ? '#7C3AED' : PRIMARY }]}>{plan?.class_type}</Text>
        </View>
      </View>

      {isPendingBoleto ? (
        <>
          <View style={styles.boletoPendingBanner}>
            <Ionicons name="time-outline" size={16} color="#D97706" />
            <View style={{ flex: 1 }}>
              <Text style={styles.boletoPendingTitle}>Aguardando pagamento do boleto</Text>
              <Text style={styles.boletoPendingDesc}>
                A ativação ocorre em até 3 dias úteis após o pagamento. Se já pagou, aguarde.
              </Text>
            </View>
          </View>
          {boleto_barcode ? (
            <TouchableOpacity style={styles.boletoActionBtn} onPress={onCopyBarcode} activeOpacity={0.8}>
              <Ionicons name={copied ? 'checkmark-circle-outline' : 'copy-outline'} size={16} color={PRIMARY} />
              <Text style={styles.boletoActionBtnText}>{copied ? 'Copiado!' : 'Copiar linha digitável'}</Text>
            </TouchableOpacity>
          ) : null}
          {boleto_url ? (
            <TouchableOpacity
              style={[styles.boletoActionBtn, { borderColor: '#D1D5DB' }]}
              onPress={() => Linking.openURL(boleto_url)}
              activeOpacity={0.8}
            >
              <Ionicons name="open-outline" size={16} color="#374151" />
              <Text style={[styles.boletoActionBtnText, { color: '#374151' }]}>Ver PDF do boleto</Text>
            </TouchableOpacity>
          ) : null}
          <TouchableOpacity style={styles.boletoCancelBtn} onPress={onCancelBoleto} disabled={cancelling} activeOpacity={0.8}>
            {cancelling ? <ActivityIndicator size="small" color="#DC2626" /> : (
              <>
                <Ionicons name="close-circle-outline" size={15} color="#DC2626" />
                <Text style={styles.boletoCancelBtnText}>Cancelar boleto (não paguei)</Text>
              </>
            )}
          </TouchableOpacity>
        </>
      ) : (
        <>
          <View style={styles.classesRow}>
            <Text style={styles.classesLabel}>Aulas restantes</Text>
            <Text style={styles.classesCount}>
              <Text style={[styles.classesRemaining, classes_remaining === 0 && { color: '#9CA3AF' }]}>
                {classes_remaining}
              </Text>
              <Text style={styles.classesTotal}> de {classes_total}</Text>
            </Text>
          </View>
          <View style={styles.progressTrack}>
            <View style={[styles.progressFill, { width: `${progress * 100}%` }]} />
          </View>
          <View style={styles.expirationRow}>
            <Ionicons name="time-outline" size={13} color={expiringSoon ? '#DC2626' : '#6B7280'} />
            <Text style={[styles.expirationText, expiringSoon && styles.expirationWarning]}>
              {days !== null && days <= 0
                ? 'Plano expirado'
                : expiringSoon
                ? `Expira em ${days} dia${days === 1 ? '' : 's'}!`
                : `Válido até ${formatDate(expires_at)}`}
            </Text>
          </View>
          {!isRefundRequested && (
            <TouchableOpacity
              style={[styles.scheduleBtn, classes_remaining === 0 && styles.scheduleBtnDisabled]}
              onPress={onSchedule}
              disabled={classes_remaining === 0 || scheduling}
              activeOpacity={0.85}
            >
              {scheduling ? <ActivityIndicator size="small" color="#FFF" /> : (
                <>
                  <Ionicons name="calendar-outline" size={16} color="#FFF" />
                  <Text style={styles.scheduleBtnText}>
                    {classes_remaining === 0 ? 'Aulas esgotadas' : 'Agendar aula'}
                  </Text>
                </>
              )}
            </TouchableOpacity>
          )}
          {isRefundRequested && (
            <View style={styles.refundBadge}>
              <Ionicons name="time-outline" size={14} color="#92400E" />
              <Text style={styles.refundBadgeText}>Reembolso em análise</Text>
            </View>
          )}
          {refundEligible && (
            <TouchableOpacity style={styles.refundBtn} onPress={onRefund} disabled={refunding} activeOpacity={0.8}>
              {refunding ? <ActivityIndicator size="small" color="#B45309" /> : (
                <>
                  <Ionicons name="return-down-back-outline" size={14} color="#B45309" />
                  <Text style={styles.refundBtnText}>
                    Solicitar reembolso ({7 - age} dia{7 - age === 1 ? '' : 's'} restantes)
                  </Text>
                </>
              )}
            </TouchableOpacity>
          )}
        </>
      )}
    </View>
  );
}

// ── Notification card ──────────────────────────────────────────────────────────
function NotificationCard({ notif, onDismiss }) {
  const isAccepted = notif.type === 'class_accepted';
  return (
    <View style={[styles.notifCard, { borderColor: isAccepted ? '#BBF7D0' : '#FECACA' }]}>
      <View style={[styles.notifIcon, { backgroundColor: isAccepted ? '#DCFCE7' : '#FEE2E2' }]}>
        <Ionicons
          name={isAccepted ? 'checkmark-circle' : 'close-circle'}
          size={20}
          color={isAccepted ? '#16A34A' : '#DC2626'}
        />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.notifTitle}>{notif.title}</Text>
        <Text style={styles.notifBody}>{notif.body}</Text>
      </View>
      <TouchableOpacity
        onPress={() => onDismiss(notif.id)}
        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
      >
        <Ionicons name="close" size={16} color="#9CA3AF" />
      </TouchableOpacity>
    </View>
  );
}

// ── Class request card ─────────────────────────────────────────────────────────
// Pix expira em ~30 min (comportamento padrão Asaas sandbox; em prod pode variar)
const PIX_EXPIRY_MS = 30 * 60 * 1000;

function ClassRequestCard({ request, onOpenPayment, onCancel, onReschedule, cancelling, rescheduling }) {
  const {
    status, type, requestedDate, requestedSlots, instructorName, instructorAvatar,
    is_avulsa, payment_method, createdAt, avulsa_price,
    rescheduleRequested, rescheduleDate, rescheduleSlots,
    cancellationReason,
  } = request;

  const isAwaitingPayment  = status === 'awaiting_payment';
  const isPending          = status === 'pending';
  const isAccepted         = status === 'accepted';
  // Instrutor teve imprevisto: aula aceita mas precisa ser reagendada pelo aluno
  const isEmergencyPending = isAccepted && cancellationReason === 'emergency';

  // Pix expira após PIX_EXPIRY_MS sem pagamento
  const isPixExpired = isAwaitingPayment
    && is_avulsa
    && payment_method === 'pix'
    && createdAt
    && (Date.now() - new Date(createdAt).getTime()) > PIX_EXPIRY_MS;

  // Bloqueia cancelamento apenas APÓS o dia da aula ter passado completamente (usa 23:59 do dia).
  // Usar meia-noite (T00:00) faria o botão sumir antes mesmo da aula acontecer.
  const classDateEnd    = requestedDate ? new Date(requestedDate + 'T23:59:59') : null;
  const hoursUntilClass = classDateEnd ? (classDateEnd.getTime() - Date.now()) / 3600000 : null;
  const canCancelAccepted = isAccepted && !rescheduleRequested;
  const tooLateToCancel   = isAccepted && hoursUntilClass !== null && hoursUntilClass < 0;

  // Taxa fixa de R$5 para qualquer cancelamento pelo aluno
  const cancelFeeLabel = is_avulsa && avulsa_price
    ? `Taxa de R$ 5,00 — estorno de R$ ${Math.max(0, avulsa_price - 5).toFixed(2)}`
    : null;

  const dateLabel  = requestedDate ? formatRequestDate(requestedDate) : null;
  const slotsLabel = Array.isArray(requestedSlots) && requestedSlots.length > 0
    ? requestedSlots.join(', ') : null;

  const borderColor = isPixExpired   ? '#FECACA'
    : isAwaitingPayment              ? '#FDE68A'
    : isAccepted                     ? '#BBF7D0'
    : '#E5E7EB';
  const bgColor = isPixExpired   ? '#FFF5F5'
    : isAwaitingPayment          ? '#FFFBEB'
    : isAccepted                 ? '#F0FDF4'
    : '#FAFAFA';

  return (
    <View style={[styles.requestCard, { borderColor, backgroundColor: bgColor }]}>
      {/* Header: instrutor + status */}
      <View style={styles.requestCardHeader}>
        <Avatar uri={instructorAvatar} name={instructorName} size={36} />
        <View style={{ flex: 1 }}>
          <Text style={styles.requestInstructor}>{instructorName || 'Instrutor'}</Text>
          <Text style={styles.requestType}>{type}</Text>
        </View>
        <StatusBadge status={isPixExpired ? 'pix_expired' : status} />
      </View>

      {/* Aviso Pix vencido */}
      {isPixExpired && (
        <View style={styles.pixExpiredBanner}>
          <Ionicons name="alert-circle-outline" size={14} color="#DC2626" />
          <Text style={styles.pixExpiredText}>
            O QR Code Pix venceu. Cancele e refaça a solicitação se quiser pagar.
          </Text>
        </View>
      )}

      {/* Data e hora */}
      {(dateLabel || slotsLabel) ? (
        <View style={styles.requestDateRow}>
          {dateLabel ? (
            <View style={styles.requestDateItem}>
              <Ionicons name="calendar-outline" size={13} color="#6B7280" />
              <Text style={styles.requestDateText}>{dateLabel}</Text>
            </View>
          ) : null}
          {slotsLabel ? (
            <View style={styles.requestDateItem}>
              <Ionicons name="time-outline" size={13} color="#6B7280" />
              <Text style={styles.requestDateText}>{slotsLabel}</Text>
            </View>
          ) : null}
        </View>
      ) : null}

      {/* Ações para awaiting_payment ou pending */}
      {(isAwaitingPayment || isPending) && (
        <View style={styles.requestActions}>
          {isAwaitingPayment && !isPixExpired && (
            <TouchableOpacity
              style={styles.payBtn}
              onPress={onOpenPayment}
              activeOpacity={0.85}
            >
              <Ionicons name="cash-outline" size={15} color="#FFF" />
              <Text style={styles.payBtnText}>Pagar agora</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity
            style={[styles.cancelClassBtn, (isPixExpired || isPending) && styles.cancelClassBtnFull]}
            onPress={() => {
              Alert.alert(
                'Cancelar aula',
                isPending
                  ? 'Tem certeza que deseja cancelar esta solicitação?'
                  : isPixExpired
                    ? 'O Pix venceu. Deseja cancelar esta solicitação?'
                    : 'Tem certeza que deseja cancelar? Se já pagou, o estorno é automático.',
                [
                  { text: 'Voltar', style: 'cancel' },
                  { text: 'Cancelar aula', style: 'destructive', onPress: onCancel },
                ]
              );
            }}
            disabled={cancelling}
            activeOpacity={0.8}
          >
            {cancelling
              ? <ActivityIndicator size="small" color="#DC2626" />
              : <Text style={styles.cancelClassBtnText}>
                  {isPending ? 'Cancelar solicitação' : isPixExpired ? 'Cancelar solicitação' : 'Não vou pagar — cancelar'}
                </Text>
            }
          </TouchableOpacity>
        </View>
      )}

      {/* Banner de imprevisto do instrutor */}
      {isEmergencyPending && !rescheduleRequested && (
        <View style={styles.emergencyBanner}>
          <Ionicons name="warning-outline" size={16} color="#D97706" />
          <View style={{ flex: 1 }}>
            <Text style={styles.emergencyBannerTitle}>Instrutor teve um imprevisto</Text>
            <Text style={styles.emergencyBannerSub}>
              {is_avulsa
                ? 'Seu pagamento está garantido. Escolha um novo horário para reagendar.'
                : 'Seu crédito está garantido. Escolha um novo horário para reagendar.'}
            </Text>
          </View>
        </View>
      )}

      {/* Botão de reagendamento para imprevisto */}
      {isEmergencyPending && !rescheduleRequested && (
        <View style={styles.acceptedActions}>
          <TouchableOpacity
            style={[styles.rescheduleBtn, { flex: 1 }]}
            onPress={onReschedule}
            disabled={rescheduling}
            activeOpacity={0.8}
          >
            {rescheduling
              ? <ActivityIndicator size="small" color="#2563EB" />
              : <>
                  <Ionicons name="swap-horizontal-outline" size={14} color="#2563EB" />
                  <Text style={styles.rescheduleBtnText}>Reagendar agora</Text>
                </>
            }
          </TouchableOpacity>
        </View>
      )}

      {/* Reagendamento pendente de aprovação do instrutor */}
      {rescheduleRequested && (
        <View style={styles.reschedulePendingBanner}>
          <Ionicons name="swap-horizontal-outline" size={14} color="#2563EB" />
          <View style={{ flex: 1 }}>
            <Text style={styles.reschedulePendingText}>Reagendamento aguardando aprovação</Text>
            {rescheduleDate && (
              <Text style={styles.reschedulePendingSub}>
                Nova data: {formatRequestDate(rescheduleDate)}
                {rescheduleSlots?.length > 0 ? ` · ${rescheduleSlots.join(', ')}` : ''}
              </Text>
            )}
          </View>
        </View>
      )}

      {/* Ações para aulas confirmadas: trocar horário + cancelar */}
      {isAccepted && !rescheduleRequested && !tooLateToCancel && !isEmergencyPending && (
        <View style={styles.acceptedActions}>
          <TouchableOpacity
            style={styles.rescheduleBtn}
            onPress={onReschedule}
            disabled={rescheduling}
            activeOpacity={0.8}
          >
            {rescheduling
              ? <ActivityIndicator size="small" color="#2563EB" />
              : <>
                  <Ionicons name="swap-horizontal-outline" size={14} color="#2563EB" />
                  <Text style={styles.rescheduleBtnText}>Trocar horário</Text>
                </>
            }
          </TouchableOpacity>

          {canCancelAccepted && (
            <TouchableOpacity
              style={styles.cancelClassBtn}
              onPress={() => {
                const feeMsg = cancelFeeLabel ? `\n\n${cancelFeeLabel}` : '';
                Alert.alert(
                  'Cancelar aula confirmada',
                  is_avulsa
                    ? `O estorno será processado automaticamente.${feeMsg}`
                    : 'O crédito da aula será devolvido ao seu plano.',
                  [
                    { text: 'Voltar', style: 'cancel' },
                    { text: 'Cancelar aula', style: 'destructive', onPress: onCancel },
                  ]
                );
              }}
              disabled={cancelling}
              activeOpacity={0.8}
            >
              {cancelling
                ? <ActivityIndicator size="small" color="#DC2626" />
                : <Text style={styles.cancelClassBtnText}>Cancelar</Text>
              }
            </TouchableOpacity>
          )}
        </View>
      )}

      {/* Aviso: aula já iniciou/passou */}
      {tooLateToCancel && (
        <View style={styles.lateCancelWarning}>
          <Ionicons name="time-outline" size={13} color="#D97706" />
          <Text style={styles.lateCancelText}>Aula em andamento ou já realizada</Text>
        </View>
      )}
    </View>
  );
}

function StatusBadge({ status }) {
  const config = {
    awaiting_payment: { label: 'Aguarda pagamento', color: '#D97706', bg: '#FEF3C7' },
    pix_expired:      { label: 'Pix vencido',        color: '#DC2626', bg: '#FEE2E2' },
    pending:          { label: 'Aguardando instrutor', color: '#2563EB', bg: '#DBEAFE' },
    accepted:         { label: 'Confirmada',           color: '#16A34A', bg: '#DCFCE7' },
  }[status] || { label: status, color: '#6B7280', bg: '#F3F4F6' };

  return (
    <View style={[styles.statusBadge, { backgroundColor: config.bg }]}>
      <Text style={[styles.statusBadgeText, { color: config.color }]}>{config.label}</Text>
    </View>
  );
}

// ── AvulsaPaymentModal ─────────────────────────────────────────────────────────
function AvulsaPaymentModal({ visible, requestId, onClose, onPaid }) {
  const [avulsa, setAvulsa] = useState(null);
  const [copied, setCopied] = useState(false);
  const [loading, setLoading] = useState(true);

  React.useEffect(() => {
    if (!visible || !requestId) return;
    setLoading(true);
    supabase
      .from('avulsa_payments')
      .select('*')
      .eq('class_request_id', requestId)
      .eq('status', 'pending_payment')
      .maybeSingle()
      .then(({ data }) => { setAvulsa(data); setLoading(false); });
  }, [visible, requestId]);

  React.useEffect(() => {
    if (!visible || !avulsa?.id) return;
    const channel = supabase
      .channel(`avulsa_pay_${avulsa.id}`)
      .on('postgres_changes', {
        event: 'UPDATE', schema: 'public', table: 'avulsa_payments',
        filter: `id=eq.${avulsa.id}`,
      }, (payload) => {
        if (payload.new.status === 'paid') { onPaid(); onClose(); }
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [visible, avulsa?.id]);

  const handleCopy = () => {
    if (!avulsa?.pix_copy_paste) return;
    Clipboard.setString(avulsa.pix_copy_paste);
    setCopied(true);
    setTimeout(() => setCopied(false), 3000);
  };

  const pm = avulsa?.payment_method;

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={pmStyles.overlay}>
        <View style={pmStyles.sheet}>
          <View style={pmStyles.handle} />
          <Text style={pmStyles.title}>Pagamento Pendente</Text>
          <Text style={pmStyles.sub}>
            O instrutor aceitou sua aula! Conclua o pagamento para confirmar.
          </Text>

          {loading && <ActivityIndicator color={PRIMARY} style={{ marginVertical: 24 }} />}
          {!loading && !avulsa && (
            <Text style={pmStyles.noData}>Nenhum pagamento pendente encontrado.</Text>
          )}

          {!loading && avulsa && pm === 'pix' && (
            <>
              {avulsa.pix_qrcode ? (
                <Image
                  source={{ uri: `data:image/png;base64,${avulsa.pix_qrcode}` }}
                  style={pmStyles.qr}
                  resizeMode="contain"
                />
              ) : null}
              <TouchableOpacity style={pmStyles.copyBtn} onPress={handleCopy}>
                <Ionicons name={copied ? 'checkmark-circle' : 'copy-outline'} size={18} color="#FFF" />
                <Text style={pmStyles.copyBtnText}>{copied ? 'Copiado!' : 'Copiar chave Pix'}</Text>
              </TouchableOpacity>
              <Text style={pmStyles.info}>Aguardando confirmação automática após pagamento</Text>
            </>
          )}

          {!loading && avulsa && pm === 'boleto' && (
            <>
              {avulsa.boleto_barcode ? (
                <View style={pmStyles.barcodeBox}>
                  <Text style={pmStyles.barcodeText} selectable>{avulsa.boleto_barcode}</Text>
                </View>
              ) : null}
              {avulsa.boleto_url ? (
                <TouchableOpacity style={pmStyles.copyBtn} onPress={() => Linking.openURL(avulsa.boleto_url)}>
                  <Ionicons name="document-outline" size={18} color="#FFF" />
                  <Text style={pmStyles.copyBtnText}>Abrir boleto</Text>
                </TouchableOpacity>
              ) : null}
              <Text style={pmStyles.info}>O pagamento pode levar até 3 dias úteis para ser confirmado</Text>
            </>
          )}

          {!loading && avulsa && pm === 'credit_card' && avulsa.invoice_url && (
            <TouchableOpacity style={pmStyles.copyBtn} onPress={() => Linking.openURL(avulsa.invoice_url)}>
              <Ionicons name="card-outline" size={18} color="#FFF" />
              <Text style={pmStyles.copyBtnText}>Pagar com cartão</Text>
            </TouchableOpacity>
          )}

          <TouchableOpacity style={pmStyles.closeBtn} onPress={onClose}>
            <Text style={pmStyles.closeBtnText}>Fechar</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

// ── Main screen ────────────────────────────────────────────────────────────────
export default function MyPlansScreen({ navigation }) {
  const { purchases, purchasesLoading, loadPurchases, requestRefund, cancelPendingPayment } = usePlans();
  const { requests, loadData } = useSchedule();
  const { notifications, markRead } = useNotifications();

  const [schedulingId, setSchedulingId]   = useState(null);
  const [refundingId, setRefundingId]     = useState(null);
  const [cancellingId, setCancellingId]   = useState(null);
  const [copiedId, setCopiedId]           = useState(null);
  const [refreshing, setRefreshing]       = useState(false);
  const [cancellingReqId, setCancellingReqId] = useState(null);
  const [avulsaPaymentReqId, setAvulsaPaymentReqId] = useState(null);

  // ── Reagendamento ──────────────────────────────────────────────────────────────
  const [rescheduleTarget, setRescheduleTarget] = useState(null); // request sendo reagendada
  const [rescheduleDate, setRescheduleDate]     = useState('');   // 'YYYY-MM-DD'
  const [rescheduleSlots, setRescheduleSlots]   = useState([]);
  const [reschedulingId, setReschedulingId]     = useState(null);

  const COMMON_SLOTS = ['06:00','07:00','08:00','09:00','10:00','11:00','14:00','15:00','16:00','17:00','18:00','19:00'];

  const handleRescheduleRequest = async () => {
    if (!rescheduleTarget || !rescheduleDate || rescheduleSlots.length === 0) {
      Alert.alert('Campos obrigatórios', 'Selecione uma data e ao menos um horário.');
      return;
    }
    setReschedulingId(rescheduleTarget.id);
    try {
      const { error } = await supabase
        .from('class_requests')
        .update({
          reschedule_requested: true,
          reschedule_date:      rescheduleDate,
          reschedule_slots:     rescheduleSlots,
        })
        .eq('id', rescheduleTarget.id);
      if (error) throw error;
      await loadData();
      toast.success('Solicitação de reagendamento enviada ao instrutor.');
      setRescheduleTarget(null);
      setRescheduleDate('');
      setRescheduleSlots([]);
    } catch (e) {
      toast.error('Não foi possível enviar o reagendamento. Tente novamente.');
    } finally {
      setReschedulingId(null);
    }
  };

  const visiblePurchases = purchases.filter(p =>
    ['active', 'refund_requested', 'pending_payment'].includes(p.status)
  );

  const activeRequests = requests
    .filter(r => ['awaiting_payment', 'pending', 'accepted'].includes(r.status))
    .sort((a, b) => {
      const order = { awaiting_payment: 0, pending: 1, accepted: 2 };
      return (order[a.status] ?? 3) - (order[b.status] ?? 3);
    });

  const handleRefresh = async () => {
    setRefreshing(true);
    try { await Promise.all([loadPurchases(), loadData()]); } finally { setRefreshing(false); }
  };

  const handleRefund = (purchase) => {
    Alert.alert(
      'Solicitar reembolso',
      `Tem certeza que deseja cancelar o plano "${purchase.plans?.name}" e solicitar reembolso de R$ ${purchase.price_paid}?\n\nNenhuma aula será descontada do seu saldo.`,
      [
        { text: 'Voltar', style: 'cancel' },
        {
          text: 'Solicitar reembolso',
          style: 'destructive',
          onPress: async () => {
            setRefundingId(purchase.id);
            try {
              await requestRefund(purchase.id);
              toast.success('Reembolso solicitado! Entraremos em contato em breve.');
            } catch (e) {
              toast.error('Não foi possível solicitar o reembolso. Tente novamente.');
            } finally {
              setRefundingId(null);
            }
          },
        },
      ]
    );
  };

  const handleCancelBoleto = (purchase) => {
    Alert.alert(
      'Cancelar boleto',
      `Tem certeza que deseja cancelar o boleto do plano "${purchase.plans?.name}"?\n\nSe você já pagou, não cancele — o sistema ativará o plano automaticamente.`,
      [
        { text: 'Voltar', style: 'cancel' },
        {
          text: 'Cancelar boleto',
          style: 'destructive',
          onPress: async () => {
            setCancellingId(purchase.id);
            try {
              await cancelPendingPayment(purchase.id);
              toast.success('Boleto cancelado com sucesso.');
            } catch (e) {
              toast.error('Não foi possível cancelar o boleto. Tente novamente.');
            } finally {
              setCancellingId(null);
            }
          },
        },
      ]
    );
  };

  const handleCopyBarcode = (purchase) => {
    if (!purchase.boleto_barcode) return;
    Clipboard.setString(purchase.boleto_barcode);
    setCopiedId(purchase.id);
    setTimeout(() => setCopiedId(null), 3000);
  };

  const handleSchedule = async (purchase) => {
    setSchedulingId(purchase.id);
    try {
      const raw        = await getInstructorById(purchase.instructor_id);
      const instructor = toAppInstructor(raw);
      navigation.navigate('BatchSchedule', { purchase, instructor });
    } catch {
      // mantém na tela em caso de erro de rede
    } finally {
      setSchedulingId(null);
    }
  };

  const handleCancelRequest = async (requestId, isAvulsa) => {
    setCancellingReqId(requestId);
    try {
      const { data, error } = await supabase.functions.invoke('cancel-payment', {
        body: { class_request_id: requestId },
      });
      if (error || data?.error) throw new Error(data?.error || 'Não foi possível cancelar a aula.');
      await loadData();
      toast.success(
        isAvulsa
          ? 'Aula cancelada. O estorno (menos a taxa de R$5) será processado automaticamente.'
          : 'Aula cancelada. O crédito foi devolvido ao seu plano.',
      );
    } catch (e) {
      toast.error(e.message || 'Não foi possível cancelar a aula.');
    } finally {
      setCancellingReqId(null);
    }
  };

  const isEmpty = visiblePurchases.length === 0 && activeRequests.length === 0;

  if (purchasesLoading) {
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Minhas Aulas</Text>
        </View>
        <View style={styles.empty}>
          <ActivityIndicator size="large" color={PRIMARY} />
          <Text style={styles.loadingText}>Carregando...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (isEmpty) {
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Minhas Aulas</Text>
          <TouchableOpacity style={styles.historyBtn} onPress={() => navigation.navigate('ClassHistory')} activeOpacity={0.7}>
            <Ionicons name="time-outline" size={16} color="#64748B" />
            <Text style={styles.historyBtnText}>Histórico</Text>
          </TouchableOpacity>
        </View>
        <View style={styles.empty}>
          <View style={styles.emptyIconWrap}>
            <Ionicons name="layers-outline" size={40} color="#7C3AED" />
          </View>
          <Text style={styles.emptyTitle}>Nenhum plano ou aula ativa</Text>
          <Text style={styles.emptySub}>
            Contrate um pacote de aulas com um instrutor para começar a agendar.
          </Text>
          <TouchableOpacity style={styles.emptyBtn} onPress={() => navigation.navigate('MapaTab')} activeOpacity={0.85}>
            <Ionicons name="search-outline" size={16} color="#FFF" />
            <Text style={styles.emptyBtnText}>Buscar instrutores</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.historyLinkBtn} onPress={() => navigation.navigate('ClassHistory')} activeOpacity={0.7}>
            <Ionicons name="time-outline" size={15} color="#64748B" />
            <Text style={styles.historyLinkText}>Ver histórico de aulas</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const unreadNotifications = notifications.filter(n => !n.read);

  // Monta seções para o SectionList
  const sections = [];
  if (unreadNotifications.length > 0) {
    sections.push({ key: 'notifications', title: 'Notificações', data: unreadNotifications });
  }
  if (visiblePurchases.length > 0) {
    sections.push({ key: 'plans', title: 'Meu Plano', data: visiblePurchases });
  }
  if (activeRequests.length > 0) {
    sections.push({ key: 'requests', title: 'Aulas', data: activeRequests });
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <Text style={styles.headerTitle}>Minhas Aulas</Text>
          {(activeRequests.length > 0 || unreadNotifications.length > 0) && (
            <View style={styles.countBadge}>
              <Text style={styles.countBadgeText}>
                {unreadNotifications.length > 0 ? unreadNotifications.length : activeRequests.length}
              </Text>
            </View>
          )}
        </View>
        <TouchableOpacity style={styles.historyBtn} onPress={() => navigation.navigate('ClassHistory')} activeOpacity={0.7}>
          <Ionicons name="time-outline" size={16} color="#64748B" />
          <Text style={styles.historyBtnText}>Histórico</Text>
        </TouchableOpacity>
      </View>

      <SectionList
        sections={sections}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        showsVerticalScrollIndicator={false}
        stickySectionHeadersEnabled={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={PRIMARY} />}
        ListFooterComponent={
          <TouchableOpacity style={styles.historyFooterBtn} onPress={() => navigation.navigate('ClassHistory')} activeOpacity={0.7}>
            <Ionicons name="time-outline" size={16} color="#64748B" />
            <Text style={styles.historyFooterText}>Ver histórico de aulas anteriores</Text>
            <Ionicons name="chevron-forward" size={14} color="#94A3B8" />
          </TouchableOpacity>
        }
        renderSectionHeader={({ section }) => (
          <Text style={styles.sectionTitle}>{section.title}</Text>
        )}
        renderItem={({ item, section }) => {
          if (section.key === 'notifications') {
            return <NotificationCard notif={item} onDismiss={markRead} />;
          }
          if (section.key === 'plans') {
            return (
              <PurchaseCard
                purchase={item}
                onSchedule={() => handleSchedule(item)}
                scheduling={schedulingId === item.id}
                onRefund={() => handleRefund(item)}
                refunding={refundingId === item.id}
                onCancelBoleto={() => handleCancelBoleto(item)}
                cancelling={cancellingId === item.id}
                onCopyBarcode={() => handleCopyBarcode(item)}
                copied={copiedId === item.id}
              />
            );
          }
          return (
            <ClassRequestCard
              request={item}
              onOpenPayment={() => setAvulsaPaymentReqId(item.id)}
              onCancel={() => handleCancelRequest(item.id, item.is_avulsa)}
              onReschedule={() => {
                setRescheduleDate('');
                setRescheduleSlots([]);
                setRescheduleTarget(item);
              }}
              cancelling={cancellingReqId === item.id}
              rescheduling={reschedulingId === item.id}
            />
          );
        }}
      />

      <AvulsaPaymentModal
        visible={!!avulsaPaymentReqId}
        requestId={avulsaPaymentReqId}
        onClose={() => setAvulsaPaymentReqId(null)}
        onPaid={() => {
          setAvulsaPaymentReqId(null);
          loadData();
          toast.success('Pagamento confirmado! Sua aula está agendada.');
        }}
      />

      {/* Modal de reagendamento */}
      <Modal
        visible={!!rescheduleTarget}
        transparent
        animationType="slide"
        onRequestClose={() => setRescheduleTarget(null)}
      >
        <View style={styles.rescheduleOverlay}>
          <View style={styles.rescheduleSheet}>
            <View style={styles.rescheduleHandle} />
            <Text style={styles.rescheduleTitle}>Trocar horário</Text>
            <Text style={styles.rescheduleSub}>
              Informe a nova data e horário desejados. O instrutor precisará aprovar.
            </Text>

            <Text style={styles.rescheduleLabel}>Data (DD/MM/AAAA)</Text>
            <TextInput
              style={styles.rescheduleInput}
              placeholder="Ex: 15/06/2025"
              placeholderTextColor="#9CA3AF"
              value={rescheduleDate.split('-').reverse().join('/')}
              onChangeText={(val) => {
                const parts = val.replace(/\D/g, '');
                if (parts.length <= 8) {
                  const d = parts.slice(0, 2);
                  const m = parts.slice(2, 4);
                  const y = parts.slice(4, 8);
                  const iso = y && m && d ? `${y}-${m}-${d}` : '';
                  setRescheduleDate(iso);
                }
              }}
              keyboardType="numeric"
              maxLength={10}
            />

            <Text style={styles.rescheduleLabel}>Horários preferidos</Text>
            <View style={styles.slotsGrid}>
              {COMMON_SLOTS.map(slot => {
                const selected = rescheduleSlots.includes(slot);
                return (
                  <TouchableOpacity
                    key={slot}
                    style={[styles.slotChip, selected && styles.slotChipSelected]}
                    onPress={() => setRescheduleSlots(prev =>
                      prev.includes(slot) ? prev.filter(s => s !== slot) : [...prev, slot]
                    )}
                    activeOpacity={0.8}
                  >
                    <Text style={[styles.slotChipText, selected && styles.slotChipTextSelected]}>
                      {slot}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <View style={styles.rescheduleActions}>
              <TouchableOpacity
                style={styles.rescheduleCancelBtn}
                onPress={() => setRescheduleTarget(null)}
              >
                <Text style={styles.rescheduleCancelText}>Voltar</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.rescheduleConfirmBtn}
                onPress={handleRescheduleRequest}
                disabled={!!reschedulingId}
                activeOpacity={0.85}
              >
                {reschedulingId
                  ? <ActivityIndicator size="small" color="#FFF" />
                  : <>
                      <Ionicons name="swap-horizontal-outline" size={16} color="#FFF" />
                      <Text style={styles.rescheduleConfirmText}>Solicitar</Text>
                    </>
                }
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
    paddingHorizontal: 20, paddingTop: 8, paddingBottom: 14,
    backgroundColor: '#FFF',
    borderBottomWidth: 1, borderBottomColor: '#F1F5F9',
  },
  headerTitle: { fontSize: 22, fontWeight: '800', color: '#0F172A' },
  countBadge: {
    backgroundColor: PRIMARY, borderRadius: 10,
    paddingHorizontal: 8, paddingVertical: 2,
  },
  countBadgeText: { color: '#FFF', fontSize: 12, fontWeight: '700' },
  historyBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    backgroundColor: '#F1F5F9', borderRadius: 10,
    paddingHorizontal: 10, paddingVertical: 6,
  },
  historyBtnText: { fontSize: 12, fontWeight: '600', color: '#64748B' },
  historyFooterBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    marginTop: 8, paddingVertical: 14, paddingHorizontal: 4,
    justifyContent: 'center',
  },
  historyFooterText: { fontSize: 13, fontWeight: '600', color: '#64748B' },
  historyLinkBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    marginTop: 4, paddingVertical: 8,
  },
  historyLinkText: { fontSize: 13, fontWeight: '600', color: '#64748B' },

  list: { padding: 16, paddingBottom: 32, gap: 0 },

  sectionTitle: {
    fontSize: 13, fontWeight: '700', color: '#6B7280',
    textTransform: 'uppercase', letterSpacing: 0.5,
    marginTop: 8, marginBottom: 10,
  },

  // Plan card
  card: {
    backgroundColor: '#FFF', borderRadius: 18, padding: 16, gap: 12,
    marginBottom: 12,
    ...makeShadow('#000', 2, 0.07, 8, 4),
  },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  cardHeaderInfo: { flex: 1 },
  instructorName: { fontSize: 15, fontWeight: '700', color: '#111827' },
  planName: { fontSize: 13, color: '#6B7280', marginTop: 1 },
  typeBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8, flexShrink: 0,
  },
  typeBadgeText: { fontSize: 11, fontWeight: '700' },
  classesRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' },
  classesLabel: { fontSize: 13, color: '#6B7280' },
  classesRemaining: { fontSize: 22, fontWeight: '800', color: PRIMARY },
  classesTotal: { fontSize: 14, color: '#9CA3AF' },
  progressTrack: { height: 6, backgroundColor: '#E2E8F0', borderRadius: 3, overflow: 'hidden' },
  progressFill: { height: '100%', backgroundColor: PRIMARY, borderRadius: 3 },
  expirationRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  expirationText: { fontSize: 12, color: '#6B7280' },
  expirationWarning: { color: '#DC2626', fontWeight: '600' },
  scheduleBtn: {
    backgroundColor: PRIMARY, borderRadius: 12, height: 46,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    ...makeShadow(PRIMARY, 2, 0.25, 6, 4),
  },
  scheduleBtnDisabled: { backgroundColor: '#D1D5DB', ...makeShadow('#000', 0, 0, 0, 0) },
  scheduleBtnText: { color: '#FFF', fontSize: 15, fontWeight: '700' },
  refundBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    borderWidth: 1.5, borderColor: '#FCD34D', borderRadius: 12,
    paddingVertical: 10, backgroundColor: '#FFFBEB',
  },
  refundBtnText: { fontSize: 13, fontWeight: '600', color: '#B45309' },
  refundBadge: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    backgroundColor: '#FEF3C7', borderRadius: 12, paddingVertical: 10,
  },
  refundBadgeText: { fontSize: 13, fontWeight: '600', color: '#92400E' },
  boletoPendingBanner: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 10,
    backgroundColor: '#FFFBEB', borderRadius: 12, padding: 12,
    borderWidth: 1, borderColor: '#FDE68A',
  },
  boletoPendingTitle: { fontSize: 13, fontWeight: '700', color: '#92400E', marginBottom: 2 },
  boletoPendingDesc:  { fontSize: 11, color: '#B45309', lineHeight: 16 },
  boletoActionBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    borderWidth: 1.5, borderColor: PRIMARY, borderRadius: 12, paddingVertical: 10,
  },
  boletoActionBtnText: { fontSize: 13, fontWeight: '700', color: PRIMARY },
  boletoCancelBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    paddingVertical: 8,
  },
  boletoCancelBtnText: { fontSize: 12, color: '#DC2626', fontWeight: '600' },

  // Class request card
  requestCard: {
    borderRadius: 14, padding: 14, marginBottom: 10,
    borderWidth: 1.5, gap: 10,
    ...makeShadow('#000', 1, 0.05, 4, 2),
  },
  requestCardHeader: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  requestInstructor: { fontSize: 14, fontWeight: '700', color: '#111827', marginBottom: 1 },
  requestType: { fontSize: 12, color: '#6B7280' },
  requestDateRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  requestDateItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  requestDateText: { fontSize: 12, color: '#6B7280' },
  requestActions: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 2 },
  payBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    backgroundColor: PRIMARY, borderRadius: 10, paddingVertical: 10,
    ...makeShadow(PRIMARY, 2, 0.2, 4, 2),
  },
  payBtnText: { color: '#FFF', fontSize: 13, fontWeight: '700' },
  cancelClassBtn: { paddingVertical: 12, paddingHorizontal: 8, justifyContent: 'center' },
  cancelClassBtnFull: { flex: 1, alignItems: 'center' },
  cancelClassBtnText: { fontSize: 12, color: '#DC2626', fontWeight: '600' },

  lateCancelWarning: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    marginTop: 12, padding: 10,
    backgroundColor: '#FFFBEB', borderRadius: 8,
    borderWidth: 1, borderColor: '#FDE68A',
  },
  lateCancelText: { fontSize: 12, color: '#D97706', flex: 1 },

  acceptedActions: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    marginTop: 12,
  },
  rescheduleBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5,
    paddingVertical: 10, borderRadius: 10,
    borderWidth: 1.5, borderColor: '#BFDBFE',
    backgroundColor: '#EFF6FF',
  },
  rescheduleBtnText: { fontSize: 12, color: '#2563EB', fontWeight: '700' },

  reschedulePendingBanner: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 8,
    marginTop: 10, padding: 10,
    backgroundColor: '#EFF6FF', borderRadius: 8,
    borderWidth: 1, borderColor: '#BFDBFE',
  },
  reschedulePendingText: { fontSize: 12, color: '#1D4ED8', fontWeight: '700' },
  reschedulePendingSub:  { fontSize: 11, color: '#3B82F6', marginTop: 2 },

  // Modal de reagendamento
  rescheduleOverlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'flex-end',
  },
  rescheduleSheet: {
    backgroundColor: '#FFF', borderTopLeftRadius: 24, borderTopRightRadius: 24,
    padding: 24, paddingBottom: 36,
  },
  rescheduleHandle: {
    width: 40, height: 4, backgroundColor: '#E5E7EB',
    borderRadius: 2, alignSelf: 'center', marginBottom: 20,
  },
  rescheduleTitle: { fontSize: 18, fontWeight: '800', color: '#111827', marginBottom: 6 },
  rescheduleSub:   { fontSize: 13, color: '#6B7280', marginBottom: 20, lineHeight: 20 },
  rescheduleLabel: { fontSize: 13, fontWeight: '700', color: '#374151', marginBottom: 8 },
  rescheduleInput: {
    borderWidth: 1.5, borderColor: '#E5E7EB', borderRadius: 10,
    paddingHorizontal: 14, paddingVertical: 12,
    fontSize: 14, color: '#111827', marginBottom: 20,
  },
  slotsGrid: {
    flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 24,
  },
  slotChip: {
    paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20,
    borderWidth: 1.5, borderColor: '#E5E7EB', backgroundColor: '#F9FAFB',
  },
  slotChipSelected:     { borderColor: '#2563EB', backgroundColor: '#EFF6FF' },
  slotChipText:         { fontSize: 13, color: '#6B7280', fontWeight: '600' },
  slotChipTextSelected: { color: '#2563EB' },
  rescheduleActions: {
    flexDirection: 'row', gap: 10,
  },
  rescheduleCancelBtn: {
    flex: 1, paddingVertical: 13, borderRadius: 12,
    borderWidth: 1.5, borderColor: '#E5E7EB',
    alignItems: 'center', justifyContent: 'center',
  },
  rescheduleCancelText: { fontSize: 14, fontWeight: '700', color: '#374151' },
  rescheduleConfirmBtn: {
    flex: 1.4, paddingVertical: 13, borderRadius: 12,
    backgroundColor: '#2563EB',
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
  },
  rescheduleConfirmText: { fontSize: 14, fontWeight: '700', color: '#FFF' },

  // Banner imprevisto do instrutor
  emergencyBanner: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 10,
    backgroundColor: '#FFFBEB', borderRadius: 10, padding: 12,
    borderWidth: 1, borderColor: '#FDE68A', marginTop: 8,
  },
  emergencyBannerTitle: { fontSize: 13, fontWeight: '700', color: '#92400E', marginBottom: 2 },
  emergencyBannerSub:   { fontSize: 12, color: '#B45309', lineHeight: 16 },

  pixExpiredBanner: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 6,
    backgroundColor: '#FEF2F2', borderRadius: 8, padding: 10,
  },
  pixExpiredText: { fontSize: 12, color: '#DC2626', lineHeight: 17, flex: 1 },

  statusBadge: { borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3 },
  statusBadgeText: { fontSize: 11, fontWeight: '700' },

  // Notification card
  notifCard: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 12,
    backgroundColor: '#FFF', borderRadius: 14, padding: 14, marginBottom: 10,
    borderWidth: 1.5,
    ...makeShadow('#000', 1, 0.05, 4, 2),
  },
  notifIcon: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  notifTitle: { fontSize: 14, fontWeight: '700', color: '#111827', marginBottom: 2 },
  notifBody: { fontSize: 13, color: '#6B7280', lineHeight: 18 },

  // Empty
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32, gap: 12 },
  loadingText: { fontSize: 14, color: '#9CA3AF', marginTop: 8 },
  emptyIconWrap: {
    width: 80, height: 80, borderRadius: 40,
    backgroundColor: '#F3E8FF',
    alignItems: 'center', justifyContent: 'center', marginBottom: 4,
  },
  emptyTitle: { fontSize: 18, fontWeight: '700', color: '#374151' },
  emptySub: { fontSize: 14, color: '#9CA3AF', textAlign: 'center', lineHeight: 20 },
  emptyBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: PRIMARY, borderRadius: 12,
    paddingHorizontal: 20, paddingVertical: 12, marginTop: 8,
  },
  emptyBtnText: { color: '#FFF', fontSize: 15, fontWeight: '700' },
});

const pmStyles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: '#FFF', borderTopLeftRadius: 24, borderTopRightRadius: 24,
    padding: 24, paddingBottom: 40,
  },
  handle: { width: 40, height: 4, backgroundColor: '#E5E7EB', borderRadius: 2, alignSelf: 'center', marginBottom: 20 },
  title: { fontSize: 20, fontWeight: '800', color: '#111827', marginBottom: 8 },
  sub: { fontSize: 14, color: '#6B7280', lineHeight: 20, marginBottom: 20 },
  qr: { width: 200, height: 200, alignSelf: 'center', marginBottom: 16 },
  barcodeBox: { backgroundColor: '#F9FAFB', borderRadius: 10, padding: 12, marginBottom: 16 },
  barcodeText: { fontSize: 12, color: '#374151', lineHeight: 18 },
  copyBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: PRIMARY, borderRadius: 14, paddingVertical: 14, marginBottom: 12,
  },
  copyBtnText: { fontSize: 15, fontWeight: '700', color: '#FFF' },
  info: { fontSize: 12, color: '#9CA3AF', textAlign: 'center', marginBottom: 16 },
  noData: { fontSize: 14, color: '#9CA3AF', textAlign: 'center', paddingVertical: 24 },
  closeBtn: { paddingVertical: 12, alignItems: 'center' },
  closeBtnText: { fontSize: 14, fontWeight: '600', color: '#9CA3AF' },
});
