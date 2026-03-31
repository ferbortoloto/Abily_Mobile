import React from 'react';
import { View, ActivityIndicator, Platform } from 'react-native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useAuth } from '../hooks/useAuth';
import LoginScreen from '../screens/auth/LoginScreen';
import RegisterScreen from '../screens/auth/RegisterScreen';
import VerifyOTPScreen from '../screens/auth/VerifyOTPScreen';
import ForgotPasswordScreen from '../screens/auth/ForgotPasswordScreen';
import ResetPasswordScreen from '../screens/auth/ResetPasswordScreen';
import TermsScreen from '../screens/shared/TermsScreen';
import TermsGate from '../screens/shared/TermsGate';
import InstructorTabNavigator from './InstructorTabNavigator';
import UserTabNavigator from './UserTabNavigator';

const Stack = createNativeStackNavigator();

export default function AppNavigator() {
  const { isAuthenticated, loading, user, pendingOtp, isPasswordRecovery, needsTerms } = useAuth();

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#0F172A' }}>
        <ActivityIndicator size="large" color="#FFFFFF" />
      </View>
    );
  }

  // Fluxo de recuperação de senha: mostra apenas a tela de nova senha
  if (isPasswordRecovery) {
    return (
      <Stack.Navigator screenOptions={{ headerShown: false, animation: Platform.OS === 'web' ? 'none' : 'fade' }}>
        <Stack.Screen name="ResetPassword" component={ResetPasswordScreen} />
      </Stack.Navigator>
    );
  }

  // Gate de termos: usuário autenticado que ainda não aceitou a versão atual
  // Bloqueia completamente o acesso ao app até o aceite
  if (needsTerms) {
    return <TermsGate />;
  }

  return (
    <Stack.Navigator screenOptions={{ headerShown: false, animation: Platform.OS === 'web' ? 'none' : 'fade' }}>
      {!isAuthenticated ? (
        pendingOtp ? (
          // OTP pendente: inicia direto na tela de verificação (1º screen = rota inicial)
          <>
            <Stack.Screen name="VerifyOTP" component={VerifyOTPScreen} initialParams={pendingOtp} />
            <Stack.Screen name="Login" component={LoginScreen} />
            <Stack.Screen name="Register" component={RegisterScreen} />
            <Stack.Screen name="ForgotPassword" component={ForgotPasswordScreen} />
          </>
        ) : (
          <>
            <Stack.Screen name="Login" component={LoginScreen} />
            <Stack.Screen name="Register" component={RegisterScreen} />
            <Stack.Screen name="VerifyOTP" component={VerifyOTPScreen} />
            <Stack.Screen name="ForgotPassword" component={ForgotPasswordScreen} />
            <Stack.Screen name="Terms" component={TermsScreen} />
          </>
        )
      ) : user?.role === 'instructor' ? (
        <>
          <Stack.Screen name="InstructorTabs" component={InstructorTabNavigator} />
          <Stack.Screen name="Terms" component={TermsScreen} />
        </>
      ) : (
        <>
          <Stack.Screen name="UserTabs" component={UserTabNavigator} />
          <Stack.Screen name="Terms" component={TermsScreen} />
        </>
      )}
    </Stack.Navigator>
  );
}
