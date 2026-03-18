import React, { useState } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, FlatList,
  TextInput, Modal, ScrollView, ActivityIndicator,
} from 'react-native';
import { makeShadow } from '../../constants/theme';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { useSchedule } from '../../context/ScheduleContext';
import { useChat } from '../../context/ChatContext';
import Avatar from '../shared/Avatar';
import { getProfile } from '../../services/auth.service';

const PRIMARY = '#1D4ED8';

// Determina status do aluno: concluído se tem plano sem aulas restantes
function getStudentStatus(student) {
  if (student.planName && student.classesRemaining !== null && student.classesRemaining <= 0) {
    return 'completed';
  }
  return 'active';
}

export default function ContactList() {
  const navigation = useNavigation();
  const { students } = useSchedule();
  const { startChatWith } = useChat();
  const [search, setSearch] = useState('');
  const [profileStudent, setProfileStudent] = useState(null);
  const [profileData, setProfileData] = useState(null);
  const [loadingProfile, setLoadingProfile] = useState(false);

  const filtered = students.filter(s =>
    s.name.toLowerCase().includes(search.toLowerCase()) ||
    s.phone?.includes(search)
  );

  const handleMessage = async (studentId) => {
    await startChatWith(studentId);
    navigation.navigate('Chat');
  };

  const handleViewProfile = async (student) => {
    setProfileStudent(student);
    setProfileData(null);
    setLoadingProfile(true);
    try {
      const data = await getProfile(student.id);
      setProfileData(data);
    } catch (_) {
      setProfileData({});
    } finally {
      setLoadingProfile(false);
    }
  };

  const renderItem = ({ item }) => {
    const status = getStudentStatus(item);
    const isCompleted = status === 'completed';

    return (
      <View style={styles.contactCard}>
        <Avatar uri={item.avatar} name={item.name} size={52} />

        <View style={styles.contactInfo}>
          <View style={styles.contactTopRow}>
            <Text style={styles.contactName}>{item.name}</Text>
            {/* Status badge */}
            <View style={[styles.statusBadge, isCompleted ? styles.statusCompleted : styles.statusActive]}>
              <Text style={[styles.statusText, isCompleted ? styles.statusTextCompleted : styles.statusTextActive]}>
                {isCompleted ? 'Concluído' : 'Ativo'}
              </Text>
            </View>
          </View>

          {/* Plan / avulsa badge */}
          <View style={styles.contactMetaRow}>
            {item.planName ? (
              <View style={styles.planBadge}>
                <Ionicons name="layers-outline" size={11} color="#7C3AED" />
                <Text style={styles.planBadgeText}>{item.planName}</Text>
              </View>
            ) : (
              <View style={styles.avulsaBadge}>
                <Ionicons name="book-outline" size={11} color="#0891B2" />
                <Text style={styles.avulsaBadgeText}>Aula avulsa</Text>
              </View>
            )}
            <Text style={styles.contactMeta}>
              {item.classCount} aula{item.classCount !== 1 ? 's' : ''}
              {item.planName && item.classesRemaining !== null
                ? ` · ${item.classesRemaining} restante${item.classesRemaining !== 1 ? 's' : ''}`
                : ''}
            </Text>
          </View>

          {item.phone ? <Text style={styles.contactPhone}>{item.phone}</Text> : null}
        </View>

        {/* Action buttons */}
        <View style={styles.actionCol}>
          <TouchableOpacity
            style={styles.profileBtn}
            onPress={() => handleViewProfile(item)}
            activeOpacity={0.8}
          >
            <Ionicons name="person-outline" size={14} color={PRIMARY} />
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.msgBtn}
            onPress={() => handleMessage(item.id)}
            activeOpacity={0.8}
          >
            <Ionicons name="chatbubble-outline" size={13} color="#FFF" />
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      {/* Search */}
      <View style={styles.topBar}>
        <View style={styles.searchBox}>
          <Ionicons name="search-outline" size={16} color="#9CA3AF" />
          <TextInput
            style={styles.searchInput}
            placeholder="Buscar aluno..."
            placeholderTextColor="#9CA3AF"
            value={search}
            onChangeText={setSearch}
          />
          {search.length > 0 && (
            <TouchableOpacity onPress={() => setSearch('')}>
              <Ionicons name="close-circle" size={16} color="#9CA3AF" />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {filtered.length === 0 ? (
        <View style={styles.emptyState}>
          <Ionicons name="people-outline" size={48} color="#D1D5DB" />
          <Text style={styles.emptyTitle}>
            {search ? 'Nenhum aluno encontrado' : 'Nenhum aluno ainda'}
          </Text>
          {!search && (
            <Text style={styles.emptySubtitle}>
              Os alunos aparecem aqui automaticamente quando você aceitar uma solicitação.
            </Text>
          )}
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={item => String(item.id)}
          renderItem={renderItem}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
          ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
        />
      )}

      {/* Profile Modal */}
      <Modal
        visible={!!profileStudent}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setProfileStudent(null)}
      >
        {profileStudent && (
          <View style={styles.modalContainer}>
            {/* Modal header */}
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Perfil do Aluno</Text>
              <TouchableOpacity onPress={() => setProfileStudent(null)} style={styles.closeBtn}>
                <Ionicons name="close" size={22} color="#374151" />
              </TouchableOpacity>
            </View>

            <ScrollView contentContainerStyle={styles.modalBody} showsVerticalScrollIndicator={false}>
              {/* Avatar + name */}
              <View style={styles.profileTop}>
                <Avatar uri={profileStudent.avatar} name={profileStudent.name} size={80} />
                <Text style={styles.profileName}>{profileStudent.name}</Text>
                <View style={styles.profileRoleBadge}>
                  <Text style={styles.profileRoleText}>Aluno</Text>
                </View>
              </View>

              {loadingProfile ? (
                <ActivityIndicator color={PRIMARY} style={{ marginTop: 24 }} />
              ) : (
                <>
                  {/* Bio */}
                  {(profileData?.bio) ? (
                    <View style={styles.profileSection}>
                      <Text style={styles.profileSectionTitle}>Sobre</Text>
                      <Text style={styles.profileBio}>{profileData.bio}</Text>
                    </View>
                  ) : null}

                  {/* Info grid */}
                  <View style={styles.profileSection}>
                    <Text style={styles.profileSectionTitle}>Informações</Text>
                    <View style={styles.infoGrid}>
                      {profileStudent.phone ? (
                        <View style={styles.infoRow}>
                          <Ionicons name="call-outline" size={16} color="#6B7280" />
                          <Text style={styles.infoText}>{profileStudent.phone}</Text>
                        </View>
                      ) : null}
                      {profileData?.email ? (
                        <View style={styles.infoRow}>
                          <Ionicons name="mail-outline" size={16} color="#6B7280" />
                          <Text style={styles.infoText}>{profileData.email}</Text>
                        </View>
                      ) : null}
                      <View style={styles.infoRow}>
                        <Ionicons name="book-outline" size={16} color="#6B7280" />
                        <Text style={styles.infoText}>
                          {profileStudent.classCount} aula{profileStudent.classCount !== 1 ? 's' : ''} realizadas
                        </Text>
                      </View>
                    </View>
                  </View>

                  {/* Plan info */}
                  <View style={styles.profileSection}>
                    <Text style={styles.profileSectionTitle}>Plano / Modalidade</Text>
                    {profileStudent.planName ? (
                      <View style={styles.planCard}>
                        <View style={styles.planCardRow}>
                          <Ionicons name="layers-outline" size={18} color="#7C3AED" />
                          <Text style={styles.planCardName}>{profileStudent.planName}</Text>
                        </View>
                        {profileStudent.classesTotal !== null && (
                          <View style={styles.planProgress}>
                            <Text style={styles.planProgressText}>
                              {profileStudent.classesTotal - (profileStudent.classesRemaining || 0)} de {profileStudent.classesTotal} aulas concluídas
                            </Text>
                            <View style={styles.planBar}>
                              <View style={[
                                styles.planBarFill,
                                {
                                  width: `${Math.round(((profileStudent.classesTotal - (profileStudent.classesRemaining || 0)) / profileStudent.classesTotal) * 100)}%`,
                                },
                              ]} />
                            </View>
                            <Text style={styles.planRemaining}>
                              {profileStudent.classesRemaining} aula{profileStudent.classesRemaining !== 1 ? 's' : ''} restante{profileStudent.classesRemaining !== 1 ? 's' : ''}
                            </Text>
                          </View>
                        )}
                      </View>
                    ) : (
                      <View style={styles.avulsoCard}>
                        <Ionicons name="book-outline" size={18} color="#0891B2" />
                        <Text style={styles.avulsoText}>Aula avulsa</Text>
                      </View>
                    )}
                  </View>
                </>
              )}

              {/* Actions */}
              <TouchableOpacity
                style={styles.modalMsgBtn}
                onPress={() => {
                  setProfileStudent(null);
                  handleMessage(profileStudent.id);
                }}
                activeOpacity={0.85}
              >
                <Ionicons name="chatbubble-outline" size={17} color="#FFF" />
                <Text style={styles.modalMsgText}>Enviar Mensagem</Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        )}
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  topBar: { padding: 12 },
  searchBox: {
    flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: '#F9FAFB', borderRadius: 12,
    borderWidth: 1, borderColor: '#E5E7EB', paddingHorizontal: 12, paddingVertical: 8,
  },
  searchInput: { flex: 1, fontSize: 14, color: '#111827' },
  list: { padding: 14, paddingTop: 6, paddingBottom: 32 },

  contactCard: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#FFF', borderRadius: 16, padding: 14, gap: 12,
    ...makeShadow('#000', 2, 0.08, 6, 3),
  },
  contactInfo: { flex: 1 },
  contactTopRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 },
  contactName: { fontSize: 15, fontWeight: '700', color: '#111827', flex: 1 },
  statusBadge: { borderRadius: 10, paddingHorizontal: 8, paddingVertical: 3 },
  statusActive: { backgroundColor: '#F0FDF4' },
  statusCompleted: { backgroundColor: '#F3F4F6' },
  statusText: { fontSize: 10, fontWeight: '700' },
  statusTextActive: { color: '#16A34A' },
  statusTextCompleted: { color: '#6B7280' },

  contactMetaRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 3 },
  planBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 3,
    backgroundColor: '#F5F3FF', borderRadius: 8, paddingHorizontal: 6, paddingVertical: 2,
  },
  planBadgeText: { fontSize: 10, fontWeight: '700', color: '#7C3AED' },
  avulsaBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 3,
    backgroundColor: '#ECFEFF', borderRadius: 8, paddingHorizontal: 6, paddingVertical: 2,
  },
  avulsaBadgeText: { fontSize: 10, fontWeight: '700', color: '#0891B2' },
  contactMeta: { fontSize: 12, color: '#6B7280' },
  contactPhone: { fontSize: 12, color: '#9CA3AF', marginTop: 1 },

  actionCol: { gap: 8, alignItems: 'center' },
  profileBtn: {
    width: 34, height: 34, borderRadius: 17,
    borderWidth: 1.5, borderColor: PRIMARY,
    alignItems: 'center', justifyContent: 'center',
  },
  msgBtn: {
    width: 34, height: 34, borderRadius: 17,
    backgroundColor: PRIMARY,
    alignItems: 'center', justifyContent: 'center',
  },

  emptyState: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: 60, gap: 10, paddingHorizontal: 32 },
  emptyTitle: { fontSize: 16, fontWeight: '700', color: '#374151' },
  emptySubtitle: { fontSize: 13, color: '#9CA3AF', textAlign: 'center', lineHeight: 20 },

  // Modal
  modalContainer: { flex: 1, backgroundColor: '#FFF' },
  modalHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 20, paddingVertical: 16,
    borderBottomWidth: 1, borderBottomColor: '#F3F4F6',
  },
  modalTitle: { fontSize: 18, fontWeight: '800', color: '#111827' },
  closeBtn: { padding: 4 },
  modalBody: { padding: 20, paddingBottom: 40 },

  profileTop: { alignItems: 'center', marginBottom: 24, gap: 10 },
  profileName: { fontSize: 22, fontWeight: '800', color: '#111827' },
  profileRoleBadge: {
    backgroundColor: '#EFF6FF', borderRadius: 12,
    paddingHorizontal: 14, paddingVertical: 5,
  },
  profileRoleText: { fontSize: 13, fontWeight: '700', color: PRIMARY },

  profileSection: { marginBottom: 20 },
  profileSectionTitle: { fontSize: 13, fontWeight: '700', color: '#9CA3AF', marginBottom: 10, textTransform: 'uppercase', letterSpacing: 0.5 },
  profileBio: { fontSize: 14, color: '#374151', lineHeight: 22 },

  infoGrid: { gap: 10 },
  infoRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  infoText: { fontSize: 14, color: '#374151' },

  planCard: {
    backgroundColor: '#F5F3FF', borderRadius: 14, padding: 16,
    borderWidth: 1, borderColor: '#DDD6FE',
  },
  planCardRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 },
  planCardName: { fontSize: 15, fontWeight: '700', color: '#5B21B6' },
  planProgress: { gap: 6 },
  planProgressText: { fontSize: 13, color: '#6B7280' },
  planBar: { height: 8, backgroundColor: '#DDD6FE', borderRadius: 4, overflow: 'hidden' },
  planBarFill: { height: '100%', backgroundColor: '#7C3AED', borderRadius: 4 },
  planRemaining: { fontSize: 12, color: '#7C3AED', fontWeight: '600' },

  avulsoCard: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: '#ECFEFF', borderRadius: 14, padding: 16,
    borderWidth: 1, borderColor: '#A5F3FC',
  },
  avulsoText: { fontSize: 15, fontWeight: '700', color: '#0891B2' },

  modalMsgBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: PRIMARY, borderRadius: 14,
    paddingVertical: 16, marginTop: 8,
  },
  modalMsgText: { fontSize: 15, fontWeight: '700', color: '#FFF' },
});
