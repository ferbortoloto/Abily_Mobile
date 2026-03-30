import React, { useState, useRef } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, ScrollView,
  Modal, Animated, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { usePlans } from '../../context/PlansContext';
import { makeShadow } from '../../constants/theme';
import { toast } from '../../utils/toast';

const PRIMARY = '#1D4ED8';

const PAYMENT_METHODS = [
  { key: 'pix',    label: 'Pix',              icon: 'flash-outline',       subtitle: 'Aprovação instantânea' },
  { key: 'credit', label: 'Cartão de Crédito', icon: 'card-outline',        subtitle: 'Até 12x sem juros' },
  { key: 'boleto', label: 'Boleto Bancário',   icon: 'document-text-outline', subtitle: 'Vencimento em 3 dias' },
];

const CLASS_TYPE_ICON = {
  'Aula Prática': 'car-outline',
  'Misto':        'grid-outline',
};

export default function PlanCheckoutScreen({ route, navigation }) {
  const { plan, instructor } = route.params;
  const { purchasePlan } = usePlans();

  const [selectedPayment, setSelectedPayment] = useState('pix');
  const [showSuccess, setShowSuccess] = useState(false);
  const [loading, setLoading] = useState(false);

  const checkScale  = useRef(new Animated.Value(0)).current;
  const checkOpacity = useRef(new Animated.Value(0)).current;

  const pricePerClass = (plan.price / plan.classCount).toFixed(0);
  const originalTotal = instructor.pricePerHour * plan.classCount;
  const savings = originalTotal - plan.price;
  const discountPct = Math.round((savings / originalTotal) * 100);

  const handleConfirm = async () => {
    setLoading(true);
    try {
      await purchasePlan({
        plan,
        instructor,
        paymentMethod: selectedPayment,
      });
      setShowSuccess(true);
      Animated.sequence([
        Animated.spring(checkScale, { toValue: 1, useNativeDriver: true, tension: 80, friction: 7 }),
        Animated.timing(checkOpacity, { toValue: 1, duration: 200, useNativeDriver: true }),
      ]).start();
    } catch {
      toast.error('Não foi possível finalizar a compra. Tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  const handleSuccessClose = () => {
    setShowSuccess(false);
    navigation.popToTop();
  };

  const handleScheduleNow = () => {
    setShowSuccess(false);
    navigation.replace('InstructorDetail', { instructor });
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color="#374151" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Finalizar Compra</Text>
        <View style={{ width: 38 }} />
      </View>

      <ScrollView style={styles.scroll} showsVerticalScrollIndicator={false}>

        {/* Plan Summary Card */}
        <View style={styles.summaryCard}>
          <View style={styles.summaryTop}>
            <View style={styles.planIconBox}>
              <Ionicons name={CLASS_TYPE_ICON[plan.classType] || 'layers-outline'} size={26} color={PRIMARY} />
            </View>
            <View style={styles.summaryInfo}>
              <Text style={styles.summaryPlanName}>{plan.name}</Text>
              <Text style={styles.summaryInstructor}>{instructor.name}</Text>
              <Text style={styles.summaryDesc} numberOfLines={2}>{plan.description}</Text>
            </View>
          </View>

          <View style={styles.summaryChips}>
            <View style={styles.summaryChip}>
              <Ionicons name="school-outline" size={13} color={PRIMARY} />
              <Text style={styles.summaryChipText}>{plan.classCount} aulas</Text>
            </View>
            <View style={styles.summaryChip}>
              <Ionicons name="time-outline" size={13} color="#2563EB" />
              <Text style={[styles.summaryChipText, { color: '#2563EB' }]}>{plan.validityDays} dias</Text>
            </View>
            <View style={styles.summaryChip}>
              <Ionicons name="layers-outline" size={13} color="#7C3AED" />
              <Text style={[styles.summaryChipText, { color: '#7C3AED' }]}>{plan.classType}</Text>
            </View>
          </View>

          {discountPct > 0 && (
            <View style={styles.savingsBanner}>
              <Ionicons name="pricetag-outline" size={14} color="#16A34A" />
              <Text style={styles.savingsText}>
                Você economiza R$ {savings} ({discountPct}% de desconto vs. aula avulsa)
              </Text>
            </View>
          )}
        </View>

        {/* Payment Methods */}
        <Text style={styles.sectionLabel}>Forma de Pagamento</Text>
        <View style={styles.paymentList}>
          {PAYMENT_METHODS.map(pm => {
            const selected = selectedPayment === pm.key;
            return (
              <TouchableOpacity
                key={pm.key}
                style={[styles.paymentOption, selected && styles.paymentOptionSelected]}
                onPress={() => setSelectedPayment(pm.key)}
                activeOpacity={0.8}
              >
                <View style={[styles.paymentIconBox, selected && styles.paymentIconBoxSelected]}>
                  <Ionicons name={pm.icon} size={20} color={selected ? PRIMARY : '#6B7280'} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.paymentLabel, selected && styles.paymentLabelSelected]}>{pm.label}</Text>
                  <Text style={styles.paymentSub}>{pm.subtitle}</Text>
                </View>
                <View style={[styles.radio, selected && styles.radioSelected]}>
                  {selected && <View style={styles.radioDot} />}
                </View>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Order Summary */}
        <Text style={styles.sectionLabel}>Resumo do Pedido</Text>
        <View style={styles.orderCard}>
          <View style={styles.orderRow}>
            <Text style={styles.orderLabel}>{plan.name}</Text>
            <Text style={styles.orderValue}>R$ {plan.price}</Text>
          </View>
          <View style={styles.orderRow}>
            <Text style={styles.orderLabel}>Taxa de serviço</Text>
            <Text style={[styles.orderValue, { color: '#16A34A' }]}>Grátis</Text>
          </View>
          {discountPct > 0 && (
            <View style={styles.orderRow}>
              <Text style={styles.orderLabel}>Desconto plano</Text>
              <Text style={[styles.orderValue, { color: '#16A34A' }]}>- R$ {savings}</Text>
            </View>
          )}
          <View style={styles.orderDivider} />
          <View style={styles.orderRow}>
            <Text style={styles.orderTotalLabel}>Total</Text>
            <Text style={styles.orderTotal}>R$ {plan.price}</Text>
          </View>
          <Text style={styles.orderSub}>
            {plan.classCount} aulas · R$ {pricePerClass}/aula · válido por {plan.validityDays} dias
          </Text>
        </View>

        <View style={{ height: 100 }} />
      </ScrollView>

      {/* Footer CTA */}
      <View style={styles.footer}>
        <View style={styles.footerInfo}>
          <Text style={styles.footerTotal}>R$ {plan.price}</Text>
          <Text style={styles.footerSub}>{plan.classCount} aulas · {plan.validityDays} dias</Text>
        </View>
        <TouchableOpacity
          style={[styles.confirmBtn, loading && styles.confirmBtnLoading]}
          onPress={handleConfirm}
          disabled={loading}
          activeOpacity={0.85}
        >
          {loading ? (
            <Text style={styles.confirmBtnText}>Processando...</Text>
          ) : (
            <>
              <Ionicons name="checkmark-circle-outline" size={18} color="#FFF" />
              <Text style={styles.confirmBtnText}>Confirmar Compra</Text>
            </>
          )}
        </TouchableOpacity>
      </View>

      {/* Success Modal */}
      <Modal visible={showSuccess} transparent animationType="fade">
        <View style={styles.successOverlay}>
          <View style={styles.successCard}>
            <Animated.View style={[styles.successIconWrap, { transform: [{ scale: checkScale }], opacity: checkOpacity }]}>
              <Ionicons name="checkmark-circle" size={64} color="#16A34A" />
            </Animated.View>
            <Text style={styles.successTitle}>Plano contratado!</Text>
            <Text style={styles.successSub}>
              Seu pacote "{plan.name}" com {instructor.name} foi ativado com sucesso.
              {'\n'}Você tem {plan.classCount} aulas disponíveis por {plan.validityDays} dias.
            </Text>
            <TouchableOpacity style={styles.successBtn} onPress={handleScheduleNow} activeOpacity={0.85}>
              <Ionicons name="calendar-outline" size={16} color="#FFF" />
              <Text style={styles.successBtnText}>Agendar primeira aula</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.successBtnSecondary} onPress={handleSuccessClose} activeOpacity={0.75}>
              <Text style={styles.successBtnSecondaryText}>Voltar ao início</Text>
            </TouchableOpacity>
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

  summaryCard: {
    backgroundColor: '#FFF', margin: 16, borderRadius: 18,
    padding: 16, gap: 12,
    ...makeShadow('#000', 2, 0.07, 8, 4),
  },
  summaryTop: { flexDirection: 'row', gap: 14, alignItems: 'flex-start' },
  planIconBox: {
    width: 52, height: 52, borderRadius: 14, backgroundColor: `#1D4ED815`,
    alignItems: 'center', justifyContent: 'center', flexShrink: 0,
  },
  summaryInfo: { flex: 1, gap: 3 },
  summaryPlanName: { fontSize: 17, fontWeight: '800', color: '#111827' },
  summaryInstructor: { fontSize: 13, color: '#6B7280', fontWeight: '600' },
  summaryDesc: { fontSize: 12, color: '#9CA3AF', lineHeight: 17 },

  summaryChips: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  summaryChip: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    backgroundColor: '#EFF6FF', borderRadius: 10,
    paddingHorizontal: 10, paddingVertical: 5,
  },
  summaryChipText: { fontSize: 12, fontWeight: '700', color: PRIMARY },

  savingsBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: '#F0FDF4', borderRadius: 10, padding: 10,
  },
  savingsText: { fontSize: 12, color: '#16A34A', fontWeight: '600', flex: 1 },

  sectionLabel: { fontSize: 13, fontWeight: '700', color: '#374151', marginHorizontal: 16, marginBottom: 8, marginTop: 4 },

  paymentList: { marginHorizontal: 16, gap: 8 },
  paymentOption: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: '#FFF', borderRadius: 14, padding: 14,
    borderWidth: 1.5, borderColor: '#E5E7EB',
  },
  paymentOptionSelected: { borderColor: PRIMARY, backgroundColor: '#EFF6FF' },
  paymentIconBox: {
    width: 40, height: 40, borderRadius: 12, backgroundColor: '#F3F4F6',
    alignItems: 'center', justifyContent: 'center',
  },
  paymentIconBoxSelected: { backgroundColor: `#1D4ED815` },
  paymentLabel: { fontSize: 14, fontWeight: '700', color: '#374151' },
  paymentLabelSelected: { color: PRIMARY },
  paymentSub: { fontSize: 11, color: '#9CA3AF', marginTop: 2 },
  radio: {
    width: 20, height: 20, borderRadius: 10, borderWidth: 2, borderColor: '#D1D5DB',
    alignItems: 'center', justifyContent: 'center',
  },
  radioSelected: { borderColor: PRIMARY },
  radioDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: PRIMARY },

  orderCard: {
    backgroundColor: '#FFF', marginHorizontal: 16, marginTop: 8, borderRadius: 14,
    padding: 16, gap: 10,
    ...makeShadow('#000', 1, 0.05, 4, 2),
  },
  orderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  orderLabel: { fontSize: 13, color: '#6B7280' },
  orderValue: { fontSize: 13, fontWeight: '700', color: '#111827' },
  orderDivider: { height: 1, backgroundColor: '#F3F4F6', marginVertical: 2 },
  orderTotalLabel: { fontSize: 15, fontWeight: '800', color: '#111827' },
  orderTotal: { fontSize: 20, fontWeight: '800', color: PRIMARY },
  orderSub: { fontSize: 11, color: '#9CA3AF', textAlign: 'center', marginTop: 4 },

  footer: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingVertical: 14,
    backgroundColor: '#FFF', borderTopWidth: 1, borderTopColor: '#F3F4F6',
    ...makeShadow('#000', -2, 0.06, 8, 8),
  },
  footerInfo: { flex: 1 },
  footerTotal: { fontSize: 22, fontWeight: '800', color: PRIMARY },
  footerSub: { fontSize: 11, color: '#9CA3AF', marginTop: 2 },
  confirmBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: PRIMARY, borderRadius: 14,
    paddingHorizontal: 20, paddingVertical: 14,
    ...makeShadow(PRIMARY, 4, 0.3, 8, 6),
  },
  confirmBtnLoading: { opacity: 0.6 },
  confirmBtnText: { color: '#FFF', fontSize: 15, fontWeight: '700' },

  successOverlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.5)',
    alignItems: 'center', justifyContent: 'center', padding: 24,
  },
  successCard: {
    backgroundColor: '#FFF', borderRadius: 24, padding: 32,
    alignItems: 'center', gap: 16, width: '100%',
    ...makeShadow('#000', 8, 0.15, 20, 12),
  },
  successIconWrap: { marginBottom: 4 },
  successTitle: { fontSize: 22, fontWeight: '800', color: '#111827', textAlign: 'center' },
  successSub: { fontSize: 14, color: '#6B7280', textAlign: 'center', lineHeight: 21 },
  successBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: PRIMARY, borderRadius: 14,
    paddingHorizontal: 24, paddingVertical: 14, marginTop: 8,
    alignSelf: 'stretch', justifyContent: 'center',
    ...makeShadow(PRIMARY, 2, 0.3, 6, 4),
  },
  successBtnText: { color: '#FFF', fontSize: 15, fontWeight: '700' },
  successBtnSecondary: {
    alignSelf: 'stretch', alignItems: 'center',
    paddingVertical: 12,
  },
  successBtnSecondaryText: { fontSize: 14, color: '#6B7280', fontWeight: '600' },
});
