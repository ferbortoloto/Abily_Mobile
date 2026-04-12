import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Linking, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import Avatar from './Avatar';
import { makeShadow } from '../../constants/theme';
import {
  getNextUpcomingClassAsInstructor,
  getNextUpcomingClassAsStudent,
} from '../../services/events.service';
import { getSessionForEvent, confirmPresence } from '../../services/session.service';

const PRIMARY  = '#1D4ED8';
const WINDOW   = 60; // minutos antes de exibir o card

function minutesUntil(isoStr) {
  return Math.round((new Date(isoStr) - Date.now()) / 60000);
}

function formatTime(isoStr) {
  const d = new Date(isoStr);
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  return `${hh}:${mm}`;
}

function VehicleBlock({ profile, vehicleType }) {
  const iscar  = vehicleType === 'car';
  const model  = iscar ? profile.car_model  : profile.moto_model;
  const year   = iscar ? profile.car_year   : profile.moto_year;
  const color  = iscar ? profile.car_color  : profile.moto_color;
  const plate  = iscar ? profile.car_plate  : profile.moto_plate;

  if (!model && !plate) return null;

  return (
    <View style={styles.vehicleBlock}>
      <View style={styles.vehicleIconWrap}>
        <Ionicons
          name={iscar ? 'car-outline' : 'bicycle-outline'}
          size={18}
          color={PRIMARY}
        />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.vehicleTitle}>
          {iscar ? 'Carro' : 'Moto'}
        </Text>
        <Text style={styles.vehicleDetail}>
          {[model, year ? String(year) : null].filter(Boolean).join(' · ') || '—'}
        </Text>
        {(color || plate) && (
          <View style={styles.vehicleTagsRow}>
            {color ? (
              <View style={styles.vehicleTag}>
                <Ionicons name="color-palette-outline" size={11} color="#6B7280" />
                <Text style={styles.vehicleTagText}>{color}</Text>
              </View>
            ) : null}
            {plate ? (
              <View style={[styles.vehicleTag, styles.vehicleTagPlate]}>
                <Ionicons name="reader-outline" size={11} color="#1D4ED8" />
                <Text style={[styles.vehicleTagText, { color: '#1D4ED8', fontWeight: '700' }]}>
                  {plate.toUpperCase()}
                </Text>
              </View>
            ) : null}
          </View>
        )}
      </View>
    </View>
  );
}

function InfoRow({ icon, label, value }) {
  if (!value) return null;
  return (
    <View style={styles.infoRow}>
      <Ionicons name={icon} size={14} color="#6B7280" style={{ marginTop: 1 }} />
      <View style={{ flex: 1 }}>
        <Text style={styles.infoLabel}>{label}</Text>
        <Text style={styles.infoValue}>{value}</Text>
      </View>
    </View>
  );
}

