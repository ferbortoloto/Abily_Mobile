import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, ScrollView,
  ActivityIndicator, Image, Clipboard, Modal, TextInput,
  KeyboardAvoidingView, Platform, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../hooks/useAuth';
import { supabase } from '../../lib/supabase';
import { toAppInstructor } from '../../services/instructors.service';
import { makeShadow } from '../../constants/theme';
import { toast } from '../../utils/toast';
import { validateCpfCnpj, isExpiryValid } from '../../utils/cardValidation';

const PRIMARY = '#1D4ED8';

// Boleto não suporta estorno automático — apenas Pix e Cartão
const PAYMENT_METHODS = [
  { key: 'pix',         label: 'Pix',              icon: 'flash-outline', subtitle: 'Aprovação instantânea' },
  { key: 'credit_card', label: 'Cartão de Crédito', icon: 'card-outline',  subtitle: 'Pague sem sair do app · +1% por parcela' },
];

const MAX_INSTALLMENTS = 12;

// PIX: 3% de desconto. Cartão parcelado: +1% por parcela adicional.
// Fórmulas idênticas ao backend (create-payment).
const getEffectivePrice = (base, method, installments = 1) => {
  if (method === 'pix') return Math.round(base * 0.97 * 100) / 100;
  if (method === 'credit_card' && installments > 1)
    return Math.round(base * (1 + (installments - 1) * 0.01) * 100) / 100;
  return base;
};
const fmt = (val) => val.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

const DAYS_PT   = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
const MONTHS_PT = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];

function formatDate(dateStr) {
  const d = new Date(dateStr + 'T00:00:00');
  return `${DAYS_PT[d.getDay()]}, ${d.getDate()} de ${MONTHS_PT[d.getMonth()]}`;
}

