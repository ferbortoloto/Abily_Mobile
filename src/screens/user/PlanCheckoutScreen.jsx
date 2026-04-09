import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, ScrollView,
  Modal, Animated, Image, Clipboard, Linking,
  ActivityIndicator, TextInput, KeyboardAvoidingView, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { usePlans } from '../../context/PlansContext';
import { supabase } from '../../lib/supabase';
import { makeShadow } from '../../constants/theme';
import { toast } from '../../utils/toast';

const PRIMARY = '#1D4ED8';

const PAYMENT_METHODS = [
  { key: 'pix',         label: 'Pix',               icon: 'flash-outline',         subtitle: 'Aprovação instantânea' },
  { key: 'credit_card', label: 'Cartão de Crédito',  icon: 'card-outline',          subtitle: 'Processado via Asaas' },
  { key: 'boleto',      label: 'Boleto Bancário',    icon: 'document-text-outline', subtitle: 'Vencimento em 1 dia útil' },
];

const CLASS_TYPE_ICON = {
  'Aula Prática': 'car-outline',
  'Misto':        'grid-outline',
};

// ---------- PIX Modal ----------

function PixModal({ visible, pixQrcode, pixCopyPaste, purchaseId, onConfirmed, onCancel }) {
  const [copied, setCopied] = useState(false);

  // Realtime: escuta mudança de status para 'active'
  useEffect(() => {
    if (!visible || !purchaseId) return;
    const channel = supabase
      .channel(`pix_purchase_${purchaseId}`)
      .on('postgres_changes', {
        event:  'UPDATE',
        schema: 'public',
        table:  'purchases',
        filter: `id=eq.${purchaseId}`,
      }, (payload) => {
        if (payload.new.status === 'active') onConfirmed();
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [visible, purchaseId, onConfirmed]);

  const handleCopy = () => {
    Clipboard.setString(pixCopyPaste);
    setCopied(true);
    setTimeout(() => setCopied(false), 3000);
  };

  return (
    <Modal visible={visible} transparent animationType="slide">
      <View style={styles.modalOverlay}>
        <View style={styles.modalCard}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Pagar com Pix</Text>
            <TouchableOpacity onPress={onCancel}>
              <Ionicons name="close" size={22} color="#6B7280" />
            </TouchableOpacity>
          </View>

          <Text style={styles.modalSub}>
            Abra seu app de banco, escolha Pix e escaneie o QR Code ou cole a chave abaixo.
          </Text>

          {pixQrcode ? (
            <Image
              source={{ uri: `data:image/png;base64,${pixQrcode}` }}
              style={styles.qrImage}
              resizeMode="contain"
            />
          ) : (
            <View style={styles.qrPlaceholder}>
              <ActivityIndicator size="large" color={PRIMARY} />
            </View>
          )}

          <TouchableOpacity style={styles.copyBtn} onPress={handleCopy} activeOpacity={0.8}>
            <Ionicons name={copied ? 'checkmark-circle-outline' : 'copy-outline'} size={18} color={PRIMARY} />
            <Text style={styles.copyBtnText} numberOfLines={1}>{copied ? 'Copiado!' : 'Copiar chave Pix'}</Text>
          </TouchableOpacity>

          <View style={styles.pixWaiting}>
            <ActivityIndicator size="small" color={PRIMARY} />
            <Text style={styles.pixWaitingText}>Aguardando confirmação do pagamento…</Text>
          </View>
        </View>
      </View>
    </Modal>
  );
}

// ---------- Boleto Modal ----------

function BoletoModal({ visible, boletoBarcode, boletoUrl, purchaseId, onConfirmed, onClose }) {
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!visible || !purchaseId) return;
    const channel = supabase
      .channel(`boleto_purchase_${purchaseId}`)
      .on('postgres_changes', {
        event:  'UPDATE',
        schema: 'public',
        table:  'purchases',
        filter: `id=eq.${purchaseId}`,
      }, (payload) => {
        if (payload.new.status === 'active') onConfirmed();
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [visible, purchaseId, onConfirmed]);

  const handleCopy = () => {
    Clipboard.setString(boletoBarcode);
    setCopied(true);
    setTimeout(() => setCopied(false), 3000);
  };

  return (
    <Modal visible={visible} transparent animationType="slide">
      <View style={styles.modalOverlay}>
        <View style={styles.modalCard}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Boleto Bancário</Text>
            <TouchableOpacity onPress={onClose}>
              <Ionicons name="close" size={22} color="#6B7280" />
            </TouchableOpacity>
          </View>

          <Text style={styles.modalSub}>
            Pague em qualquer banco, casa lotérica ou app bancário. Vence em 1 dia útil.
          </Text>

          {/* Timeline de confirmação */}
          <View style={styles.boletoTimeline}>
            <View style={styles.boletoTimelineStep}>
              <View style={[styles.boletoTimelineDot, { backgroundColor: '#16A34A' }]}>
                <Ionicons name="checkmark" size={10} color="#FFF" />
              </View>
              <Text style={[styles.boletoTimelineText, { color: '#16A34A', fontWeight: '700' }]}>Boleto gerado</Text>
            </View>
            <View style={styles.boletoTimelineLine} />
            <View style={styles.boletoTimelineStep}>
              <View style={[styles.boletoTimelineDot, { backgroundColor: '#D97706' }]}>
                <Ionicons name="time-outline" size={10} color="#FFF" />
              </View>
              <Text style={[styles.boletoTimelineText, { color: '#D97706', fontWeight: '700' }]}>Aguardando pagamento</Text>
            </View>
            <View style={styles.boletoTimelineLine} />
            <View style={styles.boletoTimelineStep}>
              <View style={[styles.boletoTimelineDot, { backgroundColor: '#D1D5DB' }]}>
                <Ionicons name="hourglass-outline" size={10} color="#9CA3AF" />
              </View>
              <Text style={styles.boletoTimelineText}>Confirmação{'\n'}(1–3 dias úteis)</Text>
            </View>
            <View style={styles.boletoTimelineLine} />
            <View style={styles.boletoTimelineStep}>
              <View style={[styles.boletoTimelineDot, { backgroundColor: '#D1D5DB' }]}>
                <Ionicons name="checkmark-done-outline" size={10} color="#9CA3AF" />
              </View>
              <Text style={styles.boletoTimelineText}>Plano ativado!</Text>
            </View>
          </View>

          <View style={styles.boletoInfoBox}>
            <Ionicons name="information-circle-outline" size={16} color="#D97706" />
            <Text style={styles.boletoInfoText}>
              O plano <Text style={{ fontWeight: '700' }}>não será ativado imediatamente</Text> — o banco pode levar até 3 dias úteis para processar o pagamento.
            </Text>
          </View>

          {boletoBarcode ? (
            <TouchableOpacity style={styles.copyBtn} onPress={handleCopy} activeOpacity={0.8}>
              <Ionicons name={copied ? 'checkmark-circle-outline' : 'copy-outline'} size={18} color={PRIMARY} />
              <Text style={styles.copyBtnText} numberOfLines={1}>
                {copied ? 'Copiado!' : 'Copiar linha digitável'}
              </Text>
            </TouchableOpacity>
          ) : null}

          {boletoUrl ? (
            <TouchableOpacity
              style={[styles.copyBtn, styles.copyBtnSecondary]}
              onPress={() => Linking.openURL(boletoUrl)}
              activeOpacity={0.8}
            >
              <Ionicons name="open-outline" size={18} color="#374151" />
              <Text style={[styles.copyBtnText, { color: '#374151' }]}>Ver PDF do boleto</Text>
            </TouchableOpacity>
          ) : null}

          <Text style={styles.boletoRefundNote}>
            Caso mude de ideia antes de pagar, acesse "Minhas Aulas" e cancele o boleto.
          </Text>

          <TouchableOpacity style={styles.boletoCloseBtn} onPress={onClose} activeOpacity={0.8}>
            <Text style={styles.boletoCloseBtnText}>Entendi, vou pagar depois</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

// ---------- Credit Card Form ----------

function CreditCardForm({ visible, onCancel, onSubmit, submitting }) {
  const [holderName, setHolderName] = useState('');
  const [cardNumber, setCardNumber] = useState('');
  const [expiry, setExpiry]         = useState('');
  const [cvv, setCvv]               = useState('');

  const handleCardNumberChange = (text) => {
    const digits    = text.replace(/\D/g, '').slice(0, 16);
    const formatted = digits.match(/.{1,4}/g)?.join(' ') || digits;
    setCardNumber(formatted);
  };

  const handleExpiryChange = (text) => {
    const raw = text.replace(/\D/g, '').slice(0, 4);
    setExpiry(raw.length > 2 ? raw.slice(0, 2) + '/' + raw.slice(2) : raw);
  };

  const isValid = () => {
    const digits      = cardNumber.replace(/\s/g, '');
    const [month, yr] = expiry.split('/');
    return (
      holderName.trim().length >= 3 &&
      digits.length === 16 &&
      month && parseInt(month, 10) >= 1 && parseInt(month, 10) <= 12 &&
      yr && yr.length === 2 &&
      cvv.length >= 3
    );
  };

  const handleSubmit = () => {
    if (!isValid() || submitting) return;
    const [month, yr] = expiry.split('/');
    onSubmit({
      holderName:  holderName.trim().toUpperCase(),
      number:      cardNumber.replace(/\s/g, ''),
      expiryMonth: month,
      expiryYear:  '20' + yr,
      ccv:         cvv,
    });
  };

  const displayNumber = cardNumber || '•••• •••• •••• ••••';
  const displayName   = holderName || 'NOME DO TITULAR';
  const displayExpiry = expiry     || 'MM/AA';

  if (!visible) return null;

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet">
      <SafeAreaView style={{ flex: 1, backgroundColor: '#F9FAFB' }} edges={['top']}>
        {/* Header */}
        <View style={styles.webViewHeader}>
          <TouchableOpacity onPress={onCancel} style={styles.backBtn} disabled={submitting}>
            <Ionicons name="close" size={22} color="#374151" />
          </TouchableOpacity>
          <Text style={styles.webViewTitle}>Cartão de Crédito</Text>
          <View style={{ width: 38 }} />
        </View>

        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <ScrollView contentContainerStyle={styles.cardFormScroll} keyboardShouldPersistTaps="handled">

            {/* Card Preview */}
            <View style={styles.cardPreview}>
              <View style={styles.cardChip} />
              <Text style={styles.cardPreviewNumber} numberOfLines={1}>{displayNumber}</Text>
              <View style={styles.cardPreviewBottom}>
                <View>
                  <Text style={styles.cardPreviewLabel}>TITULAR</Text>
                  <Text style={styles.cardPreviewValue} numberOfLines={1}>{displayName}</Text>
                </View>
                <View style={{ alignItems: 'flex-end' }}>
                  <Text style={styles.cardPreviewLabel}>VALIDADE</Text>
                  <Text style={styles.cardPreviewValue}>{displayExpiry}</Text>
                </View>
              </View>
              <View style={styles.cardNetworkBadge}>
                <View style={[styles.cardNetworkCircle, { backgroundColor: '#EB001B', marginRight: -8 }]} />
                <View style={[styles.cardNetworkCircle, { backgroundColor: '#F79E1B' }]} />
              </View>
            </View>

            {/* Fields */}
            <View style={styles.cardField}>
              <Text style={styles.cardLabel}>Nome do titular</Text>
              <TextInput
                style={styles.cardInput}
                placeholder="Como aparece no cartão"
                placeholderTextColor="#9CA3AF"
                value={holderName}
                onChangeText={t => setHolderName(t.toUpperCase())}
                autoCapitalize="characters"
                returnKeyType="next"
                editable={!submitting}
              />
            </View>

            <View style={styles.cardField}>
              <Text style={styles.cardLabel}>Número do cartão</Text>
              <View style={styles.cardInputRow}>
                <Ionicons name="card-outline" size={18} color="#9CA3AF" style={{ marginRight: 8 }} />
                <TextInput
                  style={[styles.cardInput, { flex: 1, borderWidth: 0, padding: 0 }]}
                  placeholder="0000 0000 0000 0000"
                  placeholderTextColor="#9CA3AF"
                  value={cardNumber}
                  onChangeText={handleCardNumberChange}
                  keyboardType="number-pad"
                  maxLength={19}
                  editable={!submitting}
                />
              </View>
            </View>

            <View style={{ flexDirection: 'row', gap: 12 }}>
              <View style={[styles.cardField, { flex: 1 }]}>
                <Text style={styles.cardLabel}>Validade</Text>
                <TextInput
                  style={styles.cardInput}
                  placeholder="MM/AA"
                  placeholderTextColor="#9CA3AF"
                  value={expiry}
                  onChangeText={handleExpiryChange}
                  keyboardType="number-pad"
                  maxLength={5}
                  editable={!submitting}
                />
              </View>
              <View style={[styles.cardField, { flex: 1 }]}>
                <Text style={styles.cardLabel}>CVV</Text>
                <TextInput
                  style={styles.cardInput}
                  placeholder="•••"
                  placeholderTextColor="#9CA3AF"
                  value={cvv}
                  onChangeText={t => setCvv(t.replace(/\D/g, '').slice(0, 4))}
                  keyboardType="number-pad"
                  maxLength={4}
                  secureTextEntry
                  editable={!submitting}
                />
              </View>
            </View>

            <TouchableOpacity
              style={[styles.cardSubmitBtn, (!isValid() || submitting) && styles.cardSubmitBtnDisabled]}
              onPress={handleSubmit}
              disabled={!isValid() || submitting}
              activeOpacity={0.85}
            >
              {submitting ? (
                <ActivityIndicator size="small" color="#FFF" />
              ) : (
                <>
                  <Ionicons name="lock-closed" size={16} color="#FFF" />
                  <Text style={styles.cardSubmitBtnText}>Pagar com segurança</Text>
                </>
              )}
            </TouchableOpacity>

            <View style={styles.cardSecureNote}>
              <Ionicons name="shield-checkmark-outline" size={14} color="#6B7280" />
              <Text style={styles.cardSecureNoteText}>
                Dados criptografados e processados com segurança pelo Asaas
              </Text>
            </View>

          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </Modal>
  );
}

// ---------- Success Modal ----------

function SuccessModal({ visible, plan, instructor, onSchedule, onClose }) {
  const checkScale   = useRef(new Animated.Value(0)).current;
  const checkOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      Animated.sequence([
        Animated.spring(checkScale,   { toValue: 1, useNativeDriver: true, tension: 80, friction: 7 }),
        Animated.timing(checkOpacity, { toValue: 1, duration: 200, useNativeDriver: true }),
      ]).start();
    } else {
      checkScale.setValue(0);
      checkOpacity.setValue(0);
    }
  }, [visible]);

  return (
    <Modal visible={visible} transparent animationType="fade">
      <View style={styles.successOverlay}>
        <View style={styles.successCard}>
          <Animated.View style={[styles.successIconWrap, { transform: [{ scale: checkScale }], opacity: checkOpacity }]}>
            <Ionicons name="checkmark-circle" size={64} color="#16A34A" />
          </Animated.View>
          <Text style={styles.successTitle}>Plano ativado!</Text>
          <Text style={styles.successSub}>
            Seu pacote "{plan.name}" com {instructor.name} foi ativado.
            {'\n'}Você tem {plan.classCount} aulas disponíveis por {plan.validityDays} dias.
          </Text>
          <TouchableOpacity style={styles.successBtn} onPress={onSchedule} activeOpacity={0.85}>
            <Ionicons name="calendar-outline" size={16} color="#FFF" />
            <Text style={styles.successBtnText}>Agendar aulas</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.successBtnSecondary} onPress={onClose} activeOpacity={0.75}>
            <Text style={styles.successBtnSecondaryText}>Voltar ao início</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

// ---------- Main Screen ----------

export default function PlanCheckoutScreen({ route, navigation }) {
  const { plan, instructor } = route.params;
  const { purchasePlan } = usePlans();

  const [selectedPayment, setSelectedPayment] = useState('pix');
  const [loading, setLoading]               = useState(false);
  const [cardLoading, setCardLoading]       = useState(false);

  const [paymentData, setPaymentData]           = useState(null);
  const [showPix, setShowPix]                   = useState(false);
  const [showBoleto, setShowBoleto]             = useState(false);
  const [showCreditCard, setShowCreditCard]     = useState(false);
  const [showSuccess, setShowSuccess]           = useState(false);

  const pricePerClass  = (plan.price / plan.classCount).toFixed(0);
  const originalTotal  = instructor.pricePerHour * plan.classCount;
  const savings        = originalTotal - plan.price;
  const discountPct    = Math.round((savings / originalTotal) * 100);

  const handlePaymentConfirmed = useCallback(() => {
    setShowPix(false);
    setShowBoleto(false);
    setShowSuccess(true);
  }, []);

  const handleConfirm = async () => {
    if (selectedPayment === 'credit_card') {
      setShowCreditCard(true);
      return;
    }
    setLoading(true);
    try {
      const result = await purchasePlan({ plan, instructor, paymentMethod: selectedPayment });
      setPaymentData(result);
      if (selectedPayment === 'pix') setShowPix(true);
      else                           setShowBoleto(true);
    } catch {
      toast.error('Não foi possível iniciar o pagamento. Tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  const handleCardSubmit = async (cardData) => {
    setCardLoading(true);
    try {
      const result = await purchasePlan({
        plan, instructor, paymentMethod: 'credit_card', creditCardData: cardData,
      });
      setPaymentData(result);
      setShowCreditCard(false);
      setShowSuccess(true);
    } catch (err) {
      toast.error(err.message || 'Pagamento recusado. Verifique os dados do cartão.');
    } finally {
      setCardLoading(false);
    }
  };

  const handleSuccessClose = () => {
    setShowSuccess(false);
    navigation.popToTop();
  };

  const handleScheduleNow = () => {
    setShowSuccess(false);
    const purchaseWithPlan = {
      ...paymentData?.purchase,
      plans: { name: plan.name, class_type: plan.classType },
    };
    navigation.replace('BatchSchedule', { purchase: purchaseWithPlan, instructor });
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
            <ActivityIndicator size="small" color="#FFF" />
          ) : (
            <>
              <Ionicons name="checkmark-circle-outline" size={18} color="#FFF" />
              <Text style={styles.confirmBtnText}>Continuar</Text>
            </>
          )}
        </TouchableOpacity>
      </View>

      {/* PIX Modal */}
      <PixModal
        visible={showPix}
        pixQrcode={paymentData?.payment?.pix_qrcode}
        pixCopyPaste={paymentData?.payment?.pix_copy_paste}
        purchaseId={paymentData?.purchase?.id}
        onConfirmed={handlePaymentConfirmed}
        onCancel={() => setShowPix(false)}
      />

      {/* Boleto Modal */}
      <BoletoModal
        visible={showBoleto}
        boletoBarcode={paymentData?.payment?.boleto_barcode}
        boletoUrl={paymentData?.payment?.boleto_url}
        purchaseId={paymentData?.purchase?.id}
        onConfirmed={handlePaymentConfirmed}
        onClose={() => setShowBoleto(false)}
      />

      {/* Credit Card Form */}
      <CreditCardForm
        visible={showCreditCard}
        onCancel={() => setShowCreditCard(false)}
        onSubmit={handleCardSubmit}
        submitting={cardLoading}
      />

      {/* Success Modal */}
      <SuccessModal
        visible={showSuccess}
        plan={plan}
        instructor={instructor}
        onSchedule={handleScheduleNow}
        onClose={handleSuccessClose}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe:   { flex: 1, backgroundColor: '#F9FAFB' },
  scroll: { flex: 1 },

  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 12,
    backgroundColor: '#FFF', borderBottomWidth: 1, borderBottomColor: '#F3F4F6',
  },
  backBtn:     { width: 38, height: 38, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: 17, fontWeight: '800', color: '#111827' },

  summaryCard: {
    backgroundColor: '#FFF', margin: 16, borderRadius: 18,
    padding: 16, gap: 12,
    ...makeShadow('#000', 2, 0.07, 8, 4),
  },
  summaryTop:    { flexDirection: 'row', gap: 14, alignItems: 'flex-start' },
  planIconBox:   {
    width: 52, height: 52, borderRadius: 14, backgroundColor: '#1D4ED815',
    alignItems: 'center', justifyContent: 'center', flexShrink: 0,
  },
  summaryInfo:        { flex: 1, gap: 3 },
  summaryPlanName:    { fontSize: 17, fontWeight: '800', color: '#111827' },
  summaryInstructor:  { fontSize: 13, color: '#6B7280', fontWeight: '600' },
  summaryDesc:        { fontSize: 12, color: '#9CA3AF', lineHeight: 17 },

  summaryChips: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  summaryChip:  {
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

  paymentList:          { marginHorizontal: 16, gap: 8 },
  paymentOption:        {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: '#FFF', borderRadius: 14, padding: 14,
    borderWidth: 1.5, borderColor: '#E5E7EB',
  },
  paymentOptionSelected: { borderColor: PRIMARY, backgroundColor: '#EFF6FF' },
  paymentIconBox:        {
    width: 40, height: 40, borderRadius: 12, backgroundColor: '#F3F4F6',
    alignItems: 'center', justifyContent: 'center',
  },
  paymentIconBoxSelected: { backgroundColor: '#1D4ED815' },
  paymentLabel:          { fontSize: 14, fontWeight: '700', color: '#374151' },
  paymentLabelSelected:  { color: PRIMARY },
  paymentSub:            { fontSize: 11, color: '#9CA3AF', marginTop: 2 },
  radio:                 {
    width: 20, height: 20, borderRadius: 10, borderWidth: 2, borderColor: '#D1D5DB',
    alignItems: 'center', justifyContent: 'center',
  },
  radioSelected: { borderColor: PRIMARY },
  radioDot:      { width: 10, height: 10, borderRadius: 5, backgroundColor: PRIMARY },

  orderCard: {
    backgroundColor: '#FFF', marginHorizontal: 16, marginTop: 8, borderRadius: 14,
    padding: 16, gap: 10,
    ...makeShadow('#000', 1, 0.05, 4, 2),
  },
  orderRow:       { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  orderLabel:     { fontSize: 13, color: '#6B7280' },
  orderValue:     { fontSize: 13, fontWeight: '700', color: '#111827' },
  orderDivider:   { height: 1, backgroundColor: '#F3F4F6', marginVertical: 2 },
  orderTotalLabel:{ fontSize: 15, fontWeight: '800', color: '#111827' },
  orderTotal:     { fontSize: 20, fontWeight: '800', color: PRIMARY },
  orderSub:       { fontSize: 11, color: '#9CA3AF', textAlign: 'center', marginTop: 4 },

  footer: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingVertical: 14,
    backgroundColor: '#FFF', borderTopWidth: 1, borderTopColor: '#F3F4F6',
    ...makeShadow('#000', -2, 0.06, 8, 8),
  },
  footerInfo:       { flex: 1 },
  footerTotal:      { fontSize: 22, fontWeight: '800', color: PRIMARY },
  footerSub:        { fontSize: 11, color: '#9CA3AF', marginTop: 2 },
  confirmBtn:       {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: PRIMARY, borderRadius: 14,
    paddingHorizontal: 20, paddingVertical: 14,
    ...makeShadow(PRIMARY, 4, 0.3, 8, 6),
  },
  confirmBtnLoading: { opacity: 0.6 },
  confirmBtnText:    { color: '#FFF', fontSize: 15, fontWeight: '700' },

  // Modals shared
  modalOverlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'flex-end',
  },
  modalCard: {
    backgroundColor: '#FFF', borderTopLeftRadius: 24, borderTopRightRadius: 24,
    padding: 24, gap: 16,
  },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  modalTitle:  { fontSize: 18, fontWeight: '800', color: '#111827' },
  modalSub:    { fontSize: 13, color: '#6B7280', lineHeight: 19 },

  // PIX
  qrImage:       { width: 220, height: 220, alignSelf: 'center', borderRadius: 8 },
  qrPlaceholder: {
    width: 220, height: 220, alignSelf: 'center', borderRadius: 8,
    backgroundColor: '#F3F4F6', alignItems: 'center', justifyContent: 'center',
  },
  copyBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    borderWidth: 1.5, borderColor: PRIMARY, borderRadius: 12,
    paddingHorizontal: 16, paddingVertical: 12,
  },
  copyBtnSecondary: { borderColor: '#D1D5DB' },
  copyBtnText:      { fontSize: 14, fontWeight: '700', color: PRIMARY, flex: 1 },
  pixWaiting:       { flexDirection: 'row', alignItems: 'center', gap: 8, justifyContent: 'center' },
  pixWaitingText:   { fontSize: 12, color: '#6B7280' },

  // Boleto
  boletoTimeline: {
    flexDirection: 'row', alignItems: 'flex-start',
    paddingVertical: 4,
  },
  boletoTimelineStep: { alignItems: 'center', flex: 1 },
  boletoTimelineDot: {
    width: 22, height: 22, borderRadius: 11,
    alignItems: 'center', justifyContent: 'center',
    marginBottom: 4,
  },
  boletoTimelineLine: {
    flex: 1, height: 2, backgroundColor: '#E5E7EB',
    marginTop: 10, marginHorizontal: -2,
  },
  boletoTimelineText: {
    fontSize: 9, color: '#9CA3AF', textAlign: 'center', lineHeight: 13,
  },
  boletoInfoBox: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 8,
    backgroundColor: '#FFFBEB', borderRadius: 10, padding: 12,
  },
  boletoInfoText:     { fontSize: 12, color: '#92400E', flex: 1, lineHeight: 18 },
  boletoRefundNote:   { fontSize: 11, color: '#9CA3AF', textAlign: 'center', lineHeight: 16, paddingHorizontal: 8 },
  boletoCloseBtn:     { alignItems: 'center', paddingVertical: 12 },
  boletoCloseBtnText: { fontSize: 14, color: '#6B7280', fontWeight: '600' },

  // Credit card form header
  webViewHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 12,
    borderBottomWidth: 1, borderBottomColor: '#F3F4F6',
    backgroundColor: '#FFF',
  },
  webViewTitle:  { fontSize: 16, fontWeight: '700', color: '#111827' },
  webViewLoader: { flex: 1, alignItems: 'center', justifyContent: 'center' },

  // Card form
  cardFormScroll: { padding: 20, paddingBottom: 40 },
  cardPreview: {
    backgroundColor: PRIMARY,
    borderRadius: 20,
    padding: 24,
    marginBottom: 28,
    ...makeShadow(PRIMARY, 6, 0.35, 16, 8),
  },
  cardChip: {
    width: 36, height: 26, borderRadius: 6,
    backgroundColor: '#FFD700', marginBottom: 24,
  },
  cardPreviewNumber: {
    fontSize: 20, fontWeight: '700', color: '#FFF',
    letterSpacing: 2, marginBottom: 24,
  },
  cardPreviewBottom: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end',
  },
  cardPreviewLabel: { fontSize: 9, color: 'rgba(255,255,255,0.6)', letterSpacing: 1, marginBottom: 3 },
  cardPreviewValue: { fontSize: 14, fontWeight: '700', color: '#FFF', maxWidth: 160 },
  cardNetworkBadge: {
    position: 'absolute', top: 20, right: 20, flexDirection: 'row',
  },
  cardNetworkCircle: { width: 26, height: 26, borderRadius: 13, opacity: 0.9 },

  cardField:    { marginBottom: 16 },
  cardLabel:    { fontSize: 12, fontWeight: '700', color: '#374151', marginBottom: 6 },
  cardInput: {
    backgroundColor: '#FFF', borderWidth: 1.5, borderColor: '#E5E7EB',
    borderRadius: 12, paddingHorizontal: 14, paddingVertical: 13,
    fontSize: 15, color: '#111827',
  },
  cardInputRow: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#FFF', borderWidth: 1.5, borderColor: '#E5E7EB',
    borderRadius: 12, paddingHorizontal: 14, paddingVertical: 13,
  },
  cardSubmitBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: PRIMARY, borderRadius: 14,
    paddingVertical: 16, marginTop: 8,
    ...makeShadow(PRIMARY, 4, 0.3, 8, 6),
  },
  cardSubmitBtnDisabled: { opacity: 0.5 },
  cardSubmitBtnText:     { color: '#FFF', fontSize: 16, fontWeight: '700' },
  cardSecureNote: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    justifyContent: 'center', marginTop: 20,
  },
  cardSecureNoteText: { fontSize: 11, color: '#9CA3AF', flex: 1, lineHeight: 16 },

  // Success Modal
  successOverlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.5)',
    alignItems: 'center', justifyContent: 'center', padding: 24,
  },
  successCard: {
    backgroundColor: '#FFF', borderRadius: 24, padding: 32,
    alignItems: 'center', gap: 16, width: '100%',
    ...makeShadow('#000', 8, 0.15, 20, 12),
  },
  successIconWrap:       { marginBottom: 4 },
  successTitle:          { fontSize: 22, fontWeight: '800', color: '#111827', textAlign: 'center' },
  successSub:            { fontSize: 14, color: '#6B7280', textAlign: 'center', lineHeight: 21 },
  successBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: PRIMARY, borderRadius: 14,
    paddingHorizontal: 24, paddingVertical: 14, marginTop: 8,
    alignSelf: 'stretch', justifyContent: 'center',
    ...makeShadow(PRIMARY, 2, 0.3, 6, 4),
  },
  successBtnText:          { color: '#FFF', fontSize: 15, fontWeight: '700' },
  successBtnSecondary:     { alignSelf: 'stretch', alignItems: 'center', paddingVertical: 12 },
  successBtnSecondaryText: { fontSize: 14, color: '#6B7280', fontWeight: '600' },
});
