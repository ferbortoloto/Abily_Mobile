import React, { useState, useRef, useEffect } from 'react';
import {
  View, Text, Image, TextInput, TouchableOpacity, StyleSheet,
  KeyboardAvoidingView, Platform, ActivityIndicator,
  ScrollView, Alert, useWindowDimensions, Animated,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../hooks/useAuth';
import { mapAuthError } from '../../utils/authErrors';
import { makeShadow } from '../../constants/theme';
import { toast } from '../../utils/toast';
import ImagePickerSheet from '../../components/shared/ImagePickerSheet';

const logoImg = require('../../../assets/logo.png');

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
        <Ionicons name={icon} size={15} color="#60A5FA" />
      </View>
      <Text style={styles.sectionTitle}>{title}</Text>
      <View style={styles.sectionLine} />
    </View>
  );
}

function Field({ label, icon, optional, error, focused, children }) {
  return (
    <View style={styles.inputGroup}>
      <View style={styles.labelRow}>
        <Text style={styles.label}>{label}</Text>
        {optional && <Text style={styles.optionalTag}>opcional</Text>}
      </View>
      <View style={[
        styles.inputWrapper,
        focused && styles.inputWrapperFocused,
        error && styles.inputWrapperError,
      ]}>
        {icon && (
          <Ionicons
            name={icon} size={18}
            color={error ? '#F87171' : focused ? '#60A5FA' : 'rgba(255,255,255,0.3)'}
            style={styles.inputIcon}
          />
        )}
        {children}
      </View>
      {error ? (
        <View style={styles.errorRow}>
          <Ionicons name="alert-circle-outline" size={13} color="#F87171" />
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : null}
    </View>
  );
}

// Chip with gradient absoluteFill — size never changes between active/inactive states
function Chip({ label, active, onPress }) {
  return (
    <TouchableOpacity
      style={[styles.chip, active && styles.chipActive]}
      onPress={onPress}
      activeOpacity={0.8}
    >
      {active && (
        <LinearGradient
          colors={['#2563EB', '#4F46E5']}
          start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
          style={StyleSheet.absoluteFill}
        />
      )}
      <Text style={[styles.chipText, active && styles.chipTextActive]}>{label}</Text>
    </TouchableOpacity>
  );
}

export default function RegisterScreen({ navigation }) {
  const { register, setPendingOtp } = useAuth();
  const { width } = useWindowDimensions();
  const isSmall = width < 380;

  const [role, setRole] = useState('user');
  const [photoUri, setPhotoUri] = useState(null);
  const [showPickerSheet, setShowPickerSheet] = useState(false);
  const fileInputRef = useRef(null);

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [cpf, setCpf] = useState('');
  const [birthdate, setBirthdate] = useState('');
  const [gender, setGender] = useState('undisclosed');
  const [renach, setRenach] = useState('');
  const [focusedField, setFocusedField] = useState(null);

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

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

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(24)).current;
  const blobAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 600, useNativeDriver: true }),
      Animated.timing(slideAnim, { toValue: 0, duration: 600, useNativeDriver: true }),
    ]).start();
    Animated.loop(
      Animated.sequence([
        Animated.timing(blobAnim, { toValue: 1.2, duration: 3500, useNativeDriver: true }),
        Animated.timing(blobAnim, { toValue: 1, duration: 3500, useNativeDriver: true }),
      ])
    ).start();
  }, []);

  const clearErr = (field) =>
    setErrors(prev => { const next = { ...prev }; delete next[field]; return next; });

  const blurField = (field) => {
    setFocusedField(null);
    const errs = validateAll();
    setErrors(prev => {
      const next = { ...prev };
      if (errs[field]) next[field] = errs[field];
      else delete next[field];
      return next;
    });
  };

  const handlePickImage = () => {
    if (Platform.OS === 'web') { fileInputRef.current?.click(); return; }
    setShowPickerSheet(true);
  };

  const handleWebFileChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setPhotoUri(URL.createObjectURL(file));
  };

  const initials = name.trim()
    ? name.trim().split(' ').slice(0, 2).map(w => w[0]).join('').toUpperCase()
    : '?';

  const validateAll = () => {
    const errs = {};
    const nameParts = name.trim().split(/\s+/).filter(w => w.length > 0);
    if (nameParts.length < 2) errs.name = 'Informe nome e sobrenome.';
    if (!email.trim() || !email.includes('@')) errs.email = 'Informe um e-mail válido.';
    if (!phone.trim() || phone.replace(/\D/g, '').length < 10)
      errs.phone = 'Informe um telefone válido.';
    if (!isValidCPF(cpf)) errs.cpf = 'CPF inválido.';
    if (!birthdate.trim() || birthdate.replace(/\D/g, '').length !== 8) {
      errs.birthdate = 'Use o formato DD/MM/AAAA.';
    } else {
      const [dd, mm, yyyy] = birthdate.split('/').map(Number);
      const dateObj = new Date(yyyy, mm - 1, dd);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      if (dateObj.getFullYear() !== yyyy || dateObj.getMonth() !== mm - 1 || dateObj.getDate() !== dd) {
        errs.birthdate = 'Data inválida.';
      } else if (dateObj >= today) {
        errs.birthdate = 'A data não pode ser hoje ou no futuro.';
      } else {
        const minAge = role === 'instructor' ? 21 : 18;
        const minBirthdate = new Date(today.getFullYear() - minAge, today.getMonth(), today.getDate());
        if (dateObj > minBirthdate)
          errs.birthdate = role === 'instructor'
            ? 'Instrutores devem ter pelo menos 21 anos.'
            : 'É necessário ter pelo menos 18 anos.';
      }
    }
    if (role === 'user' && renach.trim() && !/^[A-Z]{2}\d{9}$/.test(renach.trim().toUpperCase())) {
      errs.renach = 'Formato inválido. Use 2 letras + 9 dígitos (ex: SP123456789).';
    }
    if (!password || password.length < 8) errs.password = 'Mínimo 8 caracteres.';
    else if (!/[A-Z]/.test(password)) errs.password = 'Inclua ao menos uma letra maiúscula.';
    else if (!/[0-9]/.test(password)) errs.password = 'Inclua ao menos um número.';
    if (password !== confirmPassword) errs.confirmPassword = 'As senhas não coincidem.';
    if (role === 'instructor') {
      if (!instructorRegNum.trim()) errs.instructorRegNum = 'Informe o número de registro.';
      if (!bio.trim()) errs.bio = 'Escreva uma breve apresentação.';
      const hasB = licenseCategory === 'B' || licenseCategory === 'A+B';
      const hasA = licenseCategory === 'A' || licenseCategory === 'A+B';
      if (hasB && hasCar && !carModel.trim()) errs.carModel = 'Informe o modelo do carro.';
      if (hasB && hasCar && !carYear.trim()) errs.carYear = 'Informe o ano do carro.';
      if (hasA && hasMoto && !motoModel.trim()) errs.motoModel = 'Informe o modelo da moto.';
      if (hasA && hasMoto && !motoYear.trim()) errs.motoYear = 'Informe o ano da moto.';
    }
    return errs;
  };

  const handleRegister = async () => {
    const errs = validateAll();
    if (Object.keys(errs).length > 0) { setErrors(errs); return; }
    setErrors({});
    setLoading(true);
    try {
      const trimmedEmail = email.trim().toLowerCase();
      const result = await register({
        name: name.trim(), email: trimmedEmail, phone, cpf, birthdate, gender,
        ...(role === 'user' ? { renach: renach.trim().toUpperCase() || null } : {}),
        password, role, photoUri,
        licenseCategory, instructorRegNum: instructorRegNum.trim(),
        carModel: carModel.trim(), carYear: carYear.trim() ? parseInt(carYear.trim(), 10) : null,
        carOptions, vehicleType, hasMoto,
        motoModel: motoModel.trim(), motoYear: motoYear.trim() ? parseInt(motoYear.trim(), 10) : null,
        motoOptions, pricePerHour: 80, bio: bio.trim(), hasCar,
      });
      if (result.emailConfirmationRequired) {
        const otpParams = { email: trimmedEmail, type: 'signup' };
        await setPendingOtp(otpParams);
        navigation.navigate('VerifyOTP', otpParams);
      }
    } catch (err) {
      console.error('[RegisterScreen] signUp error:', err);
      const msg = (err?.message || '').toLowerCase();
      const code = (err?.code || '').toLowerCase();
      const isRateLimit =
        msg.includes('rate limit') || msg.includes('too many requests') ||
        msg.includes('for security purposes') ||
        code === 'over_request_rate_limit' || code === 'over_email_send_rate_limit';

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

  const focus = (field) => setFocusedField(field);
  const blur = (field) => blurField(field);

  return (
    <View style={styles.root}>
      <ImagePickerSheet
        visible={showPickerSheet}
        onClose={() => setShowPickerSheet(false)}
        onUri={setPhotoUri}
      />
      <LinearGradient colors={['#060B18', '#091530', '#0B1E45']} style={StyleSheet.absoluteFill} />

      {/* Blobs isolated — overflow hidden prevents scroll leak */}
      <View style={styles.blobContainer} pointerEvents="none">
        <Animated.View style={[styles.blobTop, { transform: [{ scale: blobAnim }] }]}>
          <LinearGradient
            colors={['rgba(29,78,216,0.4)', 'rgba(29,78,216,0)']}
            style={StyleSheet.absoluteFill}
            start={{ x: 0.5, y: 0.5 }} end={{ x: 1, y: 1 }}
          />
        </Animated.View>
        <Animated.View style={[styles.blobBottom, { transform: [{ scale: blobAnim }] }]}>
          <LinearGradient
            colors={['rgba(109,40,217,0.25)', 'rgba(109,40,217,0)']}
            style={StyleSheet.absoluteFill}
            start={{ x: 0.5, y: 0.5 }} end={{ x: 0, y: 0 }}
          />
        </Animated.View>
      </View>

      <SafeAreaView style={styles.safe}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.kav}
        >
          <ScrollView
            contentContainerStyle={[styles.scroll, { paddingHorizontal: isSmall ? 16 : 24 }]}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
            bounces={false}
          >
            <Animated.View style={{ opacity: fadeAnim, transform: [{ translateY: slideAnim }] }}>

              {/* Header */}
              <View style={styles.header}>
                <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
                  <Ionicons name="arrow-back" size={20} color="rgba(255,255,255,0.85)" />
                </TouchableOpacity>
                <View style={styles.brand}>
                  <View style={styles.logoWrap}>
                    <Image source={logoImg} style={styles.logo} resizeMode="contain" />
                  </View>
                  <Text style={[styles.brandName, { fontSize: isSmall ? 26 : 30 }]}>Abily</Text>
                  <Text style={styles.brandSub}>Criar nova conta</Text>
                </View>
              </View>

              <View style={styles.form}>

                {/* Role selector */}
                <Text style={styles.sectionLabel}>Quem é você?</Text>
                <View style={styles.roleRow}>
                  {[
                    { value: 'user', label: 'Sou Aluno', icon: 'person-outline' },
                    { value: 'instructor', label: 'Sou Instrutor', icon: 'school-outline' },
                  ].map(opt => (
                    <TouchableOpacity
                      key={opt.value}
                      style={[styles.roleBtn, role === opt.value && styles.roleBtnActive]}
                      onPress={() => setRole(opt.value)}
                      activeOpacity={0.85}
                    >
                      {role === opt.value && (
                        <LinearGradient
                          colors={['#2563EB', '#4F46E5']}
                          start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
                          style={StyleSheet.absoluteFill}
                        />
                      )}
                      <Ionicons
                        name={opt.icon} size={18}
                        color={role === opt.value ? '#FFF' : 'rgba(255,255,255,0.4)'}
                      />
                      <Text style={[styles.roleBtnText, role === opt.value && styles.roleBtnTextActive]}>
                        {opt.label}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>

                {/* Avatar */}
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
                      <Ionicons name="camera" size={13} color="#FFF" />
                    </View>
                  </TouchableOpacity>
                  <Text style={styles.avatarHint}>Toque para adicionar foto</Text>
                  {Platform.OS === 'web' && (
                    <input
                      ref={fileInputRef} type="file" accept="image/*"
                      style={{ display: 'none' }} onChange={handleWebFileChange}
                    />
                  )}
                </View>

                {/* ── Dados Pessoais ── */}
                <SectionHeader icon="person-circle-outline" title="Dados Pessoais" />

                <Field label="Nome completo" icon="person-outline" error={errors.name} focused={focusedField === 'name'}>
                  <TextInput style={styles.input} placeholder="Seu nome completo"
                    placeholderTextColor="rgba(255,255,255,0.25)" value={name}
                    onChangeText={v => { setName(v); clearErr('name'); }}
                    onFocus={() => focus('name')} onBlur={() => blur('name')}
                    autoCapitalize="words" />
                </Field>

                <Field label="E-mail" icon="mail-outline" error={errors.email} focused={focusedField === 'email'}>
                  <TextInput style={styles.input} placeholder="seu@email.com"
                    placeholderTextColor="rgba(255,255,255,0.25)" value={email}
                    onChangeText={v => { setEmail(v); clearErr('email'); }}
                    onFocus={() => focus('email')} onBlur={() => blur('email')}
                    keyboardType="email-address" autoCapitalize="none" autoCorrect={false} />
                </Field>

                <Field label="Telefone" icon="call-outline" error={errors.phone} focused={focusedField === 'phone'}>
                  <TextInput style={styles.input} placeholder="(11) 99999-9999"
                    placeholderTextColor="rgba(255,255,255,0.25)" value={phone}
                    onChangeText={v => { setPhone(formatPhone(v)); clearErr('phone'); }}
                    onFocus={() => focus('phone')} onBlur={() => blur('phone')}
                    keyboardType="phone-pad" />
                </Field>

                <Field label="Data de nascimento" icon="calendar-outline" error={errors.birthdate} focused={focusedField === 'birthdate'}>
                  <TextInput style={styles.input} placeholder="DD/MM/AAAA"
                    placeholderTextColor="rgba(255,255,255,0.25)" value={birthdate}
                    onChangeText={v => { setBirthdate(formatDate(v)); clearErr('birthdate'); }}
                    onFocus={() => focus('birthdate')} onBlur={() => blur('birthdate')}
                    keyboardType="numeric" />
                </Field>

                <Field label="CPF" icon="id-card-outline" error={errors.cpf} focused={focusedField === 'cpf'}>
                  <TextInput style={styles.input} placeholder="000.000.000-00"
                    placeholderTextColor="rgba(255,255,255,0.25)" value={cpf}
                    onChangeText={v => { setCpf(formatCPF(v)); clearErr('cpf'); }}
                    onFocus={() => focus('cpf')} onBlur={() => blur('cpf')}
                    keyboardType="numeric" />
                </Field>

                {/* ── Gênero ── */}
                <View style={styles.inputGroup}>
                  <Text style={styles.label}>Gênero</Text>
                  <View style={styles.chipRow}>
                    {[
                      { value: 'male',        label: 'Masculino' },
                      { value: 'female',      label: 'Feminino' },
                      { value: 'undisclosed', label: 'Não declarado' },
                    ].map(opt => (
                      <Chip key={opt.value} label={opt.label}
                        active={gender === opt.value}
                        onPress={() => setGender(opt.value)} />
                    ))}
                  </View>
                </View>

                {/* ── RENACH (somente alunos, opcional no cadastro) ── */}
                {role === 'user' && (
                  <Field label="RENACH (opcional)" icon="document-text-outline" error={errors.renach} focused={focusedField === 'renach'}>
                    <TextInput style={styles.input} placeholder="Ex: SP123456789"
                      placeholderTextColor="rgba(255,255,255,0.25)" value={renach}
                      onChangeText={v => { setRenach(v.toUpperCase()); clearErr('renach'); }}
                      onFocus={() => focus('renach')} onBlur={() => blur('renach')}
                      autoCapitalize="characters" maxLength={11} />
                  </Field>
                )}

                {/* ── Segurança ── */}
                <SectionHeader icon="lock-closed-outline" title="Segurança" />

                <Field label="Senha" icon="lock-closed-outline" error={errors.password} focused={focusedField === 'password'}>
                  <TextInput style={[styles.input, { flex: 1 }]} placeholder="Mín. 8 chars, maiúscula e número"
                    placeholderTextColor="rgba(255,255,255,0.25)" value={password}
                    onChangeText={v => { setPassword(v); clearErr('password'); }}
                    onFocus={() => focus('password')} onBlur={() => blur('password')}
                    secureTextEntry={!showPassword} />
                  <TouchableOpacity onPress={() => setShowPassword(v => !v)} style={styles.eyeBtn}>
                    <Ionicons name={showPassword ? 'eye-off-outline' : 'eye-outline'} size={18} color="rgba(255,255,255,0.4)" />
                  </TouchableOpacity>
                </Field>

                <Field label="Confirmar senha" icon="lock-closed-outline" error={errors.confirmPassword} focused={focusedField === 'confirmPassword'}>
                  <TextInput style={[styles.input, { flex: 1 }]} placeholder="Repita a senha"
                    placeholderTextColor="rgba(255,255,255,0.25)" value={confirmPassword}
                    onChangeText={v => { setConfirmPassword(v); clearErr('confirmPassword'); }}
                    onFocus={() => focus('confirmPassword')} onBlur={() => blur('confirmPassword')}
                    secureTextEntry={!showConfirm} />
                  <TouchableOpacity onPress={() => setShowConfirm(v => !v)} style={styles.eyeBtn}>
                    <Ionicons name={showConfirm ? 'eye-off-outline' : 'eye-outline'} size={18} color="rgba(255,255,255,0.4)" />
                  </TouchableOpacity>
                </Field>

                {/* ── Perfil Profissional (instrutor) ── */}
                {role === 'instructor' && (
                  <>
                    <SectionHeader icon="briefcase-outline" title="Perfil Profissional" />

                    <Field label="Nº de Registro de Instrutor" icon="ribbon-outline"
                      error={errors.instructorRegNum} focused={focusedField === 'instructorRegNum'}>
                      <TextInput style={styles.input} placeholder="Nº emitido pelo DETRAN"
                        placeholderTextColor="rgba(255,255,255,0.25)" value={instructorRegNum}
                        onChangeText={v => { setInstructorRegNum(v); clearErr('instructorRegNum'); }}
                        onFocus={() => focus('instructorRegNum')} onBlur={() => blur('instructorRegNum')}
                        autoCapitalize="characters" />
                    </Field>

                    <View style={styles.inputGroup}>
                      <Text style={styles.label}>Que tipo de aula você vai ministrar?</Text>
                      <View style={styles.chipRow}>
                        {[
                          { value: 'A', label: 'Moto (A)' },
                          { value: 'B', label: 'Carro (B)' },
                          { value: 'A+B', label: 'Moto + Carro' },
                        ].map(opt => (
                          <Chip key={opt.value} label={opt.label}
                            active={licenseCategory === opt.value}
                            onPress={() => setLicenseCategory(opt.value)} />
                        ))}
                      </View>
                    </View>

                    {/* Seção Carro */}
                    {(licenseCategory === 'B' || licenseCategory === 'A+B') && (
                      <>
                        <View style={styles.inputGroup}>
                          <Text style={styles.label}>Possui carro próprio?</Text>
                          <View style={styles.chipRow}>
                            {[{ value: false, label: 'Não' }, { value: true, label: 'Sim' }].map(opt => (
                              <Chip key={String(opt.value)} label={opt.label}
                                active={hasCar === opt.value}
                                onPress={() => { setHasCar(opt.value); if (!opt.value) setCarOptions('student'); }} />
                            ))}
                          </View>
                        </View>

                        {hasCar && (
                          <>
                            <View style={styles.inputGroup}>
                              <View style={{ flexDirection: 'row', gap: 8 }}>
                                <View style={[styles.inputWrapper, { flex: 3 }, errors.carModel && styles.inputWrapperError]}>
                                  <Ionicons name="car-outline" size={18} color="rgba(255,255,255,0.3)" style={styles.inputIcon} />
                                  <TextInput style={styles.input} placeholder="Marca e modelo *"
                                    placeholderTextColor="rgba(255,255,255,0.25)" value={carModel}
                                    onChangeText={v => { setCarModel(v); setErrors(e => ({ ...e, carModel: null })); }}
                                    autoCapitalize="words" />
                                </View>
                                <View style={[styles.inputWrapper, { flex: 2 }, errors.carYear && styles.inputWrapperError]}>
                                  <Ionicons name="calendar-outline" size={18} color="rgba(255,255,255,0.3)" style={styles.inputIcon} />
                                  <TextInput style={styles.input} placeholder="Ano *"
                                    placeholderTextColor="rgba(255,255,255,0.25)" value={carYear}
                                    onChangeText={v => { setCarYear(v); setErrors(e => ({ ...e, carYear: null })); }}
                                    keyboardType="number-pad" maxLength={4} />
                                </View>
                              </View>
                              {(errors.carModel || errors.carYear) && (
                                <View style={styles.errorRow}>
                                  <Ionicons name="alert-circle-outline" size={13} color="#F87171" />
                                  <Text style={styles.errorText}>{errors.carModel || errors.carYear}</Text>
                                </View>
                              )}
                            </View>

                            <View style={styles.inputGroup}>
                              <Text style={styles.label}>Tipo de câmbio do carro</Text>
                              <View style={styles.chipRow}>
                                {[
                                  { value: 'manual', label: 'Manual' },
                                  { value: 'automatic', label: 'Automático' },
                                  { value: 'electric', label: 'Elétrico' },
                                ].map(opt => (
                                  <Chip key={opt.value} label={opt.label}
                                    active={vehicleType === opt.value}
                                    onPress={() => setVehicleType(opt.value)} />
                                ))}
                              </View>
                            </View>
                          </>
                        )}

                        <View style={styles.infoBox}>
                          <Ionicons name="information-circle-outline" size={14} color="#60A5FA" />
                          <Text style={styles.infoText}>
                            A nova legislação permite aulas no veículo do próprio aluno. O veículo é opcional.
                          </Text>
                        </View>

                        <View style={styles.inputGroup}>
                          <Text style={styles.label}>
                            {licenseCategory === 'A+B' ? 'Aulas de carro — com qual veículo?' : 'Como serão realizadas as aulas?'}
                          </Text>
                          <View style={styles.chipRow}>
                            {[
                              { value: 'instructor', label: 'Meu carro', requiresCar: true },
                              { value: 'student', label: 'Carro do aluno', requiresCar: false },
                              { value: 'both', label: 'Ambos', requiresCar: true },
                            ].filter(opt => !opt.requiresCar || hasCar).map(opt => (
                              <Chip key={opt.value} label={opt.label}
                                active={carOptions === opt.value}
                                onPress={() => setCarOptions(opt.value)} />
                            ))}
                          </View>
                        </View>
                      </>
                    )}

                    {/* Seção Moto */}
                    {(licenseCategory === 'A' || licenseCategory === 'A+B') && (
                      <>
                        <View style={styles.inputGroup}>
                          <Text style={styles.label}>Possui moto própria?</Text>
                          <View style={styles.chipRow}>
                            {[{ value: false, label: 'Não' }, { value: true, label: 'Sim' }].map(opt => (
                              <Chip key={String(opt.value)} label={opt.label}
                                active={hasMoto === opt.value}
                                onPress={() => { setHasMoto(opt.value); if (!opt.value) setMotoOptions('student'); }} />
                            ))}
                          </View>
                        </View>

                        {hasMoto && (
                          <View style={styles.inputGroup}>
                            <View style={{ flexDirection: 'row', gap: 8 }}>
                              <View style={[styles.inputWrapper, { flex: 3 }, errors.motoModel && styles.inputWrapperError]}>
                                <Ionicons name="bicycle-outline" size={18} color="rgba(255,255,255,0.3)" style={styles.inputIcon} />
                                <TextInput style={styles.input} placeholder="Marca e modelo *"
                                  placeholderTextColor="rgba(255,255,255,0.25)" value={motoModel}
                                  onChangeText={v => { setMotoModel(v); setErrors(e => ({ ...e, motoModel: null })); }}
                                  autoCapitalize="words" />
                              </View>
                              <View style={[styles.inputWrapper, { flex: 2 }, errors.motoYear && styles.inputWrapperError]}>
                                <Ionicons name="calendar-outline" size={18} color="rgba(255,255,255,0.3)" style={styles.inputIcon} />
                                <TextInput style={styles.input} placeholder="Ano *"
                                  placeholderTextColor="rgba(255,255,255,0.25)" value={motoYear}
                                  onChangeText={v => { setMotoYear(v); setErrors(e => ({ ...e, motoYear: null })); }}
                                  keyboardType="number-pad" maxLength={4} />
                              </View>
                            </View>
                            {(errors.motoModel || errors.motoYear) && (
                              <View style={styles.errorRow}>
                                <Ionicons name="alert-circle-outline" size={13} color="#F87171" />
                                <Text style={styles.errorText}>{errors.motoModel || errors.motoYear}</Text>
                              </View>
                            )}
                          </View>
                        )}

                        <View style={styles.infoBox}>
                          <Ionicons name="information-circle-outline" size={14} color="#60A5FA" />
                          <Text style={styles.infoText}>
                            A nova legislação permite aulas na moto do próprio aluno. A moto é opcional.
                          </Text>
                        </View>

                        <View style={styles.inputGroup}>
                          <Text style={styles.label}>
                            {licenseCategory === 'A+B' ? 'Aulas de moto — com qual veículo?' : 'Como serão realizadas as aulas?'}
                          </Text>
                          <View style={styles.chipRow}>
                            {[
                              { value: 'instructor', label: 'Minha moto', requiresMoto: true },
                              { value: 'student', label: 'Moto do aluno', requiresMoto: false },
                              { value: 'both', label: 'Ambos', requiresMoto: true },
                            ].filter(opt => !opt.requiresMoto || hasMoto).map(opt => (
                              <Chip key={opt.value} label={opt.label}
                                active={motoOptions === opt.value}
                                onPress={() => setMotoOptions(opt.value)} />
                            ))}
                          </View>
                        </View>
                      </>
                    )}

                    {/* Bio */}
                    <View style={styles.inputGroup}>
                      <Text style={styles.label}>Apresentação / Bio</Text>
                      <View style={[styles.inputWrapper, styles.textareaWrapper, errors.bio && styles.inputWrapperError]}>
                        <TextInput
                          style={styles.textarea}
                          placeholder="Conte um pouco sobre sua experiência e estilo de ensino..."
                          placeholderTextColor="rgba(255,255,255,0.25)"
                          value={bio}
                          onChangeText={v => { setBio(v); clearErr('bio'); }}
                          onBlur={() => blur('bio')}
                          multiline numberOfLines={4}
                          textAlignVertical="top" maxLength={300}
                        />
                      </View>
                      <Text style={styles.charCount}>{bio.length}/300</Text>
                      {errors.bio ? (
                        <View style={styles.errorRow}>
                          <Ionicons name="alert-circle-outline" size={13} color="#F87171" />
                          <Text style={styles.errorText}>{errors.bio}</Text>
                        </View>
                      ) : null}
                    </View>
                  </>
                )}

                {/* ── Veículo (aluno) ── */}
                {role === 'user' && (
                  <>
                    <SectionHeader icon="car-outline" title="Veículo" />
                    <View style={styles.inputGroup}>
                      <Text style={styles.label}>Possui carro próprio?</Text>
                      <View style={styles.chipRow}>
                        {[{ value: false, label: 'Não' }, { value: true, label: 'Sim' }].map(opt => (
                          <Chip key={String(opt.value)} label={opt.label}
                            active={hasCar === opt.value}
                            onPress={() => setHasCar(opt.value)} />
                        ))}
                      </View>
                    </View>

                    {hasCar && (
                      <View style={styles.inputGroup}>
                        <View style={{ flexDirection: 'row', gap: 8 }}>
                          <View style={[styles.inputWrapper, { flex: 3 }]}>
                            <Ionicons name="car-outline" size={18} color="rgba(255,255,255,0.3)" style={styles.inputIcon} />
                            <TextInput style={styles.input} placeholder="Marca e modelo"
                              placeholderTextColor="rgba(255,255,255,0.25)" value={carModel}
                              onChangeText={setCarModel} autoCapitalize="words" />
                          </View>
                          <View style={[styles.inputWrapper, { flex: 2 }]}>
                            <Ionicons name="calendar-outline" size={18} color="rgba(255,255,255,0.3)" style={styles.inputIcon} />
                            <TextInput style={styles.input} placeholder="Ano"
                              placeholderTextColor="rgba(255,255,255,0.25)" value={carYear}
                              onChangeText={setCarYear} keyboardType="number-pad" maxLength={4} />
                          </View>
                        </View>
                      </View>
                    )}
                  </>
                )}

                {/* Termos */}
                <TouchableOpacity
                  style={styles.termsRow}
                  onPress={() => navigation.navigate('Terms', { role, readOnly: true })}
                  activeOpacity={0.7}
                >
                  <Ionicons name="document-text-outline" size={15} color="rgba(255,255,255,0.4)" />
                  <Text style={styles.termsText}>
                    Ao criar sua conta, você concorda com os{' '}
                    <Text style={styles.termsLink}>Termos de Uso</Text>
                    {' '}da Abily.
                  </Text>
                </TouchableOpacity>

                {/* Submit */}
                <TouchableOpacity onPress={handleRegister} disabled={loading}
                  activeOpacity={0.88} style={styles.btnOuter}>
                  <LinearGradient
                    colors={loading ? ['#334155', '#334155'] : ['#2563EB', '#4F46E5']}
                    start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
                    style={styles.btn}
                  >
                    {loading
                      ? <ActivityIndicator color="#FFF" size="small" />
                      : <Text style={styles.btnText}>Criar conta</Text>
                    }
                  </LinearGradient>
                </TouchableOpacity>

                <TouchableOpacity style={styles.loginLink} onPress={() => navigation.goBack()}>
                  <Text style={styles.loginLinkText}>
                    Já tem conta?{' '}
                    <Text style={styles.loginLinkBold}>Entrar</Text>
                  </Text>
                </TouchableOpacity>
              </View>

              <Text style={styles.footer}>Abily © {new Date().getFullYear()}</Text>
            </Animated.View>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#060B18' },
  safe: { flex: 1 },
  kav: { flex: 1 },
  scroll: { flexGrow: 1, paddingHorizontal: 24, paddingVertical: 24 },

  blobContainer: { ...StyleSheet.absoluteFillObject, overflow: 'hidden' },
  blobTop: {
    position: 'absolute', top: -100, left: -80,
    width: 300, height: 300, borderRadius: 150, overflow: 'hidden',
  },
  blobBottom: {
    position: 'absolute', bottom: -80, right: -60,
    width: 260, height: 260, borderRadius: 130, overflow: 'hidden',
  },

  header: { marginBottom: 24, paddingTop: 4 },
  backBtn: {
    width: 38, height: 38, borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.07)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)',
    alignItems: 'center', justifyContent: 'center', marginBottom: 20,
  },
  brand: { alignItems: 'center' },
  logoWrap: {
    width: 70, height: 70, borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.07)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)',
    alignItems: 'center', justifyContent: 'center', marginBottom: 12,
    ...makeShadow('#1D4ED8', 6, 0.35, 16, 10),
  },
  logo: { width: 46, height: 46 },
  brandName: { fontWeight: '800', color: '#FFFFFF', letterSpacing: 1 },
  brandSub: { fontSize: 13, color: 'rgba(255,255,255,0.45)', marginTop: 4 },

  form: { width: '100%', maxWidth: 520, alignSelf: 'center' },
  sectionLabel: { fontSize: 14, fontWeight: '600', color: 'rgba(255,255,255,0.7)', marginBottom: 12 },

  // Role selector — overflow hidden + absoluteFill gradient
  roleRow: { flexDirection: 'row', gap: 10, marginBottom: 28 },
  roleBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 7, paddingVertical: 13, borderRadius: 14, overflow: 'hidden',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)',
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  roleBtnActive: { borderColor: 'transparent' },
  roleBtnText: { fontSize: 13, fontWeight: '600', color: 'rgba(255,255,255,0.45)' },
  roleBtnTextActive: { color: '#FFF' },

  // Avatar
  avatarSection: { alignItems: 'center', marginBottom: 28 },
  avatarBtn: { position: 'relative' },
  avatarImg: { width: 88, height: 88, borderRadius: 44, borderWidth: 2.5, borderColor: '#2563EB' },
  avatarPlaceholder: {
    width: 88, height: 88, borderRadius: 44,
    backgroundColor: 'rgba(37,99,235,0.12)',
    borderWidth: 1.5, borderColor: 'rgba(96,165,250,0.4)',
    alignItems: 'center', justifyContent: 'center', borderStyle: 'dashed',
  },
  avatarInitials: { fontSize: 28, fontWeight: '800', color: '#60A5FA' },
  avatarBadge: {
    position: 'absolute', bottom: 2, right: 2,
    width: 26, height: 26, borderRadius: 13,
    backgroundColor: '#2563EB', borderWidth: 2, borderColor: '#060B18',
    alignItems: 'center', justifyContent: 'center',
  },
  avatarHint: { fontSize: 12, color: 'rgba(255,255,255,0.35)', marginTop: 8 },

  // Section header
  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 8, marginBottom: 16 },
  sectionIconBox: {
    width: 26, height: 26, borderRadius: 8,
    backgroundColor: 'rgba(37,99,235,0.2)',
    borderWidth: 1, borderColor: 'rgba(96,165,250,0.2)',
    alignItems: 'center', justifyContent: 'center',
  },
  sectionTitle: { fontSize: 12, fontWeight: '700', color: 'rgba(255,255,255,0.6)', textTransform: 'uppercase', letterSpacing: 0.8 },
  sectionLine: { flex: 1, height: 1, backgroundColor: 'rgba(255,255,255,0.07)' },

  // Inputs
  inputGroup: { marginBottom: 16 },
  labelRow: { flexDirection: 'row', alignItems: 'center' },
  label: { fontSize: 13, fontWeight: '600', color: 'rgba(255,255,255,0.65)', marginBottom: 8 },
  optionalTag: {
    marginLeft: 6, fontSize: 11, color: 'rgba(255,255,255,0.35)',
    backgroundColor: 'rgba(255,255,255,0.07)', borderRadius: 4, paddingHorizontal: 5, paddingVertical: 1,
  },
  inputWrapper: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 14, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)',
    paddingHorizontal: 14,
  },
  inputWrapperFocused: { borderColor: 'rgba(96,165,250,0.6)', backgroundColor: 'rgba(255,255,255,0.08)' },
  inputWrapperError: { borderColor: 'rgba(248,113,113,0.5)', backgroundColor: 'rgba(248,113,113,0.04)' },
  errorRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 5, marginLeft: 2 },
  errorText: { fontSize: 12, color: '#F87171' },
  inputIcon: { marginRight: 10 },
  input: { flex: 1, height: 50, fontSize: 15, color: '#F1F5F9', outlineWidth: 0 },
  eyeBtn: { padding: 4, marginLeft: 4 },

  // Info box
  infoBox: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 6,
    backgroundColor: 'rgba(37,99,235,0.12)',
    borderWidth: 1, borderColor: 'rgba(96,165,250,0.2)',
    borderRadius: 10, padding: 10, marginBottom: 14, marginTop: -4,
  },
  infoText: { fontSize: 12, color: '#93C5FD', flex: 1, lineHeight: 18 },

  // Textarea
  textareaWrapper: { alignItems: 'flex-start', paddingVertical: 14 },
  textarea: { width: '100%', minHeight: 96, fontSize: 14, color: '#F1F5F9', lineHeight: 21 },
  charCount: { fontSize: 11, color: 'rgba(255,255,255,0.3)', textAlign: 'right', marginTop: 4 },

  // Chips — padding always on the outer container; gradient is absoluteFill
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  chip: {
    overflow: 'hidden',
    borderRadius: 20,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.15)',
    backgroundColor: 'rgba(255,255,255,0.06)',
    paddingHorizontal: 18, paddingVertical: 10,
    alignItems: 'center', justifyContent: 'center',
  },
  chipActive: { borderColor: 'transparent' },
  chipText: { fontSize: 13, fontWeight: '600', color: 'rgba(255,255,255,0.5)' },
  chipTextActive: { color: '#FFF' },

  // Terms
  termsRow: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 8,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
    borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10,
    marginBottom: 16, marginTop: 8,
  },
  termsText: { flex: 1, fontSize: 12, color: 'rgba(255,255,255,0.4)', lineHeight: 18 },
  termsLink: { color: '#60A5FA', fontWeight: '700' },

  // Button
  btnOuter: { borderRadius: 14, overflow: 'hidden', ...makeShadow('#2563EB', 6, 0.4, 14, 8) },
  btn: { height: 54, alignItems: 'center', justifyContent: 'center', borderRadius: 14 },
  btnText: { color: '#FFF', fontSize: 16, fontWeight: '700', letterSpacing: 0.3 },

  loginLink: { alignItems: 'center', marginTop: 20, paddingVertical: 4 },
  loginLinkText: { fontSize: 14, color: 'rgba(255,255,255,0.45)' },
  loginLinkBold: { fontWeight: '700', color: '#60A5FA' },

  footer: { textAlign: 'center', color: 'rgba(255,255,255,0.2)', marginTop: 28, fontSize: 12 },
});