// ── Fase 1: seleção de método ──────────────────────────────────────────────────
function MethodPhase({ instructor, requestData, loading, selectedPayment, setSelectedPayment, installments, setInstallments, onConfirm, onBack }) {
  const price = instructor.pricePerHour || 0;
  const slots = Array.isArray(requestData?.time_slots) ? requestData.time_slots : [];
  const dateStr = requestData?.requested_date || '';

  const installmentOptions = Array.from({ length: MAX_INSTALLMENTS }, (_, i) => i + 1);
  const effectivePrice = getEffectivePrice(price, selectedPayment, installments);

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color="#111827" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Solicitar Aula</Text>
        <View style={{ width: 38 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>

        {/* Resumo */}
        <View style={styles.summaryCard}>
          <SummaryRow icon="person-circle-outline" label="Instrutor" value={instructor.name} />
          {dateStr ? <SummaryRow icon="calendar-outline" label="Data" value={formatDate(dateStr)} /> : null}
          {slots.length > 0 && <SummaryRow icon="time-outline" label="Horário" value={slots.join(', ')} />}
          <SummaryRow icon="cash-outline" label="Valor" value={price.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })} isPrice last />
        </View>

        {/* Banner de proteção */}
        <View style={styles.noticeBanner}>
          <Ionicons name="shield-checkmark" size={22} color="#16A34A" />
          <View style={{ flex: 1 }}>
            <Text style={styles.noticeTitle}>Seu dinheiro está protegido</Text>
            <Text style={styles.noticeText}>
              O valor só é repassado ao instrutor após ele <Text style={styles.noticeBold}>aceitar</Text> sua aula.
              Se ele recusar ou não responder, o estorno é automático e integral.
            </Text>
          </View>
        </View>

        {/* Método de pagamento */}
        <Text style={styles.sectionTitle}>Forma de Pagamento</Text>
        {PAYMENT_METHODS.map(pm => {
          const active = selectedPayment === pm.key;
          const isPix = pm.key === 'pix';
          const pixPrice = getEffectivePrice(price, 'pix', 1);
          return (
            <TouchableOpacity
              key={pm.key}
              style={[styles.methodCard, active && styles.methodCardActive]}
              onPress={() => setSelectedPayment(pm.key)}
              activeOpacity={0.8}
            >
              <View style={[styles.methodIcon, active && styles.methodIconActive]}>
                <Ionicons name={pm.icon} size={20} color={active ? PRIMARY : '#6B7280'} />
              </View>
              <View style={{ flex: 1 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <Text style={[styles.methodLabel, active && styles.methodLabelActive]}>{pm.label}</Text>
                  {isPix && (
                    <View style={styles.discountBadge}>
                      <Text style={styles.discountBadgeText}>3% de desconto no PIX</Text>
                    </View>
                  )}
                </View>
                <Text style={styles.methodSub}>
                  {isPix ? `${pm.subtitle} · ${fmt(pixPrice)}` : pm.subtitle}
                </Text>
              </View>
              <View style={[styles.radio, active && styles.radioActive]}>
                {active && <View style={styles.radioDot} />}
              </View>
            </TouchableOpacity>
          );
        })}

        {/* Parcelamento (só cartão) */}
        {selectedPayment === 'credit_card' && (
          <View style={styles.installmentSection}>
            <Text style={styles.installmentTitle}>Parcelamento</Text>
            <View style={styles.installmentRow}>
              {installmentOptions.map(n => {
                const totalWithFee = getEffectivePrice(price, 'credit_card', n);
                const val = totalWithFee / n;
                const active = installments === n;
                return (
                  <TouchableOpacity
                    key={n}
                    style={[styles.installmentChip, active && styles.installmentChipActive]}
                    onPress={() => setInstallments(n)}
                    activeOpacity={0.8}
                  >
                    <Text style={[styles.installmentChipTop, active && styles.installmentChipTopActive]}>
                      {n === 1 ? 'À vista' : `${n}x`}
                    </Text>
                    <Text style={[styles.installmentChipBot, active && styles.installmentChipBotActive]}>
                      {fmt(val)}{n > 1 ? ` (+${n - 1}%)` : ' s/ juros'}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        )}

      </ScrollView>

      <View style={styles.footer}>
        <View style={styles.footerPrice}>
          <Text style={styles.footerPriceLabel}>Total</Text>
          <Text style={styles.footerPriceValue}>{fmt(effectivePrice)}</Text>
          {selectedPayment === 'pix' && (
            <Text style={styles.footerPriceOriginal}>{fmt(price)}</Text>
          )}
        </View>
        <TouchableOpacity
          style={[styles.confirmBtn, loading && { opacity: 0.7 }]}
          onPress={onConfirm}
          disabled={loading}
          activeOpacity={0.85}
        >
          {loading
            ? <ActivityIndicator color="#FFF" size="small" />
            : (
              <>
                <Ionicons name="lock-closed-outline" size={18} color="#FFF" />
                <Text style={styles.confirmBtnText}>
                  {selectedPayment === 'credit_card' ? 'Informar cartão' : 'Pagar agora'}
                </Text>
              </>
            )}
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

// ── Formulário de cartão ───────────────────────────────────────────────────────
const formatCpfCnpj = (text) => {
  const digits = text.replace(/\D/g, '');
  if (digits.length <= 11) {
    return digits.replace(/(\d{3})(\d{3})?(\d{3})?(\d{2})?/, (match, p1, p2, p3, p4) => {
      let res = p1;
      if (p2) res += `.${p2}`;
      if (p3) res += `.${p3}`;
      if (p4) res += `-${p4}`;
      return res;
    });
  } else {
    return digits.slice(0, 14).replace(/(\d{2})(\d{3})?(\d{3})?(\d{4})?(\d{2})?/, (match, p1, p2, p3, p4, p5) => {
      let res = p1;
      if (p2) res += `.${p2}`;
      if (p3) res += `.${p3}`;
      if (p4) res += `/${p4}`;
      if (p5) res += `-${p5}`;
      return res;
    });
  }
};

const formatPhone = (text) => {
  const digits = text.replace(/\D/g, '').slice(0, 11);
  if (digits.length <= 10) {
    return digits.replace(/(\d{2})(\d{4})?(\d{4})?/, (match, p1, p2, p3) => {
      let res = `(${p1}`;
      if (p2) res += `) ${p2}`;
      if (p3) res += `-${p3}`;
      return res;
    });
  }
  return digits.replace(/(\d{2})(\d{5})?(\d{4})?/, (match, p1, p2, p3) => {
    let res = `(${p1}`;
    if (p2) res += `) ${p2}`;
    if (p3) res += `-${p3}`;
    return res;
  });
};

const formatCEP = (text) => {
  const digits = text.replace(/\D/g, '').slice(0, 8);
  return digits.replace(/(\d{5})(\d{3})?/, (match, p1, p2) => {
    return p2 ? `${p1}-${p2}` : p1;
  });
};

function CreditCardForm({ visible, price, installments, onCancel, onSubmit, submitting, errorMessage }) {
  const [holderName, setHolderName] = useState('');
  const [cardNumber, setCardNumber] = useState('');
  const [expiry, setExpiry]         = useState('');
  const [cvv, setCvv]               = useState('');
  const [cpfCnpj, setCpfCnpj]       = useState('');
  const [postalCode, setPostalCode] = useState('');
  const [addressNumber, setAddressNumber] = useState('');
  const [phone, setPhone]           = useState('');

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
    const digits = cardNumber.replace(/\s/g, '');
    return (
      holderName.trim().length >= 3 &&
      digits.length === 16 &&
      isExpiryValid(expiry) &&
      cvv.length >= 3 &&
      validateCpfCnpj(cpfCnpj) &&
      postalCode.replace(/\D/g, '').length === 8 &&
      addressNumber.trim().length >= 1 &&
      phone.replace(/\D/g, '').length >= 10
    );
  };

  const handleSubmit = () => {
    if (submitting) return;
    if (!validateCpfCnpj(cpfCnpj)) {
      Alert.alert('CPF/CNPJ inválido', 'Verifique o CPF ou CNPJ informado.');
      return;
    }
    if (!isExpiryValid(expiry)) {
      Alert.alert('Validade inválida', 'O cartão está vencido ou a data é inválida.');
      return;
    }
    if (!isValid()) return;
    const [month, yr] = expiry.split('/');
    onSubmit({
      holderName:    holderName.trim().toUpperCase(),
      number:        cardNumber.replace(/\s/g, ''),
      expiryMonth:   month,
      expiryYear:    '20' + yr,
      ccv:           cvv,
      cpfCnpj:       cpfCnpj.replace(/\D/g, ''),
      postalCode:    postalCode.replace(/\D/g, ''),
      addressNumber: addressNumber.trim(),
      phone:         phone.replace(/\D/g, ''),
    });
  };

  const displayNumber = cardNumber || '•••• •••• •••• ••••';
  const displayName   = holderName || 'NOME DO TITULAR';
  const displayExpiry = expiry     || 'MM/AA';
  const installmentVal = installments > 1 ? (price / installments).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) : null;

  if (!visible) return null;

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet">
      <SafeAreaView style={{ flex: 1, backgroundColor: '#F9FAFB' }} edges={['top']}>
        <View style={styles.cardHeader}>
          <TouchableOpacity onPress={onCancel} style={styles.backBtn} disabled={submitting}>
            <Ionicons name="close" size={22} color="#374151" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Cartão de Crédito</Text>
          <View style={{ width: 38 }} />
        </View>

        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
          <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.cardFormScroll} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>

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

            {installmentVal ? (
              <View style={styles.cardInstallmentNote}>
                <Ionicons name="information-circle-outline" size={15} color={PRIMARY} />
                <Text style={styles.cardInstallmentNoteText}>
                  {installments}x de {installmentVal} no cartão
                </Text>
              </View>
            ) : null}

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
                  style={[styles.cardInput, { flex: 1, borderWidth: 0, padding: 0, paddingVertical: 12 }]}
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

            <View style={{ flexDirection: 'row', gap: 12 }}>
              <View style={[styles.cardField, { flex: 1 }]}>
                <Text style={styles.cardLabel}>CPF/CNPJ</Text>
                <TextInput
                  style={styles.cardInput}
                  placeholder="Apenas números"
                  placeholderTextColor="#9CA3AF"
                  value={cpfCnpj}
                  onChangeText={(t) => setCpfCnpj(formatCpfCnpj(t))}
                  keyboardType="number-pad"
                  maxLength={18}
                  editable={!submitting}
                />
              </View>
              <View style={[styles.cardField, { flex: 1 }]}>
                <Text style={styles.cardLabel}>Telefone</Text>
                <TextInput
                  style={styles.cardInput}
                  placeholder="Com DDD"
                  placeholderTextColor="#9CA3AF"
                  value={phone}
                  onChangeText={(t) => setPhone(formatPhone(t))}
                  keyboardType="phone-pad"
                  maxLength={15}
                  editable={!submitting}
                />
              </View>
            </View>

            <View style={{ flexDirection: 'row', gap: 12 }}>
              <View style={[styles.cardField, { flex: 1 }]}>
                <Text style={styles.cardLabel}>CEP</Text>
                <TextInput
                  style={styles.cardInput}
                  placeholder="00000-000"
                  placeholderTextColor="#9CA3AF"
                  value={postalCode}
                  onChangeText={(t) => setPostalCode(formatCEP(t))}
                  keyboardType="number-pad"
                  maxLength={9}
                  editable={!submitting}
                />
              </View>
              <View style={[styles.cardField, { flex: 0.5 }]}>
                <Text style={styles.cardLabel}>Nº (Ender.)</Text>
                <TextInput
                  style={styles.cardInput}
                  placeholder="123"
                  placeholderTextColor="#9CA3AF"
                  value={addressNumber}
                  onChangeText={setAddressNumber}
                  keyboardType="default"
                  editable={!submitting}
                />
              </View>
            </View>

            {errorMessage ? (
              <View style={styles.cardErrorBanner}>
                <Ionicons name="alert-circle-outline" size={16} color="#DC2626" />
                <Text style={styles.cardErrorText}>{errorMessage}</Text>
              </View>
            ) : null}

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
                  <Text style={styles.cardSubmitBtnText}>
                    Pagar {installments > 1 ? `${installments}x de ${installmentVal}` : price.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                  </Text>
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

// ── Fase 2a: QR Code Pix ───────────────────────────────────────────────────────
function PixPhase({ payment, onCopy, copied }) {
  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>

        <View style={styles.pixHeader}>
          <View style={styles.pixIconWrapper}>
            <Ionicons name="flash" size={32} color="#FFF" />
          </View>
          <Text style={styles.pixTitle}>Pague com Pix</Text>
          <Text style={styles.pixSubtitle}>Escaneie o QR code ou copie o código</Text>
        </View>

        {payment.pix_qrcode ? (
          <View style={styles.qrWrapper}>
            <Image
              source={{ uri: `data:image/png;base64,${payment.pix_qrcode}` }}
              style={styles.qrImage}
              resizeMode="contain"
            />
          </View>
        ) : null}

        {payment.pix_copy_paste ? (
          <TouchableOpacity style={styles.copyBtn} onPress={onCopy} activeOpacity={0.8}>
            <Ionicons name={copied ? 'checkmark-circle' : 'copy-outline'} size={20} color={copied ? '#16A34A' : PRIMARY} />
            <Text style={[styles.copyBtnText, copied && { color: '#16A34A' }]}>
              {copied ? 'Código copiado!' : 'Copiar código Pix'}
            </Text>
          </TouchableOpacity>
        ) : null}

        <View style={styles.waitingBanner}>
          <ActivityIndicator size="small" color={PRIMARY} />
          <Text style={styles.waitingText}>
            Aguardando confirmação do pagamento…
          </Text>
        </View>

        <View style={styles.pixInfo}>
          <Ionicons name="information-circle-outline" size={16} color="#6B7280" />
          <Text style={styles.pixInfoText}>
            Após o pagamento, sua solicitação será enviada ao instrutor automaticamente.
            Você poderá acompanhar o status em <Text style={{ fontWeight: '700' }}>Minhas Aulas</Text>.
          </Text>
        </View>

        <View style={styles.pixProtectionNote}>
          <Ionicons name="shield-checkmark-outline" size={15} color="#15803D" />
          <Text style={styles.pixProtectionText}>
            Se o instrutor recusar, o estorno é automático e integral.
          </Text>
        </View>

      </ScrollView>
    </SafeAreaView>
  );
}

// ── Fase 2b: Cartão (redirecionamento) / aguardando ───────────────────────────
function WaitingPhase({ message }) {
  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <View style={styles.waitingPhaseContainer}>
        <ActivityIndicator size="large" color={PRIMARY} style={{ marginBottom: 20 }} />
        <Text style={styles.waitingPhaseTitle}>Aguardando pagamento</Text>
        <Text style={styles.waitingPhaseText}>{message}</Text>
      </View>
    </SafeAreaView>
  );
}

// ── Fase 3: Confirmado ─────────────────────────────────────────────────────────
function ConfirmedPhase({ onDone }) {
  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <View style={styles.waitingPhaseContainer}>
        <View style={styles.confirmedIcon}>
          <Ionicons name="checkmark" size={40} color="#FFF" />
        </View>
        <Text style={styles.waitingPhaseTitle}>Pagamento confirmado!</Text>
        <Text style={styles.waitingPhaseText}>
          Sua solicitação foi enviada ao instrutor.{'\n'}
          Você será notificado quando ele aceitar.
        </Text>
        <TouchableOpacity style={styles.doneBtn} onPress={onDone} activeOpacity={0.85}>
          <Text style={styles.doneBtnText}>Ver meus planos</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

// ── Helper ─────────────────────────────────────────────────────────────────────
function SummaryRow({ icon, label, value, isPrice, last }) {
  return (
    <View style={[styles.summaryRow, last && { borderBottomWidth: 0 }]}>
      <Ionicons name={icon} size={18} color={PRIMARY} />
      <Text style={styles.summaryLabel}>{label}</Text>
      <Text style={[styles.summaryValue, isPrice && styles.priceValue]}>{value}</Text>
    </View>
  );
}

// ── Main ───────────────────────────────────────────────────────────────────────
export default function AvulsaCheckoutScreen({ route, navigation }) {
  const { requestData } = route.params;
  const [instructor, setInstructor] = useState(route.params.instructor);
  const { user } = useAuth();

  const [selectedPayment, setSelectedPayment] = useState('pix');
  const [installments, setInstallments] = useState(1);
  const [phase, setPhase] = useState('method'); // 'method' | 'pix' | 'confirmed'
  const [loading, setLoading] = useState(false);
  const [showCardForm, setShowCardForm] = useState(false);
  const [cardLoading, setCardLoading] = useState(false);
  const [cardError, setCardError] = useState(null);
  const [paymentData, setPaymentData] = useState(null);
  const [copied, setCopied] = useState(false);
  const channelRef  = useRef(null);
  const pollRef     = useRef(null);
  const requestIdRef = useRef(null);

  // Realtime: atualiza preço do instrutor em tempo real durante o checkout
  useEffect(() => {
    const profileChannel = supabase
      .channel(`avulsa_checkout_instructor_${instructor.id}`)
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'profiles',
        filter: `id=eq.${instructor.id}`,
      }, (payload) => {
        const updated = toAppInstructor(payload.new);
        setInstructor(updated);
        if (updated.pricePerHour !== instructor.pricePerHour) {
          Alert.alert(
            'Preço atualizado',
            `O instrutor atualizou o valor da aula para R$ ${updated.pricePerHour}. Os valores foram recalculados.`,
          );
        }
      })
      .subscribe();
    return () => { supabase.removeChannel(profileChannel); };
  }, [instructor.id]);

  useEffect(() => {
    return () => {
      if (channelRef.current) supabase.removeChannel(channelRef.current);
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, []);

  const confirmPayment = () => {
    if (pollRef.current) clearInterval(pollRef.current);
    if (channelRef.current) supabase.removeChannel(channelRef.current);
    setPhase('confirmed');
  };

  const subscribeToRequest = (classRequestId) => {
    requestIdRef.current = classRequestId;

    // Realtime (primário)
    const channel = supabase
      .channel(`avulsa_cr_${classRequestId}`)
      .on('postgres_changes', {
        event:  'UPDATE',
        schema: 'public',
        table:  'class_requests',
        filter: `id=eq.${classRequestId}`,
      }, (payload) => {
        if (payload.new.status === 'pending') confirmPayment();
      })
      .subscribe();
    channelRef.current = channel;

    // Polling como fallback (a cada 5s)
    pollRef.current = setInterval(async () => {
      try {
        const { data } = await supabase
          .from('class_requests')
          .select('status')
          .eq('id', classRequestId)
          .single();
        if (data?.status === 'pending') confirmPayment();
      } catch {
        // ignora erros de rede no poll
      }
    }, 5000);
  };

  const processPayment = async (creditCardData) => {
    const body = {
      avulsa:          true,
      student_id:      user.id,
      instructor_id:   instructor.id,
      payment_method:  selectedPayment,
      price:           instructor.pricePerHour,
      description:     `Aula avulsa com ${instructor.name}`,
      request_data: {
        ...requestData,
        instructor_id:  instructor.id,
        is_avulsa:      true,
        payment_method: selectedPayment,
        avulsa_price:   instructor.pricePerHour,
      },
    };
    if (creditCardData) {
      body.credit_card_data = creditCardData;
      if (installments > 1) body.installment_count = installments;
    }

    const { data, error } = await supabase.functions.invoke('create-payment', { body });
    if (error) {
      let msg;
      try { msg = JSON.parse(error.message)?.error; } catch {}
      throw new Error(msg || data?.error || 'Não foi possível processar o pagamento.');
    }
    if (data?.error) throw new Error(data.error);
    return data;
  };

  const handleConfirm = async () => {
    const nameParts = (user?.name || '').trim().split(/\s+/).filter(Boolean);
    if (nameParts.length < 2) {
      Alert.alert(
        'Perfil incompleto',
        'Informe seu nome completo (nome e sobrenome) no seu perfil antes de continuar com o pagamento.',
        [
          { text: 'Ir ao Perfil', onPress: () => navigation.navigate('PerfilTab') },
          { text: 'Cancelar', style: 'cancel' },
        ],
      );
      return;
    }

    if (selectedPayment === 'credit_card') {
      setShowCardForm(true);
      return;
    }
    setLoading(true);
    try {
      const { payment, class_request_id } = await processPayment(null);
      setPaymentData(payment);
      subscribeToRequest(class_request_id);
      setPhase('pix');
    } catch (e) {
      toast.error(e.message || 'Erro ao processar pagamento. Tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  const handleCardSubmit = async (cardData) => {
    setCardLoading(true);
    setCardError(null);
    try {
      const { payment, class_request_id } = await processPayment(cardData);
      setShowCardForm(false);
      setCardError(null);
      setPaymentData(payment);
      subscribeToRequest(class_request_id);
      setPhase('confirmed');
    } catch (e) {
      const msg = e.message || 'Pagamento recusado. Verifique os dados e tente novamente.';
      setCardError(msg);
      Alert.alert('Erro no pagamento', msg);
    } finally {
      setCardLoading(false);
    }
  };

  const handleCopy = () => {
    Clipboard.setString(paymentData?.pix_copy_paste || '');
    setCopied(true);
    setTimeout(() => setCopied(false), 3000);
  };

  if (phase === 'pix') {
    return <PixPhase payment={paymentData} onCopy={handleCopy} copied={copied} />;
  }

  if (phase === 'confirmed') {
    return <ConfirmedPhase onDone={() => navigation.popToTop()} />;
  }

  return (
    <>
      <MethodPhase
        instructor={instructor}
        requestData={requestData}
        loading={loading}
        selectedPayment={selectedPayment}
        setSelectedPayment={setSelectedPayment}
        installments={installments}
        setInstallments={setInstallments}
        onConfirm={handleConfirm}
        onBack={() => navigation.goBack()}
      />
      <CreditCardForm
        visible={showCardForm}
        price={instructor.pricePerHour || 0}
        installments={installments}
        onCancel={() => { setShowCardForm(false); setCardError(null); }}
        onSubmit={handleCardSubmit}
        submitting={cardLoading}
        errorMessage={cardError}
      />
    </>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#F9FAFB' },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: '#FFF', paddingHorizontal: 16, paddingVertical: 14,
    borderBottomWidth: 1, borderBottomColor: '#F3F4F6',
  },
  backBtn: { width: 38, height: 38, justifyContent: 'center', alignItems: 'center' },
  headerTitle: { fontSize: 17, fontWeight: '700', color: '#111827' },
  content: { padding: 16, paddingBottom: 32 },

  // Summary
  summaryCard: {
    backgroundColor: '#FFF', borderRadius: 16, marginBottom: 14,
    overflow: 'hidden', ...makeShadow('#000', 2, 0.06, 6, 3),
  },
  summaryRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingHorizontal: 16, paddingVertical: 13,
    borderBottomWidth: 1, borderBottomColor: '#F3F4F6',
  },
  summaryLabel: { fontSize: 14, color: '#6B7280', flex: 1 },
  summaryValue: { fontSize: 14, fontWeight: '600', color: '#111827' },
  priceValue: { fontSize: 16, fontWeight: '800', color: PRIMARY },

  // Notice
  noticeBanner: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 12,
    backgroundColor: '#F0FDF4', borderRadius: 14, padding: 14,
    borderWidth: 1, borderColor: '#BBF7D0', marginBottom: 20,
  },
  noticeTitle: { fontSize: 14, fontWeight: '800', color: '#15803D', marginBottom: 4 },
  noticeText: { fontSize: 13, color: '#166534', lineHeight: 19 },
  noticeBold: { fontWeight: '700' },

  // Payment methods
  sectionTitle: { fontSize: 15, fontWeight: '700', color: '#111827', marginBottom: 10 },
  methodCard: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: '#FFF', borderRadius: 14, padding: 14, marginBottom: 10,
    borderWidth: 1.5, borderColor: '#E5E7EB',
    ...makeShadow('#000', 1, 0.04, 4, 2),
  },
  methodCardActive: { borderColor: PRIMARY, backgroundColor: '#EFF6FF' },
  methodIcon: {
    width: 40, height: 40, borderRadius: 10,
    backgroundColor: '#F3F4F6', alignItems: 'center', justifyContent: 'center',
  },
  methodIconActive: { backgroundColor: '#DBEAFE' },
  methodLabel: { fontSize: 14, fontWeight: '600', color: '#374151', marginBottom: 2 },
  methodLabelActive: { color: PRIMARY },
  methodSub: { fontSize: 12, color: '#9CA3AF' },
  radio: {
    width: 20, height: 20, borderRadius: 10,
    borderWidth: 2, borderColor: '#D1D5DB',
    alignItems: 'center', justifyContent: 'center',
  },
  radioActive: { borderColor: PRIMARY },
  radioDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: PRIMARY },

  // Footer
  footer: {
    backgroundColor: '#FFF', paddingHorizontal: 16, paddingTop: 14, paddingBottom: 24,
    borderTopWidth: 1, borderTopColor: '#F3F4F6',
    flexDirection: 'row', alignItems: 'center', gap: 12,
    ...makeShadow('#000', -2, 0.06, 8, 0),
  },
  footerPrice: { flex: 1 },
  footerPriceLabel: { fontSize: 11, color: '#9CA3AF', fontWeight: '500' },
  footerPriceValue: { fontSize: 20, fontWeight: '900', color: '#111827' },
  confirmBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: PRIMARY, borderRadius: 14,
    paddingHorizontal: 20, paddingVertical: 14,
    ...makeShadow(PRIMARY, 4, 0.3, 8, 4),
  },
  confirmBtnText: { fontSize: 15, fontWeight: '700', color: '#FFF' },

  // PIX phase
  pixHeader: { alignItems: 'center', paddingVertical: 24 },
  pixIconWrapper: {
    width: 64, height: 64, borderRadius: 32,
    backgroundColor: '#00BFA5', alignItems: 'center', justifyContent: 'center',
    marginBottom: 12,
  },
  pixTitle: { fontSize: 22, fontWeight: '800', color: '#111827', marginBottom: 6 },
  pixSubtitle: { fontSize: 14, color: '#6B7280', textAlign: 'center' },
  qrWrapper: {
    alignItems: 'center', backgroundColor: '#FFF', borderRadius: 20,
    padding: 20, marginBottom: 16,
    ...makeShadow('#000', 2, 0.06, 8, 4),
  },
  qrImage: { width: 220, height: 220 },
  copyBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10,
    backgroundColor: '#EFF6FF', borderRadius: 14, padding: 14, marginBottom: 16,
    borderWidth: 1.5, borderColor: '#BFDBFE',
  },
  copyBtnText: { fontSize: 15, fontWeight: '700', color: PRIMARY },
  waitingBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: '#FFF', borderRadius: 12, padding: 14, marginBottom: 16,
    borderWidth: 1, borderColor: '#E5E7EB',
  },
  waitingText: { fontSize: 14, color: '#374151', fontWeight: '500' },
  pixInfo: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 8,
    backgroundColor: '#F9FAFB', borderRadius: 10, padding: 12, marginBottom: 10,
  },
  pixInfoText: { fontSize: 13, color: '#6B7280', lineHeight: 18, flex: 1 },
  pixProtectionNote: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: '#F0FDF4', borderRadius: 10, padding: 12,
    borderWidth: 1, borderColor: '#BBF7D0',
  },
  pixProtectionText: { fontSize: 13, color: '#166534', fontWeight: '600', flex: 1 },

  // Waiting / Confirmed phase
  waitingPhaseContainer: {
    flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32,
  },
  waitingPhaseTitle: { fontSize: 22, fontWeight: '800', color: '#111827', marginBottom: 10, textAlign: 'center' },
  waitingPhaseText: { fontSize: 15, color: '#6B7280', textAlign: 'center', lineHeight: 22 },
  confirmedIcon: {
    width: 80, height: 80, borderRadius: 40,
    backgroundColor: '#16A34A', alignItems: 'center', justifyContent: 'center',
    marginBottom: 20,
  },
  doneBtn: {
    marginTop: 32, backgroundColor: PRIMARY, borderRadius: 14,
    paddingHorizontal: 32, paddingVertical: 14,
  },
  doneBtnText: { fontSize: 16, fontWeight: '700', color: '#FFF' },

  // Installment section
  installmentSection: {
    marginTop: 20, backgroundColor: '#FFF', borderRadius: 14, padding: 14,
    borderWidth: 1, borderColor: '#E5E7EB',
    ...makeShadow('#000', 1, 0.04, 4, 2),
  },
  installmentTitle: { fontSize: 13, fontWeight: '700', color: '#374151', marginBottom: 10 },
  installmentRow: { flexDirection: 'row', gap: 8 },
  installmentChip: {
    flex: 1, alignItems: 'center', paddingVertical: 10, borderRadius: 10,
    borderWidth: 1.5, borderColor: '#E5E7EB', backgroundColor: '#F9FAFB',
  },
  installmentChipActive: { borderColor: PRIMARY, backgroundColor: '#EFF6FF' },
  installmentChipTop: { fontSize: 14, fontWeight: '800', color: '#374151' },
  installmentChipTopActive: { color: PRIMARY },
  installmentChipBot: { fontSize: 10, color: '#9CA3AF', marginTop: 2 },
  installmentChipBotActive: { color: '#2563EB' },

  // Card form
  cardHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: '#FFF', paddingHorizontal: 16, paddingVertical: 14,
    borderBottomWidth: 1, borderBottomColor: '#F3F4F6',
  },
  cardFormScroll: { padding: 20, paddingBottom: 40 },
  cardPreview: {
    backgroundColor: PRIMARY, borderRadius: 18, padding: 22,
    marginBottom: 24, minHeight: 170,
    ...makeShadow(PRIMARY, 4, 0.35, 10, 6),
  },
  cardChip: {
    width: 34, height: 26, borderRadius: 5,
    backgroundColor: '#F59E0B', marginBottom: 18,
  },
  cardPreviewNumber: {
    fontSize: 18, fontWeight: '700', color: '#FFF', letterSpacing: 3, marginBottom: 20,
  },
  cardPreviewBottom: { flexDirection: 'row', justifyContent: 'space-between' },
  cardPreviewLabel: { fontSize: 9, color: 'rgba(255,255,255,0.7)', marginBottom: 3, letterSpacing: 1 },
  cardPreviewValue: { fontSize: 13, fontWeight: '700', color: '#FFF' },
  cardNetworkBadge: {
    position: 'absolute', top: 20, right: 20, flexDirection: 'row',
  },
  cardNetworkCircle: { width: 24, height: 24, borderRadius: 12, opacity: 0.85 },
  cardInstallmentNote: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: '#EFF6FF', borderRadius: 10, padding: 10, marginBottom: 16,
    borderWidth: 1, borderColor: '#BFDBFE',
  },
  cardInstallmentNoteText: { fontSize: 13, fontWeight: '600', color: PRIMARY },
  cardField: { marginBottom: 14 },
  cardLabel: { fontSize: 12, fontWeight: '700', color: '#374151', marginBottom: 6 },
  cardInput: {
    backgroundColor: '#FFF', borderRadius: 10, padding: 12,
    fontSize: 15, color: '#111827',
    borderWidth: 1.5, borderColor: '#E5E7EB',
  },
  cardInputRow: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#FFF', borderRadius: 10, paddingHorizontal: 12,
    borderWidth: 1.5, borderColor: '#E5E7EB',
  },
  cardSubmitBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: PRIMARY, borderRadius: 14,
    paddingVertical: 16, marginTop: 8,
    ...makeShadow(PRIMARY, 4, 0.3, 8, 4),
  },
  cardSubmitBtnDisabled: { opacity: 0.5 },
  cardSubmitBtnText: { fontSize: 15, fontWeight: '700', color: '#FFF' },
  cardSecureNote: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    justifyContent: 'center', marginTop: 16,
  },
  cardSecureNoteText: { fontSize: 12, color: '#9CA3AF', textAlign: 'center' },
  cardErrorBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: '#FEF2F2', borderRadius: 10, padding: 12, marginBottom: 12,
    borderWidth: 1, borderColor: '#FECACA',
  },
  cardErrorText: { fontSize: 13, color: '#DC2626', flex: 1 },

  // Desconto PIX / juros parcelamento
  discountBadge: {
    backgroundColor: '#DCFCE7', borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2,
  },
  discountBadgeText: { fontSize: 11, fontWeight: '700', color: '#16A34A' },
  installmentChipFee: { fontSize: 9, color: '#9CA3AF', marginTop: 1 },
  footerPriceOriginal: { fontSize: 11, color: '#9CA3AF', textDecorationLine: 'line-through', marginTop: 1 },
});
