import React, { useState, useEffect } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  Modal, ScrollView, KeyboardAvoidingView, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';

const PRIMARY = '#1D4ED8';

const STATUS_OPTIONS = [
  { value: 'active', label: 'Ativo', color: '#16A34A' },
  { value: 'pending', label: 'Pendente', color: '#CA8A04' },
  { value: 'inactive', label: 'Inativo', color: '#6B7280' },
];

export default function ContactModal({ visible, contact, onSave, onClose }) {
  const isEditing = !!contact;
  const [form, setForm] = useState({
    name: '', email: '', phone: '', status: 'active', notes: '',
  });

  useEffect(() => {
    if (contact) {
      setForm({
        name: contact.name || '',
        email: contact.email || '',
        phone: contact.phone || '',
        status: contact.status || 'active',
        notes: contact.notes || '',
      });
    } else {
      setForm({ name: '', email: '', phone: '', status: 'active', notes: '' });
    }
  }, [contact, visible]);

  const handleSave = () => {
    if (!form.name.trim()) return;
    onSave({ ...contact, ...form });
  };

  const set = (key, value) => setForm(p => ({ ...p, [key]: value }));

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <SafeAreaView style={styles.safe}>
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          {/* Header */}
          <View style={styles.header}>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <Ionicons name="close" size={22} color="#6B7280" />
            </TouchableOpacity>
            <Text style={styles.title}>{isEditing ? 'Editar Aluno' : 'Novo Aluno'}</Text>
            <TouchableOpacity
              style={[styles.saveBtn, !form.name.trim() && styles.saveBtnDisabled]}
              onPress={handleSave}
              disabled={!form.name.trim()}
            >
              <Text style={styles.saveBtnText}>Salvar</Text>
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.scroll} keyboardShouldPersistTaps="handled">
            <Field label="Nome *" icon="person-outline">
              <TextInput
                style={styles.input}
                value={form.name}
                onChangeText={v => set('name', v)}
                placeholder="Nome completo"
                placeholderTextColor="#9CA3AF"
              />
            </Field>

            <Field label="E-mail" icon="mail-outline">
              <TextInput
                style={styles.input}
                value={form.email}
                onChangeText={v => set('email', v)}
                placeholder="email@exemplo.com"
                placeholderTextColor="#9CA3AF"
                keyboardType="email-address"
                autoCapitalize="none"
              />
            </Field>

            <Field label="Telefone" icon="call-outline">
              <TextInput
                style={styles.input}
                value={form.phone}
                onChangeText={v => set('phone', v)}
                placeholder="(11) 99999-9999"
                placeholderTextColor="#9CA3AF"
                keyboardType="phone-pad"
              />
            </Field>

            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>Status</Text>
              <View style={styles.statusRow}>
                {STATUS_OPTIONS.map(opt => (
                  <TouchableOpacity
                    key={opt.value}
                    style={[
                      styles.statusBtn,
                      form.status === opt.value && { backgroundColor: `${opt.color}15`, borderColor: opt.color },
                    ]}
                    onPress={() => set('status', opt.value)}
                  >
                    <View style={[styles.statusDot, { backgroundColor: opt.color }]} />
                    <Text style={[styles.statusBtnText, form.status === opt.value && { color: opt.color, fontWeight: '700' }]}>
                      {opt.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            <Field label="Observações" icon="document-text-outline">
              <TextInput
                style={[styles.input, styles.textarea]}
                value={form.notes}
                onChangeText={v => set('notes', v)}
                placeholder="Observações sobre o aluno..."
                placeholderTextColor="#9CA3AF"
                multiline
                numberOfLines={3}
                textAlignVertical="top"
              />
            </Field>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </Modal>
  );
}

function Field({ label, icon, children }) {
  return (
    <View style={styles.fieldGroup}>
      <View style={styles.fieldLabelRow}>
        <Ionicons name={icon} size={14} color="#9CA3AF" />
        <Text style={styles.fieldLabel}>{label}</Text>
      </View>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#FFF' },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingVertical: 16,
    borderBottomWidth: 1, borderBottomColor: '#F3F4F6',
  },
  closeBtn: { padding: 4 },
  title: { fontSize: 18, fontWeight: '800', color: '#111827' },
  saveBtn: { backgroundColor: PRIMARY, borderRadius: 10, paddingHorizontal: 16, paddingVertical: 8 },
  saveBtnDisabled: { opacity: 0.4 },
  saveBtnText: { color: '#FFF', fontWeight: '700', fontSize: 14 },
  scroll: { flex: 1, padding: 20 },
  fieldGroup: { marginBottom: 18 },
  fieldLabelRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginBottom: 6 },
  fieldLabel: { fontSize: 13, fontWeight: '600', color: '#374151' },
  input: {
    borderWidth: 1.5, borderColor: '#E5E7EB', borderRadius: 12,
    paddingHorizontal: 14, paddingVertical: 12,
    fontSize: 15, color: '#111827', backgroundColor: '#F9FAFB',
  },
  textarea: { minHeight: 80, paddingTop: 12 },
  statusRow: { flexDirection: 'row', gap: 8 },
  statusBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5,
    paddingVertical: 10, borderRadius: 12,
    borderWidth: 1.5, borderColor: '#E5E7EB', backgroundColor: '#F9FAFB',
  },
  statusDot: { width: 8, height: 8, borderRadius: 4 },
  statusBtnText: { fontSize: 13, fontWeight: '600', color: '#6B7280' },
});
