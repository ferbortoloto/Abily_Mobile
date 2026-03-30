import React, { useState } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet,
  FlatList, ActivityIndicator, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { usePlans } from '../../context/PlansContext';
import { toast } from '../../utils/toast';
import { getInstructorById } from '../../services/instructors.service';
import Avatar from '../../components/shared/Avatar';
import { makeShadow } from '../../constants/theme';

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

function PurchaseCard({ purchase, onSchedule, scheduling, onRefund, refunding }) {
  const {
    plans: plan,
    profiles: instructorProfile,
    classes_remaining,
    classes_total,
    expires_at,
    status,
    purchased_at,
  } = purchase;

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
    </View>
  );
}

export default function MyPlansScreen({ navigation }) {
  const { purchases, requestRefund } = usePlans();
  const [schedulingId, setSchedulingId] = useState(null);
  const [refundingId, setRefundingId] = useState(null);

  const visiblePurchases = purchases.filter(p => p.status === 'active' || p.status === 'refund_requested');

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

  const handleSchedule = async (purchase) => {
    setSchedulingId(purchase.id);
    try {
      const raw = await getInstructorById(purchase.instructor_id);
      const instructor = toAppInstructor(raw);
      navigation.navigate('InstructorDetail', { instructor });
    } catch {
      // mantém na tela em caso de erro de rede
    } finally {
      setSchedulingId(null);
    }
  };

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
            Encontre um instrutor e contrate um pacote de aulas para começar.
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
      <FlatList
        data={visiblePurchases}
        keyExtractor={item => item.id}
        contentContainerStyle={styles.list}
        showsVerticalScrollIndicator={false}
        renderItem={({ item }) => (
          <PurchaseCard
            purchase={item}
            onSchedule={() => handleSchedule(item)}
            scheduling={schedulingId === item.id}
            onRefund={() => handleRefund(item)}
            refunding={refundingId === item.id}
          />
        )}
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

  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32, gap: 12 },
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
});
