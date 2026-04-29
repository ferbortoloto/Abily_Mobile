import React, { useMemo, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import LeafletMapView from '../../components/shared/LeafletMapView';
import Avatar from '../../components/shared/Avatar';
import { useStudentLiveLocation } from '../../hooks/useStudentLiveLocation';
import { useCurrentLocation } from '../../hooks/useCurrentLocation';
import { makeShadow } from '../../constants/theme';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../hooks/useAuth';

const PRIMARY  = '#1D4ED8';
const PURPLE   = '#7C3AED';
const AMBER    = '#F59E0B';

function haversineKm(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
    Math.cos((lat2 * Math.PI) / 180) *
    Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function formatEta(minutes) {
  if (minutes < 1) return 'Chegando!';
  if (minutes < 60) return `${Math.round(minutes)} min`;
  const h = Math.floor(minutes / 60);
  const m = Math.round(minutes % 60);
  return m > 0 ? `${h}h ${m}min` : `${h}h`;
}

export default function TrackStudentScreen({ route, navigation }) {
  const { studentId, studentName, studentAvatar, classTime, meetingPoint } = route.params;

  const { user } = useAuth();
  const studentLoc = useStudentLiveLocation(studentId);
  const { location: myLoc } = useCurrentLocation();

  // Enquanto a tela estiver aberta, atualiza a localização do instrutor no DB
  useEffect(() => {
    if (!user?.id || !myLoc) return;
    supabase
      .from('instructor_locations')
      .upsert({
        instructor_id: user.id,
        latitude:      myLoc.latitude,
        longitude:     myLoc.longitude,
        updated_at:    new Date().toISOString(),
      })
      .then(() => {});
  }, [user?.id, myLoc?.latitude, myLoc?.longitude]);

  const meetingCoords = meetingPoint?.coordinates ?? null;

  const { distanceKm, etaMin } = useMemo(() => {
    if (!studentLoc || !myLoc) return { distanceKm: null, etaMin: null };
    const d = haversineKm(
      studentLoc.latitude, studentLoc.longitude,
      myLoc.latitude, myLoc.longitude,
    );
    return { distanceKm: d, etaMin: (d / 30) * 60 };
  }, [studentLoc, myLoc]);

  const mapCenter = meetingCoords
    ? { lat: meetingCoords.latitude, lng: meetingCoords.longitude }
    : studentLoc
      ? { lat: studentLoc.latitude, lng: studentLoc.longitude }
      : myLoc
        ? { lat: myLoc.latitude, lng: myLoc.longitude }
        : null;

  const markers = useMemo(() => {
    const m = [];
    if (studentLoc) {
      m.push({
        id: 'student',
        latitude:  studentLoc.latitude,
        longitude: studentLoc.longitude,
        label:     studentName?.split(' ')[0] ?? 'Aluno',
        color:     PRIMARY,
        type:      'default',
      });
    }
    if (myLoc) {
      m.push({
        id: 'instructor',
        latitude:  myLoc.latitude,
        longitude: myLoc.longitude,
        label:     'Você',
        color:     PURPLE,
        type:      'default',
      });
    }
    if (meetingCoords) {
      m.push({
        id: 'meeting',
        latitude:  meetingCoords.latitude,
        longitude: meetingCoords.longitude,
        label:     'Encontro',
        color:     AMBER,
        type:      'default',
      });
    }
    return m;
  }, [studentLoc, myLoc, meetingCoords, studentName]);

  const lastSeen = studentLoc
    ? new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
    : null;

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color="#374151" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Localização do aluno</Text>
        <View style={{ width: 40 }} />
      </View>

      {/* Map */}
      <View style={styles.mapContainer}>
        {mapCenter ? (
          <LeafletMapView
            center={mapCenter}
            zoom={14}
            markers={markers}
          />
        ) : (
          <View style={styles.mapPlaceholder}>
            <ActivityIndicator size="large" color={PRIMARY} />
            <Text style={styles.mapPlaceholderText}>Obtendo localização…</Text>
          </View>
        )}
      </View>

      {/* Info card */}
      <View style={styles.card}>
        {/* Student row */}
        <View style={styles.personRow}>
          <Avatar uri={studentAvatar} name={studentName} size={48} />
          <View style={{ flex: 1 }}>
            <Text style={styles.personName}>{studentName || 'Aluno'}</Text>
            {classTime ? (
              <Text style={styles.classTime}>Aula às {classTime}</Text>
            ) : null}
          </View>
          {studentLoc ? (
            <View style={styles.liveBadge}>
              <View style={styles.liveDot} />
              <Text style={styles.liveText}>Ao vivo</Text>
            </View>
          ) : (
            <View style={styles.waitingBadge}>
              <ActivityIndicator size="small" color="#9CA3AF" />
              <Text style={styles.waitingText}>Aguardando</Text>
            </View>
          )}
        </View>

        <View style={styles.divider} />

        {/* Meeting point address */}
        {meetingPoint?.address && (
          <>
            <View style={styles.meetingRow}>
              <Ionicons name="location" size={14} color={AMBER} />
              <Text style={styles.meetingAddress} numberOfLines={1}>
                {meetingPoint.address}
              </Text>
            </View>
            <View style={styles.divider} />
          </>
        )}

        {/* Distance / ETA */}
        {studentLoc && myLoc ? (
          <View style={styles.etaRow}>
            <View style={styles.etaBlock}>
              <Ionicons name="navigate-outline" size={18} color={PRIMARY} />
              <View>
                <Text style={styles.etaLabel}>Distância do aluno</Text>
                <Text style={styles.etaValue}>
                  {distanceKm != null
                    ? distanceKm < 1
                      ? `${Math.round(distanceKm * 1000)} m`
                      : `${distanceKm.toFixed(1)} km`
                    : '—'}
                </Text>
              </View>
            </View>
            <View style={styles.etaDivider} />
            <View style={styles.etaBlock}>
              <Ionicons name="time-outline" size={18} color={PURPLE} />
              <View>
                <Text style={styles.etaLabel}>Encontro estimado</Text>
                <Text style={[styles.etaValue, { color: PURPLE }]}>
                  {etaMin != null ? formatEta(etaMin) : '—'}
                </Text>
              </View>
            </View>
          </View>
        ) : (
          <View style={styles.noLocRow}>
            <Ionicons name="location-outline" size={16} color="#9CA3AF" />
            <Text style={styles.noLocText}>
              {!studentLoc
                ? 'O aluno ainda não abriu a tela de acompanhamento.'
                : 'Obtendo sua localização…'}
            </Text>
          </View>
        )}

        {lastSeen ? (
          <Text style={styles.lastSeen}>Atualizado às {lastSeen}</Text>
        ) : null}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#F8FAFC' },

  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 12,
    backgroundColor: '#FFF',
    borderBottomWidth: 1, borderBottomColor: '#F1F5F9',
  },
  backBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: 16, fontWeight: '700', color: '#0F172A' },

  mapContainer: { flex: 1, backgroundColor: '#E5E7EB' },
  mapPlaceholder: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
  mapPlaceholderText: { fontSize: 14, color: '#9CA3AF' },

  card: {
    backgroundColor: '#FFF',
    borderTopLeftRadius: 24, borderTopRightRadius: 24,
    padding: 20,
    paddingBottom: 12,
    ...makeShadow('#000', 12, 0.1, 20, -4),
  },

  personRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 16 },
  personName: { fontSize: 16, fontWeight: '800', color: '#0F172A' },
  classTime: { fontSize: 12, color: '#6B7280', marginTop: 2 },

  liveBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    backgroundColor: '#DCFCE7', borderRadius: 20,
    paddingHorizontal: 10, paddingVertical: 4,
  },
  liveDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: '#16A34A' },
  liveText: { fontSize: 11, fontWeight: '700', color: '#16A34A' },

  waitingBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    backgroundColor: '#F3F4F6', borderRadius: 20,
    paddingHorizontal: 10, paddingVertical: 4,
  },
  waitingText: { fontSize: 11, fontWeight: '600', color: '#9CA3AF' },

  divider: { height: 1, backgroundColor: '#F1F5F9', marginBottom: 14 },

  meetingRow: {
    flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 14,
  },
  meetingAddress: { flex: 1, fontSize: 13, color: '#374151', fontWeight: '500' },

  etaRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  etaBlock: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10 },
  etaDivider: { width: 1, height: 36, backgroundColor: '#E5E7EB', marginHorizontal: 8 },
  etaLabel: { fontSize: 11, color: '#9CA3AF', fontWeight: '600' },
  etaValue: { fontSize: 18, fontWeight: '800', color: PRIMARY, marginTop: 1 },

  noLocRow: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 8,
    backgroundColor: '#F8FAFC', borderRadius: 12, padding: 12, marginBottom: 8,
  },
  noLocText: { flex: 1, fontSize: 13, color: '#9CA3AF', lineHeight: 18 },

  lastSeen: { fontSize: 11, color: '#D1D5DB', textAlign: 'right', marginTop: 4 },
});
