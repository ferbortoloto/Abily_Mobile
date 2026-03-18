import React, { useState, useRef, useEffect } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  FlatList, KeyboardAvoidingView, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../hooks/useAuth';
import { useChat } from '../../context/ChatContext';
import { formatMessageTime, formatTimeSeparator } from '../../lib/utils';
import Avatar from '../../components/shared/Avatar';
import { makeShadow } from '../../constants/theme';

const PRIMARY = '#1D4ED8';

// ─── Conversation List ────────────────────────────────────────────────────────
function ConversationList({ onSelectConversation }) {
  const { user } = useAuth();
  const { conversations, messagesByConversation, getUnreadCount } = useChat();
  const [search, setSearch] = useState('');

  const getPartner = (conv) => ({
    name: conv.other?.name || 'Usuário',
    avatar: conv.other?.avatar_url || null,
    role: user?.role === 'instructor' ? 'Aluno' : 'Instrutor',
  });

  const getLastMsg = (conv) => {
    const msgs = messagesByConversation[conv.id];
    if (!msgs || msgs.length === 0) return null;
    return msgs[msgs.length - 1];
  };

  const filtered = conversations.filter(c => {
    const p = getPartner(c);
    return p.name.toLowerCase().includes(search.toLowerCase());
  });

  return (
    <View style={styles.listContainer}>
      {/* Search */}
      <View style={styles.searchBox}>
        <Ionicons name="search-outline" size={16} color="#9CA3AF" style={styles.searchIcon} />
        <TextInput
          style={styles.searchInput}
          placeholder="Buscar conversa..."
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

      {filtered.length === 0 ? (
        <View style={styles.emptyState}>
          <Ionicons name="chatbubbles-outline" size={40} color="#D1D5DB" />
          <Text style={styles.emptyText}>Nenhuma conversa encontrada</Text>
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={item => item.id}
          renderItem={({ item }) => {
            const partner = getPartner(item);
            const lastMsg = getLastMsg(item);
            const unread = getUnreadCount(item.id);
            return (
              <TouchableOpacity
                style={[styles.convRow, unread > 0 && styles.convRowUnread]}
                onPress={() => onSelectConversation(item.id)}
                activeOpacity={0.75}
              >
                <View style={styles.convAvatarWrapper}>
                  <Avatar uri={partner.avatar} name={partner.name} size={48} />
                  {unread > 0 && (
                    <View style={styles.convBadge}>
                      <Text style={styles.convBadgeText}>{unread > 9 ? '9+' : unread}</Text>
                    </View>
                  )}
                </View>
                <View style={styles.convInfo}>
                  <View style={styles.convInfoTop}>
                    <Text style={[styles.convName, unread > 0 && styles.convNameBold]}>
                      {partner.name}
                    </Text>
                    {lastMsg && (
                      <Text style={styles.convTime}>{formatMessageTime(lastMsg.created_at)}</Text>
                    )}
                  </View>
                  <View style={styles.convInfoBottom}>
                    <Text style={[styles.convLastMsg, unread > 0 && styles.convLastMsgBold]} numberOfLines={1}>
                      {lastMsg
                        ? (lastMsg.sender_id === user?.id ? 'Você: ' : '') + lastMsg.text
                        : 'Sem mensagens'}
                    </Text>
                    {unread > 0 && <View style={styles.unreadDot} />}
                  </View>
                  <Text style={styles.convRole}>{partner.role}</Text>
                </View>
              </TouchableOpacity>
            );
          }}
          ItemSeparatorComponent={() => <View style={styles.separator} />}
        />
      )}
    </View>
  );
}

