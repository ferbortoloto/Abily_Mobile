import React, { useState, useRef, useEffect } from 'react';
import {
  View, Text, TouchableOpacity, Modal, Animated,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { makeShadow } from '../../constants/theme';

const SLIDES = [
  {
    icon: 'sparkles',
    iconColor: '#1D4ED8',
    iconBg: '#EFF6FF',
    title: 'Bem-vindo ao Ably!',
    body: 'Sua plataforma para encontrar instrutores de autoescola próximos, agendar aulas e tirar sua habilitação com facilidade.',
    accent: '#1D4ED8',
  },
  {
    icon: 'map',
    iconColor: '#7C3AED',
    iconBg: '#F5F3FF',
    title: 'Encontre Instrutores',
    body: 'No mapa você vê os instrutores disponíveis perto de você.\n\nFiltre por categoria (Moto ou Carro) e toque em um instrutor para ver perfil, avaliações e preços.',
    accent: '#7C3AED',
  },
  {
    icon: 'layers',
    iconColor: '#EA580C',
    iconBg: '#FFF7ED',
    title: 'Compre um Plano',
    body: 'Adquira pacotes de aulas diretamente no app com preço, quantidade e validade definidos pelo instrutor.\n\nSeus planos ficam salvos na aba "Planos".',
    accent: '#EA580C',
  },
  {
    icon: 'calendar',
    iconColor: '#059669',
    iconBg: '#ECFDF5',
    title: 'Agende suas Aulas',
    body: 'Com um plano ativo, escolha os dias e horários disponíveis do instrutor e confirme o agendamento em poucos toques.',
    accent: '#059669',
  },
  {
    icon: 'radio-button-on',
    iconColor: '#0891B2',
    iconBg: '#ECFEFF',
    title: 'Aulas ao Vivo',
    body: 'No dia da aula, você recebe uma confirmação. O instrutor gera um código de sessão para iniciar a aula e acompanhar o tempo em tempo real.',
    accent: '#0891B2',
  },
  {
    icon: 'chatbubbles',
    iconColor: '#CA8A04',
    iconBg: '#FEFCE8',
    title: 'Chat com o Instrutor',
    body: 'Envie mensagens diretamente para o seu instrutor pela aba "Mensagens".\n\nCombine detalhes, tire dúvidas e mantenha tudo em um só lugar.',
    accent: '#CA8A04',
  },
  {
    icon: 'shield-checkmark',
    iconColor: '#16A34A',
    iconBg: '#F0FDF4',
    title: 'Tudo pronto!',
    body: 'Você tem 7 dias para solicitar reembolso caso não utilize nenhuma aula do plano.\n\nAgora explore os instrutores disponíveis e comece sua jornada!',
    accent: '#16A34A',
    isFinal: true,
  },
];

export default function StudentOnboardingModal({ visible, onFinish }) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const fadeAnim = useRef(new Animated.Value(1)).current;

  // Reset ao abrir
  useEffect(() => {
    if (visible) setCurrentIndex(0);
  }, [visible]);

  const slide = SLIDES[currentIndex];

  const animateToIndex = (next) => {
    Animated.timing(fadeAnim, {
      toValue: 0,
      duration: 120,
      useNativeDriver: true,
    }).start(() => {
      setCurrentIndex(next);
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 180,
        useNativeDriver: true,
      }).start();
    });
  };

  const goNext = () => {
    const next = currentIndex + 1;
    if (next >= SLIDES.length) {
      onFinish();
      return;
    }
    animateToIndex(next);
  };

  const goBack = () => {
    if (currentIndex === 0) return;
    animateToIndex(currentIndex - 1);
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
      onRequestClose={() => {}}
    >
      <View style={styles.overlay}>
        <View style={styles.card}>

          {/* Skip */}
          {!slide.isFinal && (
            <TouchableOpacity style={styles.skipBtn} onPress={onFinish}>
              <Text style={styles.skipText}>Pular</Text>
            </TouchableOpacity>
          )}

          {/* Slide content */}
          <Animated.View style={[styles.slideContent, { opacity: fadeAnim }]}>
            <View style={[styles.iconWrap, { backgroundColor: slide.iconBg }]}>
              <Ionicons name={slide.icon} size={44} color={slide.iconColor} />
            </View>
            <Text style={[styles.slideTitle, { color: slide.accent }]}>{slide.title}</Text>
            <Text style={styles.slideBody}>{slide.body}</Text>
          </Animated.View>

          {/* Dots */}
          <View style={styles.dotsRow}>
            {SLIDES.map((_, i) => (
              <View
                key={i}
                style={[
                  styles.dot,
                  {
                    width: i === currentIndex ? 18 : 6,
                    opacity: i === currentIndex ? 1 : 0.3,
                    backgroundColor: slide.accent,
                  },
                ]}
              />
            ))}
          </View>

          {/* Buttons */}
          <View style={styles.btnRow}>
            {currentIndex > 0 ? (
              <TouchableOpacity style={styles.backBtn} onPress={goBack}>
                <Ionicons name="arrow-back" size={18} color="#6B7280" />
                <Text style={styles.backText}>Voltar</Text>
              </TouchableOpacity>
            ) : (
              <View style={{ flex: 1 }} />
            )}

            <TouchableOpacity
              style={[styles.nextBtn, { backgroundColor: slide.accent, ...makeShadow(slide.accent, 4, 0.3, 8, 3) }]}
              onPress={goNext}
              activeOpacity={0.85}
            >
              {slide.isFinal ? (
                <>
                  <Ionicons name="map" size={18} color="#FFF" />
                  <Text style={styles.nextText}>Explorar instrutores</Text>
                </>
              ) : (
                <>
                  <Text style={styles.nextText}>Próximo</Text>
                  <Ionicons name="arrow-forward" size={18} color="#FFF" />
                </>
              )}
            </TouchableOpacity>
          </View>

          <Text style={styles.stepLabel}>{currentIndex + 1} de {SLIDES.length}</Text>

        </View>
      </View>
    </Modal>
  );
}

