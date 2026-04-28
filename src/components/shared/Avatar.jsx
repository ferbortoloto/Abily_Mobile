import React, { useState, useEffect } from 'react';
import { View, Image, Text, StyleSheet } from 'react-native';

function getInitials(name) {
  if (!name) return '?';
  const parts = name.trim().split(/\s+/);
  const first = parts[0]?.[0] ?? '';
  const last = parts.length > 1 ? parts[parts.length - 1][0] : '';
  return (first + last).toUpperCase();
}

function pickColor(name) {
  const COLORS = [
    '#1D4ED8', '#0369A1', '#0F766E', '#15803D',
    '#7C3AED', '#B45309', '#B91C1C', '#0E7490',
  ];
  if (!name) return COLORS[0];
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return COLORS[Math.abs(hash) % COLORS.length];
}

export default function Avatar({ uri, name, size = 40, style }) {
  const [failed, setFailed] = useState(false);
  const borderRadius = size / 2;
  const fontSize = size * 0.36;

  useEffect(() => { setFailed(false); }, [uri]);

  if (uri && !failed) {
    return (
      <Image
        source={{ uri }}
        style={[{ width: size, height: size, borderRadius }, style]}
        onError={(e) => {
          console.warn('[Avatar] failed to load uri:', uri, e.nativeEvent.error);
          setFailed(true);
        }}
      />
    );
  }

  return (
    <View
      style={[
        { width: size, height: size, borderRadius, backgroundColor: pickColor(name) },
        styles.circle,
        style,
      ]}
    >
      <Text style={[styles.initials, { fontSize }]}>{getInitials(name)}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  circle: { alignItems: 'center', justifyContent: 'center' },
  initials: { color: '#fff', fontWeight: '700', letterSpacing: 0.5 },
});
