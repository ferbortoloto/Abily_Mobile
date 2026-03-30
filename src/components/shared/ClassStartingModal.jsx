import React, { useEffect, useState } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, Modal, Pressable,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { makeShadow } from '../../constants/theme';

const PRIMARY = '#1D4ED8';

/**
 * Modal que aparece sobre qualquer tela quando uma aula está prestes a começar.
 *
 * Props:
 *   upcomingClass: { event, minutesUntil } | null
 *   onDismiss: (eventId) => void
 */
export default function ClassStartingModal({ upcomingClass, onDismiss }) {
  const [minutesUntil, setMinutesUntil] = useState(null);

  // Mantém o contador de minutos atualizado a cada 30s
  useEffect(() => {
    if (!upcomingClass) { setMinutesUntil(null); return; }

    const update = () => {
      const diff = Math.round(
        (new Date(upcomingClass.event.start_datetime).getTime() - Date.now()) / 60_000
      );
      setMinutesUntil(diff);
    };

    update();
    const id = setInterval(update, 30_000);
    return () => clearInterval(id);
  }, [upcomingClass]);

  if (!upcomingClass) return null;

  const { event } = upcomingClass;

  const startTime = new Date(event.start_datetime).toLocaleTimeString('pt-BR', {
    hour: '2-digit', minute: '2-digit',
  });

  const location = event.meeting_point?.address || event.location || null;

  const isStarting  = minutesUntil !== null && minutesUntil <= 0;
  const isImmediate = minutesUntil !== null && minutesUntil <= 2;

  const urgencyColor = isImmediate ? '#EF4444' : minutesUntil <= 5 ? '#F59E0B' : PRIMARY;

  const countdownLabel = isStarting
    ? 'Começando agora!'
    : minutesUntil === 1
      ? 'Começa em 1 minuto'
      : `Começa em ${minutesUntil} minutos`;

  return (
    <Modal visible transparent animationType="slide" onRequestClose={() => onDismiss(event.id)}>
      {/* Toque fora NÃO fecha — força interação consciente */}
      <View style={styles.overlay} pointerEvents="box-none">
        <View style={[styles.card, isImmediate && styles.cardUrgent]}>

          {/* Barra de cor no topo */}
          <View style={[styles.topBar, { backgroundColor: urgencyColor }]} />

          {/* Ícone + badge de urgência */}
          <View style={styles.iconRow}>
            <View style={[styles.iconWrap, { backgroundColor: `${urgencyColor}18` }]}>
              <Ionicons
                name={isStarting ? 'flag' : 'time'}
                size={28}
                color={urgencyColor}
              />
            </View>
            <View style={[styles.urgencyBadge, { backgroundColor: urgencyColor }]}>
              <Text style={styles.urgencyText}>{countdownLabel}</Text>
            </View>
          </View>

          {/* Título da aula */}
          <Text style={styles.title} numberOfLines={2}>{event.title}</Text>

          {/* Detalhes */}
          <View style={styles.details}>
            <View style={styles.detailRow}>
              <Ionicons name="time-outline" size={15} color="#6B7280" />
              <Text style={styles.detailText}>{startTime}</Text>
            </View>

            {location && (
              <View style={styles.detailRow}>
                <Ionicons name="location-outline" size={15} color="#6B7280" />
                <Text style={styles.detailText} numberOfLines={1}>{location}</Text>
              </View>
            )}
          </View>

          {/* Linha divisória */}
          <View style={styles.divider} />

          {/* Ações */}
          <View style={styles.actions}>
            <TouchableOpacity
              style={styles.btnDismiss}
              onPress={() => onDismiss(event.id)}
              activeOpacity={0.75}
            >
              <Text style={styles.btnDismissText}>Dispensar</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.btnMain, { backgroundColor: urgencyColor }]}
              onPress={() => onDismiss(event.id)}
              activeOpacity={0.8}
            >
              <Ionicons name="checkmark-circle-outline" size={16} color="#FFF" />
              <Text style={styles.btnMainText}>Entendido</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
    paddingBottom: 24,
    paddingHorizontal: 16,
    backgroundColor: 'rgba(0,0,0,0.35)',
  },

  card: {
    backgroundColor: '#FFF',
    borderRadius: 24,
    overflow: 'hidden',
    ...makeShadow('#000', 24, 0.18, 32, 8),
  },
  cardUrgent: {
    ...makeShadow('#EF4444', 12, 0.25, 20, 6),
  },

  topBar: {
    height: 5,
    width: '100%',
  },

  iconRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 20,
    gap: 12,
  },
  iconWrap: {
    width: 52, height: 52, borderRadius: 26,
    alignItems: 'center', justifyContent: 'center',
  },
  urgencyBadge: {
    flex: 1, paddingVertical: 6, paddingHorizontal: 14,
    borderRadius: 20, alignItems: 'center',
  },
  urgencyText: {
    fontSize: 13, fontWeight: '800', color: '#FFF', letterSpacing: 0.2,
  },

  title: {
    fontSize: 20, fontWeight: '800', color: '#111827',
    paddingHorizontal: 20, paddingTop: 16, lineHeight: 26,
  },

  details: {
    paddingHorizontal: 20, paddingTop: 10, gap: 6,
  },
  detailRow: {
    flexDirection: 'row', alignItems: 'center', gap: 7,
  },
  detailText: {
    fontSize: 13, color: '#6B7280', flex: 1,
  },

  divider: {
    height: 1, backgroundColor: '#F3F4F6',
    marginHorizontal: 20, marginTop: 18,
  },

  actions: {
    flexDirection: 'row', gap: 10,
    padding: 16,
  },
  btnDismiss: {
    flex: 1, paddingVertical: 13, borderRadius: 12,
    borderWidth: 1.5, borderColor: '#E5E7EB',
    alignItems: 'center', justifyContent: 'center',
  },
  btnDismissText: {
    fontSize: 14, fontWeight: '600', color: '#6B7280',
  },
  btnMain: {
    flex: 1.5, paddingVertical: 13, borderRadius: 12,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
  },
  btnMainText: {
    fontSize: 14, fontWeight: '700', color: '#FFF',
  },
});
