import React, { useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity,
  StyleSheet, SafeAreaView, StatusBar, Linking,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, RADIUS, SHADOWS } from '../../constants/theme';
import { getTermsByRole, TERMS_VERSION, TERMS_VALIDITY_DAYS, TERMS_FULL_URL } from '../../data/termsData';

/**
 * TermsScreen
 *
 * Props (via navigation ou diretamente):
 *   route.params.role   — 'student' | 'instructor'  (default: 'student')
 *   route.params.onAccept — callback chamado ao aceitar (opcional)
 *   route.params.readOnly — se true, esconde o botão de aceite (default: false)
 */
export default function TermsScreen({ route, navigation }) {
  const role = route?.params?.role ?? 'student';
  const onAccept = route?.params?.onAccept;
  const readOnly = route?.params?.readOnly ?? false;

  const terms = getTermsByRole(role);
  const [expandedIndex, setExpandedIndex] = useState(null);

  const toggle = (i) => setExpandedIndex(expandedIndex === i ? null : i);

  const handleAccept = () => {
    if (onAccept) onAccept();
    navigation?.goBack();
  };

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="light-content" backgroundColor={COLORS.primaryDark} />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation?.goBack()} style={styles.backBtn} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Ionicons name="arrow-back" size={22} color="#fff" />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle}>{terms.title}</Text>
          <Text style={styles.headerSub}>Versão {TERMS_VERSION} · {TERMS_VALIDITY_DAYS} dias de vigência</Text>
        </View>
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {/* Intro */}
        <View style={styles.introCard}>
          <Ionicons name="document-text-outline" size={28} color={COLORS.primary} style={{ marginBottom: 10 }} />
          <Text style={styles.introText}>{terms.intro.trim()}</Text>
        </View>

        {/* Badge de vigência */}
        <View style={styles.validityBadge}>
          <Ionicons name="time-outline" size={15} color={COLORS.warning} />
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

        {/* Link versão completa */}
        <TouchableOpacity
          style={styles.fullVersionLink}
          onPress={() => Linking.openURL(TERMS_FULL_URL)}
          activeOpacity={0.7}
        >
          <Ionicons name="open-outline" size={15} color={COLORS.primary} />
          <Text style={styles.fullVersionText}>
            Ver versão completa com referências legais
          </Text>
        </TouchableOpacity>

        <View style={{ height: readOnly ? 32 : 100 }} />
      </ScrollView>

      {/* Botão de aceite */}
      {!readOnly && (
        <View style={styles.footer}>
          <Text style={styles.footerNote}>
            Ao tocar em "Li e Aceito", você concorda com todos os termos acima.
          </Text>
          <TouchableOpacity style={styles.acceptBtn} onPress={handleAccept} activeOpacity={0.85}>
            <Ionicons name="checkmark-circle-outline" size={20} color="#fff" style={{ marginRight: 8 }} />
            <Text style={styles.acceptBtnText}>Li e Aceito os Termos</Text>
          </TouchableOpacity>
        </View>
      )}
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
    backgroundColor: COLORS.primaryDark,
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 12,
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerCenter: {
    flex: 1,
  },
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

  // ── Full version link ─────────────────────────
  fullVersionLink: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 14,
  },
  fullVersionText: {
    color: COLORS.primary,
    fontSize: 13,
    textDecorationLine: 'underline',
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
  acceptBtnText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '700',
  },
});
