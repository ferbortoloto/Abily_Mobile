import React, { useState, useEffect } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, Modal, Image,
  FlatList, ActivityIndicator, Alert, RefreshControl, Clipboard, Linking,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { usePlans } from '../../context/PlansContext';
import { useSchedule } from '../../context/ScheduleContext';
import { toast } from '../../utils/toast';
import { getInstructorById } from '../../services/instructors.service';
import Avatar from '../../components/shared/Avatar';
import { makeShadow } from '../../constants/theme';
import { supabase } from '../../lib/supabase';

const PRIMARY = '#1D4ED8';

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

function daysUntil(isoDate) {
  if (!isoDate) return null;
  return Math.ceil((new Date(isoDate) - new Date()) / (1000 * 60 * 60 * 24));
}

function daysOld(isoDate) {
  if (!isoDate) return null;
  return Math.floor((new Date() - new Date(isoDate)) / (1000 * 60 * 60 * 24));
}

function PurchaseCard({ purchase, onSchedule, scheduling, onRefund, refunding, onCancelBoleto, cancelling, onCopyBarcode, copied, pendingCount }) {
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

  const isPendingBoleto  = status === 'pending_payment' && payment_method === 'boleto';
  const isRefundRequested = status === 'refund_requested';
  const age = daysOld(purchased_at);
  const refundEligible = !isRefundRequested
    && status === 'active'
    && age !== null && age <= 7
    && classes_remaining === classes_total;

  const progress = classes_total > 0 ? classes_remaining / classes_total : 0;
  const days = daysUntil(expires_at);
  const expiringSoon = days !== null && days <= 7;
  const isMisto = plan?.class_type === 'Misto';

  return (
    <View style={styles.card}>
      {/* Instrutor + plano */}
      <View style={styles.cardHeader}>
        <Avatar uri={instructorProfile?.avatar_url} name={instructorProfile?.name} size={46} />
        <View style={styles.cardHeaderInfo}>
          <Text style={styles.instructorName}>{instructorProfile?.name}</Text>
          <Text style={styles.planName}>{plan?.name}</Text>
        </View>
        <View style={[styles.typeBadge, { backgroundColor: isMisto ? '#F3E8FF' : '#EFF6FF' }]}>
          <Ionicons
            name={isMisto ? 'grid-outline' : 'car-outline'}
            size={12}
            color={isMisto ? '#7C3AED' : PRIMARY}
          />
          <Text style={[styles.typeBadgeText, { color: isMisto ? '#7C3AED' : PRIMARY }]}>
            {plan?.class_type}
          </Text>
        </View>
      </View>

      {/* Boleto pendente */}
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
              <Text style={styles.boletoActionBtnText}>
                {copied ? 'Copiado!' : 'Copiar linha digitável'}
              </Text>
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

          <TouchableOpacity
            style={styles.boletoCancelBtn}
            onPress={onCancelBoleto}
            disabled={cancelling}
            activeOpacity={0.8}
          >
            {cancelling ? (
              <ActivityIndicator size="small" color="#DC2626" />
            ) : (
              <>
                <Ionicons name="close-circle-outline" size={15} color="#DC2626" />
                <Text style={styles.boletoCancelBtnText}>Cancelar boleto (não paguei)</Text>
              </>
            )}
          </TouchableOpacity>
        </>
      ) : (
        <>
          {/* Saldo de aulas */}
          <View style={styles.classesRow}>
            <Text style={styles.classesLabel}>Aulas restantes</Text>
            <Text style={styles.classesCount}>
              <Text style={[styles.classesRemaining, classes_remaining === 0 && { color: '#9CA3AF' }]}>
                {classes_remaining}
              </Text>
              <Text style={styles.classesTotal}> de {classes_total}</Text>
            </Text>
          </View>

          {/* Barra de progresso */}
          <View style={styles.progressTrack}>
            <View style={[styles.progressFill, { width: `${progress * 100}%` }]} />
          </View>

          {/* Solicitações pendentes */}
          {pendingCount > 0 && (
            <View style={styles.pendingRow}>
              <Ionicons name="time-outline" size={13} color="#D97706" />
              <Text style={styles.pendingText}>
                {pendingCount} aula{pendingCount > 1 ? 's' : ''} aguardando confirmação do instrutor
              </Text>
            </View>
          )}

          {/* Validade */}
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

          {/* Botão agendar */}
          {!isRefundRequested && (
            <TouchableOpacity
              style={[styles.scheduleBtn, classes_remaining === 0 && styles.scheduleBtnDisabled]}
              onPress={onSchedule}
              disabled={classes_remaining === 0 || scheduling}
              activeOpacity={0.85}
            >
              {scheduling ? (
                <ActivityIndicator size="small" color="#FFF" />
              ) : (
                <>
                  <Ionicons name="calendar-outline" size={16} color="#FFF" />
                  <Text style={styles.scheduleBtnText}>
                    {classes_remaining === 0 ? 'Aulas esgotadas' : 'Agendar aula'}
                  </Text>
                </>
              )}
            </TouchableOpacity>
          )}

          {/* Reembolso solicitado */}
          {isRefundRequested && (
            <View style={styles.refundBadge}>
              <Ionicons name="time-outline" size={14} color="#92400E" />
              <Text style={styles.refundBadgeText}>Reembolso em análise</Text>
            </View>
          )}

          {/* Botão solicitar reembolso (7 dias, sem aulas usadas) */}
          {refundEligible && (
            <TouchableOpacity
              style={styles.refundBtn}
              onPress={onRefund}
              disabled={refunding}
              activeOpacity={0.8}
            >
              {refunding ? (
                <ActivityIndicator size="small" color="#B45309" />
              ) : (
                <>
                  <Ionicons name="return-down-back-outline" size={14} color="#B45309" />
                  <Text style={styles.refundBtnText}>Solicitar reembolso ({7 - age} dia{7 - age === 1 ? '' : 's'} restantes)</Text>
                </>
              )}
            </TouchableOpacity>
          )}
        </>
      )}
    </View>
  );
}

