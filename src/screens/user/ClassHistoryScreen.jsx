import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList,
  TouchableOpacity, ActivityIndicator, RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { useAuth } from '../../hooks/useAuth';
import { getStudentClassHistory } from '../../services/session.service';
import Avatar from '../../components/shared/Avatar';

// ── Configuração de status ─────────────────────────────────────────────────────

const STATUS_CONFIG = {
  completed: {
    label:    'Concluída',
    subtitle: 'Aula realizada com sucesso',
    color:    '#16A34A',
    bg:       '#F0FDF4',
    border:   '#BBF7D0',
    icon:     'checkmark-circle',
  },
  student_no_show: {
    label:    'Você faltou',
    subtitle: 'Crédito descontado',
    color:    '#DC2626',
    bg:       '#FEF2F2',
    border:   '#FECACA',
    icon:     'person-remove-outline',
  },
  instructor_no_show: {
    label:    'Instrutor faltou',
    subtitle: 'Crédito devolvido',
    color:    '#D97706',
    bg:       '#FFFBEB',
    border:   '#FDE68A',
    icon:     'alert-circle-outline',
  },
  missed: {
    label:    'Não realizada',
    subtitle: 'Nenhum dos dois compareceu · Crédito devolvido',
    color:    '#6B7280',
    bg:       '#F9FAFB',
    border:   '#E5E7EB',
    icon:     'remove-circle-outline',
  },
  interrupted: {
    label:    'Interrompida',
    subtitle: null, // usa incident_reason
    color:    '#7C3AED',
    bg:       '#F5F3FF',
    border:   '#DDD6FE',
    icon:     'warning-outline',
  },
};

const FALLBACK = {
  label: 'Encerrada', subtitle: '', color: '#6B7280',
  bg: '#F9FAFB', border: '#E5E7EB', icon: 'ellipse-outline',
};

// ── Helpers ────────────────────────────────────────────────────────────────────

function formatDate(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' });
}

function formatTime(iso) {
  if (!iso) return null;
  return new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
}

function formatDuration(minutes) {
  if (!minutes) return null;
  return `${minutes} min`;
}

// ── Item da lista ──────────────────────────────────────────────────────────────

function HistoryItem({ session }) {
  const cfg = STATUS_CONFIG[session.status] || FALLBACK;
  const instructor = session.profiles;
  const dateRef = session.scheduled_start_at || session.started_at;
  const timeStr = formatTime(session.started_at);
  const duration = formatDuration(session.duration_minutes);
  const subtitle = session.status === 'interrupted' && session.incident_reason
    ? session.incident_reason
    : cfg.subtitle;

  return (
    <View style={[styles.card, { borderColor: cfg.border, backgroundColor: cfg.bg }]}>
      {/* Cabeçalho: avatar + nome instrutor + data */}
      <View style={styles.cardHeader}>
        <Avatar uri={instructor?.avatar_url} name={instructor?.name} size={40} />
        <View style={styles.cardHeaderInfo}>
          <Text style={styles.instructorName} numberOfLines={1}>
            {instructor?.name || 'Instrutor'}
          </Text>
          <Text style={styles.dateText}>{formatDate(dateRef)}</Text>
        </View>
        {/* Badge de status */}
        <View style={[styles.badge, { backgroundColor: cfg.color + '18', borderColor: cfg.color + '40' }]}>
          <Ionicons name={cfg.icon} size={13} color={cfg.color} />
          <Text style={[styles.badgeLabel, { color: cfg.color }]}>{cfg.label}</Text>
        </View>
      </View>

      {/* Detalhes */}
      <View style={styles.cardMeta}>
        {timeStr && (
          <View style={styles.metaChip}>
            <Ionicons name="time-outline" size={12} color="#6B7280" />
            <Text style={styles.metaText}>{timeStr}</Text>
          </View>
        )}
        {duration && (
          <View style={styles.metaChip}>
            <Ionicons name="hourglass-outline" size={12} color="#6B7280" />
            <Text style={styles.metaText}>{duration}</Text>
          </View>
        )}
        {session.status === 'interrupted' && session.credit_refunded && (
          <View style={styles.metaChip}>
            <Ionicons name="refresh-circle-outline" size={12} color="#7C3AED" />
            <Text style={[styles.metaText, { color: '#7C3AED' }]}>Crédito devolvido</Text>
          </View>
        )}
      </View>

      {/* Subtítulo de status */}
      {subtitle ? (
        <Text style={[styles.statusSubtitle, { color: cfg.color }]}>{subtitle}</Text>
      ) : null}
    </View>
  );
}

// ── Tela principal ─────────────────────────────────────────────────────────────

