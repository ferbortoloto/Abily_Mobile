import React, { useState, useRef } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  KeyboardAvoidingView, Platform, ActivityIndicator,
  ScrollView, Alert, Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useAuth } from '../../hooks/useAuth';
import { mapAuthError } from '../../utils/authErrors';

const CATEGORY_OPTIONS = ['A', 'B', 'A+B'];

function formatPhone(value) {
  const digits = value.replace(/\D/g, '').slice(0, 11);
  if (digits.length <= 2) return `(${digits}`;
  if (digits.length <= 7) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
  if (digits.length <= 11)
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
  return value;
}

function formatCPF(value) {
  const digits = value.replace(/\D/g, '').slice(0, 11);
  if (digits.length <= 3) return digits;
  if (digits.length <= 6) return `${digits.slice(0, 3)}.${digits.slice(3)}`;
  if (digits.length <= 9) return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6)}`;
  return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6, 9)}-${digits.slice(9)}`;
}

function formatDate(value) {
  const digits = value.replace(/\D/g, '').slice(0, 8);
  if (digits.length <= 2) return digits;
  if (digits.length <= 4) return `${digits.slice(0, 2)}/${digits.slice(2)}`;
  return `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4)}`;
}

function SectionHeader({ icon, title }) {
  return (
    <View style={styles.sectionHeader}>
      <View style={styles.sectionIconBox}>
        <Ionicons name={icon} size={16} color="#1D4ED8" />
      </View>
      <Text style={styles.sectionTitle}>{title}</Text>
    </View>
  );
}

function Field({ label, icon, optional, error, children }) {
  return (
    <View style={styles.inputGroup}>
      <View style={styles.labelRow}>
        <Text style={styles.label}>{label}</Text>
        {optional && <Text style={styles.optionalTag}>opcional</Text>}
      </View>
      <View style={[styles.inputWrapper, error && styles.inputWrapperError]}>
        {icon && (
          <Ionicons
            name={icon}
            size={18}
            color={error ? '#EF4444' : '#9CA3AF'}
            style={styles.inputIcon}
          />
        )}
        {children}
      </View>
      {error ? <Text style={styles.errorText}>{error}</Text> : null}
    </View>
  );
}

