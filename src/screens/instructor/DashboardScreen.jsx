import React, { useState, useMemo, useRef, useEffect } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, Modal,
  ScrollView, Platform, Alert, Animated, Dimensions, PanResponder,
  TextInput, Switch,
} from 'react-native';

import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../hooks/useAuth';
import { useSchedule } from '../../context/ScheduleContext';
import { usePlans } from '../../context/PlansContext';
import { useSession } from '../../context/SessionContext';
import { useChat } from '../../context/ChatContext';
import { useCurrentLocation } from '../../hooks/useCurrentLocation';
import LeafletMapView from '../../components/shared/LeafletMapView';
import ActiveSessionCard from '../../components/shared/ActiveSessionCard';
import ReviewModal from '../../components/shared/ReviewModal';
import Avatar from '../../components/shared/Avatar';
import { formatTravelTime } from '../../utils/travelTime';
import { makeShadow } from '../../constants/theme';
import { MeetingPointType } from '../../data/scheduleData';
import { toast } from '../../utils/toast';

const PRIMARY = '#1D4ED8';
const SCREEN_H = Dimensions.get('window').height;
const COLLAPSED_H = 88; // handle + kpi strip
const EXPANDED_H = SCREEN_H * 0.48;
const FULL_H = SCREEN_H * 0.88; // terceiro snap — painel quase full-screen
const MIDPOINT_LOW = (COLLAPSED_H + EXPANDED_H) / 2;
const MIDPOINT_HIGH = (EXPANDED_H + FULL_H) / 2;

const DEFAULT_LOCATION = { latitude: -23.5505, longitude: -46.6333 };

const TYPE_COLOR = {
  'Aula Prática': { bg: '#F0FDF4', text: '#16A34A' },
  'Simulado':     { bg: '#FFF7ED', text: '#EA580C' },
};

const CLASS_TYPES = ['Aula Prática', 'Misto'];

const CLASS_TYPE_ICON = {
  'Aula Prática': 'car-outline',
  'Misto':        'grid-outline',
};


const NOTIF_STYLE = {
  request: { bg: '#EFF6FF', icon: 'notifications-outline', color: '#1D4ED8', label: 'Solicitação' },
  message: { bg: '#EFF6FF', icon: 'chatbubble-outline', color: '#2563EB', label: 'Mensagem' },
  late:    { bg: '#FFFBEB', icon: 'warning-outline',     color: '#CA8A04', label: 'Atraso' },
};