export default function ClassHistoryScreen() {
  const navigation = useNavigation();
  const { user } = useAuth();
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async (showRefresh = false) => {
    if (showRefresh) setRefreshing(true);
    else setLoading(true);
    try {
      const data = await getStudentClassHistory(user.id);
      setSessions(data);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user.id]);

  useEffect(() => { load(); }, [load]);

  // Contadores por status para o resumo
  const counts = sessions.reduce((acc, s) => {
    acc[s.status] = (acc[s.status] || 0) + 1;
    return acc;
  }, {});

  const summaryItems = [
    { key: 'completed',          label: 'Concluídas', color: '#16A34A' },
    { key: 'student_no_show',    label: 'Suas faltas', color: '#DC2626' },
    { key: 'instructor_no_show', label: 'Falta instrutor', color: '#D97706' },
    { key: 'missed',             label: 'Não realizadas', color: '#6B7280' },
    { key: 'interrupted',        label: 'Interrompidas', color: '#7C3AED' },
  ].filter(i => counts[i.key]);

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn} activeOpacity={0.7}>
          <Ionicons name="chevron-back" size={24} color="#111827" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Histórico de Aulas</Text>
        <View style={{ width: 40 }} />
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#1D4ED8" />
        </View>
      ) : (
        <FlatList
          data={sessions}
          keyExtractor={item => item.id}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={() => load(true)} colors={['#1D4ED8']} />
          }
          ListHeaderComponent={
            sessions.length > 0 ? (
              <View>
                {/* Resumo de totais */}
                <View style={styles.summary}>
                  <Text style={styles.summaryTitle}>{sessions.length} aulas no histórico</Text>
                  <View style={styles.summaryChips}>
                    {summaryItems.map(i => (
                      <View key={i.key} style={[styles.summaryChip, { borderColor: i.color + '50', backgroundColor: i.color + '12' }]}>
                        <Text style={[styles.summaryChipCount, { color: i.color }]}>{counts[i.key]}</Text>
                        <Text style={[styles.summaryChipLabel, { color: i.color }]}>{i.label}</Text>
                      </View>
                    ))}
                  </View>
                </View>
              </View>
            ) : null
          }
          ListEmptyComponent={
            <View style={styles.empty}>
              <Ionicons name="calendar-outline" size={52} color="#D1D5DB" />
              <Text style={styles.emptyTitle}>Nenhuma aula ainda</Text>
              <Text style={styles.emptySub}>Seu histórico de aulas aparecerá aqui após a primeira sessão.</Text>
            </View>
          }
          renderItem={({ item }) => <HistoryItem session={item} />}
          contentContainerStyle={styles.listContent}
          ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
        />
      )}
    </SafeAreaView>
  );
}

// ── Estilos ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#F8FAFC' },

  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 14,
    backgroundColor: '#FFF',
    borderBottomWidth: 1, borderBottomColor: '#F1F5F9',
  },
  backBtn:     { width: 40, height: 40, justifyContent: 'center' },
  headerTitle: { fontSize: 17, fontWeight: '700', color: '#111827' },

  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },

  listContent: { padding: 16, paddingBottom: 40 },

  // Resumo
  summary:      { marginBottom: 16 },
  summaryTitle: { fontSize: 13, color: '#6B7280', fontWeight: '500', marginBottom: 10 },
  summaryChips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  summaryChip:  {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingHorizontal: 10, paddingVertical: 5,
    borderRadius: 20, borderWidth: 1,
  },
  summaryChipCount: { fontSize: 14, fontWeight: '800' },
  summaryChipLabel: { fontSize: 12, fontWeight: '500' },

  // Card
  card: {
    borderRadius: 14, borderWidth: 1.5,
    padding: 14,
  },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 10 },
  cardHeaderInfo: { flex: 1 },
  instructorName: { fontSize: 14, fontWeight: '700', color: '#111827', marginBottom: 2 },
  dateText:       { fontSize: 12, color: '#6B7280' },

  badge: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 8, paddingVertical: 4,
    borderRadius: 20, borderWidth: 1,
  },
  badgeLabel: { fontSize: 11, fontWeight: '700' },

  cardMeta:   { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 6 },
  metaChip:   { flexDirection: 'row', alignItems: 'center', gap: 4 },
  metaText:   { fontSize: 12, color: '#6B7280' },

  statusSubtitle: { fontSize: 12, fontWeight: '500', marginTop: 2 },

  // Vazio
  empty:      { alignItems: 'center', paddingTop: 80, paddingHorizontal: 32 },
  emptyTitle: { fontSize: 16, fontWeight: '700', color: '#374151', marginTop: 16, marginBottom: 8 },
  emptySub:   { fontSize: 13, color: '#9CA3AF', textAlign: 'center', lineHeight: 20 },
});
