import React, { useState, useRef, useEffect } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  KeyboardAvoidingView, Platform, ActivityIndicator,
  ScrollView, Alert,
} from 'react-native';

const MAX_ATTEMPTS = 3;  // falhas antes do lockout
const LOCKOUT_SECONDS = 60;
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../hooks/useAuth';
import { mapAuthError } from '../../utils/authErrors';
import { makeShadow } from '../../constants/theme';

export default function LoginScreen({ navigation }) {
  const { login, resendOtp, setPendingOtp } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [errors, setErrors] = useState({});
  const [failCount, setFailCount] = useState(0);
  const [lockout, setLockout] = useState(0);
  const lockoutRef = useRef(null);

  useEffect(() => {
    return () => { if (lockoutRef.current) clearInterval(lockoutRef.current); };
  }, []);

  const startLockout = () => {
    setLockout(LOCKOUT_SECONDS);
    lockoutRef.current = setInterval(() => {
      setLockout(prev => {
        if (prev <= 1) {
          clearInterval(lockoutRef.current);
          setFailCount(0);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  const clearErr = (field) =>
    setErrors(prev => { const next = { ...prev }; delete next[field]; return next; });

  const validateAll = () => {
    const errs = {};
    if (!email.trim() || !email.includes('@'))
      errs.email = 'Informe um e-mail válido.';
    if (!password.trim())
      errs.password = 'Informe sua senha.';
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
    if (Object.keys(errs).length > 0) {
      setErrors(errs);
      return;
    }
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
        // E-mail cadastrado mas não confirmado — reenviar código automaticamente e ir para a tela de OTP
        try {
          const otpParams = { email: email.trim().toLowerCase(), type: 'signup' };
          await resendOtp(email.trim().toLowerCase());
          await setPendingOtp(otpParams);
          navigation.navigate('VerifyOTP', otpParams);
        } catch (_) {
          Alert.alert('Erro', 'Não foi possível reenviar o código. Tente novamente.');
        }
        return;
      }

      const newCount = failCount + 1;
      setFailCount(newCount);
      if (newCount >= MAX_ATTEMPTS) {
        startLockout();
        Alert.alert(
          'Muitas tentativas',
          `Por segurança, aguarde ${LOCKOUT_SECONDS} segundos antes de tentar novamente.`,
        );
      } else {
        Alert.alert('Erro ao entrar', mapAuthError(err));
      }
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
          <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
            {/* Logo / Brand */}
            <View style={styles.brand}>
              <View style={styles.logoCircle}>
                <Ionicons name="car-sport" size={38} color="#1D4ED8" />
              </View>
              <Text style={styles.brandName}>Abily</Text>
              <Text style={styles.brandSub}>Conectando alunos e instrutores</Text>
            </View>

            {/* Card */}
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Bem-vindo de volta!</Text>
              <Text style={styles.cardSub}>Entre na sua conta para continuar</Text>

              {/* E-mail */}
              <View style={styles.inputGroup}>
                <Text style={styles.label}>E-mail</Text>
                <View style={[styles.inputWrapper, errors.email && styles.inputWrapperError]}>
                  <Ionicons
                    name="mail-outline"
                    size={18}
                    color={errors.email ? '#EF4444' : '#94A3B8'}
                    style={styles.inputIcon}
                  />
                  <TextInput
                    style={styles.input}
                    placeholder="seu@email.com"
                    placeholderTextColor="#CBD5E1"
                    value={email}
                    onChangeText={(v) => { setEmail(v); clearErr('email'); }}
                    onBlur={() => blurField('email')}
                    keyboardType="email-address"
                    autoCapitalize="none"
                    autoCorrect={false}
                  />
                </View>
                {errors.email ? <Text style={styles.errorText}>{errors.email}</Text> : null}
              </View>

              {/* Senha */}
              <View style={styles.inputGroup}>
                <Text style={styles.label}>Senha</Text>
                <View style={[styles.inputWrapper, errors.password && styles.inputWrapperError]}>
                  <Ionicons
                    name="lock-closed-outline"
                    size={18}
                    color={errors.password ? '#EF4444' : '#94A3B8'}
                    style={styles.inputIcon}
                  />
                  <TextInput
                    style={[styles.input, { flex: 1 }]}
                    placeholder="••••••"
                    placeholderTextColor="#CBD5E1"
                    value={password}
                    onChangeText={(v) => { setPassword(v); clearErr('password'); }}
                    onBlur={() => blurField('password')}
                    secureTextEntry={!showPassword}
                  />
                  <TouchableOpacity onPress={() => setShowPassword(v => !v)} style={styles.eyeBtn}>
                    <Ionicons
                      name={showPassword ? 'eye-off-outline' : 'eye-outline'}
                      size={18}
                      color="#94A3B8"
                    />
                  </TouchableOpacity>
                </View>
                {errors.password ? <Text style={styles.errorText}>{errors.password}</Text> : null}
              </View>

              {/* Hint */}
              <View style={styles.hintBox}>
                <Ionicons name="information-circle-outline" size={14} color="#1D4ED8" />
                <Text style={styles.hintText}>
                  Novo por aqui? Crie sua conta gratuitamente clicando em "Criar conta".
                </Text>
              </View>

              {/* Aviso de tentativas restantes */}
              {failCount > 0 && lockout === 0 && (
                <View style={styles.attemptsWarn}>
                  <Ionicons name="warning-outline" size={14} color="#F59E0B" />
                  <Text style={styles.attemptsWarnText}>
                    {MAX_ATTEMPTS - failCount} tentativa{MAX_ATTEMPTS - failCount !== 1 ? 's' : ''} restante{MAX_ATTEMPTS - failCount !== 1 ? 's' : ''}
                  </Text>
                </View>
              )}

              {/* Botão */}
              <TouchableOpacity
                style={[styles.btn, (loading || lockout > 0) && styles.btnDisabled]}
                onPress={handleLogin}
                disabled={loading || lockout > 0}
                activeOpacity={0.85}
              >
                {loading ? (
                  <ActivityIndicator color="#FFF" />
                ) : lockout > 0 ? (
                  <>
                    <Ionicons name="time-outline" size={20} color="#FFF" style={{ marginRight: 8 }} />
                    <Text style={styles.btnText}>Aguarde {lockout}s</Text>
                  </>
                ) : (
                  <>
                    <Ionicons name="log-in-outline" size={20} color="#FFF" style={{ marginRight: 8 }} />
                    <Text style={styles.btnText}>Entrar</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>

            <TouchableOpacity style={styles.registerLink} onPress={() => navigation.navigate('Register')}>
              <Text style={styles.registerLinkText}>
                Ainda não tem conta?{' '}
                <Text style={styles.registerLinkBold}>Criar conta</Text>
              </Text>
            </TouchableOpacity>

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
  scroll: { flexGrow: 1, justifyContent: 'center', paddingHorizontal: 24, paddingVertical: 40 },

  brand: { alignItems: 'center', marginBottom: 36 },
  logoCircle: {
    width: 84, height: 84, borderRadius: 42,
    backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center',
    ...makeShadow('#000', 6, 0.25, 12, 10), marginBottom: 16,
  },
  brandName: { fontSize: 34, fontWeight: '800', color: '#FFFFFF', letterSpacing: 0.5 },
  brandSub: { fontSize: 14, color: 'rgba(255,255,255,0.65)', marginTop: 6, letterSpacing: 0.2 },

  card: {
    backgroundColor: '#FFFFFF', borderRadius: 24, padding: 24,
    ...makeShadow('#000', 12, 0.2, 20, 12),
  },
  cardTitle: { fontSize: 22, fontWeight: '700', color: '#0F172A', marginBottom: 4 },
  cardSub: { fontSize: 14, color: '#64748B', marginBottom: 24 },

  inputGroup: { marginBottom: 16 },
  label: { fontSize: 13, fontWeight: '600', color: '#374151', marginBottom: 6 },
  inputWrapper: {
    flexDirection: 'row', alignItems: 'center',
    borderWidth: 1.5, borderColor: '#E2E8F0', borderRadius: 12,
    backgroundColor: '#F8FAFC', paddingHorizontal: 12,
  },
  inputWrapperError: {
    borderColor: '#EF4444',
    backgroundColor: '#FFF5F5',
  },
  errorText: {
    fontSize: 12, color: '#EF4444', marginTop: 4, marginLeft: 2,
  },
  inputIcon: { marginRight: 8 },
  input: { flex: 1, height: 48, fontSize: 15, color: '#0F172A' },
  eyeBtn: { padding: 4 },

  hintBox: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: '#EFF6FF', borderRadius: 8, padding: 10, marginBottom: 20,
  },
  hintText: { fontSize: 11, color: '#1D4ED8', flex: 1 },

  btn: {
    backgroundColor: '#1D4ED8', borderRadius: 14, height: 52,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    ...makeShadow('#1D4ED8', 4, 0.35, 8, 6),
  },
  btnDisabled: { opacity: 0.6 },

  attemptsWarn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: '#FFFBEB', borderRadius: 8, padding: 10, marginBottom: 12,
    borderWidth: 1, borderColor: '#FDE68A',
  },
  attemptsWarnText: { fontSize: 12, color: '#92400E', fontWeight: '600' },
  btnText: { color: '#FFFFFF', fontSize: 16, fontWeight: '700' },

  registerLink: { alignItems: 'center', marginTop: 24 },
  registerLinkText: { fontSize: 14, color: 'rgba(255,255,255,0.75)' },
  registerLinkBold: { fontWeight: '700', color: '#FFFFFF' },

  footer: { textAlign: 'center', color: 'rgba(255,255,255,0.4)', marginTop: 20, fontSize: 12 },
});