export default function RegisterScreen({ navigation }) {
  const { register } = useAuth();

  // Role
  const [role, setRole] = useState('user');

  // Avatar
  const [photoUri, setPhotoUri] = useState(null);
  const fileInputRef = useRef(null);

  // Dados pessoais
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [cpf, setCpf] = useState('');
  const [birthdate, setBirthdate] = useState('');

  // Segurança
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  // Instrutor
  const [licenseCategory, setLicenseCategory] = useState('B');
  const [instructorRegNum, setInstructorRegNum] = useState('');
  const [carModel, setCarModel] = useState('');
  const [carOptions, setCarOptions] = useState('instructor');
  const [pricePerHour, setPricePerHour] = useState('');
  const [bio, setBio] = useState('');

  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState({});

  const clearErr = (field) =>
    setErrors(prev => { const next = { ...prev }; delete next[field]; return next; });

  // Valida um campo específico ao sair dele (onBlur)
  const blurField = (field) => {
    const errs = validateAll();
    setErrors(prev => {
      const next = { ...prev };
      if (errs[field]) next[field] = errs[field];
      else delete next[field];
      return next;
    });
  };

  // ── Image picker ──
  const pickImageNative = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permissão necessária', 'Precisamos de acesso à galeria para selecionar sua foto.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.7,
    });
    if (!result.canceled && result.assets?.[0]?.uri) {
      setPhotoUri(result.assets[0].uri);
    }
  };

  const handlePickImage = () => {
    if (Platform.OS === 'web') {
      fileInputRef.current?.click();
    } else {
      pickImageNative();
    }
  };

  const handleWebFileChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const url = URL.createObjectURL(file);
    setPhotoUri(url);
  };

  // ── Initials avatar ──
  const initials = name.trim()
    ? name.trim().split(' ').slice(0, 2).map(w => w[0]).join('').toUpperCase()
    : '?';

  // ── Validation ──
  const validateAll = () => {
    const errs = {};
    if (!name.trim())
      errs.name = 'Informe seu nome completo.';
    if (!email.trim() || !email.includes('@'))
      errs.email = 'Informe um e-mail válido.';
    if (!phone.trim() || phone.replace(/\D/g, '').length < 10)
      errs.phone = 'Informe um telefone válido.';
    if (!cpf.trim() || cpf.replace(/\D/g, '').length !== 11)
      errs.cpf = 'CPF inválido — informe os 11 dígitos.';
    if (!birthdate.trim() || birthdate.replace(/\D/g, '').length !== 8)
      errs.birthdate = 'Use o formato DD/MM/AAAA.';
    if (!password || password.length < 8)
      errs.password = 'Mínimo 8 caracteres.';
    else if (!/[A-Z]/.test(password))
      errs.password = 'Inclua ao menos uma letra maiúscula.';
    else if (!/[0-9]/.test(password))
      errs.password = 'Inclua ao menos um número.';
    if (password !== confirmPassword)
      errs.confirmPassword = 'As senhas não coincidem.';
    if (role === 'instructor') {
      if (!instructorRegNum.trim())
        errs.instructorRegNum = 'Informe o número de registro.';
      if (!pricePerHour.trim() || isNaN(parseFloat(pricePerHour)))
        errs.pricePerHour = 'Informe um valor válido (ex: 80).';
    }
    return errs;
  };

  const handleRegister = async () => {
    const errs = validateAll();
    if (Object.keys(errs).length > 0) {
      setErrors(errs);
      return;
    }
    setErrors({});
    setLoading(true);
    try {
      const trimmedEmail = email.trim().toLowerCase();
      const result = await register({
        name: name.trim(),
        email: trimmedEmail,
        phone,
        cpf,
        birthdate,
        password,
        role,
        photoUri,
        licenseCategory,
        instructorRegNum: instructorRegNum.trim(),
        carModel: carModel.trim(),
        carOptions,
        pricePerHour: parseFloat(pricePerHour) || 80,
        bio: bio.trim(),
      });
      if (result.emailConfirmationRequired) {
        navigation.navigate('VerifyOTP', { email: trimmedEmail });
      }
      // Se não requer confirmação, AuthContext seta isAuthenticated e o
      // AppNavigator redireciona automaticamente.
    } catch (err) {
      console.error('[RegisterScreen] signUp error:', err);
      Alert.alert('Erro ao cadastrar', mapAuthError(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <LinearGradient colors={['#0F172A', '#1E3A8A', '#1D4ED8']} style={styles.gradient}>
      <SafeAreaView style={styles.safe}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.kav}
        >
          <ScrollView
            contentContainerStyle={styles.scroll}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            {/* Header */}
            <View style={styles.header}>
              <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
                <Ionicons name="arrow-back" size={22} color="#FFF" />
              </TouchableOpacity>
              <View style={styles.brand}>
                <View style={styles.logoCircle}>
                  <Ionicons name="car-sport" size={32} color="#1D4ED8" />
                </View>
                <Text style={styles.brandName}>CartaOn</Text>
                <Text style={styles.brandSub}>Criar nova conta</Text>
              </View>
            </View>

            {/* Card */}
            <View style={styles.card}>

              {/* Role selector */}
              <Text style={styles.cardTitle}>Quem é você?</Text>
              <View style={styles.roleRow}>
                <TouchableOpacity
                  style={[styles.roleBtn, role === 'user' && styles.roleBtnActive]}
                  onPress={() => setRole('user')}
                  activeOpacity={0.85}
                >
                  <Ionicons name="person-outline" size={20}
                    color={role === 'user' ? '#FFF' : '#6B7280'} />
                  <Text style={[styles.roleBtnText, role === 'user' && styles.roleBtnTextActive]}>
                    Sou Aluno
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.roleBtn, role === 'instructor' && styles.roleBtnActive]}
                  onPress={() => setRole('instructor')}
                  activeOpacity={0.85}
                >
                  <Ionicons name="school-outline" size={20}
                    color={role === 'instructor' ? '#FFF' : '#6B7280'} />
                  <Text style={[styles.roleBtnText, role === 'instructor' && styles.roleBtnTextActive]}>
                    Sou Instrutor
                  </Text>
                </TouchableOpacity>
              </View>

              {/* ── Foto de perfil ── */}
              <View style={styles.avatarSection}>
                <TouchableOpacity style={styles.avatarBtn} onPress={handlePickImage} activeOpacity={0.8}>
                  {photoUri ? (
                    <Image source={{ uri: photoUri }} style={styles.avatarImg} />
                  ) : (
                    <View style={styles.avatarPlaceholder}>
                      <Text style={styles.avatarInitials}>{initials}</Text>
                    </View>
                  )}
                  <View style={styles.avatarBadge}>
                    <Ionicons name="camera" size={14} color="#FFF" />
                  </View>
                </TouchableOpacity>
                <Text style={styles.avatarHint}>Toque para adicionar foto</Text>
                {/* Web file input (hidden) */}
                {Platform.OS === 'web' && (
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    style={{ display: 'none' }}
                    onChange={handleWebFileChange}
                  />
                )}
              </View>

              {/* ── Dados Pessoais ── */}
              <SectionHeader icon="person-circle-outline" title="Dados Pessoais" />

              <Field label="Nome completo" icon="person-outline" error={errors.name}>
                <TextInput
                  style={styles.input}
                  placeholder="Seu nome completo"
                  placeholderTextColor="#9CA3AF"
                  value={name}
                  onChangeText={(v) => { setName(v); clearErr('name'); }}
                  onBlur={() => blurField('name')}
                  autoCapitalize="words"
                />
              </Field>

              <Field label="E-mail" icon="mail-outline" error={errors.email}>
                <TextInput
                  style={styles.input}
                  placeholder="seu@email.com"
                  placeholderTextColor="#9CA3AF"
                  value={email}
                  onChangeText={(v) => { setEmail(v); clearErr('email'); }}
                  onBlur={() => blurField('email')}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoCorrect={false}
                />
              </Field>

              <View style={styles.row}>
                <View style={{ flex: 1, marginRight: 8 }}>
                  <Field label="Telefone" icon="call-outline" error={errors.phone}>
                    <TextInput
                      style={styles.input}
                      placeholder="(11) 99999-9999"
                      placeholderTextColor="#9CA3AF"
                      value={phone}
                      onChangeText={(v) => { setPhone(formatPhone(v)); clearErr('phone'); }}
                      onBlur={() => blurField('phone')}
                      keyboardType="phone-pad"
                    />
                  </Field>
                </View>
                <View style={{ flex: 1, marginLeft: 8 }}>
                  <Field label="Data de nasc." icon="calendar-outline" error={errors.birthdate}>
                    <TextInput
                      style={styles.input}
                      placeholder="DD/MM/AAAA"
                      placeholderTextColor="#9CA3AF"
                      value={birthdate}
                      onChangeText={(v) => { setBirthdate(formatDate(v)); clearErr('birthdate'); }}
                      onBlur={() => blurField('birthdate')}
                      keyboardType="numeric"
                    />
                  </Field>
                </View>
              </View>

              <Field label="CPF" icon="id-card-outline" error={errors.cpf}>
                <TextInput
                  style={styles.input}
                  placeholder="000.000.000-00"
                  placeholderTextColor="#9CA3AF"
                  value={cpf}
                  onChangeText={(v) => { setCpf(formatCPF(v)); clearErr('cpf'); }}
                  onBlur={() => blurField('cpf')}
                  keyboardType="numeric"
                />
              </Field>

              {/* ── Segurança ── */}
              <SectionHeader icon="lock-closed-outline" title="Segurança" />

              <Field label="Senha" icon="lock-closed-outline" error={errors.password}>
                <TextInput
                  style={[styles.input, { flex: 1 }]}
                  placeholder="Mín. 8 chars, maiúscula e número"
                  placeholderTextColor="#9CA3AF"
                  value={password}
                  onChangeText={(v) => { setPassword(v); clearErr('password'); }}
                  onBlur={() => blurField('password')}
                  secureTextEntry={!showPassword}
                />
                <TouchableOpacity onPress={() => setShowPassword(v => !v)} style={styles.eyeBtn}>
                  <Ionicons name={showPassword ? 'eye-off-outline' : 'eye-outline'} size={18} color="#9CA3AF" />
                </TouchableOpacity>
              </Field>

              <Field label="Confirmar senha" icon="lock-closed-outline" error={errors.confirmPassword}>
                <TextInput
                  style={[styles.input, { flex: 1 }]}
                  placeholder="Repita a senha"
                  placeholderTextColor="#9CA3AF"
                  value={confirmPassword}
                  onChangeText={(v) => { setConfirmPassword(v); clearErr('confirmPassword'); }}
                  onBlur={() => blurField('confirmPassword')}
                  secureTextEntry={!showConfirm}
                />
                <TouchableOpacity onPress={() => setShowConfirm(v => !v)} style={styles.eyeBtn}>
                  <Ionicons name={showConfirm ? 'eye-off-outline' : 'eye-outline'} size={18} color="#9CA3AF" />
                </TouchableOpacity>
              </Field>

              {/* ── Perfil Profissional (instrutor) ── */}
              {role === 'instructor' && (
                <>
                  <SectionHeader icon="briefcase-outline" title="Perfil Profissional" />

                  {/* Nº Registro de Instrutor */}
                  <Field label="Nº de Registro de Instrutor" icon="ribbon-outline" error={errors.instructorRegNum}>
                    <TextInput
                      style={styles.inputSm}
                      placeholder="Nº emitido pelo CFC / DETRAN"
                      placeholderTextColor="#9CA3AF"
                      value={instructorRegNum}
                      onChangeText={(v) => { setInstructorRegNum(v); clearErr('instructorRegNum'); }}
                      onBlur={() => blurField('instructorRegNum')}
                      autoCapitalize="characters"
                    />
                  </Field>

                  {/* Categoria */}
                  <View style={styles.inputGroup}>
                    <Text style={styles.label}>Categoria da habilitação</Text>
                    <View style={styles.chipRow}>
                      {CATEGORY_OPTIONS.map((opt) => (
                        <TouchableOpacity
                          key={opt}
                          style={[styles.chip, licenseCategory === opt && styles.chipActive]}
                          onPress={() => setLicenseCategory(opt)}
                        >
                          <Text style={[styles.chipText, licenseCategory === opt && styles.chipTextActive]}>
                            {opt}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </View>

                  {/* Veículo — opcional */}
                  <Field label="Veículo (marca e modelo)" icon="car-outline" optional>
                    <TextInput
                      style={styles.input}
                      placeholder="Ex: Honda Civic 2023"
                      placeholderTextColor="#9CA3AF"
                      value={carModel}
                      onChangeText={setCarModel}
                      autoCapitalize="words"
                    />
                  </Field>
                  <View style={styles.infoBox}>
                    <Ionicons name="information-circle-outline" size={14} color="#1D4ED8" />
                    <Text style={styles.infoText}>
                      A nova legislação permite aulas no veículo do próprio aluno. O veículo é opcional.
                    </Text>
                  </View>

                  {/* Como serão feitas as aulas */}
                  <View style={styles.inputGroup}>
                    <Text style={styles.label}>Como serão realizadas as aulas?</Text>
                    <View style={styles.chipRow}>
                      {[
                        { value: 'instructor', label: 'Meu carro' },
                        { value: 'student',    label: 'Carro do aluno' },
                        { value: 'both',       label: 'Ambos' },
                      ].map(opt => (
                        <TouchableOpacity
                          key={opt.value}
                          style={[styles.chip, carOptions === opt.value && styles.chipActive]}
                          onPress={() => setCarOptions(opt.value)}
                        >
                          <Text style={[styles.chipText, carOptions === opt.value && styles.chipTextActive]}>
                            {opt.label}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </View>

                  {/* Preço */}
                  <Field label="Valor da aula avulsa (R$/hora)" icon="cash-outline" error={errors.pricePerHour}>
                    <Text style={styles.currencyPrefix}>R$</Text>
                    <TextInput
                      style={[styles.input, { flex: 1 }]}
                      placeholder="0,00"
                      placeholderTextColor="#9CA3AF"
                      value={pricePerHour}
                      onChangeText={(v) => { setPricePerHour(v); clearErr('pricePerHour'); }}
                      onBlur={() => blurField('pricePerHour')}
                      keyboardType="decimal-pad"
                    />
                  </Field>

                  {/* Bio */}
                  <View style={styles.inputGroup}>
                    <Text style={styles.label}>Apresentação / Bio</Text>
                    <View style={[styles.inputWrapper, styles.textareaWrapper]}>
                      <TextInput
                        style={styles.textarea}
                        placeholder="Conte um pouco sobre sua experiência e estilo de ensino..."
                        placeholderTextColor="#9CA3AF"
                        value={bio}
                        onChangeText={setBio}
                        multiline
                        numberOfLines={4}
                        textAlignVertical="top"
                        maxLength={300}
                      />
                    </View>
                    <Text style={styles.charCount}>{bio.length}/300</Text>
                  </View>
                </>
              )}

              {/* Submit */}
              <TouchableOpacity
                style={[styles.btn, loading && styles.btnDisabled]}
                onPress={handleRegister}
                disabled={loading}
                activeOpacity={0.85}
              >
                {loading ? (
                  <ActivityIndicator color="#FFF" />
                ) : (
                  <>
                    <Ionicons name="checkmark-circle-outline" size={20} color="#FFF" style={{ marginRight: 8 }} />
                    <Text style={styles.btnText}>Criar conta</Text>
                  </>
                )}
              </TouchableOpacity>

              {/* Link para login */}
              <TouchableOpacity style={styles.loginLink} onPress={() => navigation.goBack()}>
                <Text style={styles.loginLinkText}>
                  Já tem conta?{' '}
                  <Text style={styles.loginLinkBold}>Entrar</Text>
                </Text>
              </TouchableOpacity>
            </View>

            <Text style={styles.footer}>CartaOn © {new Date().getFullYear()}</Text>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  gradient: { flex: 1 },
  safe: { flex: 1 },
  kav: { flex: 1 },
  scroll: { flexGrow: 1, paddingHorizontal: 24, paddingVertical: 24 },

  header: { marginBottom: 20 },
  backBtn: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center', justifyContent: 'center',
    marginBottom: 16,
  },
  brand: { alignItems: 'center' },
  logoCircle: {
    width: 64, height: 64, borderRadius: 32,
    backgroundColor: '#FFF', alignItems: 'center', justifyContent: 'center',
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2, shadowRadius: 8, elevation: 8, marginBottom: 8,
  },
  brandName: { fontSize: 26, fontWeight: '800', color: '#FFF', letterSpacing: 1 },
  brandSub: { fontSize: 13, color: 'rgba(255,255,255,0.8)', marginTop: 2 },

  card: {
    backgroundColor: '#FFF', borderRadius: 24, padding: 24,
    shadowColor: '#000', shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15, shadowRadius: 16, elevation: 10,
  },
  cardTitle: { fontSize: 20, fontWeight: '700', color: '#111827', marginBottom: 14 },

  // Role selector
  roleRow: { flexDirection: 'row', gap: 10, marginBottom: 24 },
  roleBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 8, paddingVertical: 12, borderRadius: 12,
    borderWidth: 1.5, borderColor: '#E5E7EB', backgroundColor: '#F9FAFB',
  },
  roleBtnActive: { backgroundColor: '#1D4ED8', borderColor: '#1D4ED8' },
  roleBtnText: { fontSize: 14, fontWeight: '600', color: '#6B7280' },
  roleBtnTextActive: { color: '#FFF' },

  // Avatar picker
  avatarSection: { alignItems: 'center', marginBottom: 24 },
  avatarBtn: { position: 'relative' },
  avatarImg: {
    width: 90, height: 90, borderRadius: 45,
    borderWidth: 3, borderColor: '#1D4ED8',
  },
  avatarPlaceholder: {
    width: 90, height: 90, borderRadius: 45,
    backgroundColor: '#EFF6FF', borderWidth: 2, borderColor: '#BFDBFE',
    alignItems: 'center', justifyContent: 'center',
    borderStyle: 'dashed',
  },
  avatarInitials: { fontSize: 30, fontWeight: '800', color: '#1D4ED8' },
  avatarBadge: {
    position: 'absolute', bottom: 2, right: 2,
    width: 28, height: 28, borderRadius: 14,
    backgroundColor: '#1D4ED8', borderWidth: 2, borderColor: '#FFF',
    alignItems: 'center', justifyContent: 'center',
  },
  avatarHint: { fontSize: 12, color: '#9CA3AF', marginTop: 8 },

  // Section header
  sectionHeader: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    marginTop: 8, marginBottom: 14,
    paddingBottom: 10, borderBottomWidth: 1, borderBottomColor: '#F3F4F6',
  },
  sectionIconBox: {
    width: 28, height: 28, borderRadius: 8,
    backgroundColor: '#EFF6FF', alignItems: 'center', justifyContent: 'center',
  },
  sectionTitle: {
    fontSize: 13, fontWeight: '700', color: '#374151',
    textTransform: 'uppercase', letterSpacing: 0.5,
  },

  // Inputs
  inputGroup: { marginBottom: 18 },
  labelRow: { flexDirection: 'row', alignItems: 'center' },
  label: { fontSize: 13, fontWeight: '600', color: '#374151', marginBottom: 8 },
  optionalTag: {
    marginLeft: 6, fontSize: 11, color: '#9CA3AF',
    backgroundColor: '#F3F4F6', borderRadius: 4,
    paddingHorizontal: 5, paddingVertical: 1,
  },
  inputWrapper: {
    flexDirection: 'row', alignItems: 'center',
    borderWidth: 1.5, borderColor: '#E5E7EB', borderRadius: 12,
    backgroundColor: '#F9FAFB', paddingHorizontal: 12,
  },
  inputWrapperError: {
    borderColor: '#EF4444',
    backgroundColor: '#FFF5F5',
  },
  errorText: {
    fontSize: 12, color: '#EF4444', marginTop: 4, marginLeft: 2,
  },
  inputIcon: { marginRight: 8 },
  input: { flex: 1, height: 48, fontSize: 15, color: '#111827' },
  inputSm: { flex: 1, height: 48, fontSize: 12, color: '#111827' },
  eyeBtn: { padding: 4 },
  currencyPrefix: { fontSize: 15, color: '#6B7280', marginRight: 4, fontWeight: '600' },
  row: { flexDirection: 'row' },

  // Info box
  infoBox: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 6,
    backgroundColor: '#EFF6FF', borderRadius: 8, padding: 10,
    marginBottom: 14, marginTop: -6,
  },
  infoText: { fontSize: 12, color: '#1D4ED8', flex: 1, lineHeight: 18 },

  // Textarea
  textareaWrapper: { alignItems: 'flex-start', paddingVertical: 14 },
  textarea: { width: '100%', minHeight: 96, fontSize: 14, color: '#111827', lineHeight: 21 },
  charCount: { fontSize: 11, color: '#9CA3AF', textAlign: 'right', marginTop: 2 },

  // Chips
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  chip: {
    paddingHorizontal: 20, paddingVertical: 11, borderRadius: 20,
    borderWidth: 1.5, borderColor: '#E5E7EB', backgroundColor: '#F9FAFB',
  },
  chipWide: { paddingHorizontal: 12 },
  chipActive: { backgroundColor: '#1D4ED8', borderColor: '#1D4ED8' },
  chipText: { fontSize: 13, fontWeight: '600', color: '#6B7280' },
  chipTextActive: { color: '#FFF' },

  // Button
  btn: {
    backgroundColor: '#1D4ED8', borderRadius: 14, height: 52, marginTop: 8,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    shadowColor: '#1D4ED8', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3, shadowRadius: 8, elevation: 6,
  },
  btnDisabled: { opacity: 0.6 },
  btnText: { color: '#FFF', fontSize: 16, fontWeight: '700' },

  // Login link
  loginLink: { alignItems: 'center', marginTop: 18, paddingVertical: 4 },
  loginLinkText: { fontSize: 14, color: '#6B7280' },
  loginLinkBold: { fontWeight: '700', color: '#1D4ED8' },

  footer: { textAlign: 'center', color: 'rgba(255,255,255,0.6)', marginTop: 24, fontSize: 12 },

});
