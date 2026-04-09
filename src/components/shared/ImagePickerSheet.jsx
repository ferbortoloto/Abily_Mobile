/**
 * ImagePickerSheet — bottom sheet moderno para seleção de foto.
 *
 * Substitui Alert.alert no fluxo de seleção de imagem. Usar Modal React Native
 * em vez de Alert nativo resolve o problema do Android onde a Activity do picker
 * retornava resultado perdido após o Alert fechar.
 */
import React, { useRef, useEffect } from 'react';
import {
  Modal, View, Text, TouchableOpacity, StyleSheet,
  Animated, Platform, TouchableWithoutFeedback, InteractionManager,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as ImagePicker from 'expo-image-picker';
import { toast } from '../../utils/toast';

const DENIED = '__DENIED__';

async function pickFromGallery() {
  const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (status !== 'granted' && status !== 'limited') return DENIED;
  try {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      // Crop desabilitado no Android — editor nativo causa resultado cancelado em muitos OEMs
      allowsEditing: Platform.OS !== 'android',
      aspect: [1, 1],
      quality: 0.7,
    });
    return (!result.canceled && result.assets?.[0]?.uri) ? result.assets[0].uri : null;
  } catch { return null; }
}

async function pickFromCamera() {
  const { status } = await ImagePicker.requestCameraPermissionsAsync();
  if (status !== 'granted') return DENIED;
  try {
    const result = await ImagePicker.launchCameraAsync({
      allowsEditing: Platform.OS !== 'android',
      aspect: [1, 1],
      quality: 0.7,
    });
    return (!result.canceled && result.assets?.[0]?.uri) ? result.assets[0].uri : null;
  } catch { return null; }
}

export default function ImagePickerSheet({ visible, onClose, onUri }) {
  const slideAnim = useRef(new Animated.Value(400)).current;
  const backdropAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.timing(backdropAnim, { toValue: 1, duration: 220, useNativeDriver: true }),
        Animated.spring(slideAnim, {
          toValue: 0, tension: 65, friction: 11, useNativeDriver: true,
        }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(backdropAnim, { toValue: 0, duration: 180, useNativeDriver: true }),
        Animated.timing(slideAnim, { toValue: 400, duration: 200, useNativeDriver: true }),
      ]).start();
    }
  }, [visible]);

  const handleSelect = async (picker) => {
    // Fecha o modal ANTES de abrir o picker — crítico no Android
    onClose();
    await new Promise((resolve) => {
      if (Platform.OS === 'android') {
        InteractionManager.runAfterInteractions(() => setTimeout(resolve, 250));
      } else {
        setTimeout(resolve, 120);
      }
    });
    const uri = await picker();
    if (uri === DENIED) {
      toast.error('Permita o acesso nas configurações do celular.');
    } else if (uri) {
      onUri(uri);
    }
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <TouchableWithoutFeedback onPress={onClose}>
        <Animated.View style={[styles.backdrop, { opacity: backdropAnim }]}>
          <TouchableWithoutFeedback>
            <Animated.View style={[styles.sheet, { transform: [{ translateY: slideAnim }] }]}>
              {/* Drag handle */}
              <View style={styles.handle} />

              <Text style={styles.title}>Foto de perfil</Text>
              <Text style={styles.subtitle}>Como deseja adicionar sua foto?</Text>

              {/* Options */}
              <View style={styles.optionsRow}>
                <TouchableOpacity
                  style={styles.optionCard}
                  onPress={() => handleSelect(pickFromCamera)}
                  activeOpacity={0.75}
                >
                  <LinearGradient
                    colors={['rgba(37,99,235,0.14)', 'rgba(37,99,235,0.04)']}
                    style={[StyleSheet.absoluteFill, { borderRadius: 18 }]}
                  />
                  <View style={styles.optionIconCircle}>
                    <LinearGradient
                      colors={['#2563EB', '#4F46E5']}
                      style={[StyleSheet.absoluteFill, { borderRadius: 100 }]}
                      start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
                    />
                    <Ionicons name="camera" size={28} color="#FFF" />
                  </View>
                  <Text style={styles.optionLabel}>Câmera</Text>
                  <Text style={styles.optionSub}>Tirar nova foto</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.optionCard}
                  onPress={() => handleSelect(pickFromGallery)}
                  activeOpacity={0.75}
                >
                  <LinearGradient
                    colors={['rgba(124,58,237,0.14)', 'rgba(124,58,237,0.04)']}
                    style={[StyleSheet.absoluteFill, { borderRadius: 18 }]}
                  />
                  <View style={styles.optionIconCircle}>
                    <LinearGradient
                      colors={['#7C3AED', '#A855F7']}
                      style={[StyleSheet.absoluteFill, { borderRadius: 100 }]}
                      start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
                    />
                    <Ionicons name="images" size={26} color="#FFF" />
                  </View>
                  <Text style={styles.optionLabel}>Galeria</Text>
                  <Text style={styles.optionSub}>Escolher da galeria</Text>
                </TouchableOpacity>
              </View>

              <TouchableOpacity style={styles.cancelBtn} onPress={onClose} activeOpacity={0.8}>
                <Text style={styles.cancelText}>Cancelar</Text>
              </TouchableOpacity>
            </Animated.View>
          </TouchableWithoutFeedback>
        </Animated.View>
      </TouchableWithoutFeedback>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.68)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: '#0D1830',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingBottom: 40,
    paddingHorizontal: 20,
    paddingTop: 14,
    borderTopWidth: 1,
    borderLeftWidth: 1,
    borderRightWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  handle: {
    width: 40, height: 4,
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 22,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: '#F1F5F9',
    textAlign: 'center',
    marginBottom: 5,
  },
  subtitle: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.38)',
    textAlign: 'center',
    marginBottom: 26,
  },
  optionsRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 14,
  },
  optionCard: {
    flex: 1,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.09)',
    alignItems: 'center',
    paddingVertical: 24,
    overflow: 'hidden',
  },
  optionIconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
    overflow: 'hidden',
  },
  optionLabel: {
    fontSize: 15,
    fontWeight: '700',
    color: '#F1F5F9',
    marginBottom: 3,
  },
  optionSub: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.38)',
  },
  cancelBtn: {
    height: 52,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.09)',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  cancelText: {
    fontSize: 15,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.55)',
  },
});
