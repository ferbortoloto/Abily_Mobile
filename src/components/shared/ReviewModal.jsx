import React, { useState } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, Modal,
  TextInput, ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Avatar from './Avatar';
import { makeShadow } from '../../constants/theme';
import { createReview, createInstructorReview } from '../../services/instructors.service';
import { logger } from '../../utils/logger';
import { toast } from '../../utils/toast';

const PRIMARY = '#1D4ED8';

/**
 * Modal de avaliação pós-aula.
 *
 * Props:
 *   visible        boolean
 *   session        objeto da sessão concluída (instructor_id, student_id, event_id, instructorName, studentName)
 *   reviewerRole   'student' | 'instructor'
 *   onClose        () => void  — chamado após enviar ou ao pular
 */
export default function ReviewModal({ visible, session, reviewerRole, onClose }) {
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState('');
  const [loading, setLoading] = useState(false);

  if (!session) return null;

  const isInstructor = reviewerRole === 'instructor';
  const targetName = isInstructor ? session.studentName : session.instructorName;
  const targetAvatar = isInstructor ? session.studentAvatar : session.instructorAvatar;
  const title = isInstructor ? 'Avaliar Aluno' : 'Avaliar Instrutor';
  const subtitle = isInstructor
    ? `Como foi a aula com ${targetName || 'seu aluno'}?`
    : `Como foi a aula com ${targetName || 'seu instrutor'}?`;

  const handleSubmit = async () => {
    if (rating === 0) {
      toast.error('Selecione uma nota de 1 a 5 estrelas.');
      return;
    }
    setLoading(true);
    try {
      if (isInstructor) {
        await createInstructorReview({
          instructorId: session.instructor_id,
          studentId: session.student_id,
          eventId: session.event_id || null,
          rating,
          comment: comment.trim(),
        });
      } else {
        await createReview({
          instructorId: session.instructor_id,
          studentId: session.student_id,
          eventId: session.event_id || null,
          rating,
          comment: comment.trim(),
        });
      }
      toast.success('Avaliação enviada! Obrigado.');
      handleClose();
    } catch (e) {
      logger.error('Erro ao enviar avaliação:', e.message);
      toast.error('Não foi possível enviar a avaliação.');
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setRating(0);
    setComment('');
    setLoading(false);
    onClose();
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={handleClose}>
      <View style={styles.overlay}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.kav}>
          <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
            <View style={styles.card}>
              {/* Topo */}
              <View style={styles.cardTop}>
                <View style={styles.checkCircle}>
                  <Ionicons name="checkmark-done" size={22} color="#16A34A" />
                </View>
                <Text style={styles.successLabel}>Aula Concluída!</Text>
              </View>

              <Text style={styles.title}>{title}</Text>
              <Text style={styles.subtitle}>{subtitle}</Text>

              {/* Avatar + nome do avaliado */}
              <View style={styles.targetRow}>
                <Avatar uri={targetAvatar} name={targetName || '?'} size={52} />
                <Text style={styles.targetName}>{targetName || '—'}</Text>
              </View>

              {/* Estrelas */}
              <View style={styles.starsRow}>
                {[1, 2, 3, 4, 5].map(star => (
                  <TouchableOpacity key={star} onPress={() => setRating(star)} activeOpacity={0.7}>
                    <Ionicons
                      name={star <= rating ? 'star' : 'star-outline'}
                      size={38}
                      color={star <= rating ? '#F59E0B' : '#D1D5DB'}
                    />
                  </TouchableOpacity>
                ))}
              </View>
              {rating > 0 && (
                <Text style={styles.ratingLabel}>
                  {['', 'Péssimo', 'Ruim', 'Regular', 'Bom', 'Excelente!'][rating]}
                </Text>
              )}

              {/* Comentário */}
              <TextInput
                style={styles.commentInput}
                placeholder="Comentário opcional..."
                placeholderTextColor="#9CA3AF"
                value={comment}
                onChangeText={setComment}
                multiline
                numberOfLines={3}
                maxLength={300}
              />

              {/* Botões */}
              <TouchableOpacity
                style={[styles.submitBtn, loading && { opacity: 0.6 }]}
                onPress={handleSubmit}
                disabled={loading}
                activeOpacity={0.85}
              >
                {loading
                  ? <ActivityIndicator color="#FFF" size="small" />
                  : <Text style={styles.submitBtnText}>Enviar Avaliação</Text>
                }
              </TouchableOpacity>

              <TouchableOpacity style={styles.skipBtn} onPress={handleClose} disabled={loading}>
                <Text style={styles.skipBtnText}>Pular por agora</Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  kav: { width: '100%', justifyContent: 'center', alignItems: 'center' },
  scrollContent: { flexGrow: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },
  card: {
    backgroundColor: '#FFF',
    borderRadius: 24,
    padding: 28,
    width: '100%',
    maxWidth: 380,
    alignItems: 'center',
    ...makeShadow('#000', 8, 0.15, 20, 8),
  },

  cardTop: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 },
  checkCircle: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: '#DCFCE7', alignItems: 'center', justifyContent: 'center',
  },
  successLabel: { fontSize: 14, fontWeight: '700', color: '#16A34A', textTransform: 'uppercase', letterSpacing: 0.5 },

  title: { fontSize: 20, fontWeight: '800', color: '#111827', marginTop: 12, marginBottom: 4, textAlign: 'center' },
  subtitle: { fontSize: 14, color: '#6B7280', textAlign: 'center', marginBottom: 20 },

  targetRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 20 },
  targetName: { fontSize: 16, fontWeight: '700', color: '#111827' },

  starsRow: { flexDirection: 'row', gap: 8, marginBottom: 8 },
  ratingLabel: { fontSize: 13, fontWeight: '700', color: '#F59E0B', marginBottom: 16 },

  commentInput: {
    width: '100%',
    backgroundColor: '#F9FAFB',
    borderWidth: 1, borderColor: '#E5E7EB',
    borderRadius: 12,
    paddingHorizontal: 14, paddingVertical: 10,
    fontSize: 14, color: '#111827',
    minHeight: 80, textAlignVertical: 'top',
    marginBottom: 20,
  },

  submitBtn: {
    width: '100%', backgroundColor: PRIMARY,
    borderRadius: 14, paddingVertical: 14,
    alignItems: 'center', justifyContent: 'center',
    marginBottom: 10,
  },
  submitBtnText: { color: '#FFF', fontWeight: '800', fontSize: 15 },

  skipBtn: { paddingVertical: 8 },
  skipBtnText: { fontSize: 13, color: '#9CA3AF', fontWeight: '600' },
});
