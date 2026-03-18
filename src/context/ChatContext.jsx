import React, { createContext, useContext, useState, useCallback, useEffect, useRef } from 'react';
import { Platform } from 'react-native';
import { useAuth } from '../hooks/useAuth';
import { logger } from '../utils/logger';
import { sanitizeMessage } from '../utils/sanitize';
import { toast } from '../utils/toast';
import { sendLocalNotification } from '../hooks/useNotifications';
import {
  getConversations,
  getOrCreateConversation,
  getMessages,
  getLastMessagesForConversations,
  sendMessage as sendMessageService,
  markAsRead,
  subscribeToMessages,
} from '../services/chat.service';

const ChatContext = createContext(null);

export const ChatProvider = ({ children }) => {
  const { user, isAuthenticated } = useAuth();
  const [conversations, setConversations] = useState([]);
  const [messagesByConversation, setMessagesByConversation] = useState({});
  const [activeConversationId, setActiveConversationId] = useState(null);
  const [pendingConvId, setPendingConvId] = useState(null);
  const pendingConvIdRef = useRef(null);
  const unsubscribeRefs = useRef({});

  // Carrega conversas ao autenticar
  useEffect(() => {
    if (!isAuthenticated || !user) {
      setConversations([]);
      setMessagesByConversation({});
      return;
    }
    loadConversations();
  }, [isAuthenticated, user?.id]);

  // Assina realtime das mensagens quando a conversa ativa muda
  useEffect(() => {
    if (!activeConversationId) return;

    // Carrega mensagens da conversa ativa
    loadMessages(activeConversationId);
    markAsRead(activeConversationId, user.id).catch(() => {});

    // Cancela subscription anterior da mesma conversa, se houver
    if (unsubscribeRefs.current[activeConversationId]) {
      unsubscribeRefs.current[activeConversationId]();
    }

    // Inicia nova subscription realtime
    const unsubscribe = subscribeToMessages(activeConversationId, (newMessage) => {
      setMessagesByConversation(prev => {
        const existing = prev[activeConversationId] || [];
        // Evita duplicata quando a mensagem já foi adicionada via update otimista
        if (existing.some(m => m.id === newMessage.id)) return prev;
        return { ...prev, [activeConversationId]: [...existing, newMessage] };
      });
      // Notificação local quando a mensagem é de outra pessoa
      if (newMessage.sender_id !== user?.id && Platform.OS !== 'web') {
        const conv = conversations.find(c => c.id === activeConversationId);
        const senderName = conv?.other?.name || 'Nova mensagem';
        sendLocalNotification(senderName, newMessage.text).catch(() => {});
      }
    });

    unsubscribeRefs.current[activeConversationId] = unsubscribe;

    return () => {
      unsubscribe();
      delete unsubscribeRefs.current[activeConversationId];
    };
  }, [activeConversationId]);

  const loadConversations = useCallback(async () => {
    if (!user) return;
    try {
      const data = await getConversations(user.id, user.role);
      setConversations(data);
      // Pré-carrega a última mensagem de cada conversa para exibir na lista
      if (data.length) {
        const lastMsgs = await getLastMessagesForConversations(data.map(c => c.id));
        setMessagesByConversation(prev => {
          const merged = { ...prev };
          for (const [convId, msgs] of Object.entries(lastMsgs)) {
            // Só sobrescreve se a conversa ainda não foi aberta (sem mensagens completas)
            if (!merged[convId] || merged[convId].length <= 1) merged[convId] = msgs;
          }
          return merged;
        });
      }
    } catch (error) {
      logger.error('Erro ao carregar conversas:', error.message);
    }
  }, [user]);

  const loadMessages = useCallback(async (conversationId) => {
    try {
      const data = await getMessages(conversationId);
      setMessagesByConversation(prev => ({ ...prev, [conversationId]: data }));
    } catch (error) {
      logger.error('Erro ao carregar mensagens:', error.message);
      toast.error('Erro ao carregar mensagens. Verifique sua conexão.');
    }
  }, []);

  const sendMessage = useCallback(async (conversationId, text) => {
    if (!user || !text.trim()) return;
    try {
      const safeText = sanitizeMessage(text.trim());
      if (!safeText) return;
      const message = await sendMessageService(conversationId, user.id, safeText);
      setMessagesByConversation(prev => ({
        ...prev,
        [conversationId]: [...(prev[conversationId] || []), message],
      }));
    } catch (error) {
      logger.error('Erro ao enviar mensagem:', error.message);
      toast.error('Não foi possível enviar a mensagem.');
    }
  }, [user]);

  const markConversationAsRead = useCallback(async (conversationId) => {
    if (!user) return;
    await markAsRead(conversationId, user.id);
    setMessagesByConversation(prev => ({
      ...prev,
      [conversationId]: (prev[conversationId] || []).map(m => ({ ...m, read: true })),
    }));
  }, [user]);

  const getUnreadCount = useCallback((conversationId) => {
    if (!user) return 0;
    const msgs = messagesByConversation[conversationId] || [];
    return msgs.filter(m => !m.read && m.sender_id !== user.id).length;
  }, [messagesByConversation, user]);

  const getTotalUnreadCount = useCallback(() => {
    return conversations.reduce((total, conv) => total + getUnreadCount(conv.id), 0);
  }, [conversations, getUnreadCount]);

  const openConversation = useCallback(async (conversationId) => {
    setActiveConversationId(conversationId);
    if (!messagesByConversation[conversationId]) {
      await loadMessages(conversationId);
    }
  }, [messagesByConversation, loadMessages]);

  // Inicia ou abre uma conversa com um aluno/instrutor — navega automaticamente via pendingConvId
  const startChatWith = useCallback(async (otherUserId) => {
    if (!user) return null;
    try {
      const instructorId = user.role === 'instructor' ? user.id : otherUserId;
      const studentId   = user.role === 'instructor' ? otherUserId : user.id;
      const conv = await getOrCreateConversation(instructorId, studentId);
      // Adiciona ao estado se ainda não existir (com dados parciais para evitar tela em branco)
      // e recarrega em background para pegar o JOIN de profiles completo
      setConversations(prev => {
        if (prev.find(c => c.id === conv.id)) return prev;
        loadConversations(); // substitui com dados completos (assíncrono)
        return [...prev, { ...conv, other: null }]; // adiciona imediatamente
      });
      pendingConvIdRef.current = conv.id;
      setPendingConvId(conv.id);
      return conv;
    } catch (error) {
      logger.error('Erro ao iniciar conversa:', error.message);
      return null;
    }
  }, [user, loadConversations]);

  const clearPendingConv = useCallback(() => {
    pendingConvIdRef.current = null;
    setPendingConvId(null);
  }, []);

  return (
    <ChatContext.Provider value={{
      conversations,
      activeConversationId,
      messagesByConversation,
      pendingConvId,
      pendingConvIdRef,
      setActiveConversationId: openConversation,
      sendMessage,
      markConversationAsRead,
      getUnreadCount,
      getTotalUnreadCount,
      loadConversations,
      startChatWith,
      clearPendingConv,
    }}>
      {children}
    </ChatContext.Provider>
  );
};

export const useChat = () => {
  const ctx = useContext(ChatContext);
  if (!ctx) throw new Error('useChat must be used within ChatProvider');
  return ctx;
};
