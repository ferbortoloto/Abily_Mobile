import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity,
  TextInput, Alert, Modal, PanResponder, Switch,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../hooks/useAuth';
import { usePlans } from '../../context/PlansContext';
import Avatar from '../../components/shared/Avatar';
import { getReviews } from '../../services/instructors.service';
import { logger } from '../../utils/logger';

const PRIMARY = '#1D4ED8';
const DURATION_OPTIONS = [30, 45, 60, 90, 120];

const PRICE_MIN = 40;
const PRICE_MAX = 180;
const PRICE_TIERS = [
  { price: 60,  commission: 20, label: 'Econômico',   color: '#16A34A' },
  { price: 80,  commission: 15, label: 'Moderado',    color: '#2563EB' },
  { price: 100, commission: 12, label: 'Recomendado', color: '#7C3AED' },
  { price: 115, commission: 10, label: 'Premium',     color: '#0F172A' },
];
const TRACK_H = 6;
const THUMB_R = 11;

function getPriceInfo(price) {
  if (price <= 60)  return PRICE_TIERS[0];
  if (price <= 80)  return PRICE_TIERS[1];
  if (price <= 100) return PRICE_TIERS[2];
  return PRICE_TIERS[3];
}


export default function ProfileScreen({ route }) {
  const { user, logout, updateProfile } = useAuth();
  const { pauseAllPlans, resumeAllPlans } = usePlans();
  const [isEditing, setIsEditing] = useState(false);
  const [showLogoutModal, setShowLogoutModal] = useState(false);
  const [recentReviews, setRecentReviews] = useState([]);
  const scrollRef = useRef(null);
  const profSectionY = useRef(0);

  useEffect(() => {
    if (!user?.id) return;
    getReviews(user.id)
      .then(data => setRecentReviews(data.slice(0, 5)))
      .catch(e => logger.error('Erro ao carregar avaliações:', e.message));
  }, [user?.id]);

  useEffect(() => {
    if (route?.params?.startEditing) {
      setIsEditing(true);
      // Pequeno delay para o layout estar pronto antes de scrollar
      setTimeout(() => {
        scrollRef.current?.scrollTo({ y: profSectionY.current, animated: true });
      }, 150);
    }
  }, [route?.params?.startEditing, route?.params?.t]);
  const [formData, setFormData] = useState({
    name: user?.name || '',
    phone: user?.phone || '',
    carModel: user?.car_model || '',
    licenseCategory: user?.license_category || '',
    pricePerHour: String(user?.price_per_hour || ''),
    classDuration: user?.class_duration || 60,
    bio: user?.bio || 'Instrutor de direção com mais de 5 anos de experiência, especializado em formação de condutores seguros e conscientes.',
  });

  const handleLogout = () => setShowLogoutModal(true);

  const handleSave = async () => {
    try {
      await updateProfile({
        phone: formData.phone,
        car_model: formData.carModel,
        license_category: formData.licenseCategory,
        price_per_hour: parseFloat(formData.pricePerHour) || 0,
        class_duration: formData.classDuration,
        bio: formData.bio,
      });
      setIsEditing(false);
      Alert.alert('Salvo!', 'Perfil atualizado com sucesso.');
    } catch {
      Alert.alert('Erro', 'Não foi possível salvar o perfil.');
    }
  };

  const renderStars = (rating) =>
    Array.from({ length: 5 }, (_, i) => (
      <Ionicons
        key={i}
        name={i < rating ? 'star' : 'star-outline'}
        size={14}
        color={i < rating ? '#EAB308' : '#D1D5DB'}
      />
    ));

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>Meu Perfil</Text>
          <Text style={styles.headerSub}>Informações profissionais</Text>
        </View>
        <View style={styles.headerActions}>
          {isEditing ? (
            <TouchableOpacity style={styles.saveBtn} onPress={handleSave}>
              <Ionicons name="checkmark" size={16} color="#FFF" />
              <Text style={styles.saveBtnText}>Salvar</Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity style={styles.editBtn} onPress={() => setIsEditing(true)}>
              <Ionicons name="pencil-outline" size={16} color={PRIMARY} />
              <Text style={styles.editBtnText}>Editar</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      <ScrollView ref={scrollRef} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {/* Avatar + Info */}
        <View style={styles.avatarCard}>
          <View style={styles.avatarWrapper}>
            <Avatar uri={user?.avatar} name={user?.name} size={100} style={styles.avatarBorder} />
            {isEditing && (
              <TouchableOpacity style={styles.cameraBtn}>
                <Ionicons name="camera" size={16} color="#FFF" />
              </TouchableOpacity>
            )}
          </View>
          <Text style={styles.userName}>{user?.name}</Text>
          <Text style={styles.userRole}>Instrutor de Direção</Text>
          <View style={styles.ratingRow}>
            <Ionicons name="star" size={16} color="#EAB308" />
            <Text style={styles.ratingText}>{user?.rating}</Text>
            <Text style={styles.ratingCount}>({user?.reviews_count} avaliações)</Text>
          </View>
          {user?.is_verified && (
            <View style={styles.verifiedBadge}>
              <Ionicons name="shield-checkmark" size={14} color="#16A34A" />
              <Text style={styles.verifiedText}>Instrutor Verificado</Text>
            </View>
          )}

          {/* Toggle ativo/inativo */}
          <ActiveToggle
            value={user?.is_accepting_requests ?? true}
            onToggle={async (val) => {
              try {
                await updateProfile({ is_accepting_requests: val });
                if (val) {
                  await resumeAllPlans();
                } else {
                  await pauseAllPlans();
                }
              } catch {
                Alert.alert('Erro', 'Não foi possível atualizar o status.');
              }
            }}
          />
        </View>

        {/* Info Fields */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Informações de Contato</Text>
          <InfoRow icon="mail-outline" label="E-mail" value={user?.email} editing={false} />
          <InfoRow
            icon="call-outline" label="Telefone" value={formData.phone}
            editing={isEditing} onChangeText={(v) => setFormData(p => ({ ...p, phone: v }))}
          />
        </View>

        <View
          style={styles.section}
          onLayout={(e) => { profSectionY.current = e.nativeEvent.layout.y; }}
        >
          <Text style={styles.sectionTitle}>Informações Profissionais</Text>
          <InfoRow
            icon="car-outline" label="Veículo" value={formData.carModel}
            editing={isEditing} onChangeText={(v) => setFormData(p => ({ ...p, carModel: v }))}
          />
          <InfoRow
            icon="document-text-outline" label="Categoria CNH" value={formData.licenseCategory}
            editing={isEditing} onChangeText={(v) => setFormData(p => ({ ...p, licenseCategory: v }))}
          />
          {isEditing ? (
            <View style={styles.infoRow}>
              <Ionicons name="cash-outline" size={18} color="#9CA3AF" style={styles.infoIcon} />
              <View style={[styles.infoContent, { paddingBottom: 4 }]}>
                <Text style={styles.infoLabel}>Valor por hora</Text>
                <PriceSlider
                  value={formData.pricePerHour}
                  onChange={(v) => setFormData(p => ({ ...p, pricePerHour: v }))}
                />
              </View>
            </View>
          ) : (
            <InfoRow
              icon="cash-outline" label="Valor por hora" value={`R$ ${formData.pricePerHour}`}
              editing={false}
            />
          )}
          {/* Duração da Aula */}
          <View style={styles.infoRow}>
            <Ionicons name="timer-outline" size={18} color="#9CA3AF" style={styles.infoIcon} />
            <View style={styles.infoContent}>
              <Text style={styles.infoLabel}>Duração da Aula</Text>
              {isEditing ? (
                <View style={styles.durationRow}>
                  {DURATION_OPTIONS.map(d => (
                    <TouchableOpacity
                      key={d}
                      style={[styles.durationPill, formData.classDuration === d && styles.durationPillActive]}
                      onPress={() => setFormData(p => ({ ...p, classDuration: d }))}
                    >
                      <Text style={[styles.durationPillText, formData.classDuration === d && styles.durationPillTextActive]}>
                        {d}m
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              ) : (
                <Text style={styles.infoValue}>{formData.classDuration} min por aula</Text>
              )}
            </View>
          </View>
          <InfoRow icon="time-outline" label="Experiência" value="5+ anos" editing={false} />
        </View>

        {/* Bio */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Sobre Mim</Text>
          {isEditing ? (
            <TextInput
              style={styles.bioInput}
              multiline
              value={formData.bio}
              onChangeText={(v) => setFormData(p => ({ ...p, bio: v }))}
              textAlignVertical="top"
            />
          ) : (
            <Text style={styles.bioText}>{formData.bio}</Text>
          )}
        </View>

        {/* Avaliações Recentes */}
        {recentReviews.length > 0 && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Avaliações Recentes</Text>
            </View>
            {recentReviews.map((r, i) => {
              const studentName = r.profiles?.name || 'Aluno';
              const dateStr = new Date(r.created_at).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' });
              return (
                <View key={r.id} style={[styles.reviewRow, i < recentReviews.length - 1 && styles.reviewBorder]}>
                  <View style={styles.reviewTop}>
                    <View>
                      <Text style={styles.reviewName}>{studentName}</Text>
                      <View style={{ flexDirection: 'row', gap: 2, marginTop: 3 }}>
                        {renderStars(r.rating)}
                      </View>
                    </View>
                    <Text style={styles.reviewDate}>{dateStr}</Text>
                  </View>
                  {r.comment ? <Text style={styles.reviewComment}>{r.comment}</Text> : null}
                </View>
              );
            })}
          </View>
        )}

        {/* Logout */}
        <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout}>
          <Ionicons name="log-out-outline" size={20} color="#EF4444" />
          <Text style={styles.logoutText}>Sair da conta</Text>
        </TouchableOpacity>
      </ScrollView>

      {/* Modal de confirmação de logout */}
      <Modal
        visible={showLogoutModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowLogoutModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalBox}>
            <View style={styles.modalIconWrap}>
              <Ionicons name="log-out-outline" size={32} color="#EF4444" />
            </View>
            <Text style={styles.modalTitle}>Sair da conta</Text>
            <Text style={styles.modalMessage}>Tem certeza que deseja sair?</Text>
            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.modalCancel} onPress={() => setShowLogoutModal(false)}>
                <Text style={styles.modalCancelText}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.modalConfirm} onPress={logout}>
                <Text style={styles.modalConfirmText}>Sair</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

function ActiveToggle({ value, onToggle }) {
  const [loading, setLoading] = useState(false);
  const handleChange = async (next) => {
    setLoading(true);
    await onToggle(next);
    setLoading(false);
  };
  return (
    <View style={styles.activeToggleCard}>
      <View style={styles.activeToggleLeft}>
        <View style={[styles.activeIndicator, { backgroundColor: value ? '#16A34A' : '#9CA3AF' }]} />
        <View style={{ flex: 1 }}>
          <Text style={styles.activeToggleTitle}>
            {value ? 'Aceitando solicitações' : 'Pausado'}
          </Text>
          <Text style={styles.activeToggleSub}>
            {value
              ? 'Alunos podem te enviar pedidos de aula e planos'
              : 'Você não receberá novos pedidos de aula ou planos'}
          </Text>
        </View>
      </View>
      <Switch
        value={value}
        onValueChange={handleChange}
        disabled={loading}
        trackColor={{ false: '#D1D5DB', true: '#BBF7D0' }}
        thumbColor={value ? '#16A34A' : '#9CA3AF'}
        ios_backgroundColor="#D1D5DB"
      />
    </View>
  );
}

function PriceSlider({ value, onChange }) {
  // Slider tem range visual fixo; o valor digitado pode ir além
  const toRatio = (p) => Math.max(0, Math.min(1, (p - PRICE_MIN) / (PRICE_MAX - PRICE_MIN)));
  const fromRatio = (r) => Math.round(PRICE_MIN + r * (PRICE_MAX - PRICE_MIN));

  const [inputText, setInputText] = useState(String(parseInt(value, 10) || 60));
  const [ratio, setRatio] = useState(toRatio(parseInt(value, 10) || 60));
  const [inputWidth, setInputWidth] = useState(24);
  const startRef = useRef(toRatio(parseInt(value, 10) || 60));
  const trackW = useRef(300);

  const price = parseInt(inputText, 10) || 0;
  const info = getPriceInfo(Math.max(1, price));

  // Ref com handler atualizado a cada render — evita closure stale no PanResponder
  const onSlide = useRef(null);
  onSlide.current = (r) => {
    const p = fromRatio(r);
    setRatio(r);
    setInputText(String(p));
    onChange(String(p));
  };

  const pr = useRef(PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder: () => true,
    onPanResponderGrant: (e) => {
      const r = Math.max(0, Math.min(1, e.nativeEvent.locationX / trackW.current));
      startRef.current = r;
      onSlide.current(r);
    },
    onPanResponderMove: (_, gs) => {
      const r = Math.max(0, Math.min(1, startRef.current + gs.dx / trackW.current));
      onSlide.current(r);
    },
    onPanResponderRelease: (_, gs) => {
      startRef.current = Math.max(0, Math.min(1, startRef.current + gs.dx / trackW.current));
    },
  })).current;

  const handleTextChange = (text) => {
    const cleaned = text.replace(/[^0-9]/g, '');
    setInputText(cleaned);
    const p = parseInt(cleaned, 10) || 0;
    setRatio(toRatio(p));
    onChange(cleaned);
  };

  return (
    <View style={ps.wrap}>
      {/* Card de info — preço digitável */}
      <View style={[ps.card, { borderColor: info.color + '50', backgroundColor: info.color + '12' }]}>
        <View>
          <Text style={[ps.cardTier, { color: info.color }]}>{info.label}</Text>
          <View style={ps.priceRow}>
            <Text style={[ps.pricePrefix, { color: info.color }]}>R$</Text>
            {/* Text oculto que mede a largura real do conteúdo */}
            <Text
              style={[ps.priceInput, { position: 'absolute', opacity: 0 }]}
              onLayout={(e) => setInputWidth(e.nativeEvent.layout.width + 2)}
            >
              {inputText || '0'}
            </Text>
            <TextInput
              style={[ps.priceInput, { color: info.color, width: inputWidth }]}
              value={inputText}
              onChangeText={handleTextChange}
              keyboardType="numeric"
              inputMode="numeric"
              selectTextOnFocus
            />
            <Text style={ps.priceUnit}>/hora</Text>
          </View>
        </View>
        <View style={[ps.commBadge, { backgroundColor: info.color }]}>
          <Text style={ps.commPct}>{info.commission}%</Text>
          <Text style={ps.commSub}>plataforma</Text>
        </View>
      </View>

      {/* Track */}
      <View style={ps.trackOuter}>
        <View
          style={ps.track}
          onLayout={(e) => { trackW.current = e.nativeEvent.layout.width; }}
          {...pr.panHandlers}
        >
          <View style={[StyleSheet.absoluteFillObject, ps.trackBg]} />
          <View style={[ps.fill, { width: `${ratio * 100}%`, backgroundColor: info.color }]} />
          {PRICE_TIERS.map(t => (
            <View key={t.price} style={[ps.tick, { left: `${toRatio(t.price) * 100}%` }]} />
          ))}
          <View style={[ps.thumb, { left: `${ratio * 100}%`, borderColor: info.color }]} />
        </View>

        {/* Labels dos tiers */}
        <View style={ps.tierLabelRow}>
          {PRICE_TIERS.map(t => (
            <View key={t.price} style={[ps.tierLabelItem, { left: `${toRatio(t.price) * 100}%` }]}>
              <Text style={[ps.tierLabelText, price > t.price - 11 && price <= t.price + 10 && { color: t.color, fontWeight: '700' }]}>
                R${t.price}
              </Text>
            </View>
          ))}
        </View>
      </View>

      <Text style={ps.hint}>Preço maior = menor taxa da plataforma para você</Text>
    </View>
  );
}

function InfoRow({ icon, label, value, editing, onChangeText, keyboardType }) {
  return (
    <View style={styles.infoRow}>
      <Ionicons name={icon} size={18} color="#9CA3AF" style={styles.infoIcon} />
      <View style={styles.infoContent}>
        <Text style={styles.infoLabel}>{label}</Text>
        {editing ? (
          <TextInput
            style={styles.infoInput}
            value={value?.replace('R$ ', '') || value}
            onChangeText={onChangeText}
            keyboardType={keyboardType || 'default'}
          />
        ) : (
          <Text style={styles.infoValue}>{value}</Text>
        )}
      </View>
    </View>
  );
}

const ps = StyleSheet.create({
  wrap: { marginTop: 10, marginBottom: 4 },

  // Card de informação
  card: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    borderWidth: 1.5, borderRadius: 12, padding: 12, marginBottom: 16,
  },
  cardTier: { fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 },
  priceRow: { flexDirection: 'row', alignItems: 'baseline', gap: 2 },
  pricePrefix: { fontSize: 13, fontWeight: '700' },
  priceInput: { fontSize: 18, fontWeight: '800', padding: 0 },
  priceUnit: { fontSize: 12, fontWeight: '500', color: '#6B7280' },
  commBadge: { borderRadius: 10, paddingHorizontal: 10, paddingVertical: 6, alignItems: 'center' },
  commPct: { fontSize: 16, fontWeight: '800', color: '#FFF' },
  commSub: { fontSize: 10, fontWeight: '500', color: 'rgba(255,255,255,0.8)' },

  // Slider
  trackOuter: { paddingHorizontal: 2, marginBottom: 4 },
  track: {
    height: TRACK_H, borderRadius: TRACK_H / 2,
    marginBottom: 20,
    // overflow visible para o thumb aparecer fora dos limites verticais
  },
  trackBg: { borderRadius: TRACK_H / 2, backgroundColor: '#E5E7EB' },
  fill: { position: 'absolute', height: TRACK_H, borderRadius: TRACK_H / 2 },
  tick: {
    position: 'absolute',
    top: -(10 - TRACK_H) / 2 - 2,
    width: 2, height: 10,
    backgroundColor: '#FFF',
    borderRadius: 1,
    marginLeft: -1,
  },
  thumb: {
    position: 'absolute',
    top: -(THUMB_R * 2 - TRACK_H) / 2,
    width: THUMB_R * 2, height: THUMB_R * 2, borderRadius: THUMB_R,
    backgroundColor: '#FFF', borderWidth: 2.5,
    marginLeft: -THUMB_R,
    shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.25, shadowRadius: 4, elevation: 4,
  },

  // Labels dos tiers
  tierLabelRow: { position: 'relative', height: 18 },
  tierLabelItem: { position: 'absolute', alignItems: 'center', marginLeft: -16 },
  tierLabelText: { fontSize: 10, color: '#9CA3AF', fontWeight: '500' },

  hint: { fontSize: 11, color: '#9CA3AF', marginTop: 8, textAlign: 'center', fontStyle: 'italic' },
});

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#F9FAFB' },
  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    backgroundColor: '#FFF', paddingHorizontal: 20, paddingVertical: 16,
    borderBottomWidth: 1, borderBottomColor: '#F3F4F6',
  },
  headerTitle: { fontSize: 22, fontWeight: '800', color: '#111827' },
  headerSub: { fontSize: 13, color: '#6B7280', marginTop: 2 },
  headerActions: { flexDirection: 'row', gap: 8 },
  editBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    borderWidth: 1.5, borderColor: PRIMARY, borderRadius: 10,
    paddingHorizontal: 12, paddingVertical: 7,
  },
  editBtnText: { color: PRIMARY, fontWeight: '600', fontSize: 13 },
  saveBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: '#16A34A', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 7,
  },
  saveBtnText: { color: '#FFF', fontWeight: '600', fontSize: 13 },
  content: { padding: 16, paddingBottom: 40 },
  avatarCard: {
    backgroundColor: '#FFF', borderRadius: 20, padding: 24,
    alignItems: 'center', marginBottom: 16,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 8, elevation: 4,
  },
  avatarWrapper: { position: 'relative', marginBottom: 12 },
  avatarBorder: { borderWidth: 3, borderColor: PRIMARY },
  cameraBtn: {
    position: 'absolute', bottom: 0, right: 0,
    backgroundColor: PRIMARY, borderRadius: 14, width: 28, height: 28,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 2, borderColor: '#FFF',
  },
  userName: { fontSize: 22, fontWeight: '800', color: '#111827', marginBottom: 2 },
  userRole: { fontSize: 14, color: '#6B7280', marginBottom: 8 },
  ratingRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 10 },
  ratingText: { fontSize: 16, fontWeight: '700', color: '#111827' },
  ratingCount: { fontSize: 13, color: '#6B7280' },
  verifiedBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: '#F0FDF4', borderRadius: 20, paddingHorizontal: 10, paddingVertical: 4,
  },
  verifiedText: { fontSize: 12, color: '#16A34A', fontWeight: '600' },
  activeToggleCard: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    marginTop: 14, width: '100%',
    backgroundColor: '#F9FAFB', borderRadius: 12,
    borderWidth: 1, borderColor: '#E5E7EB',
    paddingHorizontal: 14, paddingVertical: 10,
  },
  activeToggleLeft: { flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1, marginRight: 12 },
  activeIndicator: { width: 10, height: 10, borderRadius: 5 },
  activeToggleTitle: { fontSize: 13, fontWeight: '700', color: '#111827' },
  activeToggleSub: { fontSize: 11, color: '#6B7280', marginTop: 1, flexShrink: 1 },
  section: {
    backgroundColor: '#FFF', borderRadius: 16, padding: 16, marginBottom: 16,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 6, elevation: 3,
  },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 },
  sectionTitle: { fontSize: 15, fontWeight: '700', color: '#111827', marginBottom: 14 },
  seeAll: { fontSize: 13, color: PRIMARY, fontWeight: '600' },
  infoRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#F9FAFB' },
  infoIcon: { marginRight: 12 },
  infoContent: { flex: 1 },
  infoLabel: { fontSize: 11, color: '#9CA3AF', fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5 },
  infoValue: { fontSize: 15, color: '#111827', marginTop: 2, fontWeight: '500' },
  infoInput: {
    fontSize: 15, color: '#111827', borderBottomWidth: 1.5,
    borderBottomColor: PRIMARY, paddingVertical: 2, marginTop: 2,
  },
  durationRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 6 },
  durationPill: {
    paddingHorizontal: 12, paddingVertical: 5, borderRadius: 20,
    backgroundColor: '#F3F4F6', borderWidth: 1.5, borderColor: '#E5E7EB',
  },
  durationPillActive: { backgroundColor: PRIMARY, borderColor: PRIMARY },
  durationPillText: { fontSize: 12, fontWeight: '700', color: '#6B7280' },
  durationPillTextActive: { color: '#FFF' },
  bioInput: {
    borderWidth: 1.5, borderColor: '#E5E7EB', borderRadius: 10,
    padding: 10, fontSize: 14, color: '#374151', minHeight: 80,
  },
  bioText: { fontSize: 14, color: '#374151', lineHeight: 22 },
  achievementRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8, gap: 12 },
  achievementIcon: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: '#EFF6FF', alignItems: 'center', justifyContent: 'center',
  },
  achievementTitle: { fontSize: 14, fontWeight: '600', color: '#111827' },
  achievementYear: { fontSize: 12, color: '#9CA3AF', marginTop: 1 },
  reviewRow: { paddingVertical: 12 },
  reviewBorder: { borderBottomWidth: 1, borderBottomColor: '#F3F4F6' },
  reviewTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 },
  reviewName: { fontSize: 14, fontWeight: '700', color: '#111827' },
  reviewDate: { fontSize: 12, color: '#9CA3AF' },
  reviewComment: { fontSize: 13, color: '#4B5563', lineHeight: 20 },
  logoutBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    borderWidth: 1.5, borderColor: '#FCA5A5', borderRadius: 14, paddingVertical: 14,
    backgroundColor: '#FFF5F5', marginBottom: 16,
  },
  logoutText: { fontSize: 15, fontWeight: '700', color: '#EF4444' },

  modalOverlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'center', alignItems: 'center',
  },
  modalBox: {
    backgroundColor: '#FFF', borderRadius: 20, padding: 28,
    marginHorizontal: 32, alignItems: 'center',
    shadowColor: '#000', shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15, shadowRadius: 20, elevation: 10,
  },
  modalIconWrap: {
    width: 60, height: 60, borderRadius: 30,
    backgroundColor: '#FEF2F2', justifyContent: 'center', alignItems: 'center',
    marginBottom: 16,
  },
  modalTitle: { fontSize: 18, fontWeight: '700', color: '#111827', marginBottom: 6 },
  modalMessage: { fontSize: 14, color: '#6B7280', textAlign: 'center', marginBottom: 24 },
  modalActions: { flexDirection: 'row', gap: 12, width: '100%' },
  modalCancel: {
    flex: 1, paddingVertical: 12, borderRadius: 12,
    borderWidth: 1.5, borderColor: '#E5E7EB', alignItems: 'center',
  },
  modalCancelText: { fontSize: 15, fontWeight: '600', color: '#374151' },
  modalConfirm: {
    flex: 1, paddingVertical: 12, borderRadius: 12,
    backgroundColor: '#EF4444', alignItems: 'center',
  },
  modalConfirmText: { fontSize: 15, fontWeight: '700', color: '#FFF' },
});
