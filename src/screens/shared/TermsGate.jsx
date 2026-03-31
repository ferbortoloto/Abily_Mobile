import React, { useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity,
  StyleSheet, SafeAreaView, StatusBar, ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../hooks/useAuth';
import { COLORS, RADIUS, SHADOWS } from '../../constants/theme';
import { getTermsByRole, TERMS_VERSION, TERMS_VALIDITY_DAYS } from '../../data/termsData';
import { toast } from '../../utils/toast';

/**
 * TermsGate
 *
 * Tela bloqueante exibida quando o usuário autenticado ainda não aceitou
 * a versão atual dos Termos de Uso. Não possui botão de voltar — o único
 * caminho é aceitar os termos ou sair da conta.
 */
export default function TermsGate() {
  const { user, acceptTerms, logout } = useAuth();
  const role = user?.role ?? 'user';
  const terms = getTermsByRole(role);

  const [expandedIndex, setExpandedIndex] = useState(null);
  const [accepting, setAccepting] = useState(false);

  const toggle = (i) => setExpandedIndex(expandedIndex === i ? null : i);

  const handleAccept = async () => {
    setAccepting(true);
    try {
      await acceptTerms();
      // needsTerms passa a false → AppNavigator renderiza o app normalmente
    } catch {
      toast.error('Não foi possível registrar o aceite. Tente novamente.');
    } finally {
      setAccepting(false);
    }
  };

  const handleLogout = async () => {
    await logout();
  };

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="light-content" backgroundColor={COLORS.primaryDark} />

      {/* Header sem botão de voltar */}
      <View style={styles.header}>
        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle}>{terms.title}</Text>
          <Text style={styles.headerSub}>Versão {TERMS_VERSION} · {TERMS_VALIDITY_DAYS} dias de vigência</Text>
        </View>
        <TouchableOpacity onPress={handleLogout} style={styles.logoutBtn} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Ionicons name="log-out-outline" size={20} color="rgba(255,255,255,0.7)" />
        </TouchableOpacity>
      </View>

      {/* Banner de contexto */}
      <View style={styles.banner}>
        <Ionicons name="alert-circle-outline" size={18} color={COLORS.warning} />
        <Text style={styles.bannerText}>
          Atualizamos nossos Termos de Uso. Leia e aceite para continuar usando o Abily.
        </Text>
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {/* Intro */}
        <View style={styles.introCard}>
          <Ionicons name="document-text-outline" size={26} color={COLORS.primary} style={{ marginBottom: 8 }} />
          <Text style={styles.introText}>{terms.intro.trim()}</Text>
        </View>

        {/* Badge vigência */}
        <View style={styles.validityBadge}>
          <Ionicons name="time-outline" size={14} color={COLORS.warning} />
          <Text style={styles.validityText}>
            Vigência: <Text style={{ fontWeight: '700' }}>{TERMS_VALIDITY_DAYS} dias</Text> a partir da aceitação (Período MVP)
          </Text>
        </View>

        {/* Seções acordeão */}
        {terms.sections.map((section, i) => (
          <View key={i} style={styles.sectionCard}>
            <TouchableOpacity
              style={styles.sectionHeader}
              onPress={() => toggle(i)}
              activeOpacity={0.7}
            >
              <Text style={styles.sectionTitle}>{section.title}</Text>
              <Ionicons
                name={expandedIndex === i ? 'chevron-up' : 'chevron-down'}
                size={18}
                color={COLORS.textSecondary}
              />
            </TouchableOpacity>
            {expandedIndex === i && (
              <View style={styles.sectionBody}>
                <Text style={styles.sectionText}>{section.body.trim()}</Text>
              </View>
            )}
          </View>
        ))}

        <View style={{ height: 120 }} />
      </ScrollView>

      {/* Footer fixo com botão de aceite */}
      <View style={styles.footer}>
        <Text style={styles.footerNote}>
          Ao tocar em "Li e Aceito", você concorda com todos os termos acima e poderá continuar usando o Abily.
        </Text>
        <TouchableOpacity
          style={[styles.acceptBtn, accepting && styles.acceptBtnDisabled]}
          onPress={handleAccept}
          disabled={accepting}
          activeOpacity={0.85}
        >
          {accepting ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <>
              <Ionicons name="checkmark-circle-outline" size={20} color="#fff" style={{ marginRight: 8 }} />
              <Text style={styles.acceptBtnText}>Li e Aceito os Termos</Text>
            </>
          )}
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: COLORS.bg,
  },

  // ── Header ──────────────────────────────────
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: COLORS.primaryDark,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  headerCenter: { flex: 1 },
  headerTitle: {
    color: '#fff',
    fontSize: 17,
    fontWeight: '700',
  },
  headerSub: {
    color: 'rgba(255,255,255,0.65)',
    fontSize: 12,
    marginTop: 1,
  },
  logoutBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 8,
  },

  // ── Banner ───────────────────────────────────
  banner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    backgroundColor: '#FFFBEB',
    borderBottomWidth: 1,
    borderBottomColor: '#FDE68A',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  bannerText: {
    flex: 1,
    color: COLORS.warning,
    fontSize: 13,
    lineHeight: 19,
    fontWeight: '500',
  },

  // ── Scroll ───────────────────────────────────
  scroll: { flex: 1 },
  content: { padding: 16, gap: 10 },

  // ── Intro card ───────────────────────────────
  introCard: {
    backgroundColor: COLORS.primaryLight,
    borderRadius: RADIUS.lg,
    padding: 18,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#BFDBFE',
    ...SHADOWS.sm,
  },
  introText: {
    color: COLORS.textPrimary,
    fontSize: 13,
    lineHeight: 20,
    textAlign: 'center',
  },

  // ── Validity badge ────────────────────────────
  validityBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#FFFBEB',
    borderRadius: RADIUS.md,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: '#FDE68A',
  },
  validityText: {
    color: COLORS.warning,
    fontSize: 13,
  },

  // ── Section cards ─────────────────────────────
  sectionCard: {
    backgroundColor: COLORS.card,
    borderRadius: RADIUS.md,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: COLORS.border,
    ...SHADOWS.sm,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  sectionTitle: {
    flex: 1,
    color: COLORS.primary,
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 0.1,
    marginRight: 8,
  },
  sectionBody: {
    paddingHorizontal: 16,
    paddingBottom: 16,
    borderTopWidth: 1,
    borderTopColor: COLORS.borderLight,
  },
  sectionText: {
    color: COLORS.textPrimary,
    fontSize: 13,
    lineHeight: 21,
    marginTop: 12,
  },

  // ── Footer ────────────────────────────────────
  footer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: COLORS.card,
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 28,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    ...SHADOWS.lg,
  },
  footerNote: {
    color: COLORS.textSecondary,
    fontSize: 12,
    textAlign: 'center',
    marginBottom: 12,
  },
  acceptBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.primary,
    borderRadius: RADIUS.lg,
    paddingVertical: 15,
    ...SHADOWS.primaryGlow,
  },
  acceptBtnDisabled: { opacity: 0.6 },
  acceptBtnText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '700',
  },
});