export default function DashboardScreen({ navigation }) {
  const { user, updateProfile } = useAuth();
  const { requests, addEvent, acceptRequest, rejectRequest, checkTravelConflict, loadData } = useSchedule();
  const { startChatWith } = useChat();
  const { getInstructorPlans, togglePlan, addPlan } = usePlans();
  const { activeSession, elapsedSeconds, isCompleted, completedSession, generateCode, startSession, endSession, clearCompletedSession } = useSession();
  const { location: currentLocation } = useCurrentLocation();

  // Atualiza as coordenadas do instrutor no perfil quando a localização é obtida
  useEffect(() => {
    if (!currentLocation || !user?.id) return;
    updateProfile({ coordinates: currentLocation }).catch(() => {});
  }, [currentLocation?.latitude, currentLocation?.longitude]);

  const [notifications, setNotifications] = useState([]);
  const [selectedRequest, setSelectedRequest] = useState(null);
  const [showNotifications, setShowNotifications] = useState(false);
  const [panelState, setPanelState] = useState('expanded'); // 'collapsed' | 'expanded' | 'full'
  const [activeTab, setActiveTab] = useState('requests'); // 'requests' | 'plans'
  const [showNewPlanModal, setShowNewPlanModal] = useState(false);
  const [showStartModal, setShowStartModal] = useState(false);
  const [sessionCodeInput, setSessionCodeInput] = useState('');

  // New plan form state
  const [newPlanName, setNewPlanName] = useState('');
  const [newPlanDesc, setNewPlanDesc] = useState('');
  const [newPlanCount, setNewPlanCount] = useState('5');
  const [newPlanPrice, setNewPlanPrice] = useState('');
  const [newPlanValidity, setNewPlanValidity] = useState('60');
  const [newPlanType, setNewPlanType] = useState('Aula Prática');

  const panelHeight = useRef(new Animated.Value(EXPANDED_H)).current;
  const settledHeight = useRef(EXPANDED_H);

  // Recarrega solicitações toda vez que a tela entra em foco (fallback se realtime falhar)
  useFocusEffect(React.useCallback(() => { loadData(); }, [])); // eslint-disable-line react-hooks/exhaustive-deps

  const instructorPlans = getInstructorPlans(user?.id);
  const pendingRequests = requests.filter(r => r.status === 'pending');
  const acceptedRequests = requests.filter(r => r.status === 'accepted');

  // Gera notificações automáticas para novas solicitações pendentes
  const seenRequestIdsRef = useRef(new Set());
  useEffect(() => {
    const newPending = requests.filter(
      r => r.status === 'pending' && !seenRequestIdsRef.current.has(r.id)
    );
    if (!newPending.length) return;
    newPending.forEach(r => seenRequestIdsRef.current.add(r.id));
    setNotifications(prev => [
      ...newPending.map(r => ({
        id: `req-${r.id}`,
        type: 'request',
        requestId: r.id,
        title: 'Nova solicitação de aula',
        body: `${r.studentName || 'Aluno'} quer agendar uma aula de ${r.type || 'direção'}.`,
        time: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
        read: false,
      })),
      ...prev,
    ]);
  }, [requests]);
  const unreadCount = notifications.filter(n => !n.read).length;
  const estimatedRevenue = acceptedRequests.reduce((s, r) => s + r.price, 0);

  const handleSaveNewPlan = () => {
    if (!newPlanName.trim() || !newPlanPrice.trim()) {
      toast.error('Preencha nome e preço do plano.');
      return;
    }
    addPlan({
      instructorId: user?.id,
      name: newPlanName.trim(),
      description: newPlanDesc.trim(),
      classCount: parseInt(newPlanCount, 10) || 5,
      classType: newPlanType,
      price: parseFloat(newPlanPrice.replace(',', '.')) || 0,
      validityDays: parseInt(newPlanValidity, 10) || 60,
    });
    setNewPlanName('');
    setNewPlanDesc('');
    setNewPlanCount('5');
    setNewPlanPrice('');
    setNewPlanValidity('60');
    setNewPlanType('Aula Prática');
    setShowNewPlanModal(false);
    toast.success('Plano criado! Já disponível para os alunos.');
  };

  const animateTo = (toValue, state) => {
    settledHeight.current = toValue;
    Animated.spring(panelHeight, { toValue, useNativeDriver: false, tension: 70, friction: 12 }).start();
    setPanelState(state);
  };

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_, gs) =>
        Math.abs(gs.dy) > 5 && Math.abs(gs.dy) > Math.abs(gs.dx),
      onPanResponderGrant: () => {
        panelHeight.stopAnimation();
        settledHeight.current = panelHeight._value ?? settledHeight.current;
      },
      onPanResponderMove: (_, gs) => {
        panelHeight.setValue(
          Math.max(COLLAPSED_H, Math.min(FULL_H, settledHeight.current - gs.dy)),
        );
      },
      onPanResponderRelease: (_, gs) => {
        const proj = settledHeight.current - gs.dy;
        if (gs.vy > 0.5) {
          // Swipe rápido para baixo — desce um nível
          if (settledHeight.current >= FULL_H - 10) animateTo(EXPANDED_H, 'expanded');
          else animateTo(COLLAPSED_H, 'collapsed');
        } else if (gs.vy < -0.5) {
          // Swipe rápido para cima — sobe um nível
          if (settledHeight.current <= COLLAPSED_H + 10) animateTo(EXPANDED_H, 'expanded');
          else animateTo(FULL_H, 'full');
        } else {
          // Snap pelo posição projetada (3 pontos)
          if (proj > MIDPOINT_HIGH) animateTo(FULL_H, 'full');
          else if (proj > MIDPOINT_LOW) animateTo(EXPANDED_H, 'expanded');
          else animateTo(COLLAPSED_H, 'collapsed');
        }
      },
      onPanResponderTerminate: (_, gs) => {
        const proj = settledHeight.current - gs.dy;
        if (proj > MIDPOINT_HIGH) animateTo(FULL_H, 'full');
        else if (proj > MIDPOINT_LOW) animateTo(EXPANDED_H, 'expanded');
        else animateTo(COLLAPSED_H, 'collapsed');
      },
    }),
  ).current;

  const instructorLocation = user?.coordinates || DEFAULT_LOCATION;

  const mapMarkers = useMemo(() => [
    { id: 'self', latitude: instructorLocation.latitude, longitude: instructorLocation.longitude, label: 'Você', color: PRIMARY, type: 'self' },
    ...requests.map(req => {
      const firstName = (req.studentName || 'Aluno').split(' ')[0];
      const isAccepted = req.status === 'accepted';
      return {
        id: req.id,
        latitude: req.coordinates.latitude,
        longitude: req.coordinates.longitude,
        label: isAccepted ? `✓ ${firstName}` : firstName,
        color: isAccepted ? '#16A34A' : '#F59E0B',
        type: 'default',
      };
    }),
  ], [requests]);

  // Calcula info de deslocamento para uma solicitação pendente,
  // considerando que a aula seria criada ~2h a partir de agora.
  const getRequestTravelInfo = (request) => {
    const durationMinutes = user?.class_duration || 60;
    const newStart = new Date(Date.now() + 2 * 60 * 60 * 1000);
    const newEnd = new Date(newStart.getTime() + durationMinutes * 60 * 1000);
    const coords = request.meetingPoint?.coordinates || null;
    return checkTravelConflict(newStart.toISOString(), newEnd.toISOString(), coords);
  };

  const getMeetingPointLabel = (request) => {
    if (!request.meetingPoint) return request.location;
    if (request.meetingPoint.type === MeetingPointType.INSTRUCTOR_LOCATION) return 'Local do instrutor';
    if (request.meetingPoint.type === MeetingPointType.STUDENT_HOME) return 'Casa do aluno';
    return 'Local personalizado';
  };

  const doAcceptRequest = async (request) => {
    try {
      const durationMinutes = user?.class_duration || 60;
      const event = await addEvent({
        title: `Aula de ${request.type} - ${request.studentName}`,
        type: 'class', priority: 'medium',
        startDateTime: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(),
        endDateTime: new Date(Date.now() + 2 * 60 * 60 * 1000 + durationMinutes * 60 * 1000).toISOString(),
        studentId: request.student_id,
        location: request.meetingPoint?.address || request.location,
        meetingPoint: request.meetingPoint,
        description: `Aula de ${request.type} via app. Valor: R$ ${request.price}`,
        status: 'scheduled',
      });
      await acceptRequest(request.id);
      const code = await generateCode({ studentId: request.student_id, eventId: event?.id, durationMinutes });
      setSelectedRequest(null);
      toast.success(`Aula aceita! Código: ${code}`);
      toast.info(`Mostre o código ${code} ao aluno para iniciar o timer.`);
    } catch (e) {
      toast.error('Não foi possível aceitar a solicitação. Tente novamente.');
    }
  };

  const handleAcceptRequest = (requestId) => {
    const request = requests.find(r => r.id === requestId);
    if (!request) return;

    const travelInfo = getRequestTravelInfo(request);

    if (travelInfo.hasIssue) {
      const lines = [];
      if (travelInfo.prevEvent && travelInfo.prevCheck.status !== 'ok') {
        lines.push(`• Aula anterior termina em ${travelInfo.prevGap} min`);
        lines.push(`  Deslocamento necessário: ${formatTravelTime(travelInfo.travelTimeToPrev)}`);
      }
      if (travelInfo.nextEvent && travelInfo.nextCheck.status !== 'ok') {
        lines.push(`• Próxima aula começa em ${travelInfo.nextGap} min`);
        lines.push(`  Deslocamento necessário: ${formatTravelTime(travelInfo.travelTimeToNext)}`);
      }
      const severity = travelInfo.prevCheck.status === 'conflict' || travelInfo.nextCheck.status === 'conflict'
        ? 'Conflito de horário'
        : 'Atenção: horário apertado';
      Alert.alert(
        severity,
        `Pode haver pouco tempo para se deslocar até ${getMeetingPointLabel(request)}.\n\n${lines.join('\n')}\n\nDeseja aceitar mesmo assim?`,
        [
          { text: 'Cancelar', style: 'cancel' },
          { text: 'Aceitar mesmo assim', style: 'destructive', onPress: () => doAcceptRequest(request) },
        ],
      );
    } else {
      doAcceptRequest(request);
    }
  };

  const handleStartSession = async () => {
    const ok = await startSession(sessionCodeInput);
    if (ok) {
      setShowStartModal(false);
      setSessionCodeInput('');
    } else {
      toast.error('Código inválido. Verifique o código informado pelo aluno.');
    }
  };

  const handleRejectRequest = async (requestId) => {
    try {
      await rejectRequest(requestId);
    } catch (e) {
      toast.error('Não foi possível rejeitar a solicitação.');
    }
    setSelectedRequest(null);
  };

  const handleNotificationPress = (notif) => {
    setNotifications(prev => prev.map(n => n.id === notif.id ? { ...n, read: true } : n));
    if (notif.type === 'request' && notif.requestId) {
      const req = requests.find(r => r.id === notif.requestId);
      if (req?.status === 'pending') { setShowNotifications(false); setSelectedRequest(req); }
    } else if (notif.type === 'message') {
      setShowNotifications(false); navigation.navigate('Chat');
    }
  };

  const markAllRead = () => setNotifications(prev => prev.map(n => ({ ...n, read: true })));

  return (
    <View style={styles.container}>
      {/* MAP */}
      <LeafletMapView
        center={{ lat: instructorLocation.latitude, lng: instructorLocation.longitude }}
        zoom={14} markers={mapMarkers}
        onMarkerPress={(id) => {
          const req = requests.find(r => r.id === id);
          if (req?.status === 'pending') { animateTo(EXPANDED_H, 'expanded'); setSelectedRequest(req); }
        }}
      />

      {/* HEADER OVERLAY */}
      <SafeAreaView edges={['top']} style={styles.headerOverlay}>
        <View style={styles.headerCard}>
          {/* Row 1: avatar + name + bell */}
          <View style={styles.headerRow}>
            <View style={styles.headerLeft}>
              <Avatar uri={user?.avatar_url} name={user?.name} size={40} />
              <View>
                <Text style={styles.headerGreeting}>Bem-vindo</Text>
                <Text style={styles.headerName}>{user?.name || 'Instrutor Abily'}</Text>
              </View>
            </View>
            <TouchableOpacity style={styles.bellBtn} onPress={() => setShowNotifications(true)} activeOpacity={0.8}>
              <Ionicons name="notifications-outline" size={20} color="#374151" />
              {unreadCount > 0 && (
                <View style={styles.bellBadge}>
                  <Text style={styles.bellBadgeText}>{unreadCount}</Text>
                </View>
              )}
            </TouchableOpacity>
          </View>
          {/* Row 2: valor/hora + duração — compacto */}
          <TouchableOpacity
            style={styles.headerConfigRow}
            onPress={() => navigation.navigate('Profile', { startEditing: true, t: Date.now() })}
            activeOpacity={0.8}
          >
            {/* Preço carro */}
            {user?.price_per_hour ? (<>
              <Ionicons name="car-outline" size={11} color="#6B7280" />
              <Text style={styles.headerConfigText}>R$ {user.price_per_hour}/h</Text>
            </>) : null}
            {/* Preço moto — só aparece se tiver ambas categorias */}
            {user?.price_per_hour && user?.price_per_hour_moto ? (
              <View style={styles.headerStatDivider} />
            ) : null}
            {user?.price_per_hour_moto ? (<>
              <Ionicons name="bicycle-outline" size={11} color="#6B7280" />
              <Text style={styles.headerConfigText}>R$ {user.price_per_hour_moto}/h</Text>
            </>) : null}
            {/* Fallback se nenhum preço definido */}
            {!user?.price_per_hour && !user?.price_per_hour_moto ? (
              <Text style={styles.headerConfigText}>—</Text>
            ) : null}
            <View style={styles.headerStatDivider} />
            <Ionicons name="timer-outline" size={11} color="#6B7280" />
            <Text style={styles.headerConfigText}>
              {user?.class_duration ? `${user.class_duration} min` : '60 min'}
            </Text>
            <View style={{ flex: 1 }} />
            <Ionicons name="create-outline" size={11} color="#9CA3AF" />
            <Text style={styles.headerConfigEditText}>Editar</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>

      {/* BOTTOM PANEL */}
      <Animated.View style={[styles.bottomPanel, { height: panelHeight }]}>

        {/* Drag handle */}
        <View style={styles.handleRow} {...panResponder.panHandlers}>
          <View style={styles.panelHandle} />
          <Ionicons name={panelState === 'full' ? 'chevron-down' : 'chevron-up'} size={13} color="#D1D5DB" style={{ marginTop: 2 }} />
        </View>

        {/* ── KPI strip ── */}
        <View style={styles.kpiStrip}>
          <View style={[styles.kpiChip, { backgroundColor: '#EFF6FF' }]}>
            <Ionicons name="notifications-outline" size={14} color={PRIMARY} />
            <Text style={[styles.kpiNum, { color: PRIMARY }]}>{pendingRequests.length}</Text>
            <Text style={[styles.kpiLbl, { color: PRIMARY }]}>Pendentes</Text>
          </View>
          <View style={styles.kpiDivider} />
          <View style={[styles.kpiChip, { backgroundColor: '#F0FDF4' }]}>
            <Ionicons name="checkmark-circle-outline" size={14} color="#16A34A" />
            <Text style={[styles.kpiNum, { color: '#16A34A' }]}>{acceptedRequests.length}</Text>
            <Text style={[styles.kpiLbl, { color: '#16A34A' }]}>Aceitas</Text>
          </View>
          <View style={styles.kpiDivider} />
          <View style={[styles.kpiChip, { backgroundColor: '#EFF6FF' }]}>
            <Ionicons name="wallet-outline" size={14} color="#2563EB" />
            <Text style={[styles.kpiNum, { color: '#2563EB' }]}>R${estimatedRevenue}</Text>
            <Text style={[styles.kpiLbl, { color: '#2563EB' }]}>Estimado</Text>
          </View>
        </View>

        {/* ── Active Session ── */}
        {activeSession ? (
          <ActiveSessionCard
            activeSession={activeSession}
            elapsedSeconds={elapsedSeconds}
            isCompleted={isCompleted}
            isInstructor
            onEnd={endSession}
          />
        ) : (
          acceptedRequests.length > 0 && (
            <TouchableOpacity
              style={styles.startSessionBtn}
              onPress={() => setShowStartModal(true)}
              activeOpacity={0.85}
            >
              <Ionicons name="play-circle-outline" size={18} color="#FFF" />
              <Text style={styles.startSessionBtnText}>Iniciar Aula</Text>
              <Text style={styles.startSessionBtnSub}>Digite o código do aluno</Text>
            </TouchableOpacity>
          )
        )}

        {/* ── Tab switcher ── */}
        {!activeSession && panelState !== 'collapsed' && (
          <View style={styles.tabSwitcher}>
            <TouchableOpacity
              style={[styles.tabBtn, activeTab === 'requests' && styles.tabBtnActive]}
              onPress={() => setActiveTab('requests')}
            >
              <Ionicons name="notifications-outline" size={13} color={activeTab === 'requests' ? PRIMARY : '#9CA3AF'} />
              <Text style={[styles.tabBtnText, activeTab === 'requests' && styles.tabBtnTextActive]}>
                Solicitações
              </Text>
              {pendingRequests.length > 0 && (
                <View style={styles.tabBadge}>
                  <Text style={styles.tabBadgeText}>{pendingRequests.length}</Text>
                </View>
              )}
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.tabBtn, activeTab === 'plans' && styles.tabBtnActive]}
              onPress={() => setActiveTab('plans')}
            >
              <Ionicons name="layers-outline" size={13} color={activeTab === 'plans' ? PRIMARY : '#9CA3AF'} />
              <Text style={[styles.tabBtnText, activeTab === 'plans' && styles.tabBtnTextActive]}>
                Planos
              </Text>
              <View style={[styles.tabBadge, { backgroundColor: '#EFF6FF' }]}>
                <Text style={[styles.tabBadgeText, { color: PRIMARY }]}>{instructorPlans.length}</Text>
              </View>
            </TouchableOpacity>
          </View>
        )}

        {/* ── PAUSED BANNER ── */}
        {!activeSession && panelState !== 'collapsed' && user?.is_accepting_requests === false && (
          <View style={styles.pausedBanner}>
            <Ionicons name="pause-circle" size={16} color="#92400E" />
            <View style={{ flex: 1 }}>
              <Text style={styles.pausedBannerTitle}>Você está pausado</Text>
              <Text style={styles.pausedBannerSub}>Novos pedidos e planos estão desativados. Reative no seu perfil.</Text>
            </View>
            <TouchableOpacity onPress={() => navigation.navigate('Profile')} activeOpacity={0.8}>
              <Text style={styles.pausedBannerLink}>Reativar</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* ── REQUESTS TAB ── */}
        {!activeSession && panelState !== 'collapsed' && activeTab === 'requests' && (
          pendingRequests.length === 0 ? (
            <View style={styles.emptyState}>
              <View style={styles.emptyIcon}>
                <Ionicons name="checkmark-done-outline" size={28} color={PRIMARY} />
              </View>
              <Text style={styles.emptyTitle}>Tudo em dia!</Text>
              <Text style={styles.emptyText}>Nenhuma solicitação pendente no momento.</Text>
            </View>
          ) : (
            <ScrollView
              style={styles.cardsList}
              contentContainerStyle={styles.cardsContent}
              showsVerticalScrollIndicator={false}
            >
              {pendingRequests.map(req => {
                const tc = TYPE_COLOR[req.type] || { bg: '#F3F4F6', text: '#6B7280' };
                const travelInfo = getRequestTravelInfo(req);
                const travelStatus = travelInfo.hasIssue
                  ? (travelInfo.prevCheck?.status === 'conflict' || travelInfo.nextCheck?.status === 'conflict'
                    ? 'conflict' : 'warning')
                  : 'ok';
                const travelColor = travelStatus === 'conflict' ? '#EF4444' : travelStatus === 'warning' ? '#D97706' : '#6B7280';
                const travelBg = travelStatus === 'conflict' ? '#FEF2F2' : travelStatus === 'warning' ? '#FFFBEB' : null;
                const travelMin = Math.max(
                  travelInfo.travelTimeToPrev || 0,
                  travelInfo.travelTimeToNext || 0,
                );
                return (
                  <TouchableOpacity
                    key={req.id}
                    style={[styles.reqCard, travelStatus === 'conflict' && styles.reqCardConflict]}
                    onPress={() => setSelectedRequest(req)}
                    activeOpacity={0.88}
                  >
                    <View style={[styles.reqAccent, travelStatus !== 'ok' && { backgroundColor: travelColor }]} />
                    <View style={styles.reqBody}>
                      <View style={styles.reqTopRow}>
                        <Avatar uri={req.studentAvatar} name={req.studentName} size={40} />
                        <View style={styles.reqNameBlock}>
                          <Text style={styles.reqName}>{req.studentName}</Text>
                          <View style={styles.reqBadgesRow}>
                            <View style={[styles.typeBadge, { backgroundColor: tc.bg }]}>
                              <Text style={[styles.typeBadgeText, { color: tc.text }]}>{req.type}</Text>
                            </View>
                            <View style={[styles.typeBadge, { backgroundColor: '#EFF6FF' }]}>
                              <Text style={[styles.typeBadgeText, { color: PRIMARY }]}>
                                {req.carOption === 'student' ? 'Carro do aluno' : 'Carro instrutor'}
                              </Text>
                            </View>
                            <View style={styles.ratingPill}>
                              <Ionicons name="star" size={10} color="#EAB308" />
                              <Text style={styles.ratingText}>{req.rating}</Text>
                            </View>
                          </View>
                        </View>
                        {req.planName ? (
                          <View style={styles.planBadge}>
                            <Ionicons name="layers-outline" size={11} color="#7C3AED" />
                            <View>
                              <Text style={styles.planBadgeName} numberOfLines={1}>{req.planName}</Text>
                              <Text style={styles.planBadgeSub}>
                                {req.classesRemaining}/{req.classesTotal} restantes
                              </Text>
                            </View>
                          </View>
                        ) : (
                          <View style={styles.avulsaBadge}>
                            <Ionicons name="car-outline" size={11} color="#1D4ED8" />
                            <Text style={styles.avulsaBadgeText}>Avulsa</Text>
                          </View>
                        )}
                      </View>

                      {/* Meeting point */}
                      <View style={styles.reqLocRow}>
                        <Ionicons
                          name={req.meetingPoint?.type === MeetingPointType.STUDENT_HOME ? 'home-outline' :
                                req.meetingPoint?.type === MeetingPointType.INSTRUCTOR_LOCATION ? 'business-outline' :
                                'location-outline'}
                          size={12} color="#9CA3AF"
                        />
                        <Text style={styles.reqLocText} numberOfLines={1}>
                          {req.meetingPoint?.address || req.location}
                        </Text>
                      </View>

                      {/* Distance + travel time row */}
                      <View style={styles.reqMetaRow}>
                        <Ionicons name="navigate-outline" size={11} color="#6B7280" />
                        <Text style={styles.reqMetaText}>{req.distance}</Text>
                        <View style={styles.metaDot} />
                        <Ionicons name="time-outline" size={11} color="#6B7280" />
                        <Text style={styles.reqMetaText}>{req.estimatedTime}</Text>
                        <Text style={styles.reqAgo}>{req.requestTime}</Text>
                      </View>

                      {/* Travel conflict badge */}
                      {travelStatus !== 'ok' && travelMin > 0 && (
                        <View style={[styles.travelWarningRow, { backgroundColor: travelBg }]}>
                          <Ionicons
                            name={travelStatus === 'conflict' ? 'close-circle-outline' : 'warning-outline'}
                            size={13} color={travelColor}
                          />
                          <Text style={[styles.travelWarningText, { color: travelColor }]}>
                            {travelStatus === 'conflict'
                              ? `Conflito: ${formatTravelTime(travelMin)} de deslocamento necessário`
                              : `Atenção: ${formatTravelTime(travelMin)} de deslocamento (pouco tempo)`}
                          </Text>
                        </View>
                      )}

                      <View style={styles.reqActions}>
                        <TouchableOpacity style={styles.rejectBtn} onPress={() => handleRejectRequest(req.id)}>
                          <Ionicons name="close" size={13} color="#EF4444" />
                          <Text style={styles.rejectBtnText}>Recusar</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={styles.acceptBtn} onPress={() => handleAcceptRequest(req.id)}>
                          <Ionicons name="checkmark" size={13} color="#FFF" />
                          <Text style={styles.acceptBtnText}>Aceitar</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={styles.detailBtn} onPress={() => setSelectedRequest(req)}>
                          <Text style={styles.detailBtnText}>Detalhes</Text>
                          <Ionicons name="chevron-forward" size={12} color={PRIMARY} />
                        </TouchableOpacity>
                      </View>
                    </View>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          )
        )}

        {/* ── PLANS TAB ── */}
        {!activeSession && panelState !== 'collapsed' && activeTab === 'plans' && (
          <ScrollView
            style={styles.cardsList}
            contentContainerStyle={styles.cardsContent}
            showsVerticalScrollIndicator={false}
          >
            {/* Header row */}
            <View style={styles.plansHeader}>
              <Text style={styles.plansHeaderText}>
                {user?.is_accepting_requests === false
                  ? `${instructorPlans.length} plano${instructorPlans.length !== 1 ? 's' : ''} pausado${instructorPlans.length !== 1 ? 's' : ''}`
                  : `${instructorPlans.filter(p => p.isActive).length} plano${instructorPlans.filter(p => p.isActive).length !== 1 ? 's' : ''} ativo${instructorPlans.filter(p => p.isActive).length !== 1 ? 's' : ''}`
                }
              </Text>
              <TouchableOpacity style={styles.newPlanBtn} onPress={() => setShowNewPlanModal(true)}>
                <Ionicons name="add" size={14} color="#FFF" />
                <Text style={styles.newPlanBtnText}>Novo Plano</Text>
              </TouchableOpacity>
            </View>


            {instructorPlans.length === 0 ? (
              <View style={styles.emptyState}>
                <View style={styles.emptyIcon}>
                  <Ionicons name="layers-outline" size={28} color={PRIMARY} />
                </View>
                <Text style={styles.emptyTitle}>Sem planos</Text>
                <Text style={styles.emptyText}>Crie planos de aulas para atrair mais alunos.</Text>
              </View>
            ) : (
              instructorPlans.map(plan => {
                const isPaused = user?.is_accepting_requests === false;
                const pricePerClass = (plan.price / plan.classCount).toFixed(0);
                return (
                  <View key={plan.id} style={[styles.planCard, (!plan.isActive || isPaused) && styles.planCardInactive]}>
                    <View style={styles.planCardLeft}>
                      <View style={[styles.planIconBox, { opacity: plan.isActive && !isPaused ? 1 : 0.4 }]}>
                        <Ionicons name={CLASS_TYPE_ICON[plan.classType] || 'layers-outline'} size={18} color={PRIMARY} />
                      </View>
                      <View style={{ flex: 1 }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                          <Text style={[styles.planCardName, (!plan.isActive || isPaused) && styles.planCardNameInactive]}>
                            {plan.name}
                          </Text>
                          {isPaused && (
                            <View style={styles.planPausedBadge}>
                              <Ionicons name="pause" size={9} color="#92400E" />
                              <Text style={styles.planPausedBadgeText}>Pausado</Text>
                            </View>
                          )}
                        </View>
                        <View style={styles.planCardMeta}>
                          <Text style={styles.planCardMetaText}>{plan.classCount} aulas · {plan.validityDays} dias</Text>
                          <View style={styles.metaDot} />
                          <Text style={styles.planCardMetaText}>{plan.classType}</Text>
                        </View>
                        <View style={styles.planCardPriceRow}>
                          <Text style={[styles.planCardPrice, (!plan.isActive || isPaused) && { color: '#9CA3AF' }]}>
                            R$ {plan.price}
                          </Text>
                          <Text style={styles.planCardPriceSub}>R$ {pricePerClass}/aula</Text>
                          {plan.purchasedBy > 0 && (
                            <View style={styles.purchasedPill}>
                              <Ionicons name="people-outline" size={10} color="#6B7280" />
                              <Text style={styles.purchasedPillText}>{plan.purchasedBy}</Text>
                            </View>
                          )}
                        </View>
                      </View>
                    </View>
                    {isPaused ? (
                      <View style={styles.planLockIcon}>
                        <Ionicons name="lock-closed" size={16} color="#D97706" />
                      </View>
                    ) : (
                      <Switch
                        value={plan.isActive}
                        onValueChange={() => togglePlan(plan.id)}
                        trackColor={{ false: '#E5E7EB', true: '#BFDBFE' }}
                        thumbColor={plan.isActive ? PRIMARY : '#9CA3AF'}
                      />
                    )}
                  </View>
                );
              })
            )}
          </ScrollView>
        )}
      </Animated.View>

      {/* ── NEW PLAN MODAL ── */}
      <Modal visible={showNewPlanModal} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setShowNewPlanModal(false)}>
        <SafeAreaView style={styles.modalSafe}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Novo Plano</Text>
            <TouchableOpacity onPress={() => setShowNewPlanModal(false)} style={styles.closeBtn}>
              <Ionicons name="close" size={22} color="#6B7280" />
            </TouchableOpacity>
          </View>
          <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 20, gap: 16 }}>
            <View style={styles.formGroup}>
              <Text style={styles.formLabel}>Nome do plano *</Text>
              <TextInput
                style={styles.formInput}
                placeholder="Ex: Pacote Iniciante"
                placeholderTextColor="#9CA3AF"
                value={newPlanName}
                onChangeText={setNewPlanName}
              />
            </View>
            <View style={styles.formGroup}>
              <Text style={styles.formLabel}>Descrição</Text>
              <TextInput
                style={[styles.formInput, { height: 72, textAlignVertical: 'top' }]}
                placeholder="Descreva o que está incluso..."
                placeholderTextColor="#9CA3AF"
                value={newPlanDesc}
                onChangeText={setNewPlanDesc}
                multiline
              />
            </View>

            <Text style={styles.formLabel}>Tipo de aula</Text>
            <View style={styles.typeSelector}>
              {CLASS_TYPES.map(t => (
                <TouchableOpacity
                  key={t}
                  style={[styles.typeSelectorBtn, newPlanType === t && styles.typeSelectorBtnActive]}
                  onPress={() => setNewPlanType(t)}
                >
                  <Ionicons name={CLASS_TYPE_ICON[t]} size={14} color={newPlanType === t ? PRIMARY : '#6B7280'} />
                  <Text style={[styles.typeSelectorText, newPlanType === t && styles.typeSelectorTextActive]}>{t}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <View style={styles.formRow}>
              <View style={[styles.formGroup, { flex: 1 }]}>
                <Text style={styles.formLabel}>Nº de aulas</Text>
                <TextInput
                  style={styles.formInput}
                  placeholder="5"
                  placeholderTextColor="#9CA3AF"
                  value={newPlanCount}
                  onChangeText={setNewPlanCount}
                  keyboardType="number-pad"
                />
              </View>
              <View style={[styles.formGroup, { flex: 1 }]}>
                <Text style={styles.formLabel}>Validade (dias)</Text>
                <TextInput
                  style={styles.formInput}
                  placeholder="60"
                  placeholderTextColor="#9CA3AF"
                  value={newPlanValidity}
                  onChangeText={setNewPlanValidity}
                  keyboardType="number-pad"
                />
              </View>
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.formLabel}>Preço total (R$) *</Text>
              <TextInput
                style={styles.formInput}
                placeholder="Ex: 390,00"
                placeholderTextColor="#9CA3AF"
                value={newPlanPrice}
                onChangeText={setNewPlanPrice}
                keyboardType="decimal-pad"
              />
            </View>
          </ScrollView>
          <View style={styles.modalActions}>
            <TouchableOpacity style={styles.modalRejectBtn} onPress={() => setShowNewPlanModal(false)}>
              <Text style={styles.modalRejectText}>Cancelar</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.modalAcceptBtn} onPress={handleSaveNewPlan}>
              <Ionicons name="checkmark-circle-outline" size={18} color="#FFF" />
              <Text style={styles.modalAcceptText}>Salvar Plano</Text>
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      </Modal>

      {/* ── NOTIFICATIONS MODAL ── */}
      <Modal visible={showNotifications} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setShowNotifications(false)}>
        <SafeAreaView style={styles.modalSafe}>
          <View style={styles.modalHeader}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Ionicons name="notifications" size={20} color="#374151" />
              <Text style={styles.modalTitle}>Notificações</Text>
              {unreadCount > 0 && (
                <View style={styles.unreadBadge}>
                  <Text style={styles.unreadBadgeText}>{unreadCount} nova{unreadCount > 1 ? 's' : ''}</Text>
                </View>
              )}
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              {unreadCount > 0 && (
                <TouchableOpacity onPress={markAllRead} style={styles.markAllBtn}>
                  <Text style={styles.markAllText}>Marcar lidas</Text>
                </TouchableOpacity>
              )}
              <TouchableOpacity onPress={() => setShowNotifications(false)} style={styles.closeBtn}>
                <Ionicons name="close" size={22} color="#6B7280" />
              </TouchableOpacity>
            </View>
          </View>
          <ScrollView style={styles.notifList}>
            {notifications.length === 0 ? (
              <View style={styles.notifEmpty}>
                <Ionicons name="notifications-off-outline" size={40} color="#D1D5DB" />
                <Text style={styles.notifEmptyTitle}>Nenhuma notificação</Text>
                <Text style={styles.notifEmptyBody}>Quando você receber novas solicitações ou mensagens, elas aparecerão aqui.</Text>
              </View>
            ) : notifications.map(notif => {
              const cfg = NOTIF_STYLE[notif.type] || NOTIF_STYLE.message;
              return (
                <TouchableOpacity key={notif.id} style={[styles.notifItem, !notif.read && styles.notifUnread]} onPress={() => handleNotificationPress(notif)} activeOpacity={0.75}>
                  <View style={[styles.notifIconBox, { backgroundColor: cfg.bg }]}>
                    <Ionicons name={cfg.icon} size={18} color={cfg.color} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 3 }}>
                      <Text style={[styles.notifTitle, !notif.read && { fontWeight: '700', color: '#111827' }]} numberOfLines={1}>{notif.title}</Text>
                      {!notif.read && <View style={styles.notifDot} />}
                    </View>
                    <Text style={styles.notifBody} numberOfLines={2}>{notif.body}</Text>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 4 }}>
                      <View style={[styles.notifTypeBadge, { backgroundColor: cfg.bg }]}>
                        <Text style={[styles.notifTypeText, { color: cfg.color }]}>{cfg.label}</Text>
                      </View>
                      <Text style={styles.notifTime}>{notif.time}</Text>
                    </View>
                  </View>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </SafeAreaView>
      </Modal>

      {/* ── START SESSION MODAL ── */}
      <Modal visible={showStartModal} transparent animationType="fade" onRequestClose={() => setShowStartModal(false)}>
        <View style={styles.startModalOverlay}>
          <View style={styles.startModalCard}>
            <View style={styles.startModalHeader}>
              <View style={styles.startModalIconBox}>
                <Ionicons name="play-circle" size={28} color={PRIMARY} />
              </View>
              <Text style={styles.startModalTitle}>Iniciar Aula</Text>
              <Text style={styles.startModalSub}>Digite o código de 6 dígitos exibido no app do aluno</Text>
            </View>
            <TextInput
              style={styles.startModalInput}
              placeholder="000000"
              placeholderTextColor="#D1D5DB"
              value={sessionCodeInput}
              onChangeText={setSessionCodeInput}
              keyboardType="number-pad"
              maxLength={6}
              textAlign="center"
              autoFocus
            />
            <View style={styles.startModalActions}>
              <TouchableOpacity style={styles.startModalCancelBtn} onPress={() => { setShowStartModal(false); setSessionCodeInput(''); }}>
                <Text style={styles.startModalCancelText}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.startModalConfirmBtn} onPress={handleStartSession}>
                <Ionicons name="play" size={16} color="#FFF" />
                <Text style={styles.startModalConfirmText}>Iniciar</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* ── REQUEST DETAIL MODAL ── */}
      <Modal visible={!!selectedRequest} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setSelectedRequest(null)}>
        {selectedRequest && (
          <SafeAreaView style={styles.modalSafe}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Detalhes da Solicitação</Text>
              <TouchableOpacity onPress={() => setSelectedRequest(null)} style={styles.closeBtn}>
                <Ionicons name="close" size={22} color="#6B7280" />
              </TouchableOpacity>
            </View>
            <ScrollView style={{ flex: 1 }}>
              <View style={styles.detailStudentRow}>
                <Avatar uri={selectedRequest.studentAvatar} name={selectedRequest.studentName} size={60} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.detailStudentName}>{selectedRequest.studentName}</Text>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 3 }}>
                    <Ionicons name="star" size={13} color="#EAB308" />
                    <Text style={styles.detailRating}>{selectedRequest.rating}</Text>
                    <Text style={styles.detailAgo}>• {selectedRequest.requestTime}</Text>
                  </View>
                </View>
                <View style={styles.detailPriceTag}>
                  <Text style={styles.detailPriceLabel}>Valor</Text>
                  <Text style={styles.detailPriceVal}>R$ {selectedRequest.price}</Text>
                </View>
              </View>

              <View style={styles.detailBody}>
                <DetailRow icon="car-outline"      label="Tipo de Aula" value={selectedRequest.type} />
                <DetailRow
                  icon={selectedRequest.carOption === 'student' ? 'car-sport-outline' : 'car-outline'}
                  label="Veículo"
                  value={selectedRequest.carOption === 'student' ? 'Carro do aluno' : 'Carro do instrutor'}
                />
                <DetailRow
                  icon={selectedRequest.meetingPoint?.type === MeetingPointType.STUDENT_HOME ? 'home-outline' :
                        selectedRequest.meetingPoint?.type === MeetingPointType.INSTRUCTOR_LOCATION ? 'business-outline' :
                        'location-outline'}
                  label="Local de encontro"
                  value={selectedRequest.meetingPoint?.address || selectedRequest.location}
                />
                <DetailRow icon="call-outline"     label="Contato"      value={selectedRequest.phone} />
                <View style={styles.detailGrid}>
                  <View style={styles.detailGridItem}>
                    <Text style={styles.detailGridVal}>{selectedRequest.distance}</Text>
                    <Text style={styles.detailGridLbl}>Distância</Text>
                  </View>
                  <View style={styles.detailGridItem}>
                    <Text style={styles.detailGridVal}>{selectedRequest.estimatedTime}</Text>
                    <Text style={styles.detailGridLbl}>Deslocamento</Text>
                  </View>
                </View>
              </View>
            </ScrollView>
            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.modalRejectBtn} onPress={() => handleRejectRequest(selectedRequest.id)}>
                <Ionicons name="close-circle-outline" size={18} color="#EF4444" />
                <Text style={styles.modalRejectText}>Recusar</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.modalMsgBtn}
                onPress={async () => {
                  setSelectedRequest(null);
                  await startChatWith(selectedRequest.student_id);
                  navigation.navigate('Chat');
                }}
              >
                <Ionicons name="chatbubble-outline" size={16} color={PRIMARY} />
                <Text style={styles.modalMsgText}>Mensagem</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.modalAcceptBtn} onPress={() => handleAcceptRequest(selectedRequest.id)}>
                <Ionicons name="checkmark-circle-outline" size={18} color="#FFF" />
                <Text style={styles.modalAcceptText}>Aceitar</Text>
              </TouchableOpacity>
            </View>
          </SafeAreaView>
        )}
      </Modal>

      {/* ── Review Modal (pós-aula, instrutor avalia aluno) ── */}
      <ReviewModal
        visible={!!completedSession}
        session={completedSession}
        reviewerRole="instructor"
        onClose={clearCompletedSession}
      />
    </View>
  );
}