// ─── Chat Conversation ────────────────────────────────────────────────────────
function ChatConversation({ conversationId, onBack }) {
  const { user } = useAuth();
  const { conversations, messagesByConversation, sendMessage, markConversationAsRead } = useChat();
  const [message, setMessage] = useState('');
  const flatRef = useRef(null);

  const conv = conversations.find(c => c.id === conversationId);
  const messages = messagesByConversation[conversationId] || [];

  useEffect(() => {
    if (conversationId) markConversationAsRead(conversationId);
  }, [conversationId]);

  useEffect(() => {
    if (messages.length) {
      setTimeout(() => flatRef.current?.scrollToEnd({ animated: true }), 100);
    }
  }, [messages.length]);

  const partner = {
    name: conv?.other?.name || 'Usuário',
    avatar: conv?.other?.avatar_url || null,
    role: user?.role === 'instructor' ? 'Aluno' : 'Instrutor',
  };

  const handleSend = () => {
    if (!message.trim()) return;
    sendMessage(conversationId, message);
    setMessage('');
  };

  const renderItem = ({ item, index }) => {
    const isOwn = item.sender_id === user?.id;
    const prev = messages[index - 1];
    const showSeparator =
      index === 0 ||
      new Date(item.created_at) - new Date(prev?.created_at) > 5 * 60 * 1000;

    return (
      <>
        {showSeparator && (
          <View style={styles.timeSeparator}>
            <Text style={styles.timeSeparatorText}>{formatTimeSeparator(item.created_at)}</Text>
          </View>
        )}
        <View style={[styles.msgRow, isOwn ? styles.msgRowOwn : styles.msgRowOther]}>
          <View style={[styles.msgBubble, isOwn ? styles.msgBubbleOwn : styles.msgBubbleOther]}>
            <Text style={[styles.msgText, isOwn ? styles.msgTextOwn : styles.msgTextOther]}>
              {item.text}
            </Text>
          </View>
        </View>
      </>
    );
  };

  if (!conv) return null;

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
    >
      {/* Conversation header */}
      <View style={styles.convHeader}>
        <TouchableOpacity onPress={onBack} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color="#374151" />
        </TouchableOpacity>
        <Avatar uri={partner.avatar} name={partner.name} size={40} style={styles.convHeaderAvatar} />
        <View>
          <Text style={styles.convHeaderName}>{partner.name}</Text>
          <Text style={styles.convHeaderRole}>{partner.role}</Text>
        </View>
      </View>

      {/* Messages */}
      <FlatList
        ref={flatRef}
        data={messages}
        keyExtractor={item => item.id}
        contentContainerStyle={styles.msgList}
        renderItem={renderItem}
        onLayout={() => flatRef.current?.scrollToEnd({ animated: false })}
      />

      {/* Input */}
      <View style={styles.inputBar}>
        <TextInput
          style={styles.msgInput}
          placeholder="Escreva uma mensagem..."
          placeholderTextColor="#9CA3AF"
          value={message}
          onChangeText={setMessage}
          multiline
          maxLength={1000}
        />
        <TouchableOpacity
          style={[styles.sendBtn, !message.trim() && styles.sendBtnDisabled]}
          onPress={handleSend}
          disabled={!message.trim()}
        >
          <Ionicons name="send" size={18} color="#FFF" />
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

// ─── Main ChatScreen ───────────────────────────────────────────────────────────
export default function ChatScreen() {
  const [activeConvId, setActiveConvId] = useState(null);
  const { pendingConvId, pendingConvIdRef, clearPendingConv } = useChat();

  // Abre conversa pendente (via startChatWith) ou reseta para a lista ao focar
  // Usa o ref para leitura imediata e o state como dependência reativa
  useFocusEffect(
    React.useCallback(() => {
      const id = pendingConvIdRef.current || pendingConvId;
      if (id) {
        setActiveConvId(id);
        clearPendingConv();
      } else {
        // Apertar no tab do rodapé sempre volta para a lista de conversas
        setActiveConvId(null);
      }
    }, [pendingConvId])
  );

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      {/* Header */}
      {!activeConvId && (
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Mensagens</Text>
          <Text style={styles.headerBrand}>Abily</Text>
        </View>
      )}

      {activeConvId ? (
        <ChatConversation
          conversationId={activeConvId}
          onBack={() => setActiveConvId(null)}
        />
      ) : (
        <ConversationList onSelectConversation={setActiveConvId} />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#FFF' },
  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 20, paddingVertical: 16,
    borderBottomWidth: 1, borderBottomColor: '#F3F4F6',
    backgroundColor: '#FFF',
  },
  headerTitle: { fontSize: 22, fontWeight: '800', color: '#111827' },
  headerBrand: { fontSize: 15, fontWeight: '800', color: PRIMARY },

  // List
  listContainer: { flex: 1 },
  searchBox: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    margin: 12, backgroundColor: '#F9FAFB', borderRadius: 12,
    borderWidth: 1, borderColor: '#E5E7EB', paddingHorizontal: 12, paddingVertical: 8,
  },
  searchIcon: {},
  searchInput: { flex: 1, fontSize: 14, color: '#111827' },
  emptyState: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 8, paddingTop: 60 },
  emptyText: { fontSize: 14, color: '#9CA3AF' },

  convRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 13 },
  convRowUnread: { backgroundColor: '#FAFAFE' },
  convAvatarWrapper: { position: 'relative', marginRight: 12 },
  convAvatar: { width: 48, height: 48, borderRadius: 24, backgroundColor: '#E5E7EB' },
  convBadge: {
    position: 'absolute', top: -2, right: -4,
    backgroundColor: '#EF4444', borderRadius: 8, minWidth: 18, height: 18,
    alignItems: 'center', justifyContent: 'center', paddingHorizontal: 3,
    borderWidth: 1.5, borderColor: '#FFF',
  },
  convBadgeText: { color: '#FFF', fontSize: 10, fontWeight: '800' },
  convInfo: { flex: 1 },
  convInfoTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 2 },
  convName: { fontSize: 15, color: '#374151', fontWeight: '500' },
  convNameBold: { fontWeight: '800', color: '#111827' },
  convTime: { fontSize: 11, color: '#9CA3AF' },
  convInfoBottom: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  convLastMsg: { fontSize: 13, color: '#9CA3AF', flex: 1, marginRight: 6 },
  convLastMsgBold: { color: '#374151', fontWeight: '600' },
  unreadDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: PRIMARY },
  convRole: { fontSize: 11, color: PRIMARY, fontWeight: '600', marginTop: 2 },
  separator: { height: 1, backgroundColor: '#F9FAFB', marginLeft: 76 },

  // Conversation
  convHeader: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingHorizontal: 16, paddingVertical: 12,
    borderBottomWidth: 1, borderBottomColor: '#F3F4F6', backgroundColor: '#FFF',
  },
  backBtn: { padding: 4 },
  convHeaderAvatar: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#E5E7EB' },
  convHeaderName: { fontSize: 15, fontWeight: '700', color: '#111827' },
  convHeaderRole: { fontSize: 12, color: '#9CA3AF' },

  msgList: { flexGrow: 1, paddingHorizontal: 16, paddingVertical: 12 },
  timeSeparator: { alignItems: 'center', marginVertical: 10 },
  timeSeparatorText: { fontSize: 11, color: '#9CA3AF', backgroundColor: '#F3F4F6', paddingHorizontal: 10, paddingVertical: 3, borderRadius: 10 },
  msgRow: { marginBottom: 4 },
  msgRowOwn: { alignItems: 'flex-end' },
  msgRowOther: { alignItems: 'flex-start' },
  msgBubble: { maxWidth: '80%', paddingHorizontal: 14, paddingVertical: 10, borderRadius: 18 },
  msgBubbleOwn: { backgroundColor: PRIMARY, borderBottomRightRadius: 4 },
  msgBubbleOther: { backgroundColor: '#FFF', borderBottomLeftRadius: 4, borderWidth: 1, borderColor: '#E5E7EB' },
  msgText: { fontSize: 14, lineHeight: 20 },
  msgTextOwn: { color: '#FFF' },
  msgTextOther: { color: '#111827' },

  inputBar: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingHorizontal: 16, paddingVertical: 10,
    borderTopWidth: 1, borderTopColor: '#F3F4F6', backgroundColor: '#FFF',
  },
  msgInput: {
    flex: 1, backgroundColor: '#F9FAFB', borderRadius: 20,
    borderWidth: 1, borderColor: '#E5E7EB',
    paddingHorizontal: 16, paddingVertical: 10,
    fontSize: 14, color: '#111827', maxHeight: 100,
  },
  sendBtn: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: PRIMARY, alignItems: 'center', justifyContent: 'center',
    ...makeShadow(PRIMARY, 2, 0.3, 4, 4),
  },
  sendBtnDisabled: { opacity: 0.4 },
});
