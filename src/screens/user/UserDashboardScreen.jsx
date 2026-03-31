import React, { useState, useRef, useMemo, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  View, Text, TouchableOpacity, StyleSheet, FlatList, ScrollView,
  Platform, ActivityIndicator, TextInput, Animated, Dimensions, PanResponder,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../hooks/useAuth';
import { useInstructorSearch } from '../../hooks/useInstructorSearch';
import { useSession } from '../../context/SessionContext';
import { useCurrentLocation } from '../../hooks/useCurrentLocation';
import { usePlans } from '../../context/PlansContext';
import { getInstructorById } from '../../services/instructors.service';
import InstructorCard from '../../components/user/InstructorCard';
import LeafletMapView from '../../components/shared/LeafletMapView';
import Avatar from '../../components/shared/Avatar';
import ActiveSessionCard from '../../components/shared/ActiveSessionCard';
import ReviewModal from '../../components/shared/ReviewModal';
import StudentOnboardingModal from '../../components/shared/StudentOnboardingModal';
import { makeShadow } from '../../constants/theme';

const PRIMARY = '#1D4ED8';
const DEFAULT_CENTER = { lat: -21.7895, lng: -46.5613 };

const CATEGORY_FILTERS = [
  { key: 'all', label: 'Todos' },
  { key: 'A', label: 'Moto (A)' },
  { key: 'B', label: 'Carro (B)' },
];

const SCREEN_H = Dimensions.get('window').height;
const COLLAPSED_H = 116; // handle row + search + filters
const EXPANDED_H = SCREEN_H * 0.52;
const FULL_H = SCREEN_H * 0.88; // terceiro snap — painel quase full-screen
const MIDPOINT_LOW = (COLLAPSED_H + EXPANDED_H) / 2;
const MIDPOINT_HIGH = (EXPANDED_H + FULL_H) / 2;

function toAppInstructor(p) {
  return {
    id: p.id, name: p.name || '', photo: p.avatar_url || null,
    carModel: p.car_model || '', carYear: p.car_year || null,
    carOptions: p.car_options || 'instructor', vehicleType: p.vehicle_type || 'manual',
    licenseCategory: p.license_category || 'B', pricePerHour: p.price_per_hour || 0,
    pricePerHourMoto: p.price_per_hour_moto || null, rating: p.rating ?? 0,
    isVerified: p.is_verified ?? false, location: p.location || '',
    reviewsCount: p.reviews_count ?? 0, bio: p.bio || '',
    coordinates: p.coordinates ?? null, isAcceptingRequests: p.is_accepting_requests ?? true,
  };
}

export default function UserDashboardScreen({ navigation }) {
  const { user } = useAuth();
  const { instructors, loading } = useInstructorSearch();
  const { activeSession, elapsedSeconds, isCompleted, completedSession, pendingSession, clearCompletedSession } = useSession();
  const { location: currentLocation } = useCurrentLocation();
  const { purchases } = usePlans();
  const [navigatingPlanId, setNavigatingPlanId] = useState(null);

  const [showOnboarding, setShowOnboarding] = useState(false);

  useEffect(() => {
    if (!user?.id) return;
    const key = `student_onboarding_done_${user.id}`;
    AsyncStorage.getItem(key).then(done => {
      if (!done) setShowOnboarding(true);
    }).catch(() => {});
  }, [user?.id]);

  const handleOnboardingFinish = () => {
    if (user?.id) {
      AsyncStorage.setItem(`student_onboarding_done_${user.id}`, '1').catch(() => {});
    }
    setShowOnboarding(false);
  };

  const activePurchases = purchases.filter(p => p.status === 'active' && (p.classes_remaining ?? 0) > 0);

  const handleScheduleFromPlan = async (purchase) => {
    setNavigatingPlanId(purchase.id);
    try {
      const raw = await getInstructorById(purchase.instructor_id);
      navigation.navigate('BatchSchedule', {
        purchase,
        instructor: toAppInstructor(raw),
      });
    } catch {
      // mantém na tela em erro de rede
    } finally {
      setNavigatingPlanId(null);
    }
  };

  const mapCenter = currentLocation
    ? { lat: currentLocation.latitude, lng: currentLocation.longitude }
    : DEFAULT_CENTER;
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [panelState, setPanelState] = useState('expanded'); // 'collapsed' | 'expanded' | 'full'
  const flatRef = useRef(null);
  const mapRef = useRef(null);
  const panelHeight = useRef(new Animated.Value(EXPANDED_H)).current;
  // Track the last "settled" height so PanResponder always has the right base
  const settledHeight = useRef(EXPANDED_H);

  const animateTo = (toValue, state) => {
    settledHeight.current = toValue;
    Animated.spring(panelHeight, {
      toValue,
      useNativeDriver: false,
      tension: 70,
      friction: 12,
    }).start();
    setPanelState(state);
  };

  const ensureExpanded = () => {
    if (panelState === 'collapsed') animateTo(EXPANDED_H, 'expanded');
  };

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      // Only claim the gesture if user moves mostly vertically
      onMoveShouldSetPanResponder: (_, gs) =>
        Math.abs(gs.dy) > 5 && Math.abs(gs.dy) > Math.abs(gs.dx),
      onPanResponderGrant: () => {
        // Freeze animation and capture actual current value
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

  const filtered = instructors.filter(inst => {
    const matchesSearch =
      inst.name.toLowerCase().includes(search.toLowerCase()) ||
      inst.carModel.toLowerCase().includes(search.toLowerCase()) ||
      inst.location.toLowerCase().includes(search.toLowerCase());
    const matchesCategory = categoryFilter === 'all' || inst.licenseCategory.includes(categoryFilter);
    return matchesSearch && matchesCategory;
  });

  const mapMarkers = useMemo(() =>
    instructors.map(inst => ({
      id: inst.id,
      latitude: inst.coordinates.latitude,
      longitude: inst.coordinates.longitude,
      label: inst.pricePerHour > 0 ? `R$ ${inst.pricePerHour}` : '•',
      color: PRIMARY,
      type: 'default',
    })),
    [instructors],
  );

  const handleMarkerPress = (id) => {
    mapRef.current?.highlightMarker(id);
    ensureExpanded();
    const idx = filtered.findIndex(i => i.id === id);
    if (idx >= 0 && flatRef.current) {
      flatRef.current.scrollToIndex({ index: idx, animated: true, viewPosition: 0.5 });
    }
  };

  return (
    <View style={styles.container}>
      {/* MAP */}
      <LeafletMapView
        ref={mapRef}
        center={mapCenter}
        zoom={13}
        markers={mapMarkers}
        onMarkerPress={handleMarkerPress}
      />

      {/* HEADER OVERLAY */}
      <SafeAreaView edges={['top']} style={styles.headerOverlay} pointerEvents="box-none">
        <View style={styles.headerCard}>
          <View style={styles.headerLeft}>
            <Avatar uri={user?.avatar} name={user?.name} size={38} />
            <View style={styles.headerInfo}>
              <Text style={styles.headerGreeting}>Bem-vindo!</Text>
              <Text style={styles.headerName}>{user?.name || 'Aluno Abily'}</Text>
            </View>
          </View>
          <View style={styles.countPill}>
            <Ionicons name="people" size={13} color={PRIMARY} />
            <Text style={styles.countPillText}>{instructors.length} instrutores</Text>
          </View>
        </View>
      </SafeAreaView>

      {/* BOTTOM PANEL */}
      <Animated.View style={[styles.bottomPanel, { height: panelHeight }]}>

        {/* ── Drag handle ── */}
        <View style={styles.handleRow} {...panResponder.panHandlers}>
          <View style={styles.panelHandle} />
          <Ionicons
            name={panelState === 'full' ? 'chevron-down' : 'chevron-up'}
            size={14}
            color="#9CA3AF"
            style={{ marginTop: 2 }}
          />
        </View>

        {/* ── Active Session or Pending Code ── */}
        {activeSession ? (
          <ActiveSessionCard
            activeSession={activeSession}
            elapsedSeconds={elapsedSeconds}
            isCompleted={isCompleted}
            isInstructor={false}
          />
        ) : pendingSession?.code ? (
          <View style={styles.codeCard}>
            <View style={styles.codeCardLeft}>
              <View style={styles.codeCardIconBox}>
                <Ionicons name="key-outline" size={18} color="#1D4ED8" />
              </View>
              <View>
                <Text style={styles.codeCardLabel}>Código da sua aula</Text>
                <Text style={styles.codeCardSub}>Mostre ao instrutor para iniciar</Text>
              </View>
            </View>
            <Text style={styles.codeCardCode}>
              {(() => { const c = String(pendingSession.code ?? '').padStart(6, '0'); return `${c.slice(0, 3)} ${c.slice(3)}`; })()}
            </Text>
          </View>
        ) : null}

        {/* Search */}
        <View style={styles.searchRow}>
          <View style={styles.searchBox}>
            <Ionicons name="search-outline" size={16} color="#9CA3AF" />
            <TextInput
              style={styles.searchInput}
              placeholder="Buscar instrutor, carro..."
              placeholderTextColor="#9CA3AF"
              value={search}
              onChangeText={setSearch}
              onFocus={ensureExpanded}
            />
            {search.length > 0 && (
              <TouchableOpacity onPress={() => setSearch('')}>
                <Ionicons name="close-circle" size={16} color="#9CA3AF" />
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* Category filters */}
        <View style={styles.filtersRow}>
          {CATEGORY_FILTERS.map(f => (
            <TouchableOpacity
              key={f.key}
              style={[styles.filterBtn, categoryFilter === f.key && styles.filterBtnActive]}
              onPress={() => { ensureExpanded(); setCategoryFilter(f.key); }}
            >
              <Text style={[styles.filterBtnText, categoryFilter === f.key && styles.filterBtnTextActive]}>
                {f.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Strip de planos ativos */}
        {activePurchases.length > 0 && panelState !== 'collapsed' && (
          <View style={styles.plansStrip}>
            <View style={styles.plansStripHeader}>
              <Ionicons name="layers" size={13} color="#7C3AED" />
              <Text style={styles.plansStripLabel}>Suas aulas contratadas</Text>
            </View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.plansStripScroll}>
              {activePurchases.map(p => (
                <TouchableOpacity
                  key={p.id}
                  style={styles.planChip}
                  onPress={() => handleScheduleFromPlan(p)}
                  activeOpacity={0.8}
                  disabled={navigatingPlanId === p.id}
                >
                  <Avatar uri={p.profiles?.avatar_url} name={p.profiles?.name} size={28} />
                  <View style={styles.planChipInfo}>
                    <Text style={styles.planChipName} numberOfLines={1}>{p.profiles?.name}</Text>
                    <Text style={styles.planChipCount}>
                      {p.classes_remaining}/{p.classes_total} aulas
                    </Text>
                  </View>
                  {navigatingPlanId === p.id ? (
                    <ActivityIndicator size="small" color="#7C3AED" />
                  ) : (
                    <View style={styles.planChipBtn}>
                      <Ionicons name="calendar-outline" size={13} color="#7C3AED" />
                      <Text style={styles.planChipBtnText}>Agendar</Text>
                    </View>
                  )}
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        )}

        {/* Instructor list */}
        {panelState !== 'collapsed' && (
          loading ? (
            <View style={styles.loadingState}>
              <ActivityIndicator color={PRIMARY} size="large" />
              <Text style={styles.loadingText}>Buscando instrutores próximos...</Text>
            </View>
          ) : filtered.length === 0 ? (
            <View style={styles.emptyState}>
              <Ionicons name="search-outline" size={36} color="#D1D5DB" />
              <Text style={styles.emptyText}>Nenhum instrutor encontrado</Text>
            </View>
          ) : (
            <FlatList
              ref={flatRef}
              data={filtered}
              keyExtractor={item => item.id}
              renderItem={({ item }) => (
                <InstructorCard
                  instructor={item}
                  onPress={() => navigation.navigate('InstructorDetail', { instructor: item })}
                />
              )}
              contentContainerStyle={styles.list}
              showsVerticalScrollIndicator={false}
              ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
              onScrollToIndexFailed={() => {}}
            />
          )
        )}
      </Animated.View>

      {/* ── Review Modal (pós-aula, aluno avalia instrutor) ── */}
      <ReviewModal
        visible={!!completedSession}
        session={completedSession}
        reviewerRole="student"
        onClose={clearCompletedSession}
      />

      {/* ── Onboarding Modal (exibido uma vez para novos alunos) ── */}
      <StudentOnboardingModal
        visible={showOnboarding}
        onFinish={handleOnboardingFinish}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },

  headerOverlay: { position: 'absolute', top: 0, left: 0, right: 0, zIndex: 10 },
  headerCard: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: 'rgba(255,255,255,0.95)', borderRadius: 18, margin: 12, padding: 12,
    ...makeShadow('#000', 4, 0.12, 10, 8),
  },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 },
  headerInfo: { flex: 1 },
  headerGreeting: { fontSize: 10, fontWeight: '700', color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: 0.5 },
  headerName: { fontSize: 14, fontWeight: '800', color: '#111827', marginTop: 1 },
  countPill: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: '#EFF6FF', borderRadius: 20, paddingHorizontal: 10, paddingVertical: 6,
  },
  countPillText: { fontSize: 11, fontWeight: '700', color: PRIMARY },

  bottomPanel: {
    position: 'absolute', bottom: 0, left: 0, right: 0, zIndex: 10,
    backgroundColor: '#FFF', borderTopLeftRadius: 24, borderTopRightRadius: 24,
    overflow: 'hidden',
    ...makeShadow('#000', -4, 0.1, 12, 12),
  },
  handleRow: {
    alignItems: 'center', paddingTop: 10, paddingBottom: 4, cursor: 'grab',
  },
  panelHandle: {
    width: 40, height: 4, borderRadius: 2, backgroundColor: '#E5E7EB',
  },

  searchRow: { paddingHorizontal: 12, marginBottom: 8 },
  searchBox: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: '#F9FAFB', borderRadius: 12,
    borderWidth: 1, borderColor: '#E5E7EB', paddingHorizontal: 12, paddingVertical: 9,
  },
  searchInput: { flex: 1, fontSize: 14, color: '#111827' },
  filtersRow: { flexDirection: 'row', gap: 8, paddingHorizontal: 12, marginBottom: 8 },
  filterBtn: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20, backgroundColor: '#F3F4F6' },
  filterBtnActive: { backgroundColor: PRIMARY },
  filterBtnText: { fontSize: 12, fontWeight: '600', color: '#6B7280' },
  filterBtnTextActive: { color: '#FFF' },
  list: { paddingHorizontal: 12, paddingBottom: Platform.OS === 'ios' ? 100 : 80 },
  loadingState: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10 },
  loadingText: { fontSize: 13, color: '#9CA3AF' },
  emptyState: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 8 },
  emptyText: { fontSize: 14, color: '#9CA3AF' },

  // ── Strip de planos ativos ──
  plansStrip: { marginBottom: 6 },
  plansStripHeader: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingHorizontal: 14, marginBottom: 8,
  },
  plansStripLabel: {
    fontSize: 11, fontWeight: '700', color: '#7C3AED',
    textTransform: 'uppercase', letterSpacing: 0.4,
  },
  plansStripScroll: { paddingHorizontal: 12, gap: 8 },
  planChip: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: '#FAF5FF', borderRadius: 14,
    borderWidth: 1.5, borderColor: '#DDD6FE',
    paddingHorizontal: 12, paddingVertical: 10,
    minWidth: 200,
  },
  planChipInfo: { flex: 1 },
  planChipName: { fontSize: 13, fontWeight: '700', color: '#5B21B6' },
  planChipCount: { fontSize: 11, color: '#7C3AED', marginTop: 1 },
  planChipBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: '#EDE9FE', borderRadius: 8,
    paddingHorizontal: 8, paddingVertical: 5,
  },
  planChipBtnText: { fontSize: 11, fontWeight: '700', color: '#7C3AED' },

  // ── Pending session code card ──
  codeCard: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: '#EFF6FF', borderRadius: 14, borderWidth: 1.5, borderColor: '#BFDBFE',
    marginHorizontal: 12, marginBottom: 10, paddingHorizontal: 14, paddingVertical: 12,
  },
  codeCardLeft: { flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 },
  codeCardIconBox: {
    width: 36, height: 36, borderRadius: 18, backgroundColor: '#DBEAFE',
    alignItems: 'center', justifyContent: 'center',
  },
  codeCardLabel: { fontSize: 13, fontWeight: '700', color: '#1D4ED8' },
  codeCardSub: { fontSize: 11, color: '#3B82F6', marginTop: 1 },
  codeCardCode: {
    fontSize: 26, fontWeight: '900', color: '#1D4ED8', letterSpacing: 4,
    fontVariant: ['tabular-nums'],
  },
});
