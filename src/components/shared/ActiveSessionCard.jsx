import React, { useEffect, useRef, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Animated, Modal, Pressable, TextInput, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { makeShadow } from '../../constants/theme';

const PRIMARY = '#1D4ED8';
const SUCCESS = '#16A34A';

function formatElapsed(seconds) {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  const pad = n => String(n).padStart(2, '0');
  if (h > 0) return `${h}:${pad(m)}:${pad(s)}`;
  return `${pad(m)}:${pad(s)}`;
}

const INCIDENT_PRESETS = [
  { label: 'Carro/moto quebrou', icon: 'construct-outline' },
  { label: 'Acidente de trânsito', icon: 'warning-outline' },
  { label: 'Problema de saúde', icon: 'medkit-outline' },
  { label: 'Emergência pessoal', icon: 'alert-circle-outline' },
  { label: 'Condição climática', icon: 'thunderstorm-outline' },
  { label: 'Outro motivo', icon: 'ellipsis-horizontal-circle-outline' },
];

/**
 * Card de aula em andamento.
 * @param {object} activeSession - sessão ativa do SessionContext
 * @param {number} elapsedSeconds - segundos decorridos
 * @param {boolean} isCompleted - se a aula atingiu a duração
 * @param {boolean} isInstructor - true → mostra botões de encerrar/emergência
 * @param {function} onEnd - callback ao encerrar normalmente
 * @param {function} onInterrupt - callback(reason, action) onde action = 'refund' | 'reschedule'
 */
export default function ActiveSessionCard({ activeSession, elapsedSeconds, isCompleted, isInstructor, onEnd, onInterrupt }) {
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const [showEndConfirm, setShowEndConfirm] = useState(false);
  const [showIncidentModal, setShowIncidentModal] = useState(false);
  const [incidentReason, setIncidentReason] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (isCompleted) {
      pulseAnim.setValue(1);
      return;
    }
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.06, duration: 800, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1, duration: 800, useNativeDriver: true }),
      ])
    );
    pulse.start();
    return () => pulse.stop();
  }, [isCompleted]);

  const progress = activeSession?.duration_minutes
    ? Math.min(1, elapsedSeconds / (activeSession.duration_minutes * 60))
    : null;

  const otherName = isInstructor ? activeSession?.studentName : activeSession?.instructorName;

  return (
    <View style={[styles.card, isCompleted ? styles.cardCompleted : styles.cardActive]}>
      {/* Header row */}
      <View style={styles.headerRow}>
        <View style={[styles.statusDot, isCompleted ? styles.dotCompleted : styles.dotActive]} />
        <Text style={[styles.statusLabel, isCompleted ? styles.statusLabelCompleted : styles.statusLabelActive]}>
          {isCompleted ? 'Aula Concluída!' : 'Aula em Andamento'}
        </Text>
        {isCompleted && (
          <Ionicons name="checkmark-circle" size={16} color={SUCCESS} style={{ marginLeft: 4 }} />
        )}
      </View>

      {/* Other person */}
      <View style={styles.personRow}>
        <View style={[styles.personIcon, isCompleted ? styles.personIconCompleted : styles.personIconActive]}>
          <Ionicons name="person" size={16} color={isCompleted ? SUCCESS : PRIMARY} />
        </View>
        <Text style={styles.personName}>{otherName || '—'}</Text>
        <Text style={styles.personRole}>{isInstructor ? 'Aluno' : 'Instrutor'}</Text>
      </View>

      {/* Timer */}
      <Animated.Text
        style={[
          styles.timer,
          isCompleted ? styles.timerCompleted : styles.timerActive,
          !isCompleted && { transform: [{ scale: pulseAnim }] },
        ]}
      >
        {formatElapsed(elapsedSeconds)}
      </Animated.Text>

      {/* Progress bar */}
      {progress !== null && (
        <View style={styles.progressContainer}>
          <View style={styles.progressTrack}>
            <View style={[
              styles.progressFill,
              isCompleted ? styles.progressFillCompleted : styles.progressFillActive,
              { width: `${Math.round(progress * 100)}%` },
            ]} />
          </View>
          <Text style={styles.progressLabel}>
            {activeSession?.duration_minutes} min
            {progress >= 1 ? ' — Completo' : ` — ${Math.round(progress * 100)}%`}
          </Text>
        </View>
      )}

      {/* End button — instructor only */}
      {isInstructor && (
        <View style={styles.actionRow}>
          <TouchableOpacity
            style={[styles.endBtn, isCompleted && styles.endBtnCompleted, { flex: 1 }]}
            onPress={isCompleted ? onEnd : () => setShowEndConfirm(true)}
            activeOpacity={0.8}
          >
            <Ionicons name={isCompleted ? 'checkmark-done-outline' : 'stop-circle-outline'} size={16} color="#FFF" />
            <Text style={styles.endBtnText}>
              {isCompleted ? 'Finalizar Sessão' : 'Encerrar Aula'}
            </Text>
          </TouchableOpacity>
          {!isCompleted && onInterrupt && (
            <TouchableOpacity
              style={styles.incidentBtn}
              onPress={() => { setIncidentReason(''); setShowIncidentModal(true); }}
              activeOpacity={0.8}
            >
              <Ionicons name="warning-outline" size={18} color="#D97706" />
            </TouchableOpacity>
          )}
        </View>
      )}

      {/* Confirm end modal */}
      <Modal visible={showEndConfirm} transparent animationType="fade" onRequestClose={() => setShowEndConfirm(false)}>
        <Pressable style={styles.confirmOverlay} onPress={() => setShowEndConfirm(false)}>
          <Pressable style={styles.confirmCard} onPress={() => {}}>
            <View style={styles.confirmIconWrap}>
              <Ionicons name="stop-circle" size={36} color="#EF4444" />
            </View>
            <Text style={styles.confirmTitle}>Encerrar Aula?</Text>
            <Text style={styles.confirmBody}>
              Tem certeza que deseja encerrar a aula em andamento?{'\n'}Essa ação não pode ser desfeita.
            </Text>
            <TouchableOpacity
              style={styles.confirmBtnEnd}
              onPress={() => { setShowEndConfirm(false); onEnd(); }}
              activeOpacity={0.8}
            >
              <Ionicons name="stop-circle-outline" size={16} color="#FFF" />
              <Text style={styles.confirmBtnEndText}>Encerrar Aula</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.confirmBtnCancel}
              onPress={() => setShowEndConfirm(false)}
              activeOpacity={0.75}
            >
              <Text style={styles.confirmBtnCancelText}>Cancelar</Text>
            </TouchableOpacity>
          </Pressable>
        </Pressable>
      </Modal>

      {/* Incident / Emergency modal */}
      <Modal visible={showIncidentModal} transparent animationType="slide" onRequestClose={() => setShowIncidentModal(false)}>
        <Pressable style={styles.confirmOverlay} onPress={() => setShowIncidentModal(false)}>
          <Pressable style={[styles.confirmCard, { maxHeight: '85%' }]} onPress={() => {}}>
            <ScrollView showsVerticalScrollIndicator={false}>
              <View style={[styles.confirmIconWrap, { backgroundColor: '#FFFBEB' }]}>
                <Ionicons name="warning" size={36} color="#D97706" />
              </View>
              <Text style={styles.confirmTitle}>Emergência / Imprevisto</Text>
              <Text style={styles.confirmBody}>
                Registre o motivo da interrupção. O aluno será notificado e poderá reagendar.
              </Text>

              {/* Preset reasons */}
              <View style={styles.presetGrid}>
                {INCIDENT_PRESETS.map(p => (
                  <TouchableOpacity
                    key={p.label}
                    style={[styles.presetChip, incidentReason === p.label && styles.presetChipActive]}
                    onPress={() => setIncidentReason(p.label)}
                    activeOpacity={0.75}
                  >
                    <Ionicons name={p.icon} size={14} color={incidentReason === p.label ? '#FFF' : '#92400E'} />
                    <Text style={[styles.presetChipText, incidentReason === p.label && { color: '#FFF' }]}>
                      {p.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              {/* Free text (complemento) */}
              <TextInput
                style={styles.incidentInput}
                placeholder="Detalhes adicionais (opcional)…"
                placeholderTextColor="#9CA3AF"
                value={incidentReason.startsWith('Outro') || !INCIDENT_PRESETS.some(p => p.label === incidentReason) ? incidentReason : ''}
                onChangeText={v => setIncidentReason(v)}
                multiline
                numberOfLines={2}
              />

              <View style={styles.actionNotice}>
                <Ionicons name="information-circle-outline" size={13} color="#1D4ED8" />
                <Text style={styles.actionNoticeText}>
                  O aluno será notificado e poderá escolher entre estornar o valor ou reagendar a aula.
                </Text>
              </View>

              <TouchableOpacity
                style={[
                  styles.confirmBtnEnd,
                  { backgroundColor: '#D97706', marginTop: 16 },
                  (submitting || !incidentReason.trim()) && { opacity: 0.5 },
                ]}
                onPress={async () => {
                  if (!incidentReason.trim() || submitting) return;
                  setSubmitting(true);
                  try {
                    await onInterrupt(incidentReason.trim());
                    setShowIncidentModal(false);
                  } finally {
                    setSubmitting(false);
                  }
                }}
                disabled={submitting || !incidentReason.trim()}
                activeOpacity={0.8}
              >
                <Ionicons name="warning-outline" size={16} color="#FFF" />
                <Text style={styles.confirmBtnEndText}>
                  {submitting ? 'Registrando…' : 'Confirmar Emergência'}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.confirmBtnCancel}
                onPress={() => setShowIncidentModal(false)}
                activeOpacity={0.75}
              >
                <Text style={styles.confirmBtnCancelText}>Cancelar</Text>
              </TouchableOpacity>
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 18,
    padding: 18,
    marginHorizontal: 12,
    marginBottom: 12,
    borderWidth: 2,
    ...makeShadow('#000', 4, 0.1, 10, 6),
  },
  cardActive: {
    backgroundColor: '#EFF6FF',
    borderColor: PRIMARY,
  },
  cardCompleted: {
    backgroundColor: '#F0FDF4',
    borderColor: SUCCESS,
  },

  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 6,
  },
  dotActive: { backgroundColor: PRIMARY },
  dotCompleted: { backgroundColor: SUCCESS },
  statusLabel: {
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  statusLabelActive: { color: PRIMARY },
  statusLabelCompleted: { color: SUCCESS },

  personRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
    gap: 8,
  },
  personIcon: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
  },
  personIconActive: { backgroundColor: '#DBEAFE' },
  personIconCompleted: { backgroundColor: '#DCFCE7' },
  personName: {
    fontSize: 15,
    fontWeight: '700',
    color: '#111827',
    flex: 1,
  },
  personRole: {
    fontSize: 11,
    fontWeight: '600',
    color: '#9CA3AF',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },

  timer: {
    fontSize: 44,
    fontWeight: '800',
    textAlign: 'center',
    marginVertical: 8,
    letterSpacing: 2,
  },
  timerActive: { color: PRIMARY },
  timerCompleted: { color: SUCCESS },

  progressContainer: {
    marginTop: 4,
    marginBottom: 8,
  },
  progressTrack: {
    height: 6,
    backgroundColor: '#E5E7EB',
    borderRadius: 3,
    overflow: 'hidden',
    marginBottom: 4,
  },
  progressFill: {
    height: '100%',
    borderRadius: 3,
  },
  progressFillActive: { backgroundColor: PRIMARY },
  progressFillCompleted: { backgroundColor: SUCCESS },
  progressLabel: {
    fontSize: 11,
    color: '#6B7280',
    textAlign: 'right',
    fontWeight: '600',
  },

  actionRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 8,
    alignItems: 'center',
  },
  endBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#EF4444',
    borderRadius: 12,
    paddingVertical: 10,
  },
  endBtnCompleted: {
    backgroundColor: SUCCESS,
  },
  endBtnText: {
    color: '#FFF',
    fontWeight: '700',
    fontSize: 14,
  },
  incidentBtn: {
    width: 42,
    height: 42,
    borderRadius: 12,
    backgroundColor: '#FFFBEB',
    borderWidth: 1.5,
    borderColor: '#FCD34D',
    alignItems: 'center',
    justifyContent: 'center',
  },
  presetGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 12,
  },
  presetChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 20,
    backgroundColor: '#FFFBEB',
    borderWidth: 1.5,
    borderColor: '#FCD34D',
  },
  presetChipActive: {
    backgroundColor: '#D97706',
    borderColor: '#D97706',
  },
  presetChipText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#92400E',
  },
  incidentInput: {
    borderWidth: 1.5,
    borderColor: '#E5E7EB',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 13,
    color: '#111827',
    marginBottom: 14,
    minHeight: 48,
    textAlignVertical: 'top',
  },
  actionNotice: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 6,
    backgroundColor: '#EFF6FF',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    marginBottom: 4,
  },
  actionNoticeText: {
    flex: 1,
    fontSize: 12,
    color: '#1D4ED8',
    lineHeight: 17,
  },

  confirmOverlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center', alignItems: 'center', padding: 28,
  },
  confirmCard: {
    backgroundColor: '#FFF', borderRadius: 20, padding: 28,
    width: '100%', alignItems: 'center',
    ...makeShadow('#000', 20, 0.18, 24, 8),
  },
  confirmIconWrap: {
    width: 64, height: 64, borderRadius: 32,
    backgroundColor: '#FEF2F2', alignItems: 'center', justifyContent: 'center',
    marginBottom: 16,
  },
  confirmTitle: {
    fontSize: 20, fontWeight: '800', color: '#111827', marginBottom: 10,
  },
  confirmBody: {
    fontSize: 14, color: '#4B5563', textAlign: 'center',
    lineHeight: 22, marginBottom: 24,
  },
  confirmBtnEnd: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    width: '100%', paddingVertical: 14, borderRadius: 12,
    backgroundColor: '#EF4444', marginBottom: 10,
  },
  confirmBtnEndText: {
    fontSize: 15, fontWeight: '700', color: '#FFF',
  },
  confirmBtnCancel: {
    width: '100%', paddingVertical: 13, borderRadius: 12,
    borderWidth: 1.5, borderColor: '#E5E7EB', alignItems: 'center',
  },
  confirmBtnCancelText: {
    fontSize: 14, fontWeight: '600', color: '#6B7280',
  },
});
