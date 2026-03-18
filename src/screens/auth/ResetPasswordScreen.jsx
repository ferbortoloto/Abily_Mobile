import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  KeyboardAvoidingView, Platform, ActivityIndicator,
  ScrollView, useWindowDimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../hooks/useAuth';
import { makeShadow } from '../../constants/theme';

export default function ResetPasswordScreen() {
  const { changePassword, clearPasswordRecovery } = useAuth();
  const { width } = useWindowDimensions();

  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);

  const handleReset = async () => {
    if (!password || password.length < 8) { setError('Mínimo 8 caracteres.'); return; }
    if (!/[A-Z]/.test(password)) { setError('Inclua ao menos uma letra maiúscula.'); return; }
    if (!/[0-9]/.test(password)) { setError('Inclua ao menos um número.'); return; }
    if (password !== confirm) { setError('As senhas não coincidem.'); return; }
    setError('');
    setLoading(true);
    try {
      await changePassword(password);
      setDone(true);
    } catch (err) {
      setError(err?.message || 'Não foi possível redefinir a senha. Tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  const cardMaxWidth = Math.min(width - 48, 480);

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
          >
            <View style={[styles.card, { width: cardMaxWidth }]}>
              {done ? (
                <View style={styles.successContent}>
                  <View style={styles.successIcon}>
                    <Ionicons name="checkmark-circle-outline" size={44} color="#1D4ED8" />
                  </View>
                  <Text style={[styles.cardTitle, { textAlign: 'center' }]}>Senha redefinida!</Text>
                  <Text style={[styles.cardSub, { textAlign: 'center' }]}>
                    Sua nova senha foi salva com sucesso. Faça login para continuar.
                  </Text>
                  <TouchableOpacity
                    style={[styles.btn, { alignSelf: 'stretch' }]}
                    onPress={clearPasswordRecovery}
                    activeOpacity={0.85}
                  >
                    <Ionicons name="log-in-outline" size={20} color="#FFF" style={{ marginRight: 8 }} />
                    <Text style={styles.btnText}>Ir para o login</Text>
                  </TouchableOpacity>
                </View>
              ) : (
                <>
                  <View style={styles.iconHeader}>
                    <Ionicons name="lock-closed-outline" size={28} color="#1D4ED8" />
                  </View>
                  <Text style={styles.cardTitle}>Nova senha</Text>
                  <Text style={styles.cardSub}>
                    Escolha uma nova senha segura para sua conta.
                  </Text>

                  {/* Senha */}
                  <View style={styles.inputGroup}>
                    <Text style={styles.label}>Nova senha</Text>
                    <View style={[styles.inputWrapper, error && styles.inputWrapperError]}>
                      <Ionicons
                        name="lock-closed-outline"
                        size={18}
                        color={error ? '#EF4444' : '#94A3B8'}
                        style={styles.inputIcon}
                      />
                      <TextInput
                        style={styles.input}
                        placeholder="Mínimo 8 caracteres"
                        placeholderTextColor="#CBD5E1"
                        value={password}
                        onChangeText={(v) => { setPassword(v); setError(''); }}
                        secureTextEntry={!showPass}
                        autoCapitalize="none"
                        autoFocus
                      />
                      <TouchableOpacity onPress={() => setShowPass(p => !p)} style={styles.eyeBtn}>
                        <Ionicons
                          name={showPass ? 'eye-off-outline' : 'eye-outline'}
                          size={20}
                          color="#94A3B8"
                        />
                      </TouchableOpacity>
                    </View>
                  </View>

                  {/* Confirmar senha */}
                  <View style={styles.inputGroup}>
                    <Text style={styles.label}>Confirmar nova senha</Text>
                    <View style={[styles.inputWrapper, error && styles.inputWrapperError]}>
                      <Ionicons
                        name="lock-closed-outline"
                        size={18}
                        color={error ? '#EF4444' : '#94A3B8'}
                        style={styles.inputIcon}
                      />
                      <TextInput
                        style={styles.input}
                        placeholder="Repita a senha"
                        placeholderTextColor="#CBD5E1"
                        value={confirm}
                        onChangeText={(v) => { setConfirm(v); setError(''); }}
                        secureTextEntry={!showConfirm}
                        autoCapitalize="none"
                      />
                      <TouchableOpacity onPress={() => setShowConfirm(p => !p)} style={styles.eyeBtn}>
                        <Ionicons
                          name={showConfirm ? 'eye-off-outline' : 'eye-outline'}
                          size={20}
                          color="#94A3B8"
                        />
                      </TouchableOpacity>
                    </View>
                    {error ? <Text style={styles.errorText}>{error}</Text> : null}
                  </View>

                  <TouchableOpacity
                    style={[styles.btn, loading && styles.btnDisabled]}
                    onPress={handleReset}
                    disabled={loading}
                    activeOpacity={0.85}
                  >
                    {loading ? (
                      <ActivityIndicator color="#FFF" />
                    ) : (
                      <>
                        <Ionicons name="checkmark-outline" size={20} color="#FFF" style={{ marginRight: 8 }} />
                        <Text style={styles.btnText}>Redefinir senha</Text>
                      </>
                    )}
                  </TouchableOpacity>
                </>
              )}
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
  scroll: {
    flexGrow: 1, alignItems: 'center',
    justifyContent: 'center', paddingHorizontal: 24, paddingVertical: 40,
  },

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

  inputGroup: { marginBottom: 16 },
  label: { fontSize: 13, fontWeight: '600', color: '#374151', marginBottom: 6 },
  inputWrapper: {
    flexDirection: 'row', alignItems: 'center',
    borderWidth: 1.5, borderColor: '#E2E8F0', borderRadius: 12,
    backgroundColor: '#F8FAFC', paddingHorizontal: 12,
  },
  inputWrapperError: { borderColor: '#EF4444', backgroundColor: '#FFF5F5' },
  inputIcon: { marginRight: 8 },
  eyeBtn: { padding: 4 },
  input: { flex: 1, height: 48, fontSize: 15, color: '#0F172A' },
  errorText: { fontSize: 12, color: '#EF4444', marginTop: 4, marginLeft: 2 },

  btn: {
    backgroundColor: '#1D4ED8', borderRadius: 14, height: 52,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    marginTop: 8, ...makeShadow('#1D4ED8', 4, 0.35, 8, 6),
  },
  btnDisabled: { opacity: 0.6 },
  btnText: { color: '#FFFFFF', fontSize: 16, fontWeight: '700' },

  successContent: { alignItems: 'center' },
  successIcon: {
    width: 80, height: 80, borderRadius: 40,
    backgroundColor: '#EFF6FF', alignItems: 'center', justifyContent: 'center',
    marginBottom: 20,
  },
});