// ---------- Modal de pagamento avulso pendente ----------
function AvulsaPaymentModal({ visible, requestId, onClose, onPaid }) {
  const [avulsa, setAvulsa]   = useState(null);
  const [copied, setCopied]   = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
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

  useEffect(() => {
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
            <TouchableOpacity
              style={pmStyles.copyBtn}
              onPress={() => Linking.openURL(avulsa.invoice_url)}
            >
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

export default function MyPlansScreen({ navigation }) {
  const { purchases, purchasesLoading, loadPurchases, requestRefund, cancelPendingPayment } = usePlans();
  const { requests, loadData } = useSchedule();
  const [schedulingId, setSchedulingId]         = useState(null);
  const [refundingId, setRefundingId]           = useState(null);
  const [cancellingId, setCancellingId]         = useState(null);
  const [copiedId, setCopiedId]                 = useState(null);
  const [refreshing, setRefreshing]             = useState(false);
  const [avulsaPaymentReqId, setAvulsaPaymentReqId] = useState(null);

  const awaitingPaymentRequests = requests.filter(r => r.status === 'awaiting_payment' && r.is_avulsa);

  const visiblePurchases = purchases.filter(p =>
    ['active', 'refund_requested', 'pending_payment'].includes(p.status)
  );

  const handleRefresh = async () => {
    setRefreshing(true);
    try { await loadPurchases(); } finally { setRefreshing(false); }
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
              toast.error(e.message || 'Não foi possível solicitar o reembolso.');
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
              toast.error(e.message || 'Não foi possível cancelar.');
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
      const raw = await getInstructorById(purchase.instructor_id);
      const instructor = toAppInstructor(raw);
      navigation.navigate('BatchSchedule', { purchase, instructor });
    } catch {
      // mantém na tela em caso de erro de rede
    } finally {
      setSchedulingId(null);
    }
  };

  if (purchasesLoading) {
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Meus Planos</Text>
        </View>
        <View style={styles.empty}>
          <ActivityIndicator size="large" color={PRIMARY} />
          <Text style={styles.loadingText}>Carregando seus planos...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (visiblePurchases.length === 0) {
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Meus Planos</Text>
        </View>
        <View style={styles.empty}>
          <View style={styles.emptyIconWrap}>
            <Ionicons name="layers-outline" size={40} color="#7C3AED" />
          </View>
          <Text style={styles.emptyTitle}>Nenhum plano ativo</Text>
          <Text style={styles.emptySub}>
            Contrate um pacote de aulas com um instrutor para começar a agendar.
          </Text>
          <TouchableOpacity
            style={styles.emptyBtn}
            onPress={() => navigation.navigate('MapaTab')}
            activeOpacity={0.85}
          >
            <Ionicons name="search-outline" size={16} color="#FFF" />
            <Text style={styles.emptyBtnText}>Buscar instrutores</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Meus Planos</Text>
        <View style={styles.countBadge}>
          <Text style={styles.countBadgeText}>{visiblePurchases.length}</Text>
        </View>
      </View>
      {/* Pagamentos avulsos aguardando pagamento */}
      {awaitingPaymentRequests.map(req => (
        <TouchableOpacity
          key={req.id}
          style={styles.awaitingBanner}
          onPress={() => setAvulsaPaymentReqId(req.id)}
          activeOpacity={0.85}
        >
          <View style={styles.awaitingIcon}>
            <Ionicons name="time-outline" size={20} color="#D97706" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.awaitingTitle}>Pagamento pendente — Aula avulsa</Text>
            <Text style={styles.awaitingSub}>
              {req.type} com {req.instructorName || 'instrutor'} · Toque para pagar
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color="#D97706" />
        </TouchableOpacity>
      ))}

      <FlatList
        data={visiblePurchases}
        keyExtractor={item => item.id}
        contentContainerStyle={styles.list}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={PRIMARY} />}
        renderItem={({ item }) => (
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
            pendingCount={requests.filter(r => r.purchaseId === item.id && r.status === 'pending').length}
          />
        )}
      />

      <AvulsaPaymentModal
        visible={!!avulsaPaymentReqId}
        requestId={avulsaPaymentReqId}
        onClose={() => setAvulsaPaymentReqId(null)}
        onPaid={() => { setAvulsaPaymentReqId(null); loadData(); toast.success('Pagamento confirmado! Sua aula está agendada.'); }}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#F9FAFB' },

  header: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
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

  list: { padding: 16, gap: 12 },

  card: {
    backgroundColor: '#FFF', borderRadius: 18, padding: 16, gap: 12,
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

  pendingRow: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: '#FFFBEB', borderRadius: 8,
    paddingHorizontal: 10, paddingVertical: 7,
  },
  pendingText: { fontSize: 12, color: '#D97706', fontWeight: '600', flex: 1 },

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

  // Boleto pendente
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

  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32, gap: 12 },
  loadingText: { fontSize: 14, color: '#9CA3AF', marginTop: 8 },
  emptyIconWrap: {
    width: 80, height: 80, borderRadius: 40,
    backgroundColor: '#F3E8FF',
    alignItems: 'center', justifyContent: 'center',
    marginBottom: 4,
  },
  emptyTitle: { fontSize: 18, fontWeight: '700', color: '#374151' },
  emptySub: { fontSize: 14, color: '#9CA3AF', textAlign: 'center', lineHeight: 20 },
  emptyBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: PRIMARY, borderRadius: 12,
    paddingHorizontal: 20, paddingVertical: 12, marginTop: 8,
  },
  emptyBtnText: { color: '#FFF', fontSize: 15, fontWeight: '700' },

  // Awaiting payment banner
  awaitingBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: '#FFFBEB', borderRadius: 14, padding: 14,
    marginHorizontal: 16, marginTop: 12,
    borderWidth: 1.5, borderColor: '#FDE68A',
    ...makeShadow('#D97706', 2, 0.1, 6, 2),
  },
  awaitingIcon: {
    width: 38, height: 38, borderRadius: 19,
    backgroundColor: '#FEF3C7', alignItems: 'center', justifyContent: 'center',
  },
  awaitingTitle: { fontSize: 14, fontWeight: '700', color: '#92400E', marginBottom: 2 },
  awaitingSub: { fontSize: 12, color: '#B45309' },
});

// Estilos do modal de pagamento avulso pendente
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
  barcodeBox: {
    backgroundColor: '#F9FAFB', borderRadius: 10, padding: 12, marginBottom: 16,
  },
  barcodeText: { fontSize: 12, color: '#374151', lineHeight: 18 },
  copyBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: PRIMARY, borderRadius: 14,
    paddingVertical: 14, marginBottom: 12,
  },
  copyBtnText: { fontSize: 15, fontWeight: '700', color: '#FFF' },
  info: { fontSize: 12, color: '#9CA3AF', textAlign: 'center', marginBottom: 16 },
  noData: { fontSize: 14, color: '#9CA3AF', textAlign: 'center', paddingVertical: 24 },
  closeBtn: { paddingVertical: 12, alignItems: 'center' },
  closeBtnText: { fontSize: 14, fontWeight: '600', color: '#9CA3AF' },
});
