import React, { useState } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, ScrollView,
  TextInput, Linking, ActivityIndicator, Modal, Pressable,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { makeShadow } from '../../constants/theme';
import { toast } from '../../utils/toast';
import { SUPPORT_SECTIONS } from '../../data/supportData';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../hooks/useAuth';

const PRIMARY = '#1D4ED8';
const SUPPORT_EMAIL = 'abilyoficial@gmail.com';

// ─── Accordion Item ──────────────────────────────────────────────────────────
function FaqItem({ question, answer }) {
  const [open, setOpen] = useState(false);
  return (
    <View style={styles.faqItem}>
      <TouchableOpacity
        activeOpacity={0.7}
        style={styles.faqQuestion}
        onPress={() => setOpen(v => !v)}
      >
        <Text style={styles.faqQuestionText}>{question}</Text>
        <Ionicons
          name={open ? 'chevron-up' : 'chevron-down'}
          size={16}
          color="#64748B"
        />
      </TouchableOpacity>
      {open && (
        <View style={styles.faqAnswer}>
          <Text style={styles.faqAnswerText}>{answer}</Text>
        </View>
      )}
    </View>
  );
}

// ─── Section Card ─────────────────────────────────────────────────────────────
function SectionCard({ section }) {
  const [expanded, setExpanded] = useState(false);
  return (
    <View style={styles.sectionCard}>
      <TouchableOpacity
        activeOpacity={0.7}
        style={styles.sectionHeader}
        onPress={() => setExpanded(v => !v)}
      >
        <View style={styles.sectionIconWrap}>
          <Ionicons name={section.icon} size={20} color={PRIMARY} />
        </View>
        <Text style={styles.sectionTitle}>{section.title}</Text>
        <View style={styles.sectionBadge}>
          <Text style={styles.sectionBadgeText}>{section.items.length}</Text>
        </View>
        <Ionicons
          name={expanded ? 'chevron-up' : 'chevron-down'}
          size={18}
          color="#94A3B8"
          style={{ marginLeft: 4 }}
        />
      </TouchableOpacity>

      {expanded && (
        <View style={styles.faqList}>
          {section.items.map((item, idx) => (
            <React.Fragment key={idx}>
              {idx > 0 && <View style={styles.faqDivider} />}
              <FaqItem question={item.question} answer={item.answer} />
            </React.Fragment>
          ))}
        </View>
      )}
    </View>
  );
}

