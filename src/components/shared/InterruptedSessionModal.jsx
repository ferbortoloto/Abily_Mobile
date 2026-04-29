import React, { useState } from 'react';
import { View, Text, TouchableOpacity, Modal, Pressable, StyleSheet, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { makeShadow } from '../../constants/theme';

/**
 * Modal exibido ao aluno quando o instrutor interrompe a aula por emergência.
 * O aluno escolhe entre estornar o valor (R$5 a menos) ou reagendar.
 */
export default function InterruptedSessionModal({ visible, session, onResolve, onDismiss }) {
  const [submitting, setSubmitting] = useState(false);

  const instructorName = session?.profiles?.name ?? session?.instructorName ?? 'seu instrutor';

  const handleAction = async (action) => {
    if (submitting) return;
    setSubmitting(true);
    try {
      await onResolve(action);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onDismiss}>
      <Pressable style={styles.overlay} onPress={() => {}}>
        <View style={styles.card}>
          <View style={styles.iconWrap}>
            <Ionicons name="warning" size={38} color="#D97706" />
          </View>

          <Text style={styles.title}>Aula interrompida</Text>
          <Text style={styles.subtitle}>
            {instructorName} precisou interromper a aula por emergência.
          </Text>

          <Text style={styles.question}>O que você prefere?</Text>

          {/* Opção: Reagendar */}
          <TouchableOpacity
            style={[styles.optionBtn, styles.optionReschedule]}
            onPress={() => handleAction('reschedule')}
            disabled={submitting}
            activeOpacity={0.8}
          >
            {submitting ? (
              <ActivityIndicator size="small" color="#FFF" />
            ) : (
              <>
                <Ionicons name="calendar-outline" size={20} color="#FFF" />
                <View style={styles.optionTextWrap}>
                  <Text style={styles.optionTitle}>Reagendar aula</Text>
                  <Text style={styles.optionDesc}>
                    Combine um novo horário com o instrutor sem custo adicional.
                  </Text>
                </View>
              </>
            )}
          </TouchableOpacity>

          {/* Opção: Estornar */}
          <TouchableOpacity
            style={[styles.optionBtn, styles.optionRefund]}
            onPress={() => handleAction('refund')}
            disabled={submitting}
            activeOpacity={0.8}
          >
            {submitting ? (
              <ActivityIndicator size="small" color="#FFF" />
            ) : (
              <>
                <Ionicons name="refresh-circle-outline" size={20} color="#FFF" />
                <View style={styles.optionTextWrap}>
                  <Text style={styles.optionTitle}>Estornar valor</Text>
                  <Text style={styles.optionDesc}>
                    Receba o estorno com R$ 5,00 de desconto (taxa de processamento Asaas).
                  </Text>
                </View>
              </>
            )}
          </TouchableOpacity>

          <Text style={styles.footnote}>
            Para aulas de plano, seu crédito já foi devolvido automaticamente independentemente da escolha.
          </Text>
        </View>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  card: {
    backgroundColor: '#FFF',
    borderRadius: 20,
    padding: 28,
    width: '100%',
    alignItems: 'center',
    ...makeShadow('#000', 20, 0.2, 24, 8),
  },
  iconWrap: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: '#FFFBEB',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
    borderWidth: 2,
    borderColor: '#FCD34D',
  },
  title: {
    fontSize: 22,
    fontWeight: '800',
    color: '#111827',
    marginBottom: 6,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 14,
    color: '#4B5563',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 20,
  },
  question: {
    fontSize: 13,
    fontWeight: '700',
    color: '#6B7280',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 12,
    alignSelf: 'flex-start',
  },
  optionBtn: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 16,
    marginBottom: 10,
    minHeight: 64,
    justifyContent: 'center',
  },
  optionReschedule: {
    backgroundColor: '#1D4ED8',
  },
  optionRefund: {
    backgroundColor: '#D97706',
  },
  optionTextWrap: {
    flex: 1,
  },
  optionTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#FFF',
    marginBottom: 2,
  },
  optionDesc: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.85)',
    lineHeight: 16,
  },
  footnote: {
    fontSize: 11,
    color: '#9CA3AF',
    textAlign: 'center',
    lineHeight: 15,
    marginTop: 4,
  },
});
