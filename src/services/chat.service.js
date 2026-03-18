import { supabase } from '../lib/supabase';

/**
 * Busca todas as conversas de um usuário com dados do outro participante.
 */
export async function getConversations(userId, role) {
  const field = role === 'instructor' ? 'instructor_id' : 'student_id';
  const otherField = role === 'instructor' ? 'student_id' : 'instructor_id';

  const { data, error } = await supabase
    .from('conversations')
    .select(`
      *,
      other:profiles!${otherField}(id, name, avatar_url)
    `)
    .eq(field, userId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data;
}

/**
 * Busca ou cria uma conversa entre instrutor e aluno.
 */
export async function getOrCreateConversation(instructorId, studentId) {
  const { data: existing, error: findError } = await supabase
    .from('conversations')
    .select('*')
    .eq('instructor_id', instructorId)
    .eq('student_id', studentId)
    .maybeSingle();
  if (findError) throw findError;
  if (existing) return existing;

  const { data, error } = await supabase
    .from('conversations')
    .insert({ instructor_id: instructorId, student_id: studentId })
    .select()
    .single();
  if (error) throw error;
  return data;
}

/**
 * Busca a última mensagem de cada conversa em uma única query.
 * Retorna um objeto { [conversationId]: [lastMessage] }
 */
export async function getLastMessagesForConversations(conversationIds) {
  if (!conversationIds.length) return {};
  const { data, error } = await supabase
    .from('messages')
    .select('*')
    .in('conversation_id', conversationIds)
    .order('created_at', { ascending: false });
  if (error) throw error;
  // Pega apenas a última mensagem por conversa (a primeira de cada grupo após ORDER BY DESC)
  const result = {};
  for (const msg of data) {
    if (!result[msg.conversation_id]) result[msg.conversation_id] = [msg];
  }
  return result;
}

/**
 * Busca as mensagens de uma conversa.
 */
export async function getMessages(conversationId) {
  const { data, error } = await supabase
    .from('messages')
    .select('*')
    .eq('conversation_id', conversationId)
    .order('created_at', { ascending: true });
  if (error) throw error;
  return data;
}

/**
 * Envia uma mensagem.
 */
export async function sendMessage(conversationId, senderId, text) {
  const { data, error } = await supabase
    .from('messages')
    .insert({ conversation_id: conversationId, sender_id: senderId, text })
    .select()
    .single();
  if (error) throw error;
  return data;
}

/**
 * Marca todas as mensagens de uma conversa como lidas (exceto as do próprio usuário).
 */
export async function markAsRead(conversationId, userId) {
  const { error } = await supabase
    .from('messages')
    .update({ read: true })
    .eq('conversation_id', conversationId)
    .neq('sender_id', userId)
    .eq('read', false);
  if (error) throw error;
}

/**
 * Escuta mensagens novas em uma conversa (Realtime).
 * Retorna função de unsubscribe.
 */
export function subscribeToMessages(conversationId, onNewMessage) {
  const channel = supabase
    .channel(`messages:${conversationId}`)
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'messages',
        filter: `conversation_id=eq.${conversationId}`,
      },
      (payload) => onNewMessage(payload.new)
    )
    .subscribe();

  return () => supabase.removeChannel(channel);
}
