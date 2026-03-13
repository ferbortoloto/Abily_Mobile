import React, { useState, useRef, useEffect } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  KeyboardAvoidingView, Platform, ActivityIndicator, Alert,
  useWindowDimensions, ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { useAuth } from '../../hooks/useAuth';
import { makeShadow } from '../../constants/theme';

const RESEND_COOLDOWN = 60;

export default function VerifyOTPScreen({ navigation, route }) {
  const { email, type = 'signup' } = route.params ?? {};
  const { verifyOtp, resendOtp, verifyLoginOtp, resendLoginOtp } = useAuth();

  const [digits, setDigits] = useState(Array(6).fill(''));
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const [error, setError] = useState('');

  const { width } = useWindowDimensions();
  // Calcula largura do input OTP dinamicamente
  // card padding (28*2) + container padding (24*2) + gaps entre 6 inputs (5*10) = 154
  const otpInputSize = Math.min(54, Math.floor((width - 154) / 6));

  const inputRefs = useRef([]);
  const cooldownRef = useRef(null);

  useEffect(() => {
    return () => { if (cooldownRef.current) clearInterval(cooldownRef.current); };
  }, []);

  // Reseta os campos e re-foca o primeiro input ao retornar à tela
  useFocusEffect(
    React.useCallback(() => {
      setDigits(Array(6).fill(''));
      setError('');
      setTimeout(() => { inputRefs.current[0]?.focus(); }, 100);
    }, [])
  );

  const startCooldown = () => {
    setCooldown(RESEND_COOLDOWN);
    cooldownRef.current = setInterval(() => {
      setCooldown(prev => {
        if (prev <= 1) { clearInterval(cooldownRef.current); return 0; }
        return prev - 1;
      });
    }, 1000);
  };

  const handleDigitChange = (value, index) => {
    const cleaned = value.replace(/\D/g, '');
    // Paste: mais de 1 dígito recebido de uma vez
    if (cleaned.length > 1) {
      const pasted = cleaned.slice(0, 6);
      const next = Array(6).fill('');
      pasted.split('').forEach((d, i) => { next[i] = d; });
      setDigits(next);
      setError('');
      inputRefs.current[Math.min(pasted.length, 5)]?.focus();
      return;
    }
    const digit = cleaned;
    const next = [...digits];
    next[index] = digit;
    setDigits(next);
    setError('');
    if (digit && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handleKeyPress = (e, index) => {
    if (e.nativeEvent.key === 'Backspace' && !digits[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  const code = digits.join('');

  const handleVerify = async () => {
    if (code.length < 6) {
      setError('Digite os 6 dígitos do código.');
      return;
    }
    setError('');
    setLoading(true);
    try {
      await (type === 'login' ? verifyLoginOtp(email, code) : verifyOtp(email, code));
      // AuthContext seta isAuthenticated → AppNavigator redireciona automaticamente
    } catch (err) {
      setError('Código inválido ou expirado. Tente novamente.');
      setDigits(Array(6).fill(''));
      inputRefs.current[0]?.focus();
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    if (cooldown > 0 || resending) return;
    setResending(true);
    setError('');
    try {
      await (type === 'login' ? resendLoginOtp(email) : resendOtp(email));
      startCooldown();
    } catch (err) {
      Alert.alert('Erro', 'Não foi possível reenviar o código. Tente novamente.');
    } finally {
      setResending(false);
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
            contentContainerStyle={styles.container}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            {/* Back */}
            <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
              <Ionicons name="arrow-back" size={22} color="#FFF" />
            </TouchableOpacity>

            {/* Card */}
            <View style={styles.card}>
              <View style={styles.iconBox}>
                <Ionicons name="mail-open-outline" size={40} color="#1D4ED8" />
              </View>

              <Text style={styles.title}>Verifique seu e-mail</Text>
              <Text style={styles.subtitle}>
                Enviamos um código de 6 dígitos para{'\n'}
                <Text style={styles.emailText}>{email}</Text>
              </Text>

              {/* OTP inputs */}
              <View style={styles.otpRow}>
                {digits.map((d, i) => (
                  <TextInput
                    key={i}
                    ref={ref => { inputRefs.current[i] = ref; }}
                    style={[
                      styles.otpInput,
                      { width: otpInputSize, height: otpInputSize + 10 },
                      error && styles.otpInputError,
                    ]}
                    value={d}
                    onChangeText={(v) => handleDigitChange(v, i)}
                    onKeyPress={(e) => handleKeyPress(e, i)}
                    keyboardType="number-pad"
                    selectTextOnFocus
                  />
                ))}
              </View>

              {error ? (
                <View style={styles.errorRow}>
                  <Ionicons name="alert-circle-outline" size={14} color="#EF4444" />
                  <Text style={styles.errorText}>{error}</Text>
                </View>
              ) : null}

              {/* Verify button */}
              <TouchableOpacity
                style={[styles.btn, (loading || code.length < 6) && styles.btnDisabled]}
                onPress={handleVerify}
                disabled={loading || code.length < 6}
                activeOpacity={0.85}
              >
                {loading ? (
                  <ActivityIndicator color="#FFF" />
                ) : (
                  <>
                    <Ionicons name="checkmark-circle-outline" size={20} color="#FFF" style={{ marginRight: 8 }} />
                    <Text style={styles.btnText}>Verificar código</Text>
                  </>
                )}
              </TouchableOpacity>

              {/* Resend */}
              <TouchableOpacity
                style={styles.resendBtn}
                onPress={handleResend}
                disabled={cooldown > 0 || resending}
                activeOpacity={0.7}
              >
                {resending ? (
                  <ActivityIndicator size="small" color="#1D4ED8" />
                ) : cooldown > 0 ? (
                  <Text style={styles.resendTextDisabled}>
                    Reenviar código em {cooldown}s
                  </Text>
                ) : (
                  <Text style={styles.resendText}>Reenviar código</Text>
                )}
              </TouchableOpacity>
            </View>
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
  container: { flexGrow: 1, paddingHorizontal: 24, paddingTop: 16, paddingBottom: 32, justifyContent: 'center' },

  backBtn: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center', justifyContent: 'center',
    marginBottom: 24, alignSelf: 'flex-start',
  },

  card: {
    backgroundColor: '#FFF', borderRadius: 24, padding: 28,
    alignItems: 'center',
    ...makeShadow('#000', 8, 0.15, 16, 10),
  },

  iconBox: {
    width: 80, height: 80, borderRadius: 40,
    backgroundColor: '#EFF6FF', alignItems: 'center', justifyContent: 'center',
    marginBottom: 20,
  },

  title: { fontSize: 22, fontWeight: '700', color: '#0F172A', marginBottom: 10, textAlign: 'center' },
  subtitle: { fontSize: 14, color: '#64748B', textAlign: 'center', lineHeight: 22, marginBottom: 28 },
  emailText: { fontWeight: '700', color: '#1D4ED8' },

  otpRow: { flexDirection: 'row', gap: 10, marginBottom: 8 },
  otpInput: {
    borderRadius: 12,
    borderWidth: 1.5, borderColor: '#E2E8F0',
    backgroundColor: '#F8FAFC',
    fontSize: 22, fontWeight: '700', color: '#0F172A',
    textAlign: 'center',
  },
  otpInputError: { borderColor: '#EF4444', backgroundColor: '#FFF5F5' },

  errorRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 16, marginTop: 4 },
  errorText: { fontSize: 12, color: '#EF4444' },

  btn: {
    width: '100%', backgroundColor: '#1D4ED8', borderRadius: 14, height: 52, marginTop: 20,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    ...makeShadow('#1D4ED8', 4, 0.3, 8, 6),
  },
  btnDisabled: { opacity: 0.5 },
  btnText: { color: '#FFF', fontSize: 16, fontWeight: '700' },

  resendBtn: { marginTop: 16, paddingVertical: 8 },
  resendText: { fontSize: 14, color: '#1D4ED8', fontWeight: '600' },
  resendTextDisabled: { fontSize: 14, color: '#94A3B8' },
});
