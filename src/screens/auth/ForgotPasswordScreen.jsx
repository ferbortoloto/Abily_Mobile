import React, { useState } from 'react';
import {
  View, Text, Image, TextInput, TouchableOpacity, StyleSheet,
  KeyboardAvoidingView, Platform, ActivityIndicator,
  ScrollView, useWindowDimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { resetPassword } from '../../services/auth.service';
import { makeShadow } from '../../constants/theme';

const logoImg = require('../../../assets/logo.png');

export default function ForgotPasswordScreen({ navigation }) {
  const { width } = useWindowDimensions();
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const cardMaxWidth = Math.min(width - 48, 480);

  const handleSend = async () => {
    const trimmed = email.trim();
    if (!trimmed || !trimmed.includes('@')) {
      setError('Informe um e-mail válido.');
      return;
    }
    setError('');
    setLoading(true);
    try {
      await resetPassword(trimmed.toLowerCase());
      navigation.navigate('VerifyOTP', { email: trimmed.toLowerCase(), type: 'recovery' });
    } catch (err) {
      const msg = err?.message || '';
      if (msg === 'EMAIL_NOT_FOUND') {
        setError('Este e-mail não está cadastrado. Crie uma conta primeiro.');
      } else if (msg.includes('429') || msg.toLowerCase().includes('rate limit') || msg.toLowerCase().includes('too many')) {
        setError('Muitas tentativas. Aguarde alguns minutos e tente novamente.');
      } else {
        setError('Não foi possível enviar o código. Tente novamente.');
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
            contentContainerStyle={styles.scroll}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            {/* Botão voltar */}
            <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
              <Ionicons name="arrow-back" size={22} color="#FFFFFF" />
            </TouchableOpacity>

            {/* Logo */}
            <View style={styles.brand}>
              <Image source={logoImg} style={styles.logoCircle} resizeMode="contain" />
              <Text style={styles.brandName}>Abily</Text>
            </View>

            {/* Card */}
            <View style={[styles.card, { width: cardMaxWidth }]}>
              <View style={styles.iconHeader}>
                <Ionicons name="key-outline" size={28} color="#1D4ED8" />
              </View>
              <Text style={styles.cardTitle}>Esqueceu a senha?</Text>
              <Text style={styles.cardSub}>
                Informe seu e-mail e enviaremos um código de 6 dígitos para criar uma nova senha.
              </Text>

              <View style={styles.inputGroup}>
                <Text style={styles.label}>E-mail</Text>
                <View style={[styles.inputWrapper, error && styles.inputWrapperError]}>
                  <Ionicons
                    name="mail-outline"
                    size={18}
                    color={error ? '#EF4444' : '#94A3B8'}
                    style={styles.inputIcon}
                  />
                  <TextInput
                    style={styles.input}
                    placeholder="seu@email.com"
                    placeholderTextColor="#CBD5E1"
                    value={email}
                    onChangeText={(v) => { setEmail(v); setError(''); }}
                    keyboardType="email-address"
                    autoCapitalize="none"
                    autoCorrect={false}
                    autoFocus
                  />
                </View>
                {error ? <Text style={styles.errorText}>{error}</Text> : null}
              </View>

              <TouchableOpacity
                style={[styles.btn, loading && styles.btnDisabled]}
                onPress={handleSend}
                disabled={loading}
                activeOpacity={0.85}
              >
                {loading ? (
                  <ActivityIndicator color="#FFF" />
                ) : (
                  <>
                    <Ionicons name="send-outline" size={18} color="#FFF" style={{ marginRight: 8 }} />
                    <Text style={styles.btnText}>Enviar código</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>

            <TouchableOpacity style={styles.backLink} onPress={() => navigation.navigate('Login')}>
              <Text style={styles.backLinkText}>
                Lembrou a senha?{' '}
                <Text style={styles.backLinkBold}>Entrar</Text>
              </Text>
            </TouchableOpacity>
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
  scroll: {
    flexGrow: 1, alignItems: 'center',
    paddingHorizontal: 24, paddingTop: 48, paddingBottom: 32,
  },

  backBtn: { alignSelf: 'flex-start', padding: 8, marginBottom: 8 },

  brand: { alignItems: 'center', marginBottom: 32 },
  logoCircle: {
    width: 84, height: 84, borderRadius: 42,
    backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center',
    ...makeShadow('#000', 6, 0.25, 12, 10), marginBottom: 16,
  },
  brandName: { fontSize: 34, fontWeight: '800', color: '#FFFFFF', letterSpacing: 0.5 },

  card: {
    backgroundColor: '#FFFFFF', borderRadius: 24, padding: 24,
    ...makeShadow('#000', 12, 0.2, 20, 12),
  },

  iconHeader: {
    width: 56, height: 56, borderRadius: 28,
    backgroundColor: '#EFF6FF', alignItems: 'center', justifyContent: 'center',
    marginBottom: 16,
  },
  cardTitle: { fontSize: 22, fontWeight: '700', color: '#0F172A', marginBottom: 4 },
  cardSub: { fontSize: 14, color: '#64748B', marginBottom: 24, lineHeight: 20 },

  inputGroup: { marginBottom: 20 },
  label: { fontSize: 13, fontWeight: '600', color: '#374151', marginBottom: 6 },
  inputWrapper: {
    flexDirection: 'row', alignItems: 'center',
    borderWidth: 1.5, borderColor: '#E2E8F0', borderRadius: 12,
    backgroundColor: '#F8FAFC', paddingHorizontal: 12,
  },
  inputWrapperError: { borderColor: '#EF4444', backgroundColor: '#FFF5F5' },
  inputIcon: { marginRight: 8 },
  input: { flex: 1, height: 48, fontSize: 15, color: '#0F172A' },
  errorText: { fontSize: 12, color: '#EF4444', marginTop: 4, marginLeft: 2 },

  btn: {
    backgroundColor: '#1D4ED8', borderRadius: 14, height: 52,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    ...makeShadow('#1D4ED8', 4, 0.35, 8, 6),
  },
  btnDisabled: { opacity: 0.6 },
  btnText: { color: '#FFFFFF', fontSize: 16, fontWeight: '700' },

  /* Sucesso */
  successContent: { alignItems: 'center' },
  successIcon: {
    width: 80, height: 80, borderRadius: 40,
    backgroundColor: '#EFF6FF', alignItems: 'center', justifyContent: 'center',
    marginBottom: 20,
  },
  emailHighlight: { color: '#1D4ED8', fontWeight: '700' },
  infoBox: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 6,
    backgroundColor: '#EFF6FF', borderRadius: 8, padding: 10,
    marginBottom: 24, marginTop: 8, alignSelf: 'stretch',
  },
  infoText: { fontSize: 12, color: '#1D4ED8', flex: 1, lineHeight: 17 },

  backLink: { alignItems: 'center', marginTop: 24 },
  backLinkText: { fontSize: 14, color: 'rgba(255,255,255,0.75)' },
  backLinkBold: { fontWeight: '700', color: '#FFFFFF' },
});
