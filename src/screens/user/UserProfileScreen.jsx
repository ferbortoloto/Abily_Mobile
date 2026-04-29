import React, { useState, useMemo, useRef, useEffect } from 'react';
import { useNavigation } from '@react-navigation/native';
import {
  View, Text, TouchableOpacity, StyleSheet, ScrollView,
  TextInput, Modal, KeyboardAvoidingView, Platform, ActivityIndicator, Alert, Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../hooks/useAuth';
import { useSchedule } from '../../context/ScheduleContext';
import { geocodeAddress, searchAddresses, searchByCep } from '../../utils/geocoding';
import { makeShadow } from '../../constants/theme';
import { toast } from '../../utils/toast';
import LeafletMapView from '../../components/shared/LeafletMapView';
import Avatar from '../../components/shared/Avatar';
import { uploadProfilePhoto } from '../../services/auth.service';
import ImagePickerSheet from '../../components/shared/ImagePickerSheet';

const PRIMARY = '#1D4ED8';

const statusMap = {
  scheduled: { label: 'Agendada', color: '#2563EB' },
  completed: { label: 'Concluída', color: '#16A34A' },
  cancelled: { label: 'Cancelada', color: '#EF4444' },
};

export default function UserProfileScreen() {
  const navigation = useNavigation();
  const { user, logout, updateProfile, changePassword, goalCategories, addGoalCategory, markCategoryObtained, removeGoalCategory } = useAuth();
  const { events } = useSchedule();
  const [editing, setEditing] = useState(false);
  const [showLogoutModal, setShowLogoutModal] = useState(false);
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [passwordLoading, setPasswordLoading] = useState(false);
  const [showNewPwd, setShowNewPwd] = useState(false);
  const [showConfirmPwd, setShowConfirmPwd] = useState(false);
  const [avatarUri, setAvatarUri] = useState(null);
  const [showPickerSheet, setShowPickerSheet] = useState(false);
  const [name, setName] = useState(user?.name || 'Aluno Abily');
  const [email, setEmail] = useState(user?.email || 'user@gmail.com');
  const [phone, setPhone] = useState(user?.phone || '(11) 98765-4321');
  const [goal, setGoal] = useState(user?.goal || 'Categoria B');

  // Endereço estruturado — inicializa tentando parsear o campo legado
  const [addrRua, setAddrRua] = useState(() => parseStoredAddress(user?.address || '').rua);
  const [addrNumero, setAddrNumero] = useState(() => parseStoredAddress(user?.address || '').numero);
  const [addrCidade, setAddrCidade] = useState(() => parseStoredAddress(user?.address || '').cidade);
  const [addrEstado, setAddrEstado] = useState(() => parseStoredAddress(user?.address || '').estado);

  const [gender, setGender] = useState(user?.gender || 'undisclosed');
  const [renach, setRenach] = useState(user?.renach || '');
  const [renachError, setRenachError] = useState('');
  const [hasCar, setHasCar] = useState(user?.has_car ?? false);
  const [carModel, setCarModel] = useState(user?.car_model || '');
  const [carYear, setCarYear] = useState(user?.car_year ? String(user.car_year) : '');
  const [carColor, setCarColor] = useState(user?.car_color || '');
  const [carPlate, setCarPlate] = useState(user?.car_plate || '');

  const classEvents = useMemo(() =>
    events.filter(e => e.type === 'class' || e.type === 'CLASS'),
  [events]);

  const recentClasses = useMemo(() =>
    [...classEvents]
      .sort((a, b) => new Date(b.startDateTime) - new Date(a.startDateTime))
      .slice(0, 5),
  [classEvents]);

  const uniqueInstructors = useMemo(() => {
    const ids = new Set(classEvents.map(e => e.instructorId).filter(Boolean));
    return ids.size;
  }, [classEvents]);

  const totalHours = useMemo(() => {
    const mins = classEvents.reduce((s, e) => {
      if (!e.startDateTime || !e.endDateTime) return s;
      return s + (new Date(e.endDateTime) - new Date(e.startDateTime)) / 60000;
    }, 0);
    return Math.round(mins / 60);
  }, [classEvents]);

  const resolvedCoords = user?.coordinates ?? null;

  const handlePickImage = () => {
    if (Platform.OS === 'web') return;
    setShowPickerSheet(true);
  };

  const handleSave = async () => {
    const nameParts = name.trim().split(/\s+/).filter(Boolean);
    if (nameParts.length < 2) {
      Alert.alert('Nome inválido', 'Informe seu nome completo (nome e sobrenome).');
      return;
    }
    if (phone.replace(/\D/g, '').length < 10) {
      Alert.alert('Telefone inválido', 'Informe um número de telefone válido com DDD.');
      return;
    }
    const renachTrimmed = renach.trim().toUpperCase();
    if (renachTrimmed && !/^[A-Z]{2}\d{9}$/.test(renachTrimmed)) {
      setRenachError('Formato inválido. Use 2 letras + 9 dígitos (ex: SP123456789).');
      return;
    }
    setRenachError('');
    const address = buildAddress(addrRua, addrNumero, addrCidade, addrEstado);
    let coordinates = user?.coordinates ?? null;
    const addressChanged = address !== (user?.address || '');
    if (addressChanged && address.trim()) {
      try {
        const coords = await geocodeAddress(address);
        if (coords) coordinates = { latitude: coords.latitude, longitude: coords.longitude };
      } catch {
        // geocoding falhou — salva sem coordenadas
      }
    } else if (!address.trim()) {
      coordinates = null;
    }

    let newAvatarUrl = null;
    if (avatarUri && !avatarUri.startsWith('http')) {
      try {
        newAvatarUrl = await uploadProfilePhoto(user.id, avatarUri);
        try { await Image.prefetch(newAvatarUrl); } catch {}
      } catch {
        toast.error('Não foi possível enviar a foto. Outros dados serão salvos.');
      }
    }

    await updateProfile({
      name, phone, goal, address, coordinates, gender,
      renach: renachTrimmed || null,
      has_car: hasCar,
      car_model: hasCar ? (carModel.trim() || null) : null,
      car_year: hasCar && carYear.trim() ? parseInt(carYear.trim(), 10) : null,
      car_color: hasCar ? (carColor.trim() || null) : null,
      car_plate: hasCar ? (carPlate.trim().toUpperCase() || null) : null,
      ...(newAvatarUrl ? { avatar_url: newAvatarUrl } : {}),
    });
    if (newAvatarUrl) setAvatarUri(newAvatarUrl);
    setEditing(false);
    toast.success('Perfil atualizado com sucesso!');
  };

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

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ImagePickerSheet
        visible={showPickerSheet}
        onClose={() => setShowPickerSheet(false)}
        onUri={setAvatarUri}
      />
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Meu Perfil</Text>
        <TouchableOpacity
          style={styles.editBtn}
          onPress={() => editing ? handleSave() : setEditing(true)}
        >
          <Ionicons name={editing ? 'checkmark' : 'pencil-outline'} size={18} color={PRIMARY} />
          <Text style={styles.editBtnText}>{editing ? 'Salvar' : 'Editar'}</Text>
        </TouchableOpacity>
      </View>

      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
      <ScrollView style={styles.scroll} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        {/* Avatar + name */}
        <View style={styles.avatarSection}>
          <View style={styles.avatarWrapper}>
            <Avatar uri={avatarUri || user?.avatar_url} name={name} size={88} style={styles.avatarCircle} />
            {editing && (
              <TouchableOpacity style={styles.cameraBtn} onPress={handlePickImage}>
                <Ionicons name="camera" size={16} color="#FFF" />
              </TouchableOpacity>
            )}
          </View>
          {editing ? (
            <TextInput
              style={styles.nameInput}
              value={name}
              onChangeText={setName}
              textAlign="center"
            />
          ) : (
            <Text style={styles.avatarName}>{name}</Text>
          )}
          <View style={styles.roleBadge}>
            <Ionicons name="school-outline" size={12} color={PRIMARY} />
            <Text style={styles.roleText}>Aluno Abily</Text>
          </View>
        </View>

        {/* Stats */}
        <View style={styles.statsRow}>
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{classEvents.length}</Text>
            <Text style={styles.statLabel}>Aulas</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{totalHours}h</Text>
            <Text style={styles.statLabel}>Horas</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{uniqueInstructors}</Text>
            <Text style={styles.statLabel}>Instrutores</Text>
          </View>
        </View>

        {/* Personal info */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Informações Pessoais</Text>

          <InfoField
            icon="mail-outline"
            label="E-mail"
            value={email}
            editing={editing}
            onChange={setEmail}
            keyboardType="email-address"
          />
          <InfoField
            icon="call-outline"
            label="Telefone"
            value={phone}
            editing={editing}
            onChange={setPhone}
            keyboardType="phone-pad"
          />
          <InfoField
            icon="ribbon-outline"
            label="Objetivo"
            value={goal}
            editing={editing}
            onChange={setGoal}
          />

          {/* Gênero */}
          <View style={styles.infoField}>
            <View style={styles.infoFieldLabel}>
              <Ionicons name="person-outline" size={14} color="#9CA3AF" />
              <Text style={styles.infoFieldLabelText}>Gênero</Text>
            </View>
            {editing ? (
              <View style={{ flexDirection: 'row', gap: 8, marginTop: 4, flexWrap: 'wrap' }}>
                {[
                  { value: 'male',        label: 'Masculino' },
                  { value: 'female',      label: 'Feminino' },
                  { value: 'undisclosed', label: 'Não declarado' },
                ].map(opt => (
                  <TouchableOpacity
                    key={opt.value}
                    onPress={() => setGender(opt.value)}
                    style={{
                      paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20,
                      borderWidth: 1.5,
                      borderColor: gender === opt.value ? PRIMARY : '#E5E7EB',
                      backgroundColor: gender === opt.value ? PRIMARY : '#F9FAFB',
                    }}
                  >
                    <Text style={{ fontSize: 13, fontWeight: '600', color: gender === opt.value ? '#FFF' : '#374151' }}>
                      {opt.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            ) : (
              <Text style={styles.infoFieldValue}>
                {gender === 'male' ? 'Masculino' : gender === 'female' ? 'Feminino' : 'Não declarado'}
              </Text>
            )}
          </View>

          {/* RENACH */}
          <View style={styles.infoField}>
            <View style={styles.infoFieldLabel}>
              <Ionicons name="document-text-outline" size={14} color="#9CA3AF" />
              <Text style={styles.infoFieldLabelText}>RENACH</Text>
            </View>
            {editing ? (
              <>
                <TextInput
                  style={[styles.infoFieldInput, renachError ? { borderColor: '#EF4444' } : {}]}
                  value={renach}
                  onChangeText={v => { setRenach(v.toUpperCase()); setRenachError(''); }}
                  placeholder="Ex: SP123456789"
                  placeholderTextColor="#9CA3AF"
                  autoCapitalize="characters"
                  maxLength={11}
                />
                {renachError ? (
                  <Text style={{ fontSize: 12, color: '#EF4444', marginTop: 4 }}>{renachError}</Text>
                ) : (
                  <Text style={{ fontSize: 11, color: '#9CA3AF', marginTop: 4 }}>
                    Necessário para marcar aulas práticas. 2 letras (UF) + 9 dígitos.
                  </Text>
                )}
              </>
            ) : (
              <Text style={[styles.infoFieldValue, !renach && { color: '#9CA3AF', fontStyle: 'italic' }]}>
                {renach || 'Não informado'}
              </Text>
            )}
          </View>

          <AddressHint />
          <AddressFields
            editing={editing}
            rua={addrRua} setRua={setAddrRua}
            numero={addrNumero} setNumero={setAddrNumero}
            cidade={addrCidade} setCidade={setAddrCidade}
            estado={addrEstado} setEstado={setAddrEstado}
          />
        </View>

        {/* Location card */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Minha localização</Text>

          {resolvedCoords ? (
            <View style={styles.mapPreview}>
              <LeafletMapView
                center={{ lat: resolvedCoords.latitude, lng: resolvedCoords.longitude }}
                zoom={15}
                markers={[{
                  id: 'student',
                  latitude: resolvedCoords.latitude,
                  longitude: resolvedCoords.longitude,
                  label: name.split(' ')[0],
                  color: PRIMARY,
                  type: 'self',
                }]}
              />
            </View>
          ) : (
            <View style={styles.noLocationBox}>
              <Ionicons name="location-off-outline" size={36} color="#D1D5DB" />
              <Text style={styles.noLocationText}>Sem localização cadastrada</Text>
              <Text style={styles.noLocationSub}>
                {editing
                  ? 'Preencha o endereço acima para ver sua localização'
                  : 'Edite o perfil e informe seu endereço'}
              </Text>
            </View>
          )}

          {/* Badge de status — só no modo visualização */}
          {!editing && resolvedCoords && (
            <View style={styles.locStatusBadge}>
              <Ionicons name="checkmark-circle" size={14} color="#16A34A" />
              <Text style={styles.locStatusText}>Localização visível para instrutores</Text>
            </View>
          )}
        </View>

        {/* Vehicle */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Veículo</Text>

          <View style={styles.infoField}>
            <View style={styles.infoFieldLabel}>
              <Ionicons name="car-outline" size={14} color="#9CA3AF" />
              <Text style={styles.infoFieldLabelText}>Possui carro próprio?</Text>
            </View>
            {editing ? (
              <View style={{ flexDirection: 'row', gap: 10, marginTop: 4 }}>
                {[{ value: false, label: 'Não' }, { value: true, label: 'Sim' }].map(opt => (
                  <TouchableOpacity
                    key={String(opt.value)}
                    onPress={() => setHasCar(opt.value)}
                    style={{
                      paddingHorizontal: 20, paddingVertical: 8, borderRadius: 20,
                      borderWidth: 1.5,
                      borderColor: hasCar === opt.value ? PRIMARY : '#E5E7EB',
                      backgroundColor: hasCar === opt.value ? PRIMARY : '#F9FAFB',
                    }}
                  >
                    <Text style={{ fontSize: 14, fontWeight: '600', color: hasCar === opt.value ? '#FFF' : '#374151' }}>
                      {opt.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            ) : (
              <Text style={styles.infoFieldValue}>{hasCar ? 'Sim' : 'Não'}</Text>
            )}
          </View>

          {(hasCar || (!editing && (carModel || carYear))) && (
            <>
              <View style={styles.infoField}>
                <View style={styles.infoFieldLabel}>
                  <Ionicons name="car-sport-outline" size={14} color="#9CA3AF" />
                  <Text style={styles.infoFieldLabelText}>Marca e modelo</Text>
                </View>
                {editing ? (
                  <TextInput
                    style={styles.infoFieldInput}
                    value={carModel}
                    onChangeText={setCarModel}
                    autoCapitalize="words"
                    placeholder="Ex: Honda Civic"
                    placeholderTextColor="#9CA3AF"
                  />
                ) : (
                  <Text style={[styles.infoFieldValue, !carModel && { color: '#9CA3AF', fontStyle: 'italic' }]}>
                    {carModel || 'Não informado'}
                  </Text>
                )}
              </View>

              <View style={styles.infoField}>
                <View style={styles.infoFieldLabel}>
                  <Ionicons name="calendar-outline" size={14} color="#9CA3AF" />
                  <Text style={styles.infoFieldLabelText}>Ano</Text>
                </View>
                {editing ? (
                  <TextInput
                    style={styles.infoFieldInput}
                    value={carYear}
                    onChangeText={setCarYear}
                    keyboardType="number-pad"
                    maxLength={4}
                    placeholder="Ex: 2022"
                    placeholderTextColor="#9CA3AF"
                  />
                ) : (
                  <Text style={[styles.infoFieldValue, !carYear && { color: '#9CA3AF', fontStyle: 'italic' }]}>
                    {carYear || 'Não informado'}
                  </Text>
                )}
              </View>

              <View style={styles.infoField}>
                <View style={styles.infoFieldLabel}>
                  <Ionicons name="color-palette-outline" size={14} color="#9CA3AF" />
                  <Text style={styles.infoFieldLabelText}>Cor</Text>
                </View>
                {editing ? (
                  <TextInput
                    style={styles.infoFieldInput}
                    value={carColor}
                    onChangeText={setCarColor}
                    autoCapitalize="words"
                    placeholder="Ex: Branco"
                    placeholderTextColor="#9CA3AF"
                  />
                ) : (
                  <Text style={[styles.infoFieldValue, !carColor && { color: '#9CA3AF', fontStyle: 'italic' }]}>
                    {carColor || 'Não informado'}
                  </Text>
                )}
              </View>

              <View style={[styles.infoField, { borderBottomWidth: 0 }]}>
                <View style={styles.infoFieldLabel}>
                  <Ionicons name="reader-outline" size={14} color="#9CA3AF" />
                  <Text style={styles.infoFieldLabelText}>Placa</Text>
                </View>
                {editing ? (
                  <TextInput
                    style={styles.infoFieldInput}
                    value={carPlate}
                    onChangeText={v => setCarPlate(v.toUpperCase())}
                    autoCapitalize="characters"
                    maxLength={8}
                    placeholder="Ex: ABC1D23"
                    placeholderTextColor="#9CA3AF"
                  />
                ) : (
                  <Text style={[styles.infoFieldValue, !carPlate && { color: '#9CA3AF', fontStyle: 'italic' }]}>
                    {carPlate || 'Não informado'}
                  </Text>
                )}
              </View>
            </>
          )}
        </View>

        {/* Recent classes */}
        {recentClasses.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Aulas Recentes</Text>
            {recentClasses.map(cls => {
              const cfg = statusMap[cls.status] || { label: cls.status, color: '#6B7280' };
              const dateStr = new Date(cls.startDateTime).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' });
              return (
                <View key={cls.id} style={styles.classRow}>
                  <View style={[styles.classIcon, { backgroundColor: `${PRIMARY}20` }]}>
                    <Ionicons name="car-outline" size={18} color={PRIMARY} />
                  </View>
                  <View style={styles.classInfo}>
                    <Text style={styles.classType}>{cls.title || 'Aula'}</Text>
                    <Text style={styles.classInstructor}>{dateStr}</Text>
                  </View>
                  <View style={[styles.classStatus, { backgroundColor: `${cfg.color}20` }]}>
                    <Text style={[styles.classStatusText, { color: cfg.color }]}>{cfg.label}</Text>
                  </View>
                </View>
              );
            })}
          </View>
        )}

        {/* ── Categorias CNH ── */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Categorias CNH</Text>
          <Text style={{ fontSize: 12, color: '#6B7280', marginBottom: 12 }}>
            Categorias que você está cursando ou já obteve. Adicione uma nova para buscar instrutores de outra categoria.
          </Text>

          {goalCategories.length === 0 && (
            <Text style={{ fontSize: 13, color: '#9CA3AF', fontStyle: 'italic', marginBottom: 10 }}>
              Nenhuma categoria cadastrada.
            </Text>
          )}

          {goalCategories.map(gc => (
            <View key={gc.category} style={styles.catRow}>
              <View style={[styles.catBadge, gc.status === 'obtained' ? styles.catBadgeObtained : styles.catBadgeStudying]}>
                <Text style={styles.catBadgeLetter}>{gc.category}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.catLabel}>Categoria {gc.category}</Text>
                <Text style={styles.catStatus}>
                  {gc.status === 'obtained' ? 'Habilitação obtida' : 'Cursando'}
                </Text>
              </View>
              <View style={styles.catActions}>
                {gc.status === 'studying' && (
                  <TouchableOpacity
                    style={styles.catActionBtn}
                    onPress={() =>
                      Alert.alert(
                        'Marcar como obtida?',
                        `Confirma que você já tirou a habilitação categoria ${gc.category}?`,
                        [
                          { text: 'Cancelar', style: 'cancel' },
                          { text: 'Confirmar', onPress: () => markCategoryObtained(gc.category).catch(() => toast.error('Erro ao atualizar.')) },
                        ],
                      )
                    }
                  >
                    <Ionicons name="checkmark-circle-outline" size={20} color="#16A34A" />
                  </TouchableOpacity>
                )}
                <TouchableOpacity
                  style={styles.catActionBtn}
                  onPress={() =>
                    Alert.alert(
                      'Remover categoria?',
                      `Deseja remover a categoria ${gc.category} da sua lista?`,
                      [
                        { text: 'Cancelar', style: 'cancel' },
                        { text: 'Remover', style: 'destructive', onPress: () => removeGoalCategory(gc.category).catch(() => toast.error('Erro ao remover.')) },
                      ],
                    )
                  }
                >
                  <Ionicons name="trash-outline" size={18} color="#EF4444" />
                </TouchableOpacity>
              </View>
            </View>
          ))}

          {/* Adicionar nova categoria */}
          {['A', 'B'].filter(c => !goalCategories.some(gc => gc.category === c)).length > 0 && (
            <View style={styles.addCatRow}>
              {['A', 'B']
                .filter(c => !goalCategories.some(gc => gc.category === c))
                .map(c => (
                  <TouchableOpacity
                    key={c}
                    style={styles.addCatChip}
                    onPress={() =>
                      Alert.alert(
                        `Adicionar categoria ${c}?`,
                        `Deseja adicionar a categoria ${c} às suas metas de habilitação?`,
                        [
                          { text: 'Cancelar', style: 'cancel' },
                          { text: 'Adicionar', onPress: () => addGoalCategory(c).catch(() => toast.error('Erro ao adicionar.')) },
                        ],
                      )
                    }
                    activeOpacity={0.75}
                  >
                    <Ionicons name="add-circle-outline" size={14} color={PRIMARY} />
                    <Text style={styles.addCatText}>+ Cat. {c}</Text>
                  </TouchableOpacity>
                ))}
            </View>
          )}
        </View>

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

        <View style={{ height: 40 }} />
      </ScrollView>
      </KeyboardAvoidingView>

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
            <Text style={styles.modalMessage}>Deseja sair da sua conta?</Text>
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

// ─── Helpers de endereço ────────────────────────────────────────────────────

/** Tenta parsear "Rua X, 123 - Cidade/UF" de volta para os campos. */
function parseStoredAddress(addr) {
  if (!addr) return { rua: '', numero: '', cidade: '', estado: '' };
  // Formato salvo: "Rua X, 123 - Cidade/UF"
  const match = addr.match(/^(.+?),\s*([^-]+?)\s*-\s*(.+?)\/([A-Z]{2})$/);
  if (match) {
    return {
      rua: match[1].trim(),
      numero: match[2].trim(),
      cidade: match[3].trim(),
      estado: match[4].trim(),
    };
  }
  // Fallback: endereço legado, coloca tudo na rua
  return { rua: addr, numero: '', cidade: '', estado: '' };
}

/** Monta a string completa a partir dos campos estruturados. */
function buildAddress(rua, numero, cidade, estado) {
  const street = [rua.trim(), numero.trim()].filter(Boolean).join(', ');
  const location = [cidade.trim(), estado.trim().toUpperCase()].filter(Boolean).join('/');
  return [street, location].filter(Boolean).join(' - ');
}

// ─── Componente de campos de endereço ────────────────────────────────────────

function AddressFields({ editing, rua, setRua, numero, setNumero, cidade, setCidade, estado, setEstado }) {
  const [query, setQuery] = useState('');
  const [suggestions, setSuggestions] = useState([]);
  const [searching, setSearching] = useState(false);
  const timer = useRef(null);

  useEffect(() => () => clearTimeout(timer.current), []);

  const formatCep = (text) => {
    const d = text.replace(/\D/g, '').slice(0, 8);
    return d.length > 5 ? `${d.slice(0, 5)}-${d.slice(5)}` : d;
  };

  const onQueryChange = (text) => {
    clearTimeout(timer.current);
    setSuggestions([]);

    const digits = text.replace(/\D/g, '');

    // CEP completo (8 dígitos) → ViaCEP
    if (digits.length === 8 && /^\d{5}-?\d{3}$/.test(text.trim())) {
      setQuery(formatCep(text));
      setSearching(true);
      searchByCep(digits)
        .then(data => {
          if (data) {
            if (data.logradouro) setRua(data.logradouro);
            if (data.localidade) setCidade(data.localidade);
            if (data.uf)         setEstado(data.uf);
            setQuery('');
            toast.success('Endereço preenchido pelo CEP!');
          } else {
            toast.error('CEP não encontrado.');
          }
        })
        .catch(() => toast.error('Erro ao buscar CEP.'))
        .finally(() => setSearching(false));
      return;
    }

    // Digitando CEP incompleto → apenas formata, sem buscar
    if (/^\d{1,5}-?\d{0,3}$/.test(text.trim())) {
      setQuery(formatCep(text));
      return;
    }

    // Busca por nome de rua — passa cidade como contexto se já preenchida
    setQuery(text);
    if (text.length < 3) return;
    timer.current = setTimeout(async () => {
      setSearching(true);
      try {
        const results = await searchAddresses(text, cidade);
        setSuggestions(results.slice(0, 5));
      } catch {
        setSuggestions([]);
      } finally {
        setSearching(false);
      }
    }, 600);
  };

  const parseSuggestion = (item) => {
    const addr = item.address || {};
    const road = addr.road || addr.pedestrian || addr.footway || addr.path || '';
    const house = addr.house_number || '';
    const city = addr.city || addr.town || addr.village || addr.municipality || '';
    const isoCode = addr['ISO3166-2-lvl4'] || '';
    const st = isoCode.includes('-') ? isoCode.split('-')[1] : (addr.state || '');
    return { road, house, city, st: st.toUpperCase().slice(0, 2) };
  };

  const formatSuggestionLabel = (item) => {
    const { road, house, city, st } = parseSuggestion(item);
    return [road + (house ? `, ${house}` : ''), city, st].filter(Boolean).join(' — ');
  };

  const onSelect = (item) => {
    const { road, house, city, st } = parseSuggestion(item);
    if (road) setRua(road);
    if (house) setNumero(house);
    if (city) setCidade(city);
    if (st) setEstado(st);
    setQuery('');
    setSuggestions([]);
  };

  if (!editing) {
    return (
      <>
        <InfoField icon="location-outline" label="Rua / Avenida" value={rua} editing={false} />
        <InfoField icon="home-outline" label="Número" value={numero} editing={false} />
        <InfoField icon="business-outline" label="Cidade" value={cidade} editing={false} />
        <InfoField icon="map-outline" label="Estado (UF)" value={estado} editing={false} last />
      </>
    );
  }

  return (
    <>
      {/* Busca com autocomplete */}
      <View style={styles.infoField}>
        <View style={styles.infoFieldLabel}>
          <Ionicons name="search-outline" size={14} color="#9CA3AF" />
          <Text style={styles.infoFieldLabelText}>Buscar endereço</Text>
        </View>
        <View style={styles.addrSearchRow}>
          <TextInput
            style={[styles.infoFieldInput, { flex: 1, marginBottom: 0 }]}
            value={query}
            onChangeText={onQueryChange}
            placeholder="Buscar por CEP (37701-000) ou rua"
            placeholderTextColor="#9CA3AF"
            autoCapitalize="words"
            returnKeyType="search"
          />
          {searching && <ActivityIndicator size="small" color="#1D4ED8" style={{ marginLeft: 8 }} />}
        </View>
        {suggestions.length > 0 && (
          <View style={styles.addrSuggestions}>
            {suggestions.map((s, i) => (
              <TouchableOpacity
                key={s.place_id ?? i}
                style={[styles.addrSuggestionItem, i < suggestions.length - 1 && styles.addrSuggestionDivider]}
                onPress={() => onSelect(s)}
                activeOpacity={0.7}
              >
                <Ionicons name="location-outline" size={13} color="#6B7280" style={{ marginTop: 1 }} />
                <Text style={styles.addrSuggestionText} numberOfLines={2}>
                  {formatSuggestionLabel(s) || s.display_name}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        )}
      </View>

      {/* Rua */}
      <View style={styles.infoField}>
        <View style={styles.infoFieldLabel}>
          <Ionicons name="location-outline" size={14} color="#9CA3AF" />
          <Text style={styles.infoFieldLabelText}>Rua / Avenida</Text>
        </View>
        <TextInput
          style={styles.infoFieldInput}
          value={rua}
          onChangeText={setRua}
          placeholder="Ex: Rua das Flores"
          placeholderTextColor="#9CA3AF"
          autoCapitalize="words"
        />
      </View>

      {/* Número + UF lado a lado */}
      <View style={styles.infoField}>
        <View style={{ flexDirection: 'row', gap: 20 }}>
          <View style={{ flex: 2 }}>
            <View style={styles.infoFieldLabel}>
              <Ionicons name="home-outline" size={14} color="#9CA3AF" />
              <Text style={styles.infoFieldLabelText}>Número</Text>
            </View>
            <TextInput
              style={styles.infoFieldInput}
              value={numero}
              onChangeText={setNumero}
              placeholder="123"
              placeholderTextColor="#9CA3AF"
              keyboardType="default"
            />
          </View>
          <View style={{ flex: 1 }}>
            <View style={styles.infoFieldLabel}>
              <Ionicons name="map-outline" size={14} color="#9CA3AF" />
              <Text style={styles.infoFieldLabelText}>UF</Text>
            </View>
            <TextInput
              style={[styles.infoFieldInput, { textTransform: 'uppercase' }]}
              value={estado}
              onChangeText={(v) => setEstado(v.toUpperCase().replace(/[^A-Z]/g, ''))}
              placeholder="SP"
              placeholderTextColor="#9CA3AF"
              maxLength={2}
              autoCapitalize="characters"
            />
          </View>
        </View>
      </View>

      {/* Cidade */}
      <View style={[styles.infoField, { borderBottomWidth: 0 }]}>
        <View style={styles.infoFieldLabel}>
          <Ionicons name="business-outline" size={14} color="#9CA3AF" />
          <Text style={styles.infoFieldLabelText}>Cidade</Text>
        </View>
        <TextInput
          style={styles.infoFieldInput}
          value={cidade}
          onChangeText={setCidade}
          placeholder="Ex: São Paulo"
          placeholderTextColor="#9CA3AF"
          autoCapitalize="words"
        />
      </View>
    </>
  );
}

// ─────────────────────────────────────────────────────────────────────────────

function AddressHint() {
  return (
    <View style={styles.addressHint}>
      <Ionicons name="location-outline" size={16} color="#1D4ED8" style={{ marginTop: 1 }} />
      <View style={styles.addressHintBody}>
        <Text style={styles.addressHintTitle}>Por que informar meu endereço?</Text>
        <Text style={styles.addressHintText}>
          Seu endereço permite que os instrutores calculem o tempo de deslocamento até você e evitem conflitos de horário entre aulas.
        </Text>
      </View>
    </View>
  );
}

function InfoField({ icon, label, value, editing, onChange, keyboardType, placeholder, last }) {
  return (
    <View style={[styles.infoField, last && { borderBottomWidth: 0 }]}>
      <View style={styles.infoFieldLabel}>
        <Ionicons name={icon} size={14} color="#9CA3AF" />
        <Text style={styles.infoFieldLabelText}>{label}</Text>
      </View>
      {editing ? (
        <TextInput
          style={styles.infoFieldInput}
          value={value}
          onChangeText={onChange}
          keyboardType={keyboardType}
          autoCapitalize="none"
          placeholder={placeholder}
          placeholderTextColor="#9CA3AF"
        />
      ) : (
        <Text style={[styles.infoFieldValue, !value && { color: '#9CA3AF', fontStyle: 'italic' }]}>
          {value || 'Não informado'}
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#F9FAFB' },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingVertical: 14,
    backgroundColor: '#FFF', borderBottomWidth: 1, borderBottomColor: '#F3F4F6',
  },
  headerTitle: { fontSize: 22, fontWeight: '800', color: '#111827' },
  editBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    backgroundColor: `${PRIMARY}15`, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8,
  },
  editBtnText: { fontSize: 13, fontWeight: '700', color: PRIMARY },

  scroll: { flex: 1 },

  avatarSection: { alignItems: 'center', paddingVertical: 28, backgroundColor: '#FFF', borderBottomWidth: 1, borderBottomColor: '#F3F4F6' },
  avatarWrapper: { position: 'relative', marginBottom: 12 },
  avatarCircle: { ...makeShadow(PRIMARY, 4, 0.25, 10, 6) },
  cameraBtn: {
    position: 'absolute', bottom: 0, right: 0,
    width: 28, height: 28, borderRadius: 14,
    backgroundColor: PRIMARY, alignItems: 'center', justifyContent: 'center',
    borderWidth: 2, borderColor: '#FFF',
  },
  avatarName: { fontSize: 22, fontWeight: '800', color: '#111827', marginBottom: 6 },
  nameInput: {
    fontSize: 22, fontWeight: '800', color: '#111827', marginBottom: 6,
    borderBottomWidth: 2, borderBottomColor: PRIMARY, paddingBottom: 4,
    alignSelf: 'center', textAlign: 'center', minWidth: 120, maxWidth: 240,
  },
  roleBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    backgroundColor: `${PRIMARY}15`, borderRadius: 12, paddingHorizontal: 10, paddingVertical: 4,
  },
  roleText: { fontSize: 12, fontWeight: '700', color: PRIMARY },

  statsRow: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#FFF', marginHorizontal: 16, marginTop: 14, borderRadius: 16, padding: 16,
    ...makeShadow('#000', 2, 0.06, 6, 3),
  },
  statItem: { flex: 1, alignItems: 'center' },
  statValue: { fontSize: 20, fontWeight: '800', color: PRIMARY },
  statLabel: { fontSize: 11, color: '#6B7280', marginTop: 3 },
  statDivider: { width: 1, height: 32, backgroundColor: '#E5E7EB' },

  section: {
    backgroundColor: '#FFF', marginHorizontal: 16, marginTop: 14, borderRadius: 16, padding: 16,
    ...makeShadow('#000', 2, 0.06, 6, 3),
  },
  sectionTitle: { fontSize: 16, fontWeight: '800', color: '#111827', marginBottom: 12 },

  achievementsRow: { flexDirection: 'row', gap: 8 },
  achievementItem: { flex: 1, alignItems: 'center', borderRadius: 12, paddingVertical: 12, gap: 5 },
  achievementLabel: { fontSize: 11, fontWeight: '700', textAlign: 'center' },

  addressHint: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 10,
    backgroundColor: '#EFF6FF', borderRadius: 12, padding: 12,
    marginBottom: 4, borderWidth: 1, borderColor: '#BFDBFE',
  },
  addressHintBody: { flex: 1 },
  addressHintTitle: { fontSize: 12, fontWeight: '700', color: '#1D4ED8', marginBottom: 3 },
  addressHintText: { fontSize: 12, color: '#3B82F6', lineHeight: 17 },

  infoField: { borderBottomWidth: 1, borderBottomColor: '#F3F4F6', paddingVertical: 12 },
  infoFieldLabel: { flexDirection: 'row', alignItems: 'center', gap: 5, marginBottom: 4 },
  infoFieldLabelText: { fontSize: 11, fontWeight: '600', color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: 0.5 },
  infoFieldValue: { fontSize: 15, color: '#111827', fontWeight: '500' },
  infoFieldInput: {
    fontSize: 15, color: '#111827', fontWeight: '500',
    borderBottomWidth: 1.5, borderBottomColor: PRIMARY, paddingBottom: 4,
  },

  classRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#F9FAFB' },
  classIcon: { width: 38, height: 38, borderRadius: 10, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  classInfo: { flex: 1 },
  classType: { fontSize: 14, fontWeight: '700', color: '#111827' },
  classInstructor: { fontSize: 12, color: '#9CA3AF', marginTop: 2 },
  classStatus: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
  classStatusText: { fontSize: 11, fontWeight: '700' },

  supportBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    marginHorizontal: 16, marginTop: 14,
    borderWidth: 1.5, borderColor: '#E2E8F0', borderRadius: 14, paddingVertical: 14,
    backgroundColor: '#F8FAFC',
  },
  supportText: { fontSize: 15, fontWeight: '700', color: '#64748B' },

  logoutBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 10, justifyContent: 'center',
    marginHorizontal: 16, marginTop: 10,
    backgroundColor: '#FFF', borderRadius: 14, paddingVertical: 14,
    borderWidth: 1.5, borderColor: '#FCA5A5',
    ...makeShadow('#000', 1, 0.05, 4, 2),
  },
  logoutText: { fontSize: 15, fontWeight: '700', color: '#EF4444' },

  // ── Categorias CNH ──
  catRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#F1F5F9',
  },
  catBadge: {
    width: 36, height: 36, borderRadius: 10,
    alignItems: 'center', justifyContent: 'center',
  },
  catBadgeStudying: { backgroundColor: '#DBEAFE' },
  catBadgeObtained: { backgroundColor: '#DCFCE7' },
  catBadgeLetter: { fontSize: 16, fontWeight: '800', color: '#1D4ED8' },
  catLabel: { fontSize: 14, fontWeight: '700', color: '#111827' },
  catStatus: { fontSize: 12, color: '#6B7280', marginTop: 1 },
  catActions: { flexDirection: 'row', gap: 6 },
  catActionBtn: { padding: 4 },
  addCatRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 12 },
  addCatChip: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingHorizontal: 14, paddingVertical: 8,
    borderRadius: 20, borderWidth: 1.5, borderColor: '#BFDBFE',
    backgroundColor: '#EFF6FF',
  },
  addCatText: { fontSize: 13, fontWeight: '600', color: PRIMARY },

  changePasswordBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 10, justifyContent: 'center',
    marginHorizontal: 16, marginTop: 14,
    backgroundColor: '#EFF6FF', borderRadius: 14, paddingVertical: 14,
    borderWidth: 1.5, borderColor: '#BFDBFE',
    ...makeShadow('#000', 1, 0.05, 4, 2),
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

  // ─── Autocomplete de endereço ────────────────────────────────────────────────
  addrSearchRow: { flexDirection: 'row', alignItems: 'center' },
  addrSuggestions: {
    marginTop: 6, borderRadius: 10, borderWidth: 1, borderColor: '#E5E7EB',
    backgroundColor: '#FFF', overflow: 'hidden',
  },
  addrSuggestionItem: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 8,
    paddingHorizontal: 12, paddingVertical: 10,
  },
  addrSuggestionDivider: { borderBottomWidth: 1, borderBottomColor: '#F3F4F6' },
  addrSuggestionText: { flex: 1, fontSize: 13, color: '#374151', lineHeight: 18 },

  // ─── Localização ────────────────────────────────────────────────────────────
  mapPreview: { height: 180, borderRadius: 12, overflow: 'hidden', marginBottom: 12 },
  noLocationBox: {
    height: 120, alignItems: 'center', justifyContent: 'center', gap: 6,
    backgroundColor: '#F9FAFB', borderRadius: 12, borderWidth: 1, borderColor: '#E5E7EB',
    marginBottom: 12, paddingHorizontal: 20,
  },
  noLocationText: { fontSize: 13, fontWeight: '700', color: '#9CA3AF' },
  noLocationSub: { fontSize: 12, color: '#9CA3AF', textAlign: 'center' },
  locStatusBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 8,
    backgroundColor: '#F0FDF4', borderRadius: 10,
    paddingHorizontal: 12, paddingVertical: 8,
    borderWidth: 1, borderColor: '#BBF7D0',
  },
  locStatusText: { fontSize: 12, fontWeight: '600', color: '#16A34A' },
});
