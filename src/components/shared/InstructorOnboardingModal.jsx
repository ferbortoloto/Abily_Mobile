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
    body: 'Você acaba de entrar na plataforma que conecta instrutores de trânsito autônomos a alunos de forma simples e eficiente.\n\nVeja tudo que você pode fazer por aqui.',
    accent: '#1D4ED8',
  },
  {
    icon: 'calendar',
    iconColor: '#7C3AED',
    iconBg: '#F5F3FF',
    title: 'Configure sua Agenda',
    body: 'Defina os dias e horários em que você estará disponível para dar aulas.\n\nAlunos só poderão solicitar aulas nos horários que você liberar.',
    accent: '#7C3AED',
  },
  {
    icon: 'home',
    iconColor: '#059669',
    iconBg: '#ECFDF5',
    title: 'Painel de Solicitações',
    body: 'Receba e gerencie solicitações de aulas dos alunos em tempo real.\n\nAceite, recuse e acompanhe sessões ativas diretamente no mapa.',
    accent: '#059669',
  },
  {
    icon: 'cube',
    iconColor: '#EA580C',
    iconBg: '#FFF7ED',
    title: 'Crie seus Planos',
    body: 'Monte pacotes de aulas com preço, quantidade e validade personalizados.\n\nAlunos compram seus planos e as aulas são descontadas automaticamente.',
    accent: '#EA580C',
  },
  {
    icon: 'chatbubbles',
    iconColor: '#0891B2',
    iconBg: '#ECFEFF',
    title: 'Chat com Alunos',
    body: 'Converse diretamente com seus alunos antes e depois das aulas.\n\nCombine detalhes, tire dúvidas e mantenha tudo organizado em um só lugar.',
    accent: '#0891B2',
  },
  {
    icon: 'bar-chart',
    iconColor: '#CA8A04',
    iconBg: '#FEFCE8',
    title: 'Relatórios e Ganhos',
    body: 'Acompanhe seu histórico de aulas, avaliações dos alunos e faturamento.\n\nTudo transparente para você crescer na plataforma.',
    accent: '#CA8A04',
  },
  {
    icon: 'time',
    iconColor: '#7C3AED',
    iconBg: '#F5F3FF',
    title: 'Duração padrão: 50 min',
    body: 'Todas as aulas na plataforma têm duração de 50 minutos.\n\nEsse é o tempo padrão definido pelo Ably para garantir uma experiência consistente para todos os alunos e instrutores.',
    accent: '#7C3AED',
  },
  {
    icon: 'checkmark-circle',
    iconColor: '#16A34A',
    iconBg: '#F0FDF4',
    title: 'Pronto para começar!',
    body: 'Configure sua disponibilidade na aba Agenda para que os alunos possam encontrar e agendar aulas com você.',
    accent: '#16A34A',
    isFinal: true,
  },
];

export default function InstructorOnboardingModal({ visible, onFinish }) {
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
                  <Ionicons name="checkmark-circle" size={18} color="#FFF" />
                  <Text style={styles.nextText}>Entendido, vamos lá!</Text>
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