function DetailRow({ icon, label, value }) {
  return (
    <View style={styles.detailRowItem}>
      <Ionicons name={icon} size={16} color="#9CA3AF" />
      <View style={{ flex: 1 }}>
        <Text style={styles.detailRowLabel}>{label}</Text>
        <Text style={styles.detailRowValue}>{value}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },

  // ── Header ──
  headerOverlay: { position: 'absolute', top: 0, left: 0, right: 0, zIndex: 10 },
  headerCard: {
    backgroundColor: 'rgba(255,255,255,0.95)', borderRadius: 16, margin: 12, padding: 12,
    ...makeShadow('#000', 3, 0.1, 8, 6),
  },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  headerConfigRow: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    marginTop: 8, paddingTop: 7, borderTopWidth: 1, borderTopColor: '#F3F4F6',
  },
  headerConfigText: { fontSize: 12, fontWeight: '600', color: '#374151' },
  headerStatDivider: { width: 1, height: 12, backgroundColor: '#D1D5DB', marginHorizontal: 3 },
  headerConfigEditText: { fontSize: 11, fontWeight: '500', color: '#9CA3AF' },
  headerGreeting: { fontSize: 10, fontWeight: '600', color: '#9CA3AF', textTransform: 'uppercase' },
  headerName: { fontSize: 14, fontWeight: '800', color: '#111827' },
  bellBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#F9FAFB', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#E5E7EB' },
  bellBadge: { position: 'absolute', top: -2, right: -2, backgroundColor: '#EF4444', borderRadius: 8, minWidth: 17, height: 17, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 3, borderWidth: 1.5, borderColor: '#FFF' },
  bellBadgeText: { color: '#FFF', fontSize: 9, fontWeight: '800' },

  // ── Bottom panel ──
  bottomPanel: {
    position: 'absolute', bottom: 0, left: 0, right: 0, zIndex: 10,
    backgroundColor: '#FFF', borderTopLeftRadius: 24, borderTopRightRadius: 24,
    overflow: 'hidden',
    ...makeShadow('#000', -3, 0.08, 10, 10),
  },
  handleRow: { alignItems: 'center', paddingTop: 10, paddingBottom: 2, cursor: 'grab' },
  panelHandle: { width: 36, height: 4, borderRadius: 2, backgroundColor: '#E5E7EB' },

  // ── KPI strip ──
  kpiStrip: {
    flexDirection: 'row', alignItems: 'center',
    marginHorizontal: 14, marginTop: 8, marginBottom: 4,
    backgroundColor: '#FAFAFA', borderRadius: 14, padding: 10,
    borderWidth: 1, borderColor: '#F3F4F6',
  },
  kpiChip: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, borderRadius: 10, paddingVertical: 6, paddingHorizontal: 4 },
  kpiNum: { fontSize: 15, fontWeight: '800' },
  kpiLbl: { fontSize: 10, fontWeight: '600' },
  kpiDivider: { width: 1, height: 28, backgroundColor: '#E5E7EB', marginHorizontal: 6 },


  // ── Section header ──
  sectionHeader: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingHorizontal: 16, paddingTop: 12, paddingBottom: 6,
  },
  sectionTitle: { fontSize: 13, fontWeight: '700', color: '#374151' },
  sectionBadge: { backgroundColor: '#FEE2E2', borderRadius: 10, paddingHorizontal: 7, paddingVertical: 2 },
  sectionBadgeText: { fontSize: 11, fontWeight: '700', color: '#EF4444' },

  // ── Request cards ──
  cardsList: { flex: 1 },
  cardsContent: { paddingHorizontal: 12, paddingTop: 8, paddingBottom: Platform.OS === 'ios' ? 90 : 16, gap: 8 },

  reqCard: {
    flexDirection: 'row', backgroundColor: '#FFF',
    borderRadius: 16, overflow: 'hidden',
    borderWidth: 1, borderColor: '#F3F4F6',
    ...makeShadow('#000', 1, 0.05, 4, 2),
  },
  reqCardConflict: { borderColor: '#FECACA' },
  reqAccent: { width: 4, backgroundColor: '#F59E0B' },
  travelWarningRow: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    borderRadius: 8, paddingHorizontal: 8, paddingVertical: 5,
  },
  travelWarningText: { fontSize: 11, fontWeight: '600', flex: 1 },
  reqBody: { flex: 1, padding: 12, gap: 6 },

  reqTopRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  reqAvatar: { width: 40, height: 40, borderRadius: 20 },
  reqNameBlock: { flex: 1 },
  reqName: { fontSize: 14, fontWeight: '700', color: '#111827' },
  reqBadgesRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 3 },
  typeBadge: { borderRadius: 6, paddingHorizontal: 7, paddingVertical: 2 },
  typeBadgeText: { fontSize: 10, fontWeight: '700' },
  ratingPill: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  ratingText: { fontSize: 11, color: '#374151', fontWeight: '600' },
  reqPrice: { fontSize: 17, fontWeight: '800', color: '#111827' },
  planBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    backgroundColor: '#F5F3FF', borderRadius: 10,
    paddingHorizontal: 8, paddingVertical: 5,
    borderWidth: 1, borderColor: '#DDD6FE',
    maxWidth: 120,
  },
  planBadgeName: { fontSize: 10, fontWeight: '700', color: '#7C3AED', maxWidth: 80 },
  planBadgeSub: { fontSize: 9, color: '#7C3AED', opacity: 0.8 },
  avulsaBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: '#EFF6FF', borderRadius: 10,
    paddingHorizontal: 8, paddingVertical: 5,
    borderWidth: 1, borderColor: '#BFDBFE',
  },
  avulsaBadgeText: { fontSize: 11, fontWeight: '700', color: '#1D4ED8' },

  reqLocRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  reqLocText: { fontSize: 11, color: '#6B7280', flex: 1 },

  reqMetaRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  reqMetaText: { fontSize: 11, color: '#6B7280', fontWeight: '600' },
  metaDot: { width: 3, height: 3, borderRadius: 1.5, backgroundColor: '#D1D5DB' },
  reqAgo: { fontSize: 10, color: '#9CA3AF', marginLeft: 'auto' },

  reqActions: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 2 },
  rejectBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, borderWidth: 1, borderColor: '#FECACA', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 5, backgroundColor: '#FFF5F5' },
  rejectBtnText: { fontSize: 12, fontWeight: '600', color: '#EF4444' },
  acceptBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, borderRadius: 8, paddingHorizontal: 14, paddingVertical: 5, backgroundColor: '#16A34A' },
  acceptBtnText: { fontSize: 12, fontWeight: '700', color: '#FFF' },
  detailBtn: { flexDirection: 'row', alignItems: 'center', gap: 2, marginLeft: 'auto' },
  detailBtnText: { fontSize: 12, color: PRIMARY, fontWeight: '600' },

  // ── Tab switcher ──
  tabSwitcher: {
    flexDirection: 'row', marginHorizontal: 14, marginTop: 8, marginBottom: 4,
    backgroundColor: '#F3F4F6', borderRadius: 12, padding: 3, gap: 3,
  },
  tabBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 5, borderRadius: 10, paddingVertical: 7,
  },
  tabBtnActive: { backgroundColor: '#FFF', ...makeShadow('#000', 1, 0.08, 3, 2) },
  tabBtnText: { fontSize: 12, fontWeight: '600', color: '#9CA3AF' },
  tabBtnTextActive: { color: PRIMARY, fontWeight: '700' },
  tabBadge: { backgroundColor: '#FEF3C7', borderRadius: 8, paddingHorizontal: 5, paddingVertical: 1 },
  tabBadgeText: { fontSize: 10, fontWeight: '800', color: '#D97706' },

  // ── Plans tab ──
  plansHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    marginBottom: 8,
  },
  plansHeaderText: { fontSize: 12, fontWeight: '600', color: '#6B7280' },
  newPlanBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: PRIMARY, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 6,
  },
  newPlanBtnText: { fontSize: 12, fontWeight: '700', color: '#FFF' },

  planCard: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#FFF', borderRadius: 14,
    borderWidth: 1, borderColor: '#F3F4F6', padding: 12,
    ...makeShadow('#000', 1, 0.04, 4, 1),
    gap: 10,
  },
  planCardInactive: { backgroundColor: '#FAFAFA', opacity: 0.7 },
  planCardLeft: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10 },
  planIconBox: {
    width: 38, height: 38, borderRadius: 10, backgroundColor: `#1D4ED815`,
    alignItems: 'center', justifyContent: 'center', flexShrink: 0,
  },
  planCardName: { fontSize: 13, fontWeight: '700', color: '#111827' },
  planCardNameInactive: { color: '#9CA3AF' },
  planCardMeta: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 3 },
  planCardMetaText: { fontSize: 11, color: '#9CA3AF' },
  planCardPriceRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 },
  planCardPrice: { fontSize: 15, fontWeight: '800', color: '#111827' },
  planCardPriceSub: { fontSize: 10, color: '#9CA3AF' },
  purchasedPill: {
    flexDirection: 'row', alignItems: 'center', gap: 3,
    backgroundColor: '#F3F4F6', borderRadius: 8, paddingHorizontal: 6, paddingVertical: 2,
  },
  purchasedPillText: { fontSize: 10, color: '#6B7280', fontWeight: '600' },

  // ── Form (new plan modal) ──
  formGroup: { gap: 6 },
  formRow: { flexDirection: 'row', gap: 12 },
  formLabel: { fontSize: 12, fontWeight: '700', color: '#374151', textTransform: 'uppercase', letterSpacing: 0.3 },
  formInput: {
    backgroundColor: '#F9FAFB', borderRadius: 12,
    borderWidth: 1, borderColor: '#E5E7EB',
    paddingHorizontal: 14, paddingVertical: 11,
    fontSize: 14, color: '#111827',
  },
  typeSelector: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  typeSelectorBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    borderWidth: 1.5, borderColor: '#E5E7EB', borderRadius: 10,
    paddingHorizontal: 12, paddingVertical: 8,
  },
  typeSelectorBtnActive: { borderColor: PRIMARY, backgroundColor: '#EFF6FF' },
  typeSelectorText: { fontSize: 12, fontWeight: '600', color: '#6B7280' },
  typeSelectorTextActive: { color: PRIMARY, fontWeight: '700' },

  // ── Paused banner ──
  pausedBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    marginHorizontal: 12, marginBottom: 8,
    backgroundColor: '#FFFBEB', borderRadius: 10,
    borderWidth: 1, borderColor: '#FCD34D',
    paddingHorizontal: 12, paddingVertical: 10,
  },
  pausedBannerTitle: { fontSize: 13, fontWeight: '700', color: '#92400E' },
  pausedBannerSub: { fontSize: 11, color: '#B45309', marginTop: 1 },
  pausedBannerLink: { fontSize: 12, fontWeight: '700', color: '#D97706' },

  planPausedBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 3,
    backgroundColor: '#FEF3C7', borderRadius: 4,
    paddingHorizontal: 5, paddingVertical: 2,
  },
  planPausedBadgeText: { fontSize: 9, fontWeight: '700', color: '#92400E', textTransform: 'uppercase' },
  planLockIcon: {
    width: 32, height: 32, borderRadius: 8,
    backgroundColor: '#FEF3C7', alignItems: 'center', justifyContent: 'center',
  },

  // ── Empty state ──
  emptyState: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 24 },
  emptyIcon: { width: 56, height: 56, borderRadius: 28, backgroundColor: '#EFF6FF', alignItems: 'center', justifyContent: 'center' },
  emptyTitle: { fontSize: 15, fontWeight: '700', color: '#111827' },
  emptyText: { fontSize: 12, color: '#9CA3AF', textAlign: 'center', paddingHorizontal: 24 },

  // ── Modals ──
  modalSafe: { flex: 1, backgroundColor: '#FFF' },
  modalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: '#F3F4F6' },
  modalTitle: { fontSize: 17, fontWeight: '800', color: '#111827' },
  unreadBadge: { backgroundColor: '#FEE2E2', borderRadius: 10, paddingHorizontal: 8, paddingVertical: 2 },
  unreadBadgeText: { fontSize: 11, fontWeight: '700', color: '#EF4444' },
  markAllBtn: { paddingHorizontal: 10, paddingVertical: 6, backgroundColor: '#EFF6FF', borderRadius: 8 },
  markAllText: { fontSize: 12, color: PRIMARY, fontWeight: '600' },
  closeBtn: { padding: 4 },

  notifList: { flex: 1 },
  notifEmpty: { alignItems: 'center', justifyContent: 'center', paddingVertical: 60, paddingHorizontal: 32, gap: 10 },
  notifEmptyTitle: { fontSize: 15, fontWeight: '700', color: '#374151', textAlign: 'center' },
  notifEmptyBody: { fontSize: 13, color: '#9CA3AF', textAlign: 'center', lineHeight: 19 },
  notifItem: { flexDirection: 'row', gap: 12, padding: 16, borderBottomWidth: 1, borderBottomColor: '#F9FAFB' },
  notifUnread: { backgroundColor: '#FAFAFE' },
  notifIconBox: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  notifTitle: { fontSize: 13, color: '#374151', fontWeight: '500', flex: 1 },
  notifBody: { fontSize: 12, color: '#6B7280', lineHeight: 17 },
  notifDot: { width: 7, height: 7, borderRadius: 3.5, backgroundColor: PRIMARY },
  notifTypeBadge: { borderRadius: 8, paddingHorizontal: 6, paddingVertical: 2 },
  notifTypeText: { fontSize: 10, fontWeight: '700' },
  notifTime: { fontSize: 11, color: '#9CA3AF' },

  detailStudentRow: { flexDirection: 'row', alignItems: 'center', gap: 14, padding: 20, borderBottomWidth: 1, borderBottomColor: '#F3F4F6' },
  detailAvatar: { width: 60, height: 60, borderRadius: 30 },
  detailStudentName: { fontSize: 18, fontWeight: '800', color: '#111827' },
  detailRating: { fontSize: 13, fontWeight: '600', color: '#374151' },
  detailAgo: { fontSize: 12, color: '#9CA3AF' },
  detailPriceTag: { alignItems: 'center', backgroundColor: '#EFF6FF', borderRadius: 12, padding: 10 },
  detailPriceLabel: { fontSize: 10, color: PRIMARY, fontWeight: '600', textTransform: 'uppercase' },
  detailPriceVal: { fontSize: 20, fontWeight: '800', color: PRIMARY },

  detailBody: { padding: 20, gap: 14 },
  detailRowItem: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  detailRowLabel: { fontSize: 11, color: '#9CA3AF', fontWeight: '600', textTransform: 'uppercase' },
  detailRowValue: { fontSize: 14, color: '#111827', fontWeight: '500', marginTop: 2 },
  detailGrid: { flexDirection: 'row', gap: 12 },
  detailGridItem: { flex: 1, backgroundColor: '#F9FAFB', borderRadius: 12, padding: 14, alignItems: 'center' },
  detailGridVal: { fontSize: 18, fontWeight: '800', color: '#111827' },
  detailGridLbl: { fontSize: 11, color: '#6B7280', marginTop: 2 },

  modalActions: { flexDirection: 'row', gap: 12, paddingHorizontal: 20, paddingVertical: 16, borderTopWidth: 1, borderTopColor: '#F3F4F6' },
  modalRejectBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, borderWidth: 1.5, borderColor: '#FECACA', borderRadius: 14, paddingVertical: 14, backgroundColor: '#FFF5F5' },
  modalRejectText: { fontSize: 13, fontWeight: '700', color: '#EF4444' },
  modalMsgBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, borderWidth: 1.5, borderColor: `${PRIMARY}40`, borderRadius: 14, paddingVertical: 14, backgroundColor: '#EFF6FF' },
  modalMsgText: { fontSize: 13, fontWeight: '700', color: PRIMARY },
  modalAcceptBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, backgroundColor: '#16A34A', borderRadius: 14, paddingVertical: 14 },
  modalAcceptText: { fontSize: 13, fontWeight: '700', color: '#FFF' },

  // ── Start Session button ──
  startSessionBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: PRIMARY, borderRadius: 14,
    marginHorizontal: 14, marginTop: 8, marginBottom: 4,
    paddingHorizontal: 16, paddingVertical: 12,
  },
  startSessionBtnText: { fontSize: 15, fontWeight: '800', color: '#FFF', flex: 1 },
  startSessionBtnSub: { fontSize: 11, color: '#BFDBFE', fontWeight: '500' },

  // ── Start Session modal ──
  startModalOverlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.45)',
    alignItems: 'center', justifyContent: 'center', padding: 24,
  },
  startModalCard: {
    backgroundColor: '#FFF', borderRadius: 24, padding: 24, width: '100%', maxWidth: 360,
    ...makeShadow('#000', 8, 0.2, 20, 12),
  },
  startModalHeader: { alignItems: 'center', marginBottom: 20, gap: 8 },
  startModalIconBox: {
    width: 56, height: 56, borderRadius: 28, backgroundColor: '#EFF6FF',
    alignItems: 'center', justifyContent: 'center', marginBottom: 4,
  },
  startModalTitle: { fontSize: 20, fontWeight: '800', color: '#111827' },
  startModalSub: { fontSize: 13, color: '#6B7280', textAlign: 'center', lineHeight: 19 },
  startModalInput: {
    fontSize: 36, fontWeight: '800', color: '#111827', letterSpacing: 8,
    borderWidth: 2, borderColor: '#DBEAFE', borderRadius: 16,
    paddingVertical: 14, paddingHorizontal: 20, backgroundColor: '#F8FAFF',
    marginBottom: 20, textAlign: 'center',
  },
  startModalActions: { flexDirection: 'row', gap: 10 },
  startModalCancelBtn: {
    flex: 1, borderWidth: 1.5, borderColor: '#E5E7EB', borderRadius: 12,
    paddingVertical: 12, alignItems: 'center',
  },
  startModalCancelText: { fontSize: 14, fontWeight: '600', color: '#6B7280' },
  startModalConfirmBtn: {
    flex: 2, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    backgroundColor: PRIMARY, borderRadius: 12, paddingVertical: 12,
  },
  startModalConfirmText: { fontSize: 14, fontWeight: '700', color: '#FFF' },
});
