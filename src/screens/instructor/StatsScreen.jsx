import React, { useMemo, useEffect, useState, useCallback } from 'react';
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity,
  Modal, TextInput, Pressable, ActivityIndicator, KeyboardAvoidingView, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { useAuth } from '../../hooks/useAuth';
import { useSchedule } from '../../context/ScheduleContext';
import { useChat } from '../../context/ChatContext';
import { getReviews } from '../../services/instructors.service';
import { makeShadow } from '../../constants/theme';
import { logger } from '../../utils/logger';
import { supabase } from '../../lib/supabase';
import { toast } from '../../utils/toast';
import Avatar from '../../components/shared/Avatar';

const PRIMARY = '#1D4ED8';
const GREEN   = '#16A34A';

const statusConfig = {
  completed:    { label: 'Concluída',     color: '#16A34A', dot: '#22C55E' },
  'in-progress':{ label: 'Em andamento',  color: '#CA8A04', dot: '#EAB308' },
  scheduled:    { label: 'Agendada',      color: '#2563EB', dot: '#3B82F6' },
};

const PIX_TYPES = [
  { key: 'cpf',    label: 'CPF' },
  { key: 'email',  label: 'E-mail' },
  { key: 'phone',  label: 'Celular' },
  { key: 'random', label: 'Chave aleatória' },
];

const MINIMUM_WITHDRAWAL = 20;

// ---------- Modal de Saque ----------
const PIX_TYPE_LABEL = { cpf: 'CPF', email: 'E-mail', phone: 'Celular', random: 'Chave aleatória' };

