import React, { useState, useRef, useEffect } from 'react';
import { Animated, DeviceEventEmitter, StyleSheet, Text } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { toast } from '../../utils/toast';

const ICON = { success: 'checkmark-circle', error: 'alert-circle', info: 'information-circle' };
const BG   = { success: '#16A34A', error: '#DC2626', info: '#1D4ED8' };

export default function Toast() {
  const [visible, setVisible]   = useState(false);
  const [message, setMessage]   = useState('');
  const [type, setType]         = useState('success');
  const opacity    = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(-16)).current;
  const timerRef   = useRef(null);
  const { top } = useSafeAreaInsets();

  useEffect(() => {
    const sub = DeviceEventEmitter.addListener(toast._event, ({ message: msg, type: t }) => {
      if (timerRef.current) clearTimeout(timerRef.current);
      setMessage(msg);
      setType(t);
      setVisible(true);
      translateY.setValue(-16);
      opacity.setValue(0);
      Animated.parallel([
        Animated.timing(opacity,    { toValue: 1, duration: 220, useNativeDriver: true }),
        Animated.timing(translateY, { toValue: 0, duration: 220, useNativeDriver: true }),
      ]).start();
      timerRef.current = setTimeout(() => {
        Animated.parallel([
          Animated.timing(opacity,    { toValue: 0, duration: 280, useNativeDriver: true }),
          Animated.timing(translateY, { toValue: -16, duration: 280, useNativeDriver: true }),
        ]).start(() => setVisible(false));
      }, 3000);
    });
    return () => sub.remove();
  }, []);

  if (!visible) return null;

  return (
    <Animated.View
      style={[
        styles.container,
        { top: top + 12, backgroundColor: BG[type] || BG.success },
        { opacity, transform: [{ translateY }] },
      ]}
    >
      <Ionicons name={ICON[type] || ICON.success} size={18} color="#FFF" />
      <Text style={styles.text} numberOfLines={2}>{message}</Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    left: 16,
    right: 16,
    zIndex: 9999,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 13,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 8,
  },
  text: { color: '#FFF', fontSize: 14, fontWeight: '600', flex: 1 },
});
