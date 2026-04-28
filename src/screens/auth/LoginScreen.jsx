import React, { useState, useRef, useEffect } from 'react';
import {
  View, Text, Image, TextInput, TouchableOpacity, StyleSheet,
  KeyboardAvoidingView, Platform, ActivityIndicator,
  ScrollView, useWindowDimensions, Animated,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../hooks/useAuth';
import { mapAuthError } from '../../utils/authErrors';
import { makeShadow } from '../../constants/theme';
import { toast } from '../../utils/toast';

const MAX_ATTEMPTS = 3;
const LOCKOUT_SECONDS = 60;
const logoImg = require('../../../assets/logo.png');

export default function LoginScreen({ navigation }) {
  const { login, resendOtp, setPendingOtp } = useAuth();
  const { width } = useWindowDimensions();
  const isSmall = width < 380;

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [errors, setErrors] = useState({});
  const [failCount, setFailCount] = useState(0);
  const [lockout, setLockout] = useState(0);
  const [emailFocused, setEmailFocused] = useState(false);
  const [passwordFocused, setPasswordFocused] = useState(false);
  const lockoutRef = useRef(null);

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(32)).current;
  const blobAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 700, useNativeDriver: true }),
      Animated.timing(slideAnim, { toValue: 0, duration: 700, useNativeDriver: true }),
    ]).start();

    Animated.loop(
      Animated.sequence([
        Animated.timing(blobAnim, { toValue: 1.18, duration: 3200, useNativeDriver: true }),
        Animated.timing(blobAnim, { toValue: 1, duration: 3200, useNativeDriver: true }),
      ])
    ).start();

    return () => { if (lockoutRef.current) clearInterval(lockoutRef.current); };
  }, []);

  const startLockout = () => {
    setLockout(LOCKOUT_SECONDS);
    lockoutRef.current = setInterval(() => {
      setLockout(prev => {
        if (prev <= 1) { clearInterval(lockoutRef.current); setFailCount(0); return 0; }
        return prev - 1;
      });
    }, 1000);
  };

  const clearErr = (field) =>
    setErrors(prev => { const next = { ...prev }; delete next[field]; return next; });

  const validateAll = () => {
    const errs = {};
    if (!email.trim() || !email.includes('@')) errs.email = 'Informe um e-mail válido.';
    if (!password.trim()) errs.password = 'Informe sua senha.';
    return errs;
  };

  const blurField = (field) => {
    const errs = validateAll();
    setErrors(prev => {
      const next = { ...prev };
      if (errs[field]) next[field] = errs[field];
      else delete next[field];
      return next;
    });
  };

  const handleLogin = async () => {
    if (lockout > 0) return;
    const errs = validateAll();
    if (Object.keys(errs).length > 0) { setErrors(errs); return; }
    setErrors({});
    setLoading(true);
    try {
      const { needsOtp } = await login(email.trim(), password);
      setFailCount(0);
      if (needsOtp) {
        const otpParams = { email: email.trim().toLowerCase(), type: 'login' };
        await setPendingOtp(otpParams);
        navigation.navigate('VerifyOTP', otpParams);
        return;
      }
    } catch (err) {
      const msg = (err?.message || '').toLowerCase();
      const code = (err?.code || '').toLowerCase();
      const isUnconfirmed = msg.includes('email not confirmed') || code === 'email_not_confirmed';

      if (isUnconfirmed) {
        try {
          const otpParams = { email: email.trim().toLowerCase(), type: 'signup' };
          await resendOtp(email.trim().toLowerCase());
          await setPendingOtp(otpParams);
          navigation.navigate('VerifyOTP', otpParams);
        } catch (_) {
          toast.error('Não foi possível reenviar o código. Tente novamente.');
        }
        return;
      }

      const newCount = failCount + 1;
      setFailCount(newCount);
      if (newCount >= MAX_ATTEMPTS) {
        startLockout();
        toast.error(`Muitas tentativas. Aguarde ${LOCKOUT_SECONDS}s antes de tentar novamente.`);
      } else {
        toast.error(mapAuthError(err));
      }
    } finally {
      setLoading(false);
    }
  };

  const isDisabled = loading || lockout > 0;

  return (
    <View style={styles.root}>
      {/* Background gradient */}
      <LinearGradient
        colors={['#060B18', '#091530', '#0B1E45']}
        style={StyleSheet.absoluteFill}
      />

      {/* Decorative blobs — isolated container with overflow hidden to prevent scroll leak */}
      <View style={styles.blobContainer} pointerEvents="none">
        <Animated.View style={[styles.blobTop, { transform: [{ scale: blobAnim }] }]}>
          <LinearGradient
            colors={['rgba(29,78,216,0.45)', 'rgba(29,78,216,0)']}
            style={StyleSheet.absoluteFill}
            start={{ x: 0.5, y: 0.5 }} end={{ x: 1, y: 1 }}
          />
        </Animated.View>
        <Animated.View style={[styles.blobBottom, { transform: [{ scale: blobAnim }] }]}>
          <LinearGradient
            colors={['rgba(109,40,217,0.3)', 'rgba(109,40,217,0)']}
            style={StyleSheet.absoluteFill}
            start={{ x: 0.5, y: 0.5 }} end={{ x: 0, y: 0 }}
          />
        </Animated.View>
      </View>

      <SafeAreaView style={styles.safe}>
        {/* KeyboardAvoidingView + ScrollView para teclado funcionar em aparelhos pequenos */}
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.kav}
        >
          <ScrollView
            contentContainerStyle={styles.scroll}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
            bounces={false}
          >
            <Animated.View
              style={[styles.content, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}
            >
              {/* Brand */}
              <View style={[styles.brand, { marginBottom: isSmall ? 24 : 36 }]}>
                <View style={styles.logoWrap}>
                  <Image source={logoImg} style={styles.logo} resizeMode="contain" />
                </View>
                <Text style={[styles.brandName, { fontSize: isSmall ? 30 : 38 }]}>Abily</Text>
                <Text style={styles.brandSub}>Conectando alunos e instrutores</Text>
              </View>

              {/* Form */}
              <View style={styles.form}>
                <Text style={[styles.formTitle, { fontSize: isSmall ? 18 : 22 }]}>Bem-vindo de volta</Text>

                {/* E-mail */}
                <View style={styles.fieldGroup}>
                  <View style={[
                    styles.inputRow,
                    emailFocused && styles.inputRowFocused,
                    errors.email && styles.inputRowError,
                  ]}>
                    <Ionicons
                      name="mail-outline" size={19}
                      color={errors.email ? '#F87171' : emailFocused ? '#60A5FA' : 'rgba(255,255,255,0.35)'}
                      style={styles.fieldIcon}
                    />
                    <TextInput
                      style={styles.fieldInput}
                      placeholder="seu@email.com"
                      placeholderTextColor="rgba(255,255,255,0.25)"
                      value={email}
                      onChangeText={(v) => { setEmail(v); clearErr('email'); }}
                      onFocus={() => setEmailFocused(true)}
                      onBlur={() => { setEmailFocused(false); blurField('email'); }}
                      keyboardType="email-address"
                      autoCapitalize="none"
                      autoCorrect={false}
                    />
                  </View>
                  {errors.email ? (
                    <View style={styles.errorRow}>
                      <Ionicons name="alert-circle-outline" size={13} color="#F87171" />
                      <Text style={styles.errorText}>{errors.email}</Text>
                    </View>
                  ) : null}
                </View>

                {/* Senha */}
                <View style={styles.fieldGroup}>
                  <View style={[
                    styles.inputRow,
                    passwordFocused && styles.inputRowFocused,
                    errors.password && styles.inputRowError,
                  ]}>
                    <Ionicons
                      name="lock-closed-outline" size={19}
                      color={errors.password ? '#F87171' : passwordFocused ? '#60A5FA' : 'rgba(255,255,255,0.35)'}
                      style={styles.fieldIcon}
                    />
                    <TextInput
                      style={[styles.fieldInput, { flex: 1 }]}
                      placeholder="Senha"
                      placeholderTextColor="rgba(255,255,255,0.25)"
                      value={password}
                      onChangeText={(v) => { setPassword(v); clearErr('password'); }}
                      onFocus={() => setPasswordFocused(true)}
                      onBlur={() => { setPasswordFocused(false); blurField('password'); }}
                      secureTextEntry={!showPassword}
                    />
                    <TouchableOpacity onPress={() => setShowPassword(v => !v)} style={styles.eyeBtn}>
                      <Ionicons
                        name={showPassword ? 'eye-off-outline' : 'eye-outline'}
                        size={19} color="rgba(255,255,255,0.4)"
                      />
                    </TouchableOpacity>
                  </View>
                  {errors.password ? (
                    <View style={styles.errorRow}>
                      <Ionicons name="alert-circle-outline" size={13} color="#F87171" />
                      <Text style={styles.errorText}>{errors.password}</Text>
                    </View>
                  ) : null}
                </View>

                {/* Esqueci / tentativas */}
                <View style={styles.forgotRow}>
                  {failCount > 0 && lockout === 0 ? (
                    <View style={styles.attemptsRow}>
                      <Ionicons name="warning-outline" size={13} color="#FCD34D" />
                      <Text style={styles.attemptsText}>
                        {MAX_ATTEMPTS - failCount} tentativa{MAX_ATTEMPTS - failCount !== 1 ? 's' : ''} restante{MAX_ATTEMPTS - failCount !== 1 ? 's' : ''}
                      </Text>
                    </View>
                  ) : <View />}
                  <TouchableOpacity onPress={() => navigation.navigate('ForgotPassword')}>
                    <Text style={styles.forgotText}>Esqueci a senha</Text>
                  </TouchableOpacity>
                </View>

                {/* CTA */}
                <TouchableOpacity
                  onPress={handleLogin} disabled={isDisabled}
                  activeOpacity={0.88} style={styles.btnOuter}
                >
                  <LinearGradient
                    colors={isDisabled ? ['#334155', '#334155'] : ['#2563EB', '#4F46E5']}
                    start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
                    style={styles.btn}
                  >
                    {loading ? (
                      <ActivityIndicator color="#FFF" size="small" />
                    ) : lockout > 0 ? (
                      <>
                        <Ionicons name="time-outline" size={19} color="#FFF" style={{ marginRight: 8 }} />
                        <Text style={styles.btnText}>Aguarde {lockout}s</Text>
                      </>
                    ) : (
                      <Text style={styles.btnText}>Entrar</Text>
                    )}
                  </LinearGradient>
                </TouchableOpacity>

                {/* Divider */}
                <View style={styles.divider}>
                  <View style={styles.dividerLine} />
                  <Text style={styles.dividerText}>ou</Text>
                  <View style={styles.dividerLine} />
                </View>

                {/* Criar conta */}
                <TouchableOpacity
                  style={styles.registerBtn}
                  onPress={() => navigation.navigate('Register')}
                  activeOpacity={0.8}
                >
                  <Text style={styles.registerBtnText}>Criar conta</Text>
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

  // Blobs isolated in their own absoluteFill container — overflow hidden prevents scroll leak
  blobContainer: {
    ...StyleSheet.absoluteFillObject,
    overflow: 'hidden',
  },
  blobTop: {
    position: 'absolute', top: -120, left: -80,
    width: 340, height: 340, borderRadius: 170, overflow: 'hidden',
  },
  blobBottom: {
    position: 'absolute', bottom: -100, right: -60,
    width: 280, height: 280, borderRadius: 140, overflow: 'hidden',
  },

  // ScrollView apenas para suporte ao teclado, sem crescimento extra
  scroll: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: 24,
    paddingVertical: 32,
  },
  content: { width: '100%' },

  // Brand
  brand: { alignItems: 'center' },
  logoWrap: {
    width: 80, height: 80, borderRadius: 24,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)',
    alignItems: 'center', justifyContent: 'center',
    marginBottom: 16,
    ...makeShadow('#1D4ED8', 8, 0.4, 20, 12),
  },
  logo: { width: 52, height: 52 },
  brandName: { fontWeight: '800', color: '#FFFFFF', letterSpacing: 1 },
  brandSub: { fontSize: 13, color: 'rgba(255,255,255,0.45)', marginTop: 6, letterSpacing: 0.3 },

  // Form
  form: { width: '100%', maxWidth: 440, alignSelf: 'center' },
  formTitle: { fontWeight: '700', color: '#F1F5F9', marginBottom: 20 },

  fieldGroup: { marginBottom: 14 },
  inputRow: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 14, borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    paddingHorizontal: 14, height: 54,
  },
  inputRowFocused: {
    borderColor: 'rgba(96,165,250,0.6)',
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  inputRowError: {
    borderColor: 'rgba(248,113,113,0.5)',
    backgroundColor: 'rgba(248,113,113,0.05)',
  },
  fieldIcon: { marginRight: 10 },
  fieldInput: { flex: 1, height: 54, fontSize: 15, color: '#F1F5F9', letterSpacing: 0.2 },
  eyeBtn: { padding: 4, marginLeft: 4 },

  errorRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 5, marginLeft: 2 },
  errorText: { fontSize: 12, color: '#F87171' },

  forgotRow: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'center', marginBottom: 20, marginTop: 4,
  },
  forgotText: { fontSize: 13, color: '#60A5FA', fontWeight: '600' },
  attemptsRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  attemptsText: { fontSize: 12, color: '#FCD34D', fontWeight: '600' },

  btnOuter: {
    borderRadius: 14, overflow: 'hidden',
    ...makeShadow('#2563EB', 6, 0.4, 14, 8),
  },
  btn: { height: 54, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', borderRadius: 14 },
  btnText: { color: '#FFFFFF', fontSize: 16, fontWeight: '700', letterSpacing: 0.3 },

  divider: { flexDirection: 'row', alignItems: 'center', marginVertical: 18, gap: 10 },
  dividerLine: { flex: 1, height: 1, backgroundColor: 'rgba(255,255,255,0.1)' },
  dividerText: { fontSize: 12, color: 'rgba(255,255,255,0.3)', fontWeight: '600' },

  registerBtn: {
    height: 54, borderRadius: 14,
    borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  registerBtnText: { color: '#F1F5F9', fontSize: 15, fontWeight: '600', letterSpacing: 0.2 },

  footer: { textAlign: 'center', color: 'rgba(255,255,255,0.2)', marginTop: 28, fontSize: 12 },
});