function WithdrawModal({ visible, balance, instructorId, onClose, onSuccess }) {
  const [pixType, setPixType]         = useState('cpf');
  const [pixKey, setPixKey]           = useState('');
  const [amountCents, setAmountCents] = useState(0);
  const [loading, setLoading]         = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const parsedAmount  = amountCents / 100;
  const amountDisplay = parsedAmount.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const canSubmit     = pixKey.trim() && parsedAmount >= MINIMUM_WITHDRAWAL && parsedAmount <= balance;

  const handleAmountChange = (text) => {
    const digits = text.replace(/\D/g, '');
    setAmountCents(parseInt(digits || '0', 10));
  };

  const handleReview = () => {
    if (!pixKey.trim()) return toast.error('Informe a chave Pix.');
    if (parsedAmount < MINIMUM_WITHDRAWAL) return toast.error(`Valor mínimo para saque é R$ ${MINIMUM_WITHDRAWAL},00.`);
    if (parsedAmount > balance) return toast.error('Valor maior que o saldo disponível.');
    setShowConfirm(true);
  };

  const handleSubmit = async () => {

    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('process-withdrawal', {
        body: {
          instructor_id: instructorId,
          amount:        parsedAmount,
          pix_type:      pixType,
          pix_key:       pixKey.trim(),
        },
      });
      if (error) {
        let msg = error.message;
        try { const b = await error.context?.json?.(); if (b?.error) msg = b.error; } catch {}
        throw new Error(msg);
      }
      if (data?.error) throw new Error(data.error);
      toast.success('Pix enviado! O valor deve chegar em instantes.');
      setPixKey('');
      setAmountCents(0);
      setShowConfirm(false);
      onSuccess();
    } catch (e) {
      toast.error(e.message || 'Erro ao processar saque. Tente novamente.');
      logger.error('Withdraw error:', e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <Pressable style={wStyles.overlay} onPress={onClose}>
          <Pressable style={wStyles.sheet} onPress={() => {}}>
            <View style={wStyles.handle} />

            {showConfirm ? (
              /* ── Tela de confirmação ── */
              <>
                <Text style={wStyles.title}>Confirmar saque</Text>

                <View style={wStyles.confirmRow}>
                  <Text style={wStyles.confirmLabel}>Tipo de chave</Text>
                  <Text style={wStyles.confirmValue}>{PIX_TYPE_LABEL[pixType]}</Text>
                </View>
                <View style={wStyles.confirmRow}>
                  <Text style={wStyles.confirmLabel}>Chave Pix</Text>
                  <Text style={wStyles.confirmValue}>{pixKey.trim()}</Text>
                </View>
                <View style={[wStyles.confirmRow, { marginBottom: 20 }]}>
                  <Text style={wStyles.confirmLabel}>Valor</Text>
                  <Text style={[wStyles.confirmValue, { color: PRIMARY, fontWeight: '800' }]}>R$ {amountDisplay}</Text>
                </View>

                <View style={wStyles.warningBox}>
                  <Ionicons name="warning-outline" size={18} color="#92400E" style={{ marginTop: 1 }} />
                  <Text style={wStyles.warningText}>
                    Verifique os dados acima com atenção. Transferências Pix são processadas imediatamente e
                    {' '}<Text style={{ fontWeight: '700' }}>não podem ser revertidas</Text>.
                    Caso a chave esteja incorreta, a responsabilidade é do instrutor e não será possível recuperar o valor.
                  </Text>
                </View>

                <TouchableOpacity
                  style={[wStyles.btn, loading && { opacity: 0.5 }]}
                  onPress={handleSubmit}
                  disabled={loading}
                >
                  {loading
                    ? <ActivityIndicator color="#FFF" size="small" />
                    : (
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                        <Ionicons name="flash" size={18} color="#FFF" />
                        <Text style={wStyles.btnText}>Confirmar e enviar</Text>
                      </View>
                    )}
                </TouchableOpacity>

                <TouchableOpacity style={wStyles.cancelBtn} onPress={() => setShowConfirm(false)} disabled={loading}>
                  <Text style={wStyles.cancelBtnText}>Voltar e corrigir</Text>
                </TouchableOpacity>
              </>
            ) : (
              /* ── Formulário ── */
              <>
                <Text style={wStyles.title}>Solicitar Saque</Text>
                <Text style={wStyles.balanceLabel}>Saldo disponível</Text>
                <Text style={wStyles.balanceValue}>
                  {balance.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                </Text>

                <Text style={wStyles.label}>Tipo de chave Pix</Text>
                <View style={wStyles.typesRow}>
                  {PIX_TYPES.map(pt => (
                    <TouchableOpacity
                      key={pt.key}
                      style={[wStyles.typeBtn, pixType === pt.key && wStyles.typeBtnActive]}
                      onPress={() => { setPixType(pt.key); setPixKey(''); }}
                    >
                      <Text style={[wStyles.typeBtnText, pixType === pt.key && wStyles.typeBtnTextActive]}>
                        {pt.label}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>

                <Text style={wStyles.label}>Chave Pix</Text>
                <TextInput
                  style={wStyles.input}
                  value={pixKey}
                  onChangeText={setPixKey}
                  placeholder={pixType === 'cpf' ? '000.000.000-00' : pixType === 'email' ? 'seu@email.com' : pixType === 'phone' ? '11 99999-9999' : 'chave aleatória'}
                  placeholderTextColor="#9CA3AF"
                  autoCapitalize="none"
                  keyboardType={pixType === 'phone' ? 'phone-pad' : 'default'}
                />

                <Text style={wStyles.label}>Valor a sacar</Text>
                <TextInput
                  style={wStyles.input}
                  value={amountCents > 0 ? `R$ ${amountDisplay}` : ''}
                  onChangeText={handleAmountChange}
                  placeholder={`R$ ${MINIMUM_WITHDRAWAL},00`}
                  placeholderTextColor="#9CA3AF"
                  keyboardType="number-pad"
                />

                <View style={wStyles.infoBox}>
                  <Ionicons name="information-circle-outline" size={15} color="#6B7280" />
                  <Text style={wStyles.infoBoxText}>
                    Mínimo R$ {MINIMUM_WITHDRAWAL},00 · Você revisará os dados antes de confirmar
                  </Text>
                </View>

                <TouchableOpacity
                  style={[wStyles.btn, !canSubmit && { opacity: 0.5 }]}
                  onPress={handleReview}
                  disabled={!canSubmit}
                >
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <Ionicons name="eye-outline" size={18} color="#FFF" />
                    <Text style={wStyles.btnText}>Revisar dados</Text>
                  </View>
                </TouchableOpacity>
              </>
            )}
          </Pressable>
        </Pressable>
      </KeyboardAvoidingView>
    </Modal>
  );
}

// ---------- Tela principal ----------
export default function StatsScreen() {
  const navigation = useNavigation();
  const { user }   = useAuth();
  const { events, requests } = useSchedule();
  const { startChatWith } = useChat();

  const [reviews, setReviews]             = useState([]);
  const [walletBalance, setWalletBalance] = useState(0);
  const [transactions, setTransactions]   = useState([]);
  const [showWithdraw, setShowWithdraw]   = useState(false);

  // Carrega avaliações
  useEffect(() => {
    if (!user?.id) return;
    getReviews(user.id)
      .then(setReviews)
      .catch(e => logger.error('Erro ao carregar avaliações:', e.message));
  }, [user?.id]);

  // Carrega carteira
  const loadWallet = useCallback(async () => {
    if (!user?.id) return;
    const { data: profile } = await supabase
      .from('profiles').select('wallet_balance').eq('id', user.id).single();
    if (profile) setWalletBalance(profile.wallet_balance || 0);

    const { data: txs } = await supabase
      .from('wallet_transactions')
      .select('*')
      .eq('instructor_id', user.id)
      .order('created_at', { ascending: false })
      .limit(20);
    if (txs) setTransactions(txs);
  }, [user?.id]);

  useEffect(() => { loadWallet(); }, [loadWallet]);
  useFocusEffect(useCallback(() => { loadWallet(); }, [loadWallet]));

  // Stats de aulas
  const classEvents = useMemo(() =>
    events.filter(e => e.type === 'class' || e.type === 'CLASS'),
  [events]);

  const weekStart = useMemo(() => {
    const d = new Date(); d.setDate(d.getDate() - d.getDay()); d.setHours(0, 0, 0, 0); return d;
  }, []);

  const classesThisWeek = useMemo(() =>
    classEvents.filter(e => new Date(e.startDateTime) >= weekStart).length,
  [classEvents, weekStart]);

  const myStudents = useMemo(() => {
    const byId = {};
    requests.filter(r => r.status === 'accepted').forEach(r => {
      if (!r.student_id) return;
      if (!byId[r.student_id]) byId[r.student_id] = { id: r.student_id, name: r.studentName, avatar: r.studentAvatar, classCount: 0 };
      byId[r.student_id].classCount += 1;
    });
    classEvents.forEach(e => {
      if (!e.contactId) return;
      if (!byId[e.contactId]) byId[e.contactId] = { id: e.contactId, name: 'Aluno', avatar: null, classCount: 0 };
      byId[e.contactId].classCount += 1;
    });
    return Object.values(byId);
  }, [requests, classEvents]);

  const avgRating = useMemo(() => {
    if (!reviews.length) return null;
    return (reviews.reduce((s, r) => s + (r.rating || 0), 0) / reviews.length).toFixed(1);
  }, [reviews]);

  const stats = [
    { title: 'Aulas esta Semana', value: String(classesThisWeek),  icon: 'calendar-outline', color: '#2563EB', bg: '#EFF6FF' },
    { title: 'Meus Alunos',       value: String(myStudents.length), icon: 'people-outline',   color: GREEN,    bg: '#F0FDF4' },
    { title: 'Avaliação Média',   value: avgRating ?? '—',          icon: 'star-outline',     color: '#CA8A04',bg: '#FEFCE8' },
  ];

  const recentClasses = useMemo(() =>
    [...classEvents]
      .sort((a, b) => new Date(b.startDateTime) - new Date(a.startDateTime))
      .slice(0, 5)
      .map(e => {
        const d = new Date(e.startDateTime);
        const today    = new Date();
        const tomorrow = new Date(today); tomorrow.setDate(today.getDate() + 1);
        const isToday    = d.toDateString() === today.toDateString();
        const isTomorrow = d.toDateString() === tomorrow.toDateString();
        const dateLabel = isToday ? 'Hoje' : isTomorrow ? 'Amanhã' : d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
        return {
          id: e.id,
          studentName: e.title.replace(/^Aula de .+ - /, '') || 'Aluno',
          date: `${dateLabel}, ${d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`,
          status: e.status === 'completed' ? 'completed' : 'scheduled',
          duration: `${user?.class_duration || 60} min`,
        };
      }),
  [classEvents, user]);

  const fmtCurrency = v => Math.abs(v).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  const fmtDate = iso => new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit' });

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>Financeiro</Text>
          <Text style={styles.headerSub}>Carteira e estatísticas</Text>
        </View>
        <View style={styles.avatarCircle}>
          <Ionicons name="wallet-outline" size={22} color={PRIMARY} />
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>

        {/* ── CARTEIRA ── */}
        <LinearGradient colors={['#1E3A8A', '#2563EB']} style={styles.walletCard}>
          <Text style={styles.walletLabel}>Saldo disponível</Text>
          <Text style={styles.walletBalance}>
            {walletBalance.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
          </Text>
          <TouchableOpacity
            style={styles.withdrawBtn}
            onPress={() => setShowWithdraw(true)}
            activeOpacity={0.85}
          >
            <Ionicons name="arrow-up-circle-outline" size={18} color={PRIMARY} />
            <Text style={styles.withdrawBtnText}>Solicitar Saque</Text>
          </TouchableOpacity>
        </LinearGradient>

        {/* Transações recentes */}
        {transactions.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Movimentações</Text>
            {transactions.map(tx => (
              <View key={tx.id} style={styles.txRow}>
                <View style={[styles.txIcon, { backgroundColor: tx.amount >= 0 ? '#F0FDF4' : '#FEF2F2' }]}>
                  <Ionicons
                    name={tx.amount >= 0 ? 'arrow-down-circle-outline' : 'arrow-up-circle-outline'}
                    size={20}
                    color={tx.amount >= 0 ? GREEN : '#DC2626'}
                  />
                </View>
                <View style={styles.txInfo}>
                  <Text style={styles.txDesc}>{tx.description || (tx.type === 'credit' ? 'Crédito' : 'Saque')}</Text>
                  <Text style={styles.txDate}>
                    {fmtDate(tx.created_at)}
                    {tx.gross_amount && tx.platform_fee
                      ? `  ·  bruto ${fmtCurrency(tx.gross_amount)} · taxa ${fmtCurrency(tx.platform_fee)} (${tx.fee_pct}%)`
                      : ''}
                  </Text>
                </View>
                <Text style={[styles.txAmount, { color: tx.amount >= 0 ? GREEN : '#DC2626' }]}>
                  {tx.amount >= 0 ? '+' : '-'}{fmtCurrency(tx.amount)}
                </Text>
              </View>
            ))}
          </View>
        )}

        {/* ── ESTATÍSTICAS ── */}
        <View style={styles.kpiGrid}>
          {stats.map((stat, i) => (
            <View key={i} style={styles.kpiCard}>
              <View style={[styles.kpiIconBox, { backgroundColor: stat.bg }]}>
                <Ionicons name={stat.icon} size={22} color={stat.color} />
              </View>
              <Text style={styles.kpiValue}>{stat.value}</Text>
              <Text style={styles.kpiTitle}>{stat.title}</Text>
            </View>
          ))}
        </View>

        {/* Meus Alunos */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Meus Alunos</Text>
            <Text style={styles.seeAll}>{myStudents.length} aluno{myStudents.length !== 1 ? 's' : ''}</Text>
          </View>
          {myStudents.length === 0 ? (
            <Text style={styles.emptyText}>Nenhum aluno ainda. Aceite solicitações para ver seus alunos aqui.</Text>
          ) : myStudents.map(student => (
            <View key={student.id} style={styles.studentRow}>
              <Avatar uri={student.avatar} name={student.name} size={44} />
              <View style={styles.studentInfo}>
                <Text style={styles.studentName}>{student.name}</Text>
                <Text style={styles.studentMeta}>{student.classCount} aula{student.classCount !== 1 ? 's' : ''}</Text>
              </View>
              <TouchableOpacity
                style={styles.msgBtn}
                onPress={async () => { await startChatWith(student.id); navigation.navigate('Chat'); }}
                activeOpacity={0.8}
              >
                <Ionicons name="chatbubble-outline" size={14} color="#FFF" />
                <Text style={styles.msgBtnText}>Mensagem</Text>
              </TouchableOpacity>
            </View>
          ))}
        </View>

        {/* Aulas Recentes */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Aulas Recentes</Text>
          </View>
          {recentClasses.length === 0 ? (
            <Text style={styles.emptyText}>Nenhuma aula registrada ainda.</Text>
          ) : recentClasses.map(item => {
            const cfg = statusConfig[item.status] || statusConfig.scheduled;
            return (
              <View key={item.id} style={styles.classRow}>
                <View style={[styles.classDot, { backgroundColor: cfg.dot }]} />
                <View style={styles.classInfo}>
                  <Text style={styles.className}>{item.studentName}</Text>
                  <Text style={styles.classType}>Aula · {item.duration}</Text>
                </View>
                <View style={styles.classRight}>
                  <Text style={styles.classDate}>{item.date}</Text>
                  <Text style={[styles.classStatus, { color: cfg.color }]}>{cfg.label}</Text>
                </View>
              </View>
            );
          })}
        </View>

        {/* Banner avaliações */}
        {reviews.length > 0 && (
          <LinearGradient colors={['#1E3A8A', '#1D4ED8']} style={styles.banner}>
            <View style={{ flex: 1 }}>
              <Text style={styles.bannerTitle}>Avaliação do Mês</Text>
              <Text style={styles.bannerSub}>
                {reviews.length} avaliação{reviews.length > 1 ? 'ões' : ''} · Média {avgRating} ⭐
              </Text>
            </View>
            <Ionicons name="trophy" size={56} color="rgba(255,255,255,0.3)" />
          </LinearGradient>
        )}
      </ScrollView>

      <WithdrawModal
        visible={showWithdraw}
        balance={walletBalance}
        instructorId={user?.id}
        onClose={() => setShowWithdraw(false)}
        onSuccess={() => { setShowWithdraw(false); loadWallet(); }}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#F9FAFB' },
  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    backgroundColor: '#FFF', paddingHorizontal: 20, paddingVertical: 16,
    borderBottomWidth: 1, borderBottomColor: '#F3F4F6',
  },
  headerTitle: { fontSize: 22, fontWeight: '800', color: '#111827' },
  headerSub: { fontSize: 13, color: '#6B7280', marginTop: 2 },
  avatarCircle: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: '#EFF6FF', alignItems: 'center', justifyContent: 'center',
  },
  content: { padding: 16, paddingBottom: 40 },

  // Wallet card
  walletCard: {
    borderRadius: 20, padding: 24, marginBottom: 16,
    ...makeShadow('#1E3A8A', 4, 0.3, 12, 4),
  },
  walletLabel: { fontSize: 13, color: 'rgba(255,255,255,0.75)', marginBottom: 6 },
  walletBalance: { fontSize: 36, fontWeight: '900', color: '#FFF', marginBottom: 20 },
  withdrawBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: '#FFF', borderRadius: 12,
    paddingHorizontal: 16, paddingVertical: 10, alignSelf: 'flex-start',
  },
  withdrawBtnText: { fontSize: 14, fontWeight: '700', color: PRIMARY },

  // Transactions
  txRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#F3F4F6',
  },
  txIcon: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  txInfo: { flex: 1 },
  txDesc: { fontSize: 14, fontWeight: '600', color: '#111827' },
  txDate: { fontSize: 12, color: '#9CA3AF', marginTop: 1 },
  txAmount: { fontSize: 14, fontWeight: '700' },

  // KPI
  kpiGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginBottom: 16 },
  kpiCard: {
    flex: 1, minWidth: '29%', backgroundColor: '#FFF', borderRadius: 16,
    padding: 14, alignItems: 'center', gap: 6,
    ...makeShadow('#000', 2, 0.06, 6, 3),
  },
  kpiIconBox: { width: 44, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  kpiValue: { fontSize: 20, fontWeight: '800', color: '#111827' },
  kpiTitle: { fontSize: 11, color: '#6B7280', textAlign: 'center' },

  // Section
  section: {
    backgroundColor: '#FFF', borderRadius: 16, padding: 16, marginBottom: 16,
    ...makeShadow('#000', 2, 0.06, 6, 3),
  },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: '#111827', marginBottom: 12 },
  seeAll: { fontSize: 13, color: PRIMARY, fontWeight: '600' },
  emptyText: { fontSize: 13, color: '#9CA3AF', textAlign: 'center', paddingVertical: 16 },

  // Classes
  classRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#F3F4F6' },
  classDot: { width: 8, height: 40, borderRadius: 4, marginRight: 12 },
  classInfo: { flex: 1 },
  className: { fontSize: 14, fontWeight: '600', color: '#111827' },
  classType: { fontSize: 12, color: '#6B7280', marginTop: 2 },
  classRight: { alignItems: 'flex-end' },
  classDate: { fontSize: 13, fontWeight: '600', color: '#374151' },
  classStatus: { fontSize: 11, marginTop: 2, fontWeight: '600' },

  // Students
  studentRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#F3F4F6', gap: 12 },
  studentInfo: { flex: 1 },
  studentName: { fontSize: 14, fontWeight: '600', color: '#111827' },
  studentMeta: { fontSize: 12, color: '#6B7280', marginTop: 2 },
  msgBtn: { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: PRIMARY, borderRadius: 20, paddingHorizontal: 12, paddingVertical: 7 },
  msgBtnText: { fontSize: 12, fontWeight: '700', color: '#FFF' },

  // Banner
  banner: { borderRadius: 16, padding: 20, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  bannerTitle: { fontSize: 18, fontWeight: '800', color: '#FFF', marginBottom: 6 },
  bannerSub: { fontSize: 13, color: 'rgba(255,255,255,0.85)' },
});

const wStyles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: '#FFF', borderTopLeftRadius: 24, borderTopRightRadius: 24,
    padding: 24, paddingBottom: 40,
  },
  handle: { width: 40, height: 4, backgroundColor: '#E5E7EB', borderRadius: 2, alignSelf: 'center', marginBottom: 20 },
  title: { fontSize: 20, fontWeight: '800', color: '#111827', marginBottom: 16 },
  balanceLabel: { fontSize: 12, color: '#6B7280', marginBottom: 4 },
  balanceValue: { fontSize: 28, fontWeight: '900', color: '#111827', marginBottom: 24 },
  label: { fontSize: 13, fontWeight: '600', color: '#374151', marginBottom: 8 },
  typesRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 20 },
  typeBtn: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, borderWidth: 1.5, borderColor: '#E5E7EB' },
  typeBtnActive: { borderColor: PRIMARY, backgroundColor: '#EFF6FF' },
  typeBtnText: { fontSize: 13, fontWeight: '600', color: '#6B7280' },
  typeBtnTextActive: { color: PRIMARY },
  input: {
    borderWidth: 1.5, borderColor: '#E5E7EB', borderRadius: 12,
    paddingHorizontal: 14, paddingVertical: 12,
    fontSize: 15, color: '#111827', marginBottom: 20,
  },
  btn: {
    backgroundColor: PRIMARY, borderRadius: 14,
    paddingVertical: 14, alignItems: 'center', marginBottom: 12,
  },
  btnText: { fontSize: 16, fontWeight: '700', color: '#FFF' },
  infoBox: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 6,
    backgroundColor: '#F9FAFB', borderRadius: 10, padding: 10, marginBottom: 16,
  },
  infoBoxText: { fontSize: 12, color: '#6B7280', flex: 1, lineHeight: 18 },

  // Confirmação
  confirmRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#F3F4F6',
  },
  confirmLabel: { fontSize: 13, color: '#6B7280', fontWeight: '500' },
  confirmValue: { fontSize: 14, color: '#111827', fontWeight: '600', flexShrink: 1, textAlign: 'right', marginLeft: 12 },
  warningBox: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 10,
    backgroundColor: '#FFFBEB', borderWidth: 1, borderColor: '#FCD34D',
    borderRadius: 12, padding: 14, marginBottom: 20,
  },
  warningText: { fontSize: 13, color: '#92400E', flex: 1, lineHeight: 19 },
  cancelBtn: { alignItems: 'center', paddingVertical: 12 },
  cancelBtnText: { fontSize: 14, color: '#6B7280', fontWeight: '600' },
});