// ─── Main Screen ──────────────────────────────────────────────────────────────
export default function SupportScreen() {
  const navigation = useNavigation();
  const { user } = useAuth();

  // Bug report state
  const [reportTitle, setReportTitle] = useState('');
  const [reportBody, setReportBody] = useState('');
  const [sending, setSending] = useState(false);
  const [sentModal, setSentModal] = useState(false);

  const handleContact = async () => {
    const subject = encodeURIComponent('[Abily] Preciso de ajuda');
    const body = encodeURIComponent('Olá, equipe Abily!\n\nPreciso de ajuda com:\n\n');
    const mailUrl = `mailto:${SUPPORT_EMAIL}?subject=${subject}&body=${body}`;
    try {
      const supported = await Linking.canOpenURL(mailUrl);
      if (supported) {
        Linking.openURL(mailUrl);
      } else {
        toast.error('Nenhum app de e-mail encontrado. Envie para ' + SUPPORT_EMAIL);
      }
    } catch {
      toast.error('Não foi possível abrir o app de e-mail.');
    }
  };

  const handleSendReport = async () => {
    if (!reportTitle.trim()) {
      toast.error('Informe um título para o problema.');
      return;
    }
    if (!reportBody.trim() || reportBody.trim().length < 10) {
      toast.error('Descreva o problema com pelo menos 10 caracteres.');
      return;
    }

    setSending(true);
    try {
      const { data, error } = await supabase.functions.invoke('send-support-email', {
        body: {
          title:       reportTitle.trim(),
          body:        reportBody.trim(),
          senderName:  user?.name  || undefined,
          senderEmail: user?.email || undefined,
        },
      });
      if (error || data?.error) throw new Error(data?.error || error?.message);
      setReportTitle('');
      setReportBody('');
      setSentModal(true);
    } catch {
      toast.error('Não foi possível enviar o relatório. Tente novamente.');
    } finally {
      setSending(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          activeOpacity={0.7}
          style={styles.backBtn}
        >
          <Ionicons name="arrow-back" size={22} color="#0F172A" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Suporte & Ajuda</Text>
        <View style={{ width: 38 }} />
      </View>

      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* Hero */}
        <View style={styles.hero}>
          <View style={styles.heroIcon}>
            <Ionicons name="help-buoy-outline" size={32} color={PRIMARY} />
          </View>
          <Text style={styles.heroTitle}>Como podemos ajudar?</Text>
          <Text style={styles.heroSubtitle}>
            Encontre respostas rápidas ou fale diretamente com nossa equipe.
          </Text>
        </View>

        {/* ── Fale Conosco ── */}
        <View style={styles.block}>
          <Text style={styles.blockLabel}>FALE CONOSCO</Text>
          <TouchableOpacity
            style={styles.contactBtn}
            activeOpacity={0.8}
            onPress={handleContact}
          >
            <View style={styles.contactIconWrap}>
              <Ionicons name="mail-outline" size={24} color={PRIMARY} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.contactTitle}>E-mail</Text>
              <Text style={styles.contactSubtitle}>{SUPPORT_EMAIL}</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color="#94A3B8" />
          </TouchableOpacity>
        </View>

        {/* ── Central de Ajuda ── */}
        <View style={styles.block}>
          <Text style={styles.blockLabel}>CENTRAL DE AJUDA</Text>
          {SUPPORT_SECTIONS.map(section => (
            <SectionCard key={section.id} section={section} />
          ))}
        </View>

        {/* ── Relatar Problema ── */}
        <View style={styles.block}>
          <Text style={styles.blockLabel}>RELATAR PROBLEMA</Text>
          <View style={styles.reportCard}>
            <View style={styles.reportHeaderRow}>
              <View style={styles.reportIconWrap}>
                <Ionicons name="bug-outline" size={20} color="#DC2626" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.reportTitle}>Encontrou um bug?</Text>
                <Text style={styles.reportSubtitle}>
                  Descreva o problema e enviaremos para nossa equipe.
                </Text>
              </View>
            </View>

            <Text style={styles.inputLabel}>Título do problema *</Text>
            <TextInput
              style={styles.input}
              placeholder="Ex: Tela de agendamento trava ao..."
              placeholderTextColor="#94A3B8"
              value={reportTitle}
              onChangeText={setReportTitle}
              maxLength={100}
              returnKeyType="next"
            />

            <Text style={styles.inputLabel}>Descrição detalhada *</Text>
            <TextInput
              style={[styles.input, styles.inputMultiline]}
              placeholder="Descreva o que aconteceu, em qual tela ocorreu, o que você esperava que acontecesse e o que aconteceu de fato..."
              placeholderTextColor="#94A3B8"
              value={reportBody}
              onChangeText={setReportBody}
              multiline
              numberOfLines={5}
              textAlignVertical="top"
              maxLength={1000}
            />
            <Text style={styles.charCount}>{reportBody.length}/1000</Text>

            <TouchableOpacity
              style={[styles.sendBtn, sending && { opacity: 0.7 }]}
              activeOpacity={0.8}
              onPress={handleSendReport}
              disabled={sending}
            >
              {sending ? (
                <ActivityIndicator color="#FFF" size="small" />
              ) : (
                <Ionicons name="send-outline" size={18} color="#FFF" />
              )}
              <Text style={styles.sendBtnText}>
                {sending ? 'Enviando...' : 'Enviar relatório'}
              </Text>
            </TouchableOpacity>

            <Text style={styles.reportNote}>
              Seu relatório será enviado diretamente para nossa equipe em abilyoficial@gmail.com
            </Text>
          </View>
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>

      {/* Modal confirmação de envio */}
      <Modal
        visible={sentModal}
        transparent
        animationType="fade"
        onRequestClose={() => setSentModal(false)}
      >
        <Pressable style={styles.modalOverlay} onPress={() => setSentModal(false)}>
          <Pressable style={styles.modalCard} onPress={() => {}}>
            <View style={styles.modalIconWrap}>
              <Ionicons name="checkmark-circle" size={40} color="#059669" />
            </View>
            <Text style={styles.modalTitle}>Relatório enviado!</Text>
            <Text style={styles.modalBody}>
              Obrigado por nos avisar. Nossa equipe analisará o problema e
              entrará em contato se necessário.
            </Text>
            <TouchableOpacity
              style={styles.modalBtn}
              onPress={() => setSentModal(false)}
              activeOpacity={0.8}
            >
              <Text style={styles.modalBtnText}>Fechar</Text>
            </TouchableOpacity>
          </Pressable>
        </Pressable>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#F8FAFC' },

  // Header
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 12,
    backgroundColor: '#FFFFFF', borderBottomWidth: 1, borderBottomColor: '#F1F5F9',
    ...makeShadow('#000', 2, 0.04, 4, 2),
  },
  backBtn: {
    width: 38, height: 38, borderRadius: 12,
    backgroundColor: '#F8FAFC', alignItems: 'center', justifyContent: 'center',
  },
  headerTitle: { fontSize: 17, fontWeight: '800', color: '#0F172A' },

  scroll: { paddingHorizontal: 16, paddingTop: 20 },

  // Hero
  hero: { alignItems: 'center', marginBottom: 28 },
  heroIcon: {
    width: 72, height: 72, borderRadius: 36,
    backgroundColor: '#EFF6FF', alignItems: 'center', justifyContent: 'center',
    marginBottom: 14, ...makeShadow(PRIMARY, 4, 0.12, 12, 4),
  },
  heroTitle: { fontSize: 22, fontWeight: '800', color: '#0F172A', marginBottom: 6 },
  heroSubtitle: {
    fontSize: 14, color: '#64748B', textAlign: 'center',
    lineHeight: 21, paddingHorizontal: 20,
  },

  // Block
  block: { marginBottom: 24 },
  blockLabel: {
    fontSize: 11, fontWeight: '800', color: '#94A3B8',
    letterSpacing: 1.1, marginBottom: 10, marginLeft: 2,
  },

  // Contact
  contactBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    backgroundColor: '#FFFFFF', borderRadius: 16, padding: 16,
    borderWidth: 1, borderColor: '#E2E8F0',
    ...makeShadow('#000', 2, 0.06, 8, 3),
  },
  contactIconWrap: {
    width: 46, height: 46, borderRadius: 23,
    backgroundColor: '#EFF6FF', alignItems: 'center', justifyContent: 'center',
  },
  contactTitle: { fontSize: 15, fontWeight: '700', color: '#0F172A' },
  contactSubtitle: { fontSize: 12, color: '#64748B', marginTop: 2 },

  // FAQ Section Card
  sectionCard: {
    backgroundColor: '#FFFFFF', borderRadius: 16,
    borderWidth: 1, borderColor: '#E2E8F0', marginBottom: 10,
    overflow: 'hidden', ...makeShadow('#000', 2, 0.05, 6, 2),
  },
  sectionHeader: {
    flexDirection: 'row', alignItems: 'center', padding: 16, gap: 12,
  },
  sectionIconWrap: {
    width: 38, height: 38, borderRadius: 12,
    backgroundColor: '#EFF6FF', alignItems: 'center', justifyContent: 'center',
  },
  sectionTitle: { flex: 1, fontSize: 15, fontWeight: '700', color: '#0F172A' },
  sectionBadge: {
    backgroundColor: '#EFF6FF', borderRadius: 10,
    paddingHorizontal: 8, paddingVertical: 2,
  },
  sectionBadgeText: { fontSize: 11, fontWeight: '800', color: PRIMARY },

  faqList: { borderTopWidth: 1, borderTopColor: '#F1F5F9', paddingBottom: 4 },
  faqDivider: { height: 1, backgroundColor: '#F1F5F9', marginHorizontal: 16 },
  faqItem: {},
  faqQuestion: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 14, gap: 12,
  },
  faqQuestionText: {
    flex: 1, fontSize: 14, fontWeight: '600', color: '#0F172A', lineHeight: 20,
  },
  faqAnswer: {
    paddingHorizontal: 16, paddingBottom: 14,
    backgroundColor: '#F8FAFC',
    borderTopWidth: 1, borderTopColor: '#F1F5F9',
  },
  faqAnswerText: {
    fontSize: 13, color: '#374151', lineHeight: 21,
  },

  // Report Card
  reportCard: {
    backgroundColor: '#FFFFFF', borderRadius: 16, padding: 20,
    borderWidth: 1, borderColor: '#E2E8F0',
    ...makeShadow('#000', 2, 0.06, 8, 3),
  },
  reportHeaderRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, marginBottom: 20 },
  reportIconWrap: {
    width: 40, height: 40, borderRadius: 12,
    backgroundColor: '#FEF2F2', alignItems: 'center', justifyContent: 'center',
  },
  reportTitle: { fontSize: 15, fontWeight: '700', color: '#0F172A' },
  reportSubtitle: { fontSize: 13, color: '#64748B', marginTop: 2, lineHeight: 19 },

  inputLabel: {
    fontSize: 12, fontWeight: '700', color: '#374151', marginBottom: 6,
  },
  input: {
    backgroundColor: '#F8FAFC', borderWidth: 1.5, borderColor: '#E2E8F0',
    borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12,
    fontSize: 14, color: '#0F172A', marginBottom: 14,
  },
  inputMultiline: {
    height: 120, paddingTop: 12, marginBottom: 4,
  },
  charCount: {
    fontSize: 11, color: '#94A3B8', textAlign: 'right', marginBottom: 16,
  },

  sendBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 8, backgroundColor: PRIMARY, borderRadius: 12, paddingVertical: 14,
    ...makeShadow(PRIMARY, 4, 0.25, 8, 4),
  },
  sendBtnText: { fontSize: 15, fontWeight: '700', color: '#FFF' },

  reportNote: {
    fontSize: 11, color: '#94A3B8', textAlign: 'center',
    lineHeight: 17, marginTop: 12,
  },

  // Modal
  modalOverlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'center', alignItems: 'center', padding: 24,
  },
  modalCard: {
    backgroundColor: '#FFF', borderRadius: 20, padding: 28,
    width: '100%', alignItems: 'center',
    ...makeShadow('#000', 20, 0.15, 24, 8),
  },
  modalIconWrap: {
    width: 72, height: 72, borderRadius: 36,
    backgroundColor: '#ECFDF5', alignItems: 'center', justifyContent: 'center',
    marginBottom: 16,
  },
  modalTitle: { fontSize: 18, fontWeight: '800', color: '#111827', marginBottom: 10 },
  modalBody: {
    fontSize: 14, color: '#4B5563', textAlign: 'center',
    lineHeight: 22, marginBottom: 24,
  },
  modalBtn: {
    width: '100%', backgroundColor: PRIMARY,
    borderRadius: 12, paddingVertical: 14, alignItems: 'center',
    ...makeShadow(PRIMARY, 4, 0.25, 8, 4),
  },
  modalBtnText: { fontSize: 15, fontWeight: '700', color: '#FFF' },
});