export default function PreClassCard({ userId, role }) {
  const [classData, setClassData] = useState(null);
  const [minutesLeft, setMinutesLeft] = useState(null);
  const [session, setSession] = useState(null);
  const [checkedIn, setCheckedIn] = useState(false);
  const [checkingIn, setCheckingIn] = useState(false);

  const fetchNext = useCallback(async () => {
    if (!userId) return;
    try {
      const data = role === 'instructor'
        ? await getNextUpcomingClassAsInstructor(userId, WINDOW)
        : await getNextUpcomingClassAsStudent(userId, WINDOW);
      setClassData(data || null);
      if (data?.start_datetime) {
        setMinutesLeft(minutesUntil(data.start_datetime));
      }
    } catch {
      setClassData(null);
    }
  }, [userId, role]);

  // Recarrega ao focar a tela
  useFocusEffect(useCallback(() => {
    fetchNext();
  }, [fetchNext]));

  // Busca sessão pendente ao carregar a aula
  useEffect(() => {
    if (!classData?.id) { setSession(null); setCheckedIn(false); return; }
    getSessionForEvent(classData.id)
      .then(s => {
        setSession(s);
        if (s) {
          const field = role === 'instructor' ? 'instructor_checked_in_at' : 'student_checked_in_at';
          setCheckedIn(!!s[field]);
        }
      })
      .catch(() => {});
  }, [classData?.id, role]);

  // Atualiza o contador a cada minuto
  useEffect(() => {
    if (!classData?.start_datetime) return;
    const id = setInterval(() => {
      setMinutesLeft(minutesUntil(classData.start_datetime));
    }, 60000);
    return () => clearInterval(id);
  }, [classData?.start_datetime]);

  const handleCheckIn = async () => {
    if (!session || checkingIn || checkedIn) return;
    setCheckingIn(true);
    try {
      await confirmPresence(session.id, role);
      setCheckedIn(true);
    } catch {
      // falha silenciosa — o cron trata o caso base
    } finally {
      setCheckingIn(false);
    }
  };

  if (!classData) return null;

  const isInstructor = role === 'instructor';
  const other        = classData.profiles; // perfil do outro lado (via FK join)
  const carOption    = classData.car_option || 'instructor';

  // Formata o contador
  const countLabel = minutesLeft <= 0
    ? 'Agora!'
    : minutesLeft === 1
      ? 'Em 1 min'
      : `Em ${minutesLeft} min`;

  const urgentColor = minutesLeft <= 15 ? '#DC2626' : minutesLeft <= 30 ? '#EA580C' : PRIMARY;

  const handleCallOther = () => {
    const phone = other?.phone?.replace(/\D/g, '');
    if (phone) Linking.openURL(`tel:${phone}`);
  };

  return (
    <View style={styles.card}>
      {/* ── Topo ── */}
      <View style={styles.topRow}>
        <View style={[styles.timeBadge, { backgroundColor: urgentColor }]}>
          <Ionicons name="time-outline" size={12} color="#FFF" />
          <Text style={styles.timeBadgeText}>{countLabel}</Text>
        </View>
        <Text style={styles.cardTitle}>Próxima Aula</Text>
        <Text style={styles.startTime}>{formatTime(classData.start_datetime)}</Text>
      </View>

      {/* ── Perfil do outro ── */}
      {other ? (
        <>
          <View style={styles.personRow}>
            <Avatar
              uri={other.avatar_url}
              name={other.name}
              size={48}
              style={styles.avatar}
            />
            <View style={{ flex: 1 }}>
              <Text style={styles.personName}>{other.name || '—'}</Text>
              <Text style={styles.personRole}>
                {isInstructor ? 'Aluno' : 'Instrutor'}
              </Text>
            </View>
            {other.phone ? (
              <TouchableOpacity
                style={styles.callBtn}
                onPress={handleCallOther}
                activeOpacity={0.8}
              >
                <Ionicons name="call-outline" size={18} color="#FFF" />
              </TouchableOpacity>
            ) : null}
          </View>

          <View style={styles.divider} />

          {/* ── Dados específicos por papel ── */}
          {isInstructor ? (
            // Instrutor vê: RENACH, endereço do aluno, carro do aluno se for ele quem leva
            <View style={styles.detailsBlock}>
              <InfoRow
                icon="document-text-outline"
                label="RENACH"
                value={other.renach || 'Não informado'}
              />
              <InfoRow
                icon="person-outline"
                label="Sexo"
                value={
                  other.gender === 'male' ? 'Masculino'
                  : other.gender === 'female' ? 'Feminino'
                  : 'Não declarado'
                }
              />
              <InfoRow
                icon="location-outline"
                label="Endereço"
                value={other.address || null}
              />
              {carOption === 'student' && (
                <VehicleBlock profile={other} vehicleType="car" />
              )}
              {carOption === 'instructor' && (
                <View style={styles.vehicleNote}>
                  <Ionicons name="car-outline" size={14} color="#6B7280" />
                  <Text style={styles.vehicleNoteText}>Aula no seu veículo</Text>
                </View>
              )}
            </View>
          ) : (
            // Aluno vê: veículo do instrutor (carro ou moto)
            <View style={styles.detailsBlock}>
              {carOption === 'instructor' ? (
                <>
                  <VehicleBlock profile={other} vehicleType="car" />
                  <VehicleBlock profile={other} vehicleType="moto" />
                  {!other.car_model && !other.moto_model && (
                    <View style={styles.vehicleNote}>
                      <Ionicons name="car-outline" size={14} color="#6B7280" />
                      <Text style={styles.vehicleNoteText}>Veículo do instrutor</Text>
                    </View>
                  )}
                </>
              ) : (
                <View style={styles.vehicleNote}>
                  <Ionicons name="car-sport-outline" size={14} color="#6B7280" />
                  <Text style={styles.vehicleNoteText}>Aula no seu próprio carro</Text>
                </View>
              )}
            </View>
          )}
        </>
      ) : (
        <Text style={styles.loadingText}>Carregando dados da aula…</Text>
      )}

      {/* ── Botão de confirmação de presença ── */}
      {session && (
        <>
          <View style={styles.divider} />
          {checkedIn ? (
            <View style={styles.checkedInRow}>
              <Ionicons name="checkmark-circle" size={18} color="#16A34A" />
              <Text style={styles.checkedInText}>Presença confirmada</Text>
            </View>
          ) : (
            <TouchableOpacity
              style={[styles.checkInBtn, checkingIn && { opacity: 0.6 }]}
              onPress={handleCheckIn}
              disabled={checkingIn}
              activeOpacity={0.8}
            >
              <Ionicons name="location-outline" size={16} color="#FFF" />
              <Text style={styles.checkInBtnText}>
                {checkingIn
                  ? 'Confirmando…'
                  : isInstructor
                    ? 'Confirmar presença'
                    : 'Confirmar chegada'}
              </Text>
            </TouchableOpacity>
          )}
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#FFF',
    borderRadius: 18,
    marginHorizontal: 16,
    marginBottom: 14,
    padding: 16,
    borderWidth: 1.5,
    borderColor: '#DBEAFE',
    ...makeShadow(PRIMARY, 8, 0.12, 16, 4),
  },

  // Topo
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 14,
    gap: 8,
  },
  timeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 20,
  },
  timeBadgeText: { fontSize: 11, fontWeight: '800', color: '#FFF' },
  cardTitle: { flex: 1, fontSize: 14, fontWeight: '700', color: '#0F172A' },
  startTime: { fontSize: 14, fontWeight: '800', color: PRIMARY },

  // Pessoa
  personRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 14,
  },
  avatar: { borderRadius: 24 },
  personName: { fontSize: 16, fontWeight: '800', color: '#0F172A' },
  personRole: { fontSize: 12, color: '#6B7280', marginTop: 2 },
  callBtn: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: '#16A34A',
    alignItems: 'center', justifyContent: 'center',
    ...makeShadow('#16A34A', 4, 0.25, 8, 3),
  },

  divider: { height: 1, backgroundColor: '#F1F5F9', marginBottom: 14 },

  // Detalhes
  detailsBlock: { gap: 10 },
  infoRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  infoLabel: { fontSize: 11, color: '#9CA3AF', fontWeight: '600', marginBottom: 1 },
  infoValue: { fontSize: 13, color: '#1F2937', fontWeight: '500' },

  // Veículo
  vehicleBlock: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 10,
    backgroundColor: '#EFF6FF',
    borderRadius: 12, padding: 10,
  },
  vehicleIconWrap: {
    width: 32, height: 32, borderRadius: 10,
    backgroundColor: '#DBEAFE',
    alignItems: 'center', justifyContent: 'center',
  },
  vehicleTitle: { fontSize: 11, fontWeight: '700', color: '#6B7280', marginBottom: 2 },
  vehicleDetail: { fontSize: 13, fontWeight: '700', color: '#0F172A' },
  vehicleTagsRow: { flexDirection: 'row', gap: 6, marginTop: 6, flexWrap: 'wrap' },
  vehicleTag: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: '#F3F4F6', borderRadius: 8,
    paddingHorizontal: 7, paddingVertical: 3,
  },
  vehicleTagPlate: { backgroundColor: '#DBEAFE' },
  vehicleTagText: { fontSize: 11, color: '#374151' },

  vehicleNote: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: '#F8FAFC', borderRadius: 10, padding: 10,
  },
  vehicleNoteText: { fontSize: 13, color: '#6B7280' },

  loadingText: { fontSize: 13, color: '#9CA3AF', textAlign: 'center', paddingVertical: 8 },

  // Check-in
  checkedInRow: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingTop: 2 },
  checkedInText: { fontSize: 13, fontWeight: '700', color: '#16A34A' },
  checkInBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: '#16A34A', borderRadius: 12,
    paddingVertical: 10, paddingHorizontal: 16,
  },
  checkInBtnText: { fontSize: 14, fontWeight: '700', color: '#FFF' },
});
