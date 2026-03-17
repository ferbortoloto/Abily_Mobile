import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Avatar from '../shared/Avatar';
import { makeShadow } from '../../constants/theme';

const PRIMARY = '#F59E0B';

export default function InstructorCard({ instructor, onPress }) {
  const catColor = instructor.licenseCategory === 'A' ? '#EA580C' : '#2563EB';

  return (
    <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={0.85}>
      <Avatar uri={instructor.photo} name={instructor.name} size={56} style={styles.photoFlex} />

      <View style={styles.info}>
        {/* Name + verified */}
        <View style={styles.nameRow}>
          <Text style={styles.name} numberOfLines={1}>{instructor.name}</Text>
          {instructor.isVerified && (
            <Ionicons name="checkmark-circle" size={16} color="#16A34A" />
          )}
        </View>

        {/* Car + Category + Vehicle Type */}
        <View style={styles.detailRow}>
          <Ionicons name="car-outline" size={12} color="#9CA3AF" />
          <Text style={styles.detailText} numberOfLines={1}>
            {[instructor.carModel, instructor.carYear].filter(Boolean).join(' ') || '—'}
          </Text>
          <View style={[styles.catBadge, { backgroundColor: `${catColor}20` }]}>
            <Text style={[styles.catText, { color: catColor }]}>Cat. {instructor.licenseCategory}</Text>
          </View>
          {instructor.vehicleType && instructor.vehicleType !== 'manual' && (
            <View style={styles.vehicleTypeBadge}>
              <Text style={styles.vehicleTypeText}>
                {instructor.vehicleType === 'automatic' ? 'Auto' : 'Elét.'}
              </Text>
            </View>
          )}
        </View>

        {/* Location */}
        <View style={styles.detailRow}>
          <Ionicons name="location-outline" size={12} color="#9CA3AF" />
          <Text style={styles.detailText} numberOfLines={1}>{instructor.location}</Text>
        </View>

        {/* Rating + Price */}
        <View style={styles.bottomRow}>
          <View style={styles.ratingRow}>
            <Ionicons name="star" size={13} color="#EAB308" />
            <Text style={styles.ratingText}>{instructor.rating.toFixed(1)}</Text>
            <Text style={styles.reviewsText}>({instructor.reviewsCount})</Text>
          </View>
          <PriceTag
            category={instructor.licenseCategory}
            pricePerHour={instructor.pricePerHour}
            pricePerHourMoto={instructor.pricePerHourMoto}
          />
        </View>
      </View>

      <Ionicons name="chevron-forward" size={18} color="#D1D5DB" />
    </TouchableOpacity>
  );
}

function PriceTag({ category, pricePerHour, pricePerHourMoto }) {
  if (category === 'A+B' && pricePerHourMoto) {
    return (
      <View style={styles.dualPriceCol}>
        <View style={styles.priceRow}>
          <Ionicons name="car-outline" size={11} color="#2563EB" />
          <Text style={[styles.priceSmall, { color: '#2563EB' }]}>R$ {pricePerHour}/h</Text>
        </View>
        <View style={styles.priceRow}>
          <Ionicons name="bicycle-outline" size={11} color="#EA580C" />
          <Text style={[styles.priceSmall, { color: '#EA580C' }]}>R$ {pricePerHourMoto}/h</Text>
        </View>
      </View>
    );
  }
  if (category === 'A') {
    return (
      <View style={styles.priceRow}>
        <Ionicons name="bicycle-outline" size={12} color="#EA580C" />
        <Text style={[styles.price, { color: '#EA580C' }]}>
          R$ {pricePerHourMoto || pricePerHour}/h
        </Text>
      </View>
    );
  }
  return <Text style={styles.price}>R$ {pricePerHour}/h</Text>;
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF',
    borderRadius: 16,
    padding: 12,
    gap: 12,
    ...makeShadow('#000', 2, 0.08, 6, 3),
  },
  photoFlex: { flexShrink: 0 },
  info: { flex: 1, gap: 3 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  name: { fontSize: 15, fontWeight: '700', color: '#111827', flex: 1 },
  detailRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  detailText: { fontSize: 12, color: '#6B7280', flex: 1 },
  catBadge: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6 },
  catText: { fontSize: 10, fontWeight: '700' },
  vehicleTypeBadge: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6, backgroundColor: '#EFF6FF' },
  vehicleTypeText: { fontSize: 10, fontWeight: '700', color: '#1D4ED8' },
  bottomRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 2 },
  ratingRow: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  ratingText: { fontSize: 13, fontWeight: '700', color: '#374151' },
  reviewsText: { fontSize: 11, color: '#9CA3AF' },
  price: { fontSize: 13, fontWeight: '800', color: PRIMARY },
  // Dual price
  dualPriceCol: { alignItems: 'flex-end', gap: 2 },
  priceRow: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  priceSmall: { fontSize: 11, fontWeight: '800' },
});
