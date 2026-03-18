import 'react-native-gesture-handler';
import React, { useEffect } from 'react';
import { registerRootComponent } from 'expo';
import { StatusBar } from 'expo-status-bar';
import { NavigationContainer } from '@react-navigation/native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import * as Updates from 'expo-updates';
import { Linking } from 'react-native';
import { supabase } from './src/lib/supabase';
import { AuthProvider } from './src/context/AuthContext';
import { SecurityProvider } from './src/context/SecurityContext';
import { ScheduleProvider } from './src/context/ScheduleContext';
import { ChatProvider } from './src/context/ChatContext';
import { PlansProvider } from './src/context/PlansContext';
import { SessionProvider } from './src/context/SessionContext';
import AppNavigator from './src/navigation/AppNavigator';
import Toast from './src/components/shared/Toast';
import { useNotifications } from './src/hooks/useNotifications';
import { useAuth } from './src/hooks/useAuth';

async function checkForUpdate() {
  try {
    if (__DEV__) return; // não roda no desenvolvimento
    const update = await Updates.checkForUpdateAsync();
    if (update.isAvailable) {
      await Updates.fetchUpdateAsync();
      await Updates.reloadAsync(); // reinicia o app com a nova versão
    }
  } catch (_) {
    // ignora erros silenciosamente (sem internet, etc.)
  }
}

// Processa deep links de recuperação de senha (abily://reset-password#access_token=...&type=recovery)
async function handleRecoveryUrl(url) {
  if (!url) return;
  const hash = url.split('#')[1];
  if (!hash) return;
  const params = Object.fromEntries(
    hash.split('&').map(pair => {
      const [k, v] = pair.split('=');
      return [k, v ? decodeURIComponent(v) : ''];
    }),
  );
  if (params.type === 'recovery' && params.access_token) {
    await supabase.auth.setSession({
      access_token: params.access_token,
      refresh_token: params.refresh_token || '',
    });
  }
}

// Componente interno: tem acesso ao AuthContext para obter o userId
function AppInner() {
  const { user } = useAuth();
  useNotifications(user?.id ?? null);
  return null;
}

export default function App() {
  useEffect(() => { checkForUpdate(); }, []);

  // Captura o deep link que abriu o app (cold start) e os subsequentes (warm)
  useEffect(() => {
    Linking.getInitialURL().then(handleRecoveryUrl).catch(() => {});
    const subscription = Linking.addEventListener('url', ({ url }) => handleRecoveryUrl(url));
    return () => subscription.remove();
  }, []);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <AuthProvider>
          {/* SecurityProvider: dentro do Auth (usa logout) e fora dos demais
              para capturar toques e exibir a tela de privacidade em background */}
          <SecurityProvider>
            <SessionProvider>
              <ScheduleProvider>
                <ChatProvider>
                  <PlansProvider>
                    <NavigationContainer>
                      <AppInner />
                      <AppNavigator />
                      <Toast />
                      <StatusBar style="auto" />
                    </NavigationContainer>
                  </PlansProvider>
                </ChatProvider>
              </ScheduleProvider>
            </SessionProvider>
          </SecurityProvider>
        </AuthProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

registerRootComponent(App);
