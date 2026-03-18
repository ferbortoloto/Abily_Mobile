import React, { useMemo, useEffect, useState } from 'react';
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { useAuth } from '../../hooks/useAuth';
import { useSchedule } from '../../context/ScheduleContext';
import { useChat } from '../../context/ChatContext';
import { getReviews } from '../../services/instructors.service';
import { makeShadow } from '../../constants/theme';
import { logger } from '../../utils/logger';
import Avatar from '../../components/shared/Avatar';

const PRIMARY = '#1D4ED8';

const statusConfig = {
  completed: { label: 'Concluída', color: '#16A34A', dot: '#22C55E' },
  'in-progress': { label: 'Em andamento', color: '#CA8A04', dot: '#EAB308' },
  scheduled: { label: 'Agendada', color: '#2563EB', dot: '#3B82F6' },
};

export default function StatsScreen() {
  const navigation = useNavigation();
  const { user } = useAuth();
  const { events, requests } = useSchedule();
  const { startChatWith } = useChat();
  const [reviews, setReviews] = useState([]);

  useEffect(() => {
    if (!user?.id) return;
    getReviews(user.id)
      .then(data => setReviews(data))
      .catch(e => logger.error('Erro ao carregar avaliações:', e.message));
  }, [user?.id]);

  const classEvents = useMemo(() =>
    events.filter(e => e.type === 'class' || e.type === 'CLASS'),
  [events]);

  const weekStart = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() - d.getDay());
    d.setHours(0, 0, 0, 0);
    return d;
  }, []);

  const classesThisWeek = useMemo(() =>
    classEvents.filter(e => new Date(e.startDateTime) >= weekStart).length,
  [classEvents, weekStart]);

  // Alunos únicos: combinação de events + requests aceitas (para não perder alunos sem evento ainda)
  const myStudents = useMemo(() => {
    const acceptedReqs = requests.filter(r => r.status === 'accepted');
    const byId = {};
    // Adiciona de requests aceitas (têm name/avatar)
    acceptedReqs.forEach(r => {
      if (!r.student_id) return;
      if (!byId[r.student_id]) {
        byId[r.student_id] = {
          id: r.student_id,
          name: r.studentName,
          avatar: r.studentAvatar,
          classCount: 0,
        };
      }
      byId[r.student_id].classCount += 1;
    });
    // Adiciona de events (podem não ter nome — mas garantem contagem)
    classEvents.forEach(e => {
      if (!e.contactId) return;
      if (!byId[e.contactId]) {
        byId[e.contactId] = { id: e.contactId, name: 'Aluno', avatar: null, classCount: 0 };
      }
      byId[e.contactId].classCount += 1;
    });
    return Object.values(byId);
  }, [requests, classEvents]);

  const activeStudents = myStudents.length;

  const avgRating = useMemo(() => {
    if (reviews.length === 0) return null;
    const sum = reviews.reduce((s, r) => s + (r.rating || 0), 0);
    return (sum / reviews.length).toFixed(1);
  }, [reviews]);

  const estimatedRevenue = useMemo(() => {
    const pricePerHour = user?.price_per_hour || 0;
    const duration = (user?.class_duration || 60) / 60;
    return Math.round(classEvents.filter(e => e.status === 'completed').length * pricePerHour * duration);
  }, [classEvents, user]);

  const stats = [
    { title: 'Aulas esta Semana', value: String(classesThisWeek), icon: 'calendar-outline', color: '#2563EB', bg: '#EFF6FF' },
    { title: 'Meus Alunos', value: String(activeStudents), icon: 'people-outline', color: '#16A34A', bg: '#F0FDF4' },
    { title: 'Avaliação Média', value: avgRating ?? '—', icon: 'star-outline', color: '#CA8A04', bg: '#FEFCE8' },
    { title: 'Faturamento', value: `R$ ${estimatedRevenue}`, icon: 'cash-outline', color: PRIMARY, bg: '#EFF6FF' },
  ];

  const recentClasses = useMemo(() =>
    [...classEvents]
      .sort((a, b) => new Date(b.startDateTime) - new Date(a.startDateTime))
      .slice(0, 5)
      .map(e => {
        const d = new Date(e.startDateTime);
        const today = new Date();
        const tomorrow = new Date(today);
        tomorrow.setDate(today.getDate() + 1);
        const isToday = d.toDateString() === today.toDateString();
        const isTomorrow = d.toDateString() === tomorrow.toDateString();
        const dateLabel = isToday ? 'Hoje' : isTomorrow ? 'Amanhã' : d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
        const timeLabel = d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
        return {
          id: e.id,
          studentName: e.title.replace(/^Aula de .+ - /, '') || 'Aluno',
          date: `${dateLabel}, ${timeLabel}`,
          type: e.type === 'class' || e.type === 'CLASS' ? 'Aula Prática' : e.type,
          status: e.status === 'scheduled' ? 'scheduled' : e.status === 'completed' ? 'completed' : 'scheduled',
          duration: `${user?.class_duration || 60} min`,
        };
      }),
  [classEvents, user]);

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>Estatísticas</Text>
          <Text style={styles.headerSub}>Acompanhe seu desempenho</Text>
        </View>
        <View style={styles.avatarCircle}>
          <Ionicons name="stats-chart" size={22} color={PRIMARY} />
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {/* KPI Cards */}
        <View style={styles.kpiGrid}>
          {stats.map((stat, i) => (
            <View key={i} style={styles.kpiCard}>
              <View style={styles.kpiTop}>
                <View style={[styles.kpiIconBox, { backgroundColor: stat.bg }]}>
                  <Ionicons name={stat.icon} size={22} color={stat.color} />
                </View>
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
          ) : (
            myStudents.map(student => (
              <View key={student.id} style={styles.studentRow}>
                <Avatar uri={student.avatar} name={student.name} size={44} />
                <View style={styles.studentInfo}>
                  <Text style={styles.studentName}>{student.name}</Text>
                  <Text style={styles.studentMeta}>
                    {student.classCount} aula{student.classCount !== 1 ? 's' : ''}
                  </Text>
                </View>
                <TouchableOpacity
                  style={styles.msgBtn}
                  onPress={async () => {
                    await startChatWith(student.id);
                    navigation.navigate('Chat');
                  }}
                  activeOpacity={0.8}
                >
                  <Ionicons name="chatbubble-outline" size={14} color="#FFF" />
                  <Text style={styles.msgBtnText}>Mensagem</Text>
                </TouchableOpacity>
              </View>
            ))
          )}
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
                  <Text style={styles.classType}>{item.type} · {item.duration}</Text>
                </View>
                <View style={styles.classRight}>
                  <Text style={styles.classDate}>{item.date}</Text>
                  <Text style={[styles.classStatus, { color: cfg.color }]}>{cfg.label}</Text>
                </View>
              </View>
            );
          })}
        </View>

        {/* Banner do mês */}
        {reviews.length > 0 && (
          <LinearGradient colors={['#1E3A8A', '#1D4ED8']} style={styles.banner}>
            <View style={styles.bannerLeft}>
              <Text style={styles.bannerTitle}>Avaliação do Mês</Text>
              <Text style={styles.bannerSub}>Você tem {reviews.length} avaliação{reviews.length > 1 ? 'ões' : ''}. Média {avgRating} ⭐</Text>
            </View>
            <Ionicons name="trophy" size={56} color="rgba(255,255,255,0.3)" />
          </LinearGradient>
        )}
      </ScrollView>
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
  content: { padding: 16, paddingBottom: 32 },
  kpiGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginBottom: 20 },
  kpiCard: {
    flex: 1, minWidth: '45%', backgroundColor: '#FFF', borderRadius: 16,
    padding: 14, ...makeShadow('#000', 2, 0.06, 6, 3),
  },
  kpiTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 },
  kpiIconBox: { width: 40, height: 40, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  kpiBadge: { backgroundColor: '#F0FDF4', borderRadius: 8, paddingHorizontal: 6, paddingVertical: 3 },
  kpiBadgeText: { fontSize: 11, color: '#16A34A', fontWeight: '700' },
  kpiValue: { fontSize: 22, fontWeight: '800', color: '#111827', marginBottom: 2 },
  kpiTitle: { fontSize: 12, color: '#6B7280' },
  section: {
    backgroundColor: '#FFF', borderRadius: 16, padding: 16, marginBottom: 16,
    ...makeShadow('#000', 2, 0.06, 6, 3),
  },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: '#111827' },
  seeAll: { fontSize: 13, color: PRIMARY, fontWeight: '600' },
  classRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#F3F4F6' },
  classDot: { width: 8, height: 40, borderRadius: 4, marginRight: 12 },
  classInfo: { flex: 1 },
  className: { fontSize: 14, fontWeight: '600', color: '#111827' },
  classType: { fontSize: 12, color: '#6B7280', marginTop: 2 },
  classRight: { alignItems: 'flex-end' },
  classDate: { fontSize: 13, fontWeight: '600', color: '#374151' },
  classStatus: { fontSize: 11, marginTop: 2, fontWeight: '600' },
  testCard: {
    borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 12, padding: 12, marginBottom: 10,
  },
  testTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 },
  testName: { fontSize: 14, fontWeight: '700', color: '#111827' },
  testType: { fontSize: 12, color: '#6B7280', marginTop: 2 },
  testDateRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
  testDateLabel: { fontSize: 12, color: '#6B7280' },
  testDateValue: { fontSize: 12, fontWeight: '700', color: '#111827' },
  prepRow: { marginBottom: 6 },
  prepLabel: { fontSize: 12, color: '#6B7280' },
  prepValue: { fontWeight: '700', color: '#111827' },
  progressBg: { height: 6, backgroundColor: '#E5E7EB', borderRadius: 3, overflow: 'hidden' },
  progressFill: { height: 6, backgroundColor: PRIMARY, borderRadius: 3 },
  banner: {
    borderRadius: 16, padding: 20, flexDirection: 'row',
    alignItems: 'center', justifyContent: 'space-between',
  },
  bannerLeft: { flex: 1 },
  bannerTitle: { fontSize: 18, fontWeight: '800', color: '#FFF', marginBottom: 6 },
  bannerSub: { fontSize: 13, color: 'rgba(255,255,255,0.85)', marginBottom: 14 },
  bannerBtn: { backgroundColor: '#FFF', borderRadius: 10, paddingHorizontal: 16, paddingVertical: 8, alignSelf: 'flex-start' },
  bannerBtnText: { fontSize: 13, fontWeight: '700', color: PRIMARY },
  emptyText: { fontSize: 13, color: '#9CA3AF', textAlign: 'center', paddingVertical: 16 },
  studentRow: {
    flexDirection: 'row', alignItems: 'center', paddingVertical: 10,
    borderBottomWidth: 1, borderBottomColor: '#F3F4F6', gap: 12,
  },
  studentInfo: { flex: 1 },
  studentName: { fontSize: 14, fontWeight: '600', color: '#111827' },
  studentMeta: { fontSize: 12, color: '#6B7280', marginTop: 2 },
  msgBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    backgroundColor: PRIMARY, borderRadius: 20,
    paddingHorizontal: 12, paddingVertical: 7,
  },
  msgBtnText: { fontSize: 12, fontWeight: '700', color: '#FFF' },
});
