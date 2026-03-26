import React, { useState, useRef } from 'react';
import {
  View, Text, Image, TextInput, TouchableOpacity, StyleSheet,
  KeyboardAvoidingView, Platform, ActivityIndicator,
  ScrollView, Alert, useWindowDimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../hooks/useAuth';
import { mapAuthError } from '../../utils/authErrors';
import { makeShadow } from '../../constants/theme';
import { toast } from '../../utils/toast';
import { showImagePickerAlert } from '../../utils/imagePicker';


const logoImg = require('../../../assets/logoAb.png');
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

function isValidCPF(value) {
  const d = value.replace(/\D/g, '');
  if (d.length !== 11 || /^(\d)\1{10}$/.test(d)) return false;
  const calc = (len) => {
    let sum = 0;
    for (let i = 0; i < len; i++) sum += Number(d[i]) * (len + 1 - i);
    const r = sum % 11;
    return r < 2 ? 0 : 11 - r;
  };
  return calc(9) === Number(d[9]) && calc(10) === Number(d[10]);
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
  const { register, setPendingOtp } = useAuth();
  const { width } = useWindowDimensions();
  const isSmall = width < 380;

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
  const [carYear, setCarYear] = useState('');
  const [hasCar, setHasCar] = useState(false);
  const [carOptions, setCarOptions] = useState('instructor');
  const [vehicleType, setVehicleType] = useState('manual');
  const [hasMoto, setHasMoto] = useState(false);
  const [motoModel, setMotoModel] = useState('');
  const [motoYear, setMotoYear] = useState('');
  const [motoOptions, setMotoOptions] = useState('instructor');
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
  const handlePickImage = () => {
    if (Platform.OS === 'web') {
      fileInputRef.current?.click();
      return;
    }
    showImagePickerAlert(setPhotoUri);
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
    const nameParts = name.trim().split(/\s+/).filter(w => w.length > 0);
    if (nameParts.length < 2)
      errs.name = 'Informe nome e sobrenome.';
    if (!email.trim() || !email.includes('@'))
      errs.email = 'Informe um e-mail válido.';
    if (!phone.trim() || phone.replace(/\D/g, '').length < 10)
      errs.phone = 'Informe um telefone válido.';
    if (!isValidCPF(cpf))
      errs.cpf = 'CPF inválido.';
    if (!birthdate.trim() || birthdate.replace(/\D/g, '').length !== 8) {
      errs.birthdate = 'Use o formato DD/MM/AAAA.';
    } else {
      const [dd, mm, yyyy] = birthdate.split('/').map(Number);
      const dateObj = new Date(yyyy, mm - 1, dd);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      if (
        dateObj.getFullYear() !== yyyy ||
        dateObj.getMonth() !== mm - 1 ||
        dateObj.getDate() !== dd
      ) {
        errs.birthdate = 'Data inválida.';
      } else if (dateObj >= today) {
        errs.birthdate = 'A data não pode ser hoje ou no futuro.';
      } else {
        const minBirthdate = new Date(today.getFullYear() - 18, today.getMonth(), today.getDate());
        if (dateObj > minBirthdate)
          errs.birthdate = 'É necessário ter pelo menos 18 anos.';
      }
    }
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
      if (!bio.trim())
        errs.bio = 'Escreva uma breve apresentação.';
      const hasB = licenseCategory === 'B' || licenseCategory === 'A+B';
      const hasA = licenseCategory === 'A' || licenseCategory === 'A+B';
      if (hasB && hasCar && !carModel.trim())
        errs.carModel = 'Informe o modelo do carro.';
      if (hasB && hasCar && !carYear.trim())
        errs.carYear = 'Informe o ano do carro.';
      if (hasA && hasMoto && !motoModel.trim())
        errs.motoModel = 'Informe o modelo da moto.';
      if (hasA && hasMoto && !motoYear.trim())
        errs.motoYear = 'Informe o ano da moto.';
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
        carYear: carYear.trim() ? parseInt(carYear.trim(), 10) : null,
        carOptions,
        vehicleType,
        hasMoto,
        motoModel: motoModel.trim(),
        motoYear: motoYear.trim() ? parseInt(motoYear.trim(), 10) : null,
        motoOptions,
        pricePerHour: 80,
        bio: bio.trim(),
        hasCar,
      });
      if (result.emailConfirmationRequired) {
        const otpParams = { email: trimmedEmail, type: 'signup' };
        await setPendingOtp(otpParams);
        navigation.navigate('VerifyOTP', otpParams);
      }
      // Se não requer confirmação, AuthContext seta isAuthenticated e o
      // AppNavigator redireciona automaticamente.
    } catch (err) {
      console.error('[RegisterScreen] signUp error:', err);
      const msg = (err?.message || '').toLowerCase();
      const code = (err?.code || '').toLowerCase();
      const isRateLimit =
        msg.includes('rate limit') ||
        msg.includes('too many requests') ||
        msg.includes('for security purposes') ||
        code === 'over_request_rate_limit' ||
        code === 'over_email_send_rate_limit';

      if (isRateLimit) {
        const trimmedEmail = email.trim().toLowerCase();
        Alert.alert(
          'Muitas tentativas',
          'O limite de cadastros foi atingido. Aguarde alguns minutos.\n\nSe você já se cadastrou antes, verifique seu e-mail — pode haver um código aguardando confirmação.',
          [
            {
              text: 'Tenho um código',
              onPress: async () => {
                const otpParams = { email: trimmedEmail, type: 'signup' };
                await setPendingOtp(otpParams);
                navigation.navigate('VerifyOTP', otpParams);
              },
            },
            { text: 'OK', style: 'cancel' },
          ]
        );
      } else {
        toast.error(mapAuthError(err));
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <LinearGradient colors={['#0F172A', '#1E3A8A', '#1D4ED8']} style={styles.gradient}>
      <SafeAreaView style={styles.safe}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.kav}
        >
          <ScrollView
            contentContainerStyle={[styles.scroll, { paddingHorizontal: isSmall ? 16 : 24 }]}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            {/* Header */}
            <View style={styles.header}>
              <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
                <Ionicons name="arrow-back" size={22} color="#FFF" />
              </TouchableOpacity>
              <View style={styles.brand}>
                <Image source={logoImg} style={styles.logoCircle} resizeMode="contain" />
                <Text style={styles.brandName}>Abily</Text>
                <Text style={styles.brandSub}>Criar nova conta</Text>
              </View>
            </View>

            {/* Card */}
            <View style={[styles.card, { padding: isSmall ? 16 : 24 }]}>

              {/* Role selector */}
              <Text style={styles.cardTitle}>Quem é você?</Text>
              <View style={styles.roleRow}>
                <TouchableOpacity
                  style={[styles.roleBtn, role === 'user' && styles.roleBtnActive]}
                  onPress={() => setRole('user')}
                  activeOpacity={0.85}
                >
                  <Ionicons name="person-outline" size={isSmall ? 18 : 20}
                    color={role === 'user' ? '#FFF' : '#6B7280'} />
                  <Text style={[styles.roleBtnText, role === 'user' && styles.roleBtnTextActive, isSmall && { fontSize: 12 }]}>
                    Sou Aluno
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.roleBtn, role === 'instructor' && styles.roleBtnActive]}
                  onPress={() => setRole('instructor')}
                  activeOpacity={0.85}
                >
                  <Ionicons name="school-outline" size={isSmall ? 18 : 20}
                    color={role === 'instructor' ? '#FFF' : '#6B7280'} />
                  <Text style={[styles.roleBtnText, role === 'instructor' && styles.roleBtnTextActive, isSmall && { fontSize: 12 }]}>
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

              <Field label="Data de nascimento" icon="calendar-outline" error={errors.birthdate}>
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
                      placeholder="Nº emitido pelo DETRAN"
                      placeholderTextColor="#9CA3AF"
                      value={instructorRegNum}
                      onChangeText={(v) => { setInstructorRegNum(v); clearErr('instructorRegNum'); }}
                      onBlur={() => blurField('instructorRegNum')}
                      autoCapitalize="characters"
                    />
                  </Field>

                  {/* Categoria */}
                  <View style={styles.inputGroup}>
                    <Text style={[styles.label, { marginBottom: 6 }]}>Que tipo de aula você vai ministrar?</Text>
                    <View style={styles.chipRow}>
                      {[
                        { value: 'A',   label: 'Moto (A)' },
                        { value: 'B',   label: 'Carro (B)' },
                        { value: 'A+B', label: 'Moto + Carro' },
                      ].map((opt) => (
                        <TouchableOpacity
                          key={opt.value}
                          style={[styles.chip, licenseCategory === opt.value && styles.chipActive]}
                          onPress={() => setLicenseCategory(opt.value)}
                        >
                          <Text style={[styles.chipText, licenseCategory === opt.value && styles.chipTextActive]}>
                            {opt.label}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </View>

                  {/* ── Seção Carro (categoria B ou A+B) ── */}
                  {(licenseCategory === 'B' || licenseCategory === 'A+B') && (
                    <>
                      {/* Toggle possui carro próprio */}
                      <View style={styles.inputGroup}>
                        <Text style={[styles.label, { marginBottom: 12 }]}>Possui carro próprio?</Text>
                        <View style={styles.chipRow}>
                          {[
                            { value: false, label: 'Não' },
                            { value: true,  label: 'Sim' },
                          ].map(opt => (
                            <TouchableOpacity
                              key={String(opt.value)}
                              style={[styles.chip, hasCar === opt.value && styles.chipActive]}
                              onPress={() => {
                                setHasCar(opt.value);
                                // Sem carro próprio → força carro do aluno
                                if (!opt.value) setCarOptions('student');
                              }}
                            >
                              <Text style={[styles.chipText, hasCar === opt.value && styles.chipTextActive]}>
                                {opt.label}
                              </Text>
                            </TouchableOpacity>
                          ))}
                        </View>
                      </View>

                      {hasCar && (
                        <>
                          <View style={styles.inputGroup}>
                            <View style={{ flexDirection: 'row', gap: 8 }}>
                              <View style={[styles.inputWrapper, { flex: 3 }, errors.carModel && styles.inputWrapperError]}>
                                <Ionicons name="car-outline" size={18} color="#9CA3AF" style={styles.inputIcon} />
                                <TextInput
                                  style={styles.input}
                                  placeholder="Marca e modelo *"
                                  placeholderTextColor="#9CA3AF"
                                  value={carModel}
                                  onChangeText={v => { setCarModel(v); setErrors(e => ({ ...e, carModel: null })); }}
                                  autoCapitalize="words"
                                />
                              </View>
                              <View style={[styles.inputWrapper, { flex: 2 }, errors.carYear && styles.inputWrapperError]}>
                                <Ionicons name="calendar-outline" size={18} color="#9CA3AF" style={styles.inputIcon} />
                                <TextInput
                                  style={styles.input}
                                  placeholder="Ano *"
                                  placeholderTextColor="#9CA3AF"
                                  value={carYear}
                                  onChangeText={v => { setCarYear(v); setErrors(e => ({ ...e, carYear: null })); }}
                                  keyboardType="number-pad"
                                  maxLength={4}
                                />
                              </View>
                            </View>
                            {(errors.carModel || errors.carYear) && (
                              <Text style={styles.fieldError}>{errors.carModel || errors.carYear}</Text>
                            )}
                          </View>

                          {/* Tipo de câmbio do carro */}
                          <View style={styles.inputGroup}>
                            <Text style={[styles.label, { marginBottom: 12 }]}>Tipo de câmbio do carro</Text>
                            <View style={styles.chipRow}>
                              {[
                                { value: 'manual',    label: 'Manual' },
                                { value: 'automatic', label: 'Automático' },
                                { value: 'electric',  label: 'Elétrico' },
                              ].map(opt => (
                                <TouchableOpacity
                                  key={opt.value}
                                  style={[styles.chip, vehicleType === opt.value && styles.chipActive]}
                                  onPress={() => setVehicleType(opt.value)}
                                >
                                  <Text style={[styles.chipText, vehicleType === opt.value && styles.chipTextActive]}>
                                    {opt.label}
                                  </Text>
                                </TouchableOpacity>
                              ))}
                            </View>
                          </View>
                        </>
                      )}

                      <View style={styles.infoBox}>
                        <Ionicons name="information-circle-outline" size={14} color="#1D4ED8" />
                        <Text style={styles.infoText}>
                          A nova legislação permite aulas no veículo do próprio aluno. O veículo é opcional.
                        </Text>
                      </View>

                      {/* Como serão feitas as aulas de carro */}
                      <View style={styles.inputGroup}>
                        <Text style={[styles.label, { marginBottom: 12 }]}>
                          {licenseCategory === 'A+B' ? 'Aulas de carro — com qual veículo?' : 'Como serão realizadas as aulas?'}
                        </Text>
                        <View style={styles.chipRow}>
                          {[
                            { value: 'instructor', label: 'Meu carro',      requiresCar: true },
                            { value: 'student',    label: 'Carro do aluno', requiresCar: false },
                            { value: 'both',       label: 'Ambos',          requiresCar: true },
                          ].filter(opt => !opt.requiresCar || hasCar).map(opt => (
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
                    </>
                  )}

                  {/* ── Seção Moto (categoria A ou A+B) ── */}
                  {(licenseCategory === 'A' || licenseCategory === 'A+B') && (
                    <>
                      {/* Toggle possui moto própria */}
                      <View style={styles.inputGroup}>
                        <Text style={[styles.label, { marginBottom: 12 }]}>Possui moto própria?</Text>
                        <View style={styles.chipRow}>
                          {[
                            { value: false, label: 'Não' },
                            { value: true,  label: 'Sim' },
                          ].map(opt => (
                            <TouchableOpacity
                              key={String(opt.value)}
                              style={[styles.chip, hasMoto === opt.value && styles.chipActive]}
                              onPress={() => {
                                setHasMoto(opt.value);
                                // Sem moto própria → força moto do aluno
                                if (!opt.value) setMotoOptions('student');
                              }}
                            >
                              <Text style={[styles.chipText, hasMoto === opt.value && styles.chipTextActive]}>
                                {opt.label}
                              </Text>
                            </TouchableOpacity>
                          ))}
                        </View>
                      </View>

                      {hasMoto && (
                        <View style={styles.inputGroup}>
                          <View style={{ flexDirection: 'row', gap: 8 }}>
                            <View style={[styles.inputWrapper, { flex: 3 }, errors.motoModel && styles.inputWrapperError]}>
                              <Ionicons name="bicycle-outline" size={18} color="#9CA3AF" style={styles.inputIcon} />
                              <TextInput
                                style={styles.input}
                                placeholder="Marca e modelo *"
                                placeholderTextColor="#9CA3AF"
                                value={motoModel}
                                onChangeText={v => { setMotoModel(v); setErrors(e => ({ ...e, motoModel: null })); }}
                                autoCapitalize="words"
                              />
                            </View>
                            <View style={[styles.inputWrapper, { flex: 2 }, errors.motoYear && styles.inputWrapperError]}>
                              <Ionicons name="calendar-outline" size={18} color="#9CA3AF" style={styles.inputIcon} />
                              <TextInput
                                style={styles.input}
                                placeholder="Ano *"
                                placeholderTextColor="#9CA3AF"
                                value={motoYear}
                                onChangeText={v => { setMotoYear(v); setErrors(e => ({ ...e, motoYear: null })); }}
                                keyboardType="number-pad"
                                maxLength={4}
                              />
                            </View>
                          </View>
                          {(errors.motoModel || errors.motoYear) && (
                            <Text style={styles.fieldError}>{errors.motoModel || errors.motoYear}</Text>
                          )}
                        </View>
                      )}

                      <View style={styles.infoBox}>
                        <Ionicons name="information-circle-outline" size={14} color="#1D4ED8" />
                        <Text style={styles.infoText}>
                          A nova legislação permite aulas na moto do próprio aluno. A moto é opcional.
                        </Text>
                      </View>

                      {/* Como serão feitas as aulas de moto */}
                      <View style={styles.inputGroup}>
                        <Text style={[styles.label, { marginBottom: 12 }]}>
                          {licenseCategory === 'A+B' ? 'Aulas de moto — com qual veículo?' : 'Como serão realizadas as aulas?'}
                        </Text>
                        <View style={styles.chipRow}>
                          {[
                            { value: 'instructor', label: 'Minha moto',    requiresMoto: true },
                            { value: 'student',    label: 'Moto do aluno', requiresMoto: false },
                            { value: 'both',       label: 'Ambos',         requiresMoto: true },
                          ].filter(opt => !opt.requiresMoto || hasMoto).map(opt => (
                            <TouchableOpacity
                              key={opt.value}
                              style={[styles.chip, motoOptions === opt.value && styles.chipActive]}
                              onPress={() => setMotoOptions(opt.value)}
                            >
                              <Text style={[styles.chipText, motoOptions === opt.value && styles.chipTextActive]}>
                                {opt.label}
                              </Text>
                            </TouchableOpacity>
                          ))}
                        </View>
                      </View>
                    </>
                  )}

                  {/* Bio */}
                  <View style={styles.inputGroup}>
                    <View style={styles.labelRow}>
                      <Text style={styles.label}>Apresentação / Bio</Text>
                    </View>
                    <View style={[styles.inputWrapper, styles.textareaWrapper, errors.bio && styles.inputWrapperError]}>
                      <TextInput
                        style={styles.textarea}
                        placeholder="Conte um pouco sobre sua experiência e estilo de ensino..."
                        placeholderTextColor="#9CA3AF"
                        value={bio}
                        onChangeText={(v) => { setBio(v); clearErr('bio'); }}
                        onBlur={() => blurField('bio')}
                        multiline
                        numberOfLines={4}
                        textAlignVertical="top"
                        maxLength={300}
                      />
                    </View>
                    <Text style={styles.charCount}>{bio.length}/300</Text>
                    {errors.bio ? <Text style={styles.errorText}>{errors.bio}</Text> : null}
                  </View>
                </>
              )}

              {/* ── Veículo (aluno) ── */}
              {role === 'user' && (
                <>
                  <SectionHeader icon="car-outline" title="Veículo" />

                  <View style={styles.inputGroup}>
                    <Text style={[styles.label, { marginBottom: 12 }]}>Possui carro próprio?</Text>
                    <View style={styles.chipRow}>
                      {[
                        { value: false, label: 'Não' },
                        { value: true,  label: 'Sim' },
                      ].map(opt => (
                        <TouchableOpacity
                          key={String(opt.value)}
                          style={[styles.chip, hasCar === opt.value && styles.chipActive]}
                          onPress={() => setHasCar(opt.value)}
                        >
                          <Text style={[styles.chipText, hasCar === opt.value && styles.chipTextActive]}>
                            {opt.label}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </View>

                  {hasCar && (
                    <View style={styles.inputGroup}>
                      <View style={{ flexDirection: 'row', gap: 8 }}>
                        <View style={[styles.inputWrapper, { flex: 3 }]}>
                          <Ionicons name="car-outline" size={18} color="#9CA3AF" style={styles.inputIcon} />
                          <TextInput
                            style={styles.input}
                            placeholder="Marca e modelo"
                            placeholderTextColor="#9CA3AF"
                            value={carModel}
                            onChangeText={setCarModel}
                            autoCapitalize="words"
                          />
                        </View>
                        <View style={[styles.inputWrapper, { flex: 2 }]}>
                          <Ionicons name="calendar-outline" size={18} color="#9CA3AF" style={styles.inputIcon} />
                          <TextInput
                            style={styles.input}
                            placeholder="Ano"
                            placeholderTextColor="#9CA3AF"
                            value={carYear}
                            onChangeText={setCarYear}
                            keyboardType="number-pad"
                            maxLength={4}
                          />
                        </View>
                      </View>
                    </View>
                  )}
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

            <Text style={styles.footer}>Abily © {new Date().getFullYear()}</Text>
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
    ...makeShadow('#000', 4, 0.2, 8, 8), marginBottom: 8,
  },
  brandName: { fontSize: 26, fontWeight: '800', color: '#FFF', letterSpacing: 1 },
  brandSub: { fontSize: 13, color: 'rgba(255,255,255,0.8)', marginTop: 2 },

  card: {
    backgroundColor: '#FFF', borderRadius: 24, padding: 24,
    width: '100%', maxWidth: 520, alignSelf: 'center',
    ...makeShadow('#000', 8, 0.15, 16, 10),
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
  labelRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  label: { fontSize: 13, fontWeight: '600', color: '#374151' },
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
  input: { flex: 1, height: 48, fontSize: 15, color: '#111827', outlineWidth: 0 },
  inputSm: { flex: 1, height: 48, fontSize: 12, color: '#111827', outlineWidth: 0 },
  eyeBtn: { padding: 4 },

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
    ...makeShadow('#1D4ED8', 4, 0.3, 8, 6),
  },
  btnDisabled: { opacity: 0.6 },
  btnText: { color: '#FFF', fontSize: 16, fontWeight: '700' },

  // Login link
  loginLink: { alignItems: 'center', marginTop: 18, paddingVertical: 4 },
  loginLinkText: { fontSize: 14, color: '#6B7280' },
  loginLinkBold: { fontWeight: '700', color: '#1D4ED8' },

  footer: { textAlign: 'center', color: 'rgba(255,255,255,0.6)', marginTop: 24, fontSize: 12 },

});