const styles = {
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 16,
  },
  card: {
    backgroundColor: '#FFF',
    borderRadius: 24,
    width: '100%',
    maxWidth: 420,
    paddingBottom: 24,
    ...makeShadow('#000', 24, 0.18, 32, 8),
  },
  skipBtn: {
    position: 'absolute',
    top: 16,
    right: 16,
    zIndex: 10,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: '#F3F4F6',
  },
  skipText: { fontSize: 13, fontWeight: '600', color: '#6B7280' },
  slideContent: {
    paddingHorizontal: 28,
    paddingTop: 40,
    paddingBottom: 8,
    alignItems: 'center',
    minHeight: 280,
    justifyContent: 'center',
  },
  iconWrap: {
    width: 96,
    height: 96,
    borderRadius: 48,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
    marginTop: 8,
  },
  slideTitle: {
    fontSize: 22,
    fontWeight: '800',
    textAlign: 'center',
    marginBottom: 14,
    letterSpacing: -0.3,
  },
  slideBody: {
    fontSize: 14.5,
    color: '#4B5563',
    textAlign: 'center',
    lineHeight: 22,
  },
  dotsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 5,
    marginTop: 20,
    marginBottom: 4,
    height: 8,
  },
  dot: { height: 6, borderRadius: 3 },
  btnRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 24,
    marginTop: 20,
    gap: 12,
  },
  backBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 13,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: '#E5E7EB',
  },
  backText: { fontSize: 14, fontWeight: '600', color: '#6B7280' },
  nextBtn: {
    flex: 2,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    borderRadius: 12,
  },
  nextText: { fontSize: 15, fontWeight: '700', color: '#FFF' },
  stepLabel: {
    textAlign: 'center',
    fontSize: 12,
    color: '#9CA3AF',
    marginTop: 10,
    fontWeight: '500',
  },
};
