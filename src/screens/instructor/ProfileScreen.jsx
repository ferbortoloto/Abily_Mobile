import React, { useState, useEffect, useRef } from 'react';
import { useNavigation } from '@react-navigation/native';
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity,
  TextInput, Modal, PanResponder, Switch,
  KeyboardAvoidingView, Platform, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../hooks/useAuth';
import { usePlans } from '../../context/PlansContext';
import Avatar from '../../components/shared/Avatar';
import { getReviews } from '../../services/instructors.service';
import { uploadProfilePhoto } from '../../services/auth.service';
import { logger } from '../../utils/logger';
import { makeShadow } from '../../constants/theme';
import { toast } from '../../utils/toast';
import ImagePickerSheet from '../../components/shared/ImagePickerSheet';

const PRIMARY = '#1D4ED8';
const CLASS_DURATION_MINUTES = 50;
const VEHICLE_TYPE_OPTIONS = [
  { value: 'manual',    label: 'Manual' },
  { value: 'automatic', label: 'Automático' },
  { value: 'electric',  label: 'Elétrico' },
];

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
  const navigation = useNavigation();
  const { user, logout, updateProfile, changePassword } = useAuth();
  const { pauseAllPlans, resumeAllPlans } = usePlans();
  const [isEditing, setIsEditing] = useState(false);
  const [showLogoutModal, setShowLogoutModal] = useState(false);
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [passwordLoading, setPasswordLoading] = useState(false);
  const [showNewPwd, setShowNewPwd] = useState(false);
  const [showConfirmPwd, setShowConfirmPwd] = useState(false);
  const [recentReviews, setRecentReviews] = useState([]);
  const [avatarUri, setAvatarUri] = useState(null);
  const [showPickerSheet, setShowPickerSheet] = useState(false);
  const scrollRef = useRef(null);
  const profSectionY = useRef(0);
  const fileInputRef = useRef(null);

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
    hasCar: user?.has_car ?? false,
    carModel: user?.car_model || '',
    carYear: user?.car_year ? String(user.car_year) : '',
    carColor: user?.car_color || '',
    carPlate: user?.car_plate || '',
    carOptions: user?.car_options || 'instructor',
    vehicleType: user?.vehicle_type || 'manual',
    licenseCategory: user?.license_category || '',
    pricePerHour: String(user?.price_per_hour || ''),
    pricePerHourMoto: String(user?.price_per_hour_moto || ''),
    classDuration: CLASS_DURATION_MINUTES,
    bio: user?.bio || 'Instrutor de direção com mais de 5 anos de experiência, especializado em formação de condutores seguros e conscientes.',
    hasMoto: user?.has_moto ?? false,
    motoModel: user?.moto_model || '',
    motoYear: user?.moto_year ? String(user.moto_year) : '',
    motoColor: user?.moto_color || '',
    motoPlate: user?.moto_plate || '',
    motoOptions: user?.moto_options || 'instructor',
    gender: user?.gender || 'undisclosed',
  });

  const handleLogout = () => setShowLogoutModal(true);

  const handleChangePassword = async () => {
    if (!newPassword || newPassword.length < 8) {
      setPasswordError('Mínimo 8 caracteres.');
      return;
    }
    if (!/[A-Z]/.test(newPassword)) {
      setPasswordError('Inclua ao menos uma letra maiúscula.');
      return;
    }
    if (!/[0-9]/.test(newPassword)) {
      setPasswordError('Inclua ao menos um número.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordError('As senhas não coincidem.');
      return;
    }
    setPasswordLoading(true);
    try {
      await changePassword(newPassword);
      setShowPasswordModal(false);
      setNewPassword('');
      setConfirmPassword('');
      setPasswordError('');
      toast.success('Senha alterada com sucesso!');
    } catch {
      setPasswordError('Não foi possível alterar a senha. Tente novamente.');
    } finally {
      setPasswordLoading(false);
    }
  };

  const handleWebFileChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setAvatarUri(URL.createObjectURL(file));
  };

  const handlePickImage = () => {
    if (Platform.OS === 'web') {
      fileInputRef.current?.click();
      return;
    }
    setShowPickerSheet(true);
  };

  const handleSave = async () => {
    const cat = formData.licenseCategory;
    const hasB = cat === 'B' || cat === 'A+B';
    const hasA = cat === 'A' || cat === 'A+B';

    // Validação: carro e moto próprios exigem modelo e ano
    if (hasB && formData.hasCar && !formData.carModel.trim()) {
      toast.error('Informe o modelo do carro.');
      return;
    }
    if (hasB && formData.hasCar && !formData.carYear.trim()) {
      toast.error('Informe o ano do carro.');
      return;
    }
    if (hasA && formData.hasMoto && !formData.motoModel.trim()) {
      toast.error('Informe o modelo da moto.');
      return;
    }
    if (hasA && formData.hasMoto && !formData.motoYear.trim()) {
      toast.error('Informe o ano da moto.');
      return;
    }

    try {
      // Faz upload da foto se for uma URI local (não começa com http)
      let newAvatarUrl = null;
      if (avatarUri && !avatarUri.startsWith('http')) {
        try {
          newAvatarUrl = await uploadProfilePhoto(user.id, avatarUri);
        } catch (uploadErr) {
          logger.error('Erro ao enviar foto:', uploadErr?.message);
          toast.error('Não foi possível enviar a foto. Outros dados serão salvos.');
        }
      }

      await updateProfile({
        name: formData.name,
        phone: formData.phone,
        ...(newAvatarUrl ? { avatar_url: newAvatarUrl } : {}),
        license_category: cat,
        // Cat A → só moto; Cat B → só carro; Cat A+B → ambos
        price_per_hour:      hasB ? (parseFloat(formData.pricePerHour) || 0) : null,
        price_per_hour_moto: hasA ? (parseFloat(formData.pricePerHourMoto) || null) : null,
        class_duration: formData.classDuration,
        bio: formData.bio,
        // Campos de carro (apenas se categoria inclui B)
        has_car:      hasB ? formData.hasCar : null,
        car_model:    hasB && formData.hasCar ? formData.carModel : null,
        car_year:     hasB && formData.hasCar && formData.carYear ? parseInt(formData.carYear, 10) : null,
        car_color:    hasB && formData.hasCar ? (formData.carColor.trim() || null) : null,
        car_plate:    hasB && formData.hasCar ? (formData.carPlate.trim().toUpperCase() || null) : null,
        vehicle_type: hasB && formData.hasCar ? formData.vehicleType : null,
        car_options:  hasB ? formData.carOptions : null,
        // Campos de moto (apenas se categoria inclui A)
        has_moto:      hasA ? formData.hasMoto : null,
        moto_model:    hasA && formData.hasMoto ? formData.motoModel : null,
        moto_year:     hasA && formData.hasMoto && formData.motoYear ? parseInt(formData.motoYear, 10) : null,
        moto_color:    hasA && formData.hasMoto ? (formData.motoColor.trim() || null) : null,
        moto_plate:    hasA && formData.hasMoto ? (formData.motoPlate.trim().toUpperCase() || null) : null,
        moto_options:  hasA ? formData.motoOptions : null,
        gender: formData.gender,
      });
      setAvatarUri(null);
      setIsEditing(false);
      toast.success('Perfil atualizado com sucesso!');
    } catch (e) {
      logger.error('Erro ao salvar perfil:', e?.message);
      toast.error(e?.message || 'Não foi possível salvar o perfil.');
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
      <ImagePickerSheet
        visible={showPickerSheet}
        onClose={() => setShowPickerSheet(false)}
        onUri={setAvatarUri}
      />
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

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1 }}
      >
      <ScrollView ref={scrollRef} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        {/* Avatar + Info */}
        <View style={styles.avatarCard}>
          <View style={styles.avatarWrapper}>
            <Avatar uri={avatarUri || user?.avatar_url} name={user?.name} size={100} style={styles.avatarBorder} />
            {isEditing && (
              <TouchableOpacity style={styles.cameraBtn} onPress={handlePickImage}>
                <Ionicons name="camera" size={16} color="#FFF" />
              </TouchableOpacity>
            )}
            {Platform.OS === 'web' && (
              <input ref={fileInputRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleWebFileChange} />
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
                toast.error('Não foi possível atualizar o status.');
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
          {/* Gênero */}
          <View style={styles.infoRow}>
            <Ionicons name="person-outline" size={18} color="#9CA3AF" style={styles.infoIcon} />
            <View style={styles.infoContent}>
              <Text style={styles.infoLabel}>Gênero</Text>
              {isEditing ? (
                <View style={[styles.durationRow, { marginTop: 6 }]}>
                  {[
                    { value: 'male',        label: 'Masculino' },
                    { value: 'female',      label: 'Feminino' },
                    { value: 'undisclosed', label: 'Não declarado' },
                  ].map(opt => (
                    <TouchableOpacity
                      key={opt.value}
                      style={[styles.durationPill, formData.gender === opt.value && styles.durationPillActive]}
                      onPress={() => setFormData(p => ({ ...p, gender: opt.value }))}
                    >
                      <Text style={[styles.durationPillText, formData.gender === opt.value && styles.durationPillTextActive]}>
                        {opt.label}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              ) : (
                <Text style={styles.infoValue}>
                  {formData.gender === 'male' ? 'Masculino' : formData.gender === 'female' ? 'Feminino' : 'Não declarado'}
                </Text>
              )}
            </View>
          </View>
        </View>

        <View
          style={styles.section}
          onLayout={(e) => { profSectionY.current = e.nativeEvent.layout.y; }}
        >
          <Text style={styles.sectionTitle}>Informações Profissionais</Text>
          {/* ── Carro (categoria B ou A+B) ── */}
          {(formData.licenseCategory === 'B' || formData.licenseCategory === 'A+B') && (<>
            {/* Toggle possui carro próprio */}
            <View style={styles.infoRow}>
              <Ionicons name="car-outline" size={18} color="#9CA3AF" style={styles.infoIcon} />
              <View style={styles.infoContent}>
                <Text style={styles.infoLabel}>Possui carro próprio</Text>
                {isEditing ? (
                  <View style={[styles.durationRow, { marginTop: 6 }]}>
                    {[
                      { value: false, label: 'Não' },
                      { value: true,  label: 'Sim' },
                    ].map(opt => (
                      <TouchableOpacity
                        key={String(opt.value)}
                        style={[styles.durationPill, formData.hasCar === opt.value && styles.durationPillActive]}
                        onPress={() => setFormData(p => ({
                          ...p,
                          hasCar: opt.value,
                          // Sem carro próprio → só pode usar carro do aluno
                          carOptions: !opt.value ? 'student' : p.carOptions,
                        }))}
                      >
                        <Text style={[styles.durationPillText, formData.hasCar === opt.value && styles.durationPillTextActive]}>
                          {opt.label}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                ) : (
                  <Text style={styles.infoValue}>{formData.hasCar ? 'Sim' : 'Não'}</Text>
                )}
              </View>
            </View>
            {/* Modelo, ano e câmbio — só se possui carro */}
            {formData.hasCar && (
              <>
                <View style={styles.infoRow}>
                  <Ionicons name="car-outline" size={18} color="#9CA3AF" style={styles.infoIcon} />
                  <View style={styles.infoContent}>
                    <Text style={styles.infoLabel}>Carro</Text>
                    {isEditing ? (
                      <View style={{ flexDirection: 'row', gap: 8, marginTop: 2 }}>
                        <TextInput
                          style={[styles.infoInput, { flex: 3 }]}
                          value={formData.carModel}
                          onChangeText={(v) => setFormData(p => ({ ...p, carModel: v }))}
                          placeholder="Marca e modelo"
                          placeholderTextColor="#D1D5DB"
                          autoCapitalize="words"
                        />
                        <TextInput
                          style={[styles.infoInput, { flex: 2 }]}
                          value={formData.carYear}
                          onChangeText={(v) => setFormData(p => ({ ...p, carYear: v }))}
                          placeholder="Ano"
                          placeholderTextColor="#D1D5DB"
                          keyboardType="number-pad"
                          maxLength={4}
                        />
                      </View>
                    ) : (
                      <Text style={styles.infoValue}>
                        {[formData.carModel, formData.carYear].filter(Boolean).join(' ') || '—'}
                      </Text>
                    )}
                  </View>
                </View>
                <View style={styles.infoRow}>
                  <Ionicons name="color-palette-outline" size={18} color="#9CA3AF" style={styles.infoIcon} />
                  <View style={styles.infoContent}>
                    <Text style={styles.infoLabel}>Cor e Placa do Carro</Text>
                    {isEditing ? (
                      <View style={{ flexDirection: 'row', gap: 8, marginTop: 2 }}>
                        <TextInput
                          style={[styles.infoInput, { flex: 3 }]}
                          value={formData.carColor}
                          onChangeText={(v) => setFormData(p => ({ ...p, carColor: v }))}
                          placeholder="Cor (ex: Branco)"
                          placeholderTextColor="#D1D5DB"
                          autoCapitalize="words"
                        />
                        <TextInput
                          style={[styles.infoInput, { flex: 2 }]}
                          value={formData.carPlate}
                          onChangeText={(v) => setFormData(p => ({ ...p, carPlate: v.toUpperCase() }))}
                          placeholder="ABC1D23"
                          placeholderTextColor="#D1D5DB"
                          autoCapitalize="characters"
                          maxLength={8}
                        />
                      </View>
                    ) : (
                      <Text style={styles.infoValue}>
                        {[formData.carColor, formData.carPlate].filter(Boolean).join(' · ') || '—'}
                      </Text>
                    )}
                  </View>
                </View>
                <View style={styles.infoRow}>
                  <Ionicons name="settings-outline" size={18} color="#9CA3AF" style={styles.infoIcon} />
                  <View style={styles.infoContent}>
                    <Text style={styles.infoLabel}>Tipo de Câmbio</Text>
                    {isEditing ? (
                      <View style={styles.durationRow}>
                        {VEHICLE_TYPE_OPTIONS.map(opt => (
                          <TouchableOpacity
                            key={opt.value}
                            style={[styles.durationPill, formData.vehicleType === opt.value && styles.durationPillActive]}
                            onPress={() => setFormData(p => ({ ...p, vehicleType: opt.value }))}
                          >
                            <Text style={[styles.durationPillText, formData.vehicleType === opt.value && styles.durationPillTextActive]}>
                              {opt.label}
                            </Text>
                          </TouchableOpacity>
                        ))}
                      </View>
                    ) : (
                      <Text style={styles.infoValue}>
                        {VEHICLE_TYPE_OPTIONS.find(o => o.value === formData.vehicleType)?.label || 'Manual'}
                      </Text>
                    )}
                  </View>
                </View>
              </>
            )}
            {/* Aulas de carro — com qual veículo */}
            <View style={styles.infoRow}>
              <Ionicons name="swap-horizontal-outline" size={18} color="#9CA3AF" style={styles.infoIcon} />
              <View style={styles.infoContent}>
                <Text style={styles.infoLabel}>Aulas de carro com</Text>
                {isEditing ? (
                  <View style={styles.durationRow}>
                    {[
                      { value: 'instructor', label: 'Meu carro',      requiresCar: true },
                      { value: 'student',    label: 'Carro do aluno', requiresCar: false },
                      { value: 'both',       label: 'Ambos',          requiresCar: true },
                    ].filter(opt => !opt.requiresCar || formData.hasCar).map(opt => (
                      <TouchableOpacity
                        key={opt.value}
                        style={[styles.durationPill, formData.carOptions === opt.value && styles.durationPillActive]}
                        onPress={() => setFormData(p => ({ ...p, carOptions: opt.value }))}
                      >
                        <Text style={[styles.durationPillText, formData.carOptions === opt.value && styles.durationPillTextActive]}>
                          {opt.label}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                ) : (
                  <Text style={styles.infoValue}>
                    {{ instructor: 'Meu carro', student: 'Carro do aluno', both: 'Ambos' }[formData.carOptions] || '—'}
                  </Text>
                )}
              </View>
            </View>
          </>)}

          {/* ── Moto (categoria A ou A+B) ── */}
          {(formData.licenseCategory === 'A' || formData.licenseCategory === 'A+B') && (<>
            {/* Toggle possui moto própria */}
            <View style={styles.infoRow}>
              <Ionicons name="bicycle-outline" size={18} color="#9CA3AF" style={styles.infoIcon} />
              <View style={styles.infoContent}>
                <Text style={styles.infoLabel}>Possui moto própria</Text>
                {isEditing ? (
                  <View style={[styles.durationRow, { marginTop: 6 }]}>
                    {[
                      { value: false, label: 'Não' },
                      { value: true,  label: 'Sim' },
                    ].map(opt => (
                      <TouchableOpacity
                        key={String(opt.value)}
                        style={[styles.durationPill, formData.hasMoto === opt.value && styles.durationPillActive]}
                        onPress={() => setFormData(p => ({
                          ...p,
                          hasMoto: opt.value,
                          // Sem moto própria → só pode usar moto do aluno
                          motoOptions: !opt.value ? 'student' : p.motoOptions,
                        }))}
                      >
                        <Text style={[styles.durationPillText, formData.hasMoto === opt.value && styles.durationPillTextActive]}>
                          {opt.label}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                ) : (
                  <Text style={styles.infoValue}>{formData.hasMoto ? 'Sim' : 'Não'}</Text>
                )}
              </View>
            </View>
            {/* Modelo e ano da moto — só se possui moto */}
            {formData.hasMoto && (
            <>
            <View style={styles.infoRow}>
              <Ionicons name="bicycle-outline" size={18} color="#9CA3AF" style={styles.infoIcon} />
              <View style={styles.infoContent}>
                <Text style={styles.infoLabel}>Moto</Text>
                {isEditing ? (
                  <View style={{ flexDirection: 'row', gap: 8, marginTop: 2 }}>
                    <TextInput
                      style={[styles.infoInput, { flex: 3 }]}
                      value={formData.motoModel}
                      onChangeText={(v) => setFormData(p => ({ ...p, motoModel: v }))}
                      placeholder="Marca e modelo"
                      placeholderTextColor="#D1D5DB"
                      autoCapitalize="words"
                    />
                    <TextInput
                      style={[styles.infoInput, { flex: 2 }]}
                      value={formData.motoYear}
                      onChangeText={(v) => setFormData(p => ({ ...p, motoYear: v }))}
                      placeholder="Ano"
                      placeholderTextColor="#D1D5DB"
                      keyboardType="number-pad"
                      maxLength={4}
                    />
                  </View>
                ) : (
                  <Text style={styles.infoValue}>
                    {[formData.motoModel, formData.motoYear].filter(Boolean).join(' ') || '—'}
                  </Text>
                )}
              </View>
            </View>
            <View style={styles.infoRow}>
              <Ionicons name="color-palette-outline" size={18} color="#9CA3AF" style={styles.infoIcon} />
              <View style={styles.infoContent}>
                <Text style={styles.infoLabel}>Cor e Placa da Moto</Text>
                {isEditing ? (
                  <View style={{ flexDirection: 'row', gap: 8, marginTop: 2 }}>
                    <TextInput
                      style={[styles.infoInput, { flex: 3 }]}
                      value={formData.motoColor}
                      onChangeText={(v) => setFormData(p => ({ ...p, motoColor: v }))}
                      placeholder="Cor (ex: Vermelho)"
                      placeholderTextColor="#D1D5DB"
                      autoCapitalize="words"
                    />
                    <TextInput
                      style={[styles.infoInput, { flex: 2 }]}
                      value={formData.motoPlate}
                      onChangeText={(v) => setFormData(p => ({ ...p, motoPlate: v.toUpperCase() }))}
                      placeholder="ABC1D23"
                      placeholderTextColor="#D1D5DB"
                      autoCapitalize="characters"
                      maxLength={8}
                    />
                  </View>
                ) : (
                  <Text style={styles.infoValue}>
                    {[formData.motoColor, formData.motoPlate].filter(Boolean).join(' · ') || '—'}
                  </Text>
                )}
              </View>
            </View>
            </>
            )}
            {/* Aulas de moto — com qual veículo */}
            <View style={styles.infoRow}>
              <Ionicons name="swap-horizontal-outline" size={18} color="#9CA3AF" style={styles.infoIcon} />
              <View style={styles.infoContent}>
                <Text style={styles.infoLabel}>Aulas de moto com</Text>
                {isEditing ? (
                  <View style={styles.durationRow}>
                    {[
                      { value: 'instructor', label: 'Minha moto', requiresMoto: true },
                      { value: 'student',    label: 'Moto do aluno', requiresMoto: false },
                      { value: 'both',       label: 'Ambos',       requiresMoto: true },
                    ].filter(opt => !opt.requiresMoto || formData.hasMoto).map(opt => (
                      <TouchableOpacity
                        key={opt.value}
                        style={[styles.durationPill, formData.motoOptions === opt.value && styles.durationPillActive]}
                        onPress={() => setFormData(p => ({ ...p, motoOptions: opt.value }))}
                      >
                        <Text style={[styles.durationPillText, formData.motoOptions === opt.value && styles.durationPillTextActive]}>
                          {opt.label}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                ) : (
                  <Text style={styles.infoValue}>
                    {{ instructor: 'Minha moto', student: 'Moto do aluno', both: 'Ambos' }[formData.motoOptions] || '—'}
                  </Text>
                )}
              </View>
            </View>
          </>)}
          {/* Categoria CNH */}
          <View style={styles.infoRow}>
            <Ionicons name="document-text-outline" size={18} color="#9CA3AF" style={styles.infoIcon} />
            <View style={styles.infoContent}>
              <Text style={styles.infoLabel}>Categoria CNH</Text>
              {isEditing ? (
                <View style={[styles.durationRow, { marginTop: 6 }]}>
                  {[
                    { value: 'A',   label: 'Moto (A)' },
                    { value: 'B',   label: 'Carro (B)' },
                    { value: 'A+B', label: 'Moto + Carro' },
                  ].map(opt => (
                    <TouchableOpacity
                      key={opt.value}
                      style={[styles.durationPill, formData.licenseCategory === opt.value && styles.durationPillActive]}
                      onPress={() => setFormData(p => ({ ...p, licenseCategory: opt.value }))}
                    >
                      <Text style={[styles.durationPillText, formData.licenseCategory === opt.value && styles.durationPillTextActive]}>
                        {opt.label}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              ) : (
                <Text style={styles.infoValue}>{formData.licenseCategory || '—'}</Text>
              )}
            </View>
          </View>
          {isEditing ? (
            <View style={styles.infoRow}>
              <Ionicons name="cash-outline" size={18} color="#9CA3AF" style={styles.infoIcon} />
              <View style={[styles.infoContent, { paddingBottom: 4 }]}>
                <Text style={styles.infoLabel}>
                  {formData.licenseCategory === 'A+B' ? 'Valores por hora' : 'Valor por hora'}
                </Text>
                {formData.licenseCategory !== 'A' && (
                  <PriceSlider
                    vehicleLabel={formData.licenseCategory === 'A+B' ? 'Carro' : null}
                    vehicleIcon="car-outline"
                    vehicleColor="#2563EB"
                    value={formData.pricePerHour}
                    onChange={(v) => setFormData(p => ({ ...p, pricePerHour: v }))}
                  />
                )}
                {formData.licenseCategory !== 'B' && (
                  <PriceSlider
                    vehicleLabel={formData.licenseCategory === 'A+B' ? 'Moto' : null}
                    vehicleIcon="bicycle-outline"
                    vehicleColor="#7C3AED"
                    value={formData.pricePerHourMoto}
                    onChange={(v) => setFormData(p => ({ ...p, pricePerHourMoto: v }))}
                  />
                )}
              </View>
            </View>
          ) : (
            <View style={styles.infoRow}>
              <Ionicons name="cash-outline" size={18} color="#9CA3AF" style={styles.infoIcon} />
              <View style={styles.infoContent}>
                <Text style={styles.infoLabel}>
                  {formData.licenseCategory === 'A+B' ? 'Valores por hora' : 'Valor por hora'}
                </Text>
                {formData.licenseCategory !== 'A' && (
                  <View style={styles.priceViewRow}>
                    {formData.licenseCategory === 'A+B' && (
                      <Ionicons name="car-outline" size={14} color="#2563EB" />
                    )}
                    <Text style={[styles.infoValue, formData.licenseCategory === 'A+B' && { color: '#2563EB' }]}>
                      R$ {formData.pricePerHour || '—'}/h
                    </Text>
                  </View>
                )}
                {formData.licenseCategory !== 'B' && (
                  <View style={[styles.priceViewRow, { marginTop: formData.licenseCategory === 'A+B' ? 4 : 2 }]}>
                    {formData.licenseCategory !== 'B' && (
                      <Ionicons name="bicycle-outline" size={14} color="#7C3AED" />
                    )}
                    <Text style={[styles.infoValue, { color: '#7C3AED' }]}>
                      R$ {formData.pricePerHourMoto || '—'}/h
                    </Text>
                  </View>
                )}
              </View>
            </View>
          )}
          {/* Duração da Aula */}
          <View style={styles.infoRow}>
            <Ionicons name="timer-outline" size={18} color="#9CA3AF" style={styles.infoIcon} />
            <View style={styles.infoContent}>
              <Text style={styles.infoLabel}>Duração da Aula</Text>
              <Text style={styles.infoValue}>{CLASS_DURATION_MINUTES} min por aula</Text>
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

        {/* Alterar senha */}
        <TouchableOpacity style={styles.changePasswordBtn} onPress={() => { setShowPasswordModal(true); setPasswordError(''); setNewPassword(''); setConfirmPassword(''); }}>
          <Ionicons name="key-outline" size={20} color={PRIMARY} />
          <Text style={styles.changePasswordText}>Alterar senha</Text>
        </TouchableOpacity>

        {/* Suporte */}
        <TouchableOpacity style={styles.supportBtn} onPress={() => navigation.navigate('Support')}>
          <Ionicons name="help-circle-outline" size={20} color="#64748B" />
          <Text style={styles.supportText}>Suporte & Ajuda</Text>
        </TouchableOpacity>

        {/* Logout */}
        <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout}>
          <Ionicons name="log-out-outline" size={20} color="#EF4444" />
          <Text style={styles.logoutText}>Sair da conta</Text>
        </TouchableOpacity>
      </ScrollView>
      </KeyboardAvoidingView>

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

      {/* Modal de alteração de senha */}
      <Modal
        visible={showPasswordModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowPasswordModal(false)}
      >
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
          <View style={styles.modalOverlay}>
            <View style={styles.modalBox}>
              <View style={[styles.modalIconWrap, { backgroundColor: '#EFF6FF' }]}>
                <Ionicons name="key-outline" size={32} color={PRIMARY} />
              </View>
              <Text style={styles.modalTitle}>Alterar senha</Text>
              <Text style={styles.modalMessage}>A nova senha deve ter no mínimo 8 caracteres, uma maiúscula e um número.</Text>

              <View style={styles.pwdInputWrapper}>
                <TextInput
                  style={styles.pwdInput}
                  placeholder="Nova senha"
                  placeholderTextColor="#9CA3AF"
                  secureTextEntry={!showNewPwd}
                  value={newPassword}
                  onChangeText={(v) => { setNewPassword(v); setPasswordError(''); }}
                  autoCapitalize="none"
                />
                <TouchableOpacity onPress={() => setShowNewPwd(v => !v)} style={styles.pwdEye}>
                  <Ionicons name={showNewPwd ? 'eye-off-outline' : 'eye-outline'} size={18} color="#9CA3AF" />
                </TouchableOpacity>
              </View>

              <View style={[styles.pwdInputWrapper, { marginBottom: 4 }]}>
                <TextInput
                  style={styles.pwdInput}
                  placeholder="Confirmar nova senha"
                  placeholderTextColor="#9CA3AF"
                  secureTextEntry={!showConfirmPwd}
                  value={confirmPassword}
                  onChangeText={(v) => { setConfirmPassword(v); setPasswordError(''); }}
                  autoCapitalize="none"
                />
                <TouchableOpacity onPress={() => setShowConfirmPwd(v => !v)} style={styles.pwdEye}>
                  <Ionicons name={showConfirmPwd ? 'eye-off-outline' : 'eye-outline'} size={18} color="#9CA3AF" />
                </TouchableOpacity>
              </View>

              {passwordError ? <Text style={styles.pwdError}>{passwordError}</Text> : null}

              <View style={[styles.modalActions, { marginTop: 20 }]}>
                <TouchableOpacity style={styles.modalCancel} onPress={() => setShowPasswordModal(false)}>
                  <Text style={styles.modalCancelText}>Cancelar</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.modalConfirm, { backgroundColor: PRIMARY }, passwordLoading && { opacity: 0.6 }]}
                  onPress={handleChangePassword}
                  disabled={passwordLoading}
                >
                  {passwordLoading
                    ? <ActivityIndicator color="#FFF" size="small" />
                    : <Text style={styles.modalConfirmText}>Salvar</Text>
                  }
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </KeyboardAvoidingView>
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

function PriceSlider({ value, onChange, vehicleLabel, vehicleIcon, vehicleColor }) {
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

  const labelColor = vehicleColor || info.color;

  return (
    <View style={ps.wrap}>
      {/* Label de veículo (só quando A+B) */}
      {vehicleLabel && (
        <View style={ps.vehicleHeader}>
          <Ionicons name={vehicleIcon || 'car-outline'} size={13} color={labelColor} />
          <Text style={[ps.vehicleHeaderText, { color: labelColor }]}>{vehicleLabel}</Text>
        </View>
      )}
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
    ...makeShadow('#000', 2, 0.25, 4, 4),
  },

  // Labels dos tiers
  tierLabelRow: { position: 'relative', height: 18 },
  tierLabelItem: { position: 'absolute', alignItems: 'center', marginLeft: -16 },
  tierLabelText: { fontSize: 10, color: '#9CA3AF', fontWeight: '500' },

  hint: { fontSize: 11, color: '#9CA3AF', marginTop: 8, textAlign: 'center', fontStyle: 'italic' },

  // Label de veículo (carro/moto)
  vehicleHeader: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    marginBottom: 6, marginTop: 2,
  },
  vehicleHeaderText: { fontSize: 12, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5 },
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
    ...makeShadow('#000', 2, 0.06, 8, 4),
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
    ...makeShadow('#000', 2, 0.06, 6, 3),
  },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 },
  sectionTitle: { fontSize: 15, fontWeight: '700', color: '#111827', marginBottom: 14 },
  seeAll: { fontSize: 13, color: PRIMARY, fontWeight: '600' },
  infoRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#F9FAFB' },
  infoIcon: { marginRight: 12 },
  infoContent: { flex: 1 },
  infoLabel: { fontSize: 11, color: '#9CA3AF', fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5 },
  infoValue: { fontSize: 15, color: '#111827', marginTop: 2, fontWeight: '500' },
  priceViewRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 2 },
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
  supportBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    borderWidth: 1.5, borderColor: '#E2E8F0', borderRadius: 14, paddingVertical: 14,
    backgroundColor: '#F8FAFC', marginBottom: 12,
  },
  supportText: { fontSize: 15, fontWeight: '700', color: '#64748B' },

  logoutBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    borderWidth: 1.5, borderColor: '#FCA5A5', borderRadius: 14, paddingVertical: 14,
    backgroundColor: '#FFF5F5', marginBottom: 16,
  },
  logoutText: { fontSize: 15, fontWeight: '700', color: '#EF4444' },

  changePasswordBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    borderWidth: 1.5, borderColor: '#BFDBFE', borderRadius: 14, paddingVertical: 14,
    backgroundColor: '#EFF6FF', marginBottom: 12,
  },
  changePasswordText: { fontSize: 15, fontWeight: '700', color: PRIMARY },

  pwdInputWrapper: {
    flexDirection: 'row', alignItems: 'center',
    borderWidth: 1.5, borderColor: '#E5E7EB', borderRadius: 12,
    backgroundColor: '#F9FAFB', paddingHorizontal: 12,
    width: '100%', marginBottom: 12,
  },
  pwdInput: { flex: 1, height: 46, fontSize: 15, color: '#111827' },
  pwdEye: { padding: 4 },
  pwdError: { fontSize: 12, color: '#EF4444', marginBottom: 4, alignSelf: 'flex-start' },

  modalOverlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'center', alignItems: 'center',
  },
  modalBox: {
    backgroundColor: '#FFF', borderRadius: 20, padding: 24,
    marginHorizontal: '8%', alignItems: 'center',
    ...makeShadow('#000', 8, 0.15, 20, 10),
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
