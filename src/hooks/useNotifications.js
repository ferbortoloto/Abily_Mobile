import { useEffect, useRef } from 'react';
import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import { supabase } from '../lib/supabase';
import { logger } from '../utils/logger';

// Configura o comportamento padrão das notificações (exibir mesmo com app aberto)
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

/**
 * Solicita permissão de notificações, obtém o Expo Push Token
 * e salva no perfil do usuário no Supabase.
 *
 * @param {string|null} userId  - ID do usuário logado
 */
export function useNotifications(userId) {
  const notificationListener = useRef(null);
  const responseListener = useRef(null);

  useEffect(() => {
    if (!userId || Platform.OS === 'web') return;

    registerForPushNotifications(userId);

    // Listener: notificação recebida com app aberto
    notificationListener.current = Notifications.addNotificationReceivedListener(notification => {
      logger.info('Notificação recebida:', notification.request.content.title);
    });

    // Listener: usuário tocou na notificação
    responseListener.current = Notifications.addNotificationResponseReceivedListener(response => {
      logger.info('Notificação tocada:', response.notification.request.content.data);
    });

    return () => {
      notificationListener.current?.remove();
      responseListener.current?.remove();
    };
  }, [userId]);
}

async function registerForPushNotifications(userId) {
  try {
    // Verifica se é dispositivo físico (push não funciona em simulador)
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;

    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }

    if (finalStatus !== 'granted') {
      logger.warn('Permissão de notificação negada');
      return;
    }

    // Obtém o Expo Push Token
    const tokenData = await Notifications.getExpoPushTokenAsync({
      projectId: 'cd9b465c-987d-4179-af45-dce0f2c7f467',
    });
    const token = tokenData.data;

    // Salva o token no perfil do usuário
    await supabase
      .from('profiles')
      .update({ push_token: token })
      .eq('id', userId);

    logger.info('Push token salvo:', token);
  } catch (error) {
    logger.error('Erro ao registrar notificações:', error.message);
  }
}

/**
 * Envia uma notificação local (quando o app está em primeiro plano).
 * Para notificações em background, use a Supabase Edge Function.
 */
export async function sendLocalNotification(title, body, data = {}) {
  await Notifications.scheduleNotificationAsync({
    content: { title, body, data, sound: true },
    trigger: null, // imediata
  });
}
