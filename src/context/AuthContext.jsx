import React, { createContext, useState, useEffect, useRef } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  signIn,
  signUp,
  signOut,
  getProfile,
  updateProfile as updateProfileService,
  updatePassword as updatePasswordService,
  getSession,
  onAuthStateChange,
  verifySignupOtp,
  resendOtp as resendOtpService,
  verifyLoginOtp as verifyLoginOtpService,
  resendLoginOtp as resendLoginOtpService,
  verifyRecoveryOtp as verifyRecoveryOtpService,
} from '../services/auth.service';

const PENDING_OTP_KEY = 'pendingOtp';

// Aguarda um tick para garantir que eventos pendentes do Supabase sejam processados
const tick = () => new Promise(r => setTimeout(r, 50));

export const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);       // profile completo do banco
  const [session, setSession] = useState(null); // sessão do Supabase Auth
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [loading, setLoading] = useState(true);
  const [pendingOtp, setPendingOtpState] = useState(null); // { email, type } persistido no AsyncStorage
  const [isPasswordRecovery, setIsPasswordRecovery] = useState(false);

  // Suprime eventos de onAuthStateChange durante o fluxo de login 2FA
  // (signInWithPassword cria sessão temporária que é descartada antes do OTP)
  const suppressAuthRef = useRef(false);

  useEffect(() => {
    let done = false;
    const finish = () => { if (!done) { done = true; setLoading(false); } };

    // Timeout de segurança: garante que o loading encerra mesmo se o Supabase travar
    const timeout = setTimeout(finish, 8000);

    // Carrega sessão e OTP pendente em paralelo ao abrir o app
    Promise.all([
      getSession(),
      AsyncStorage.getItem(PENDING_OTP_KEY).then(v => v ? JSON.parse(v) : null).catch(() => null),
    ]).then(([s, otp]) => {
      if (otp) setPendingOtpState(otp);
      if (s) {
        setSession(s);
        setIsAuthenticated(true);
        // Carrega perfil em background sem bloquear o loading
        getProfile(s.user.id)
          .then(profile => setUser({ email: s.user.email, ...profile }))
          .catch(() => {
            setUser({ id: s.user.id, email: s.user.email, ...s.user.user_metadata });
          });
      }
      clearTimeout(timeout);
      finish();
    }).catch(() => {
      clearTimeout(timeout);
      finish();
    });

    // Escuta mudanças de autenticação (login, logout, refresh de token)
    const unsubscribe = onAuthStateChange(async (event, s) => {
      // Ignora eventos disparados durante o fluxo de login 2FA
      if (suppressAuthRef.current) return;

      // Recuperação de senha: não autentica normalmente, mostra tela de nova senha
      if (event === 'PASSWORD_RECOVERY') {
        setSession(s);
        setIsPasswordRecovery(true);
        return;
      }

      setSession(s);
      if (s) {
        // Navega imediatamente sem esperar o perfil
        setIsAuthenticated(true);
        // Carrega o perfil em background
        getProfile(s.user.id)
          .then(profile => setUser({ email: s.user.email, ...profile }))
          .catch(() => {
            // Fallback: usa dados básicos do auth enquanto perfil não carrega
            setUser({ id: s.user.id, email: s.user.email, ...s.user.user_metadata });
          });
      } else {
        setUser(null);
        setIsAuthenticated(false);
        setIsPasswordRecovery(false);
      }
    });

    return () => { clearTimeout(timeout); unsubscribe(); };
  }, []);

  const login = async (email, password) => {
    // Suprime o onAuthStateChange enquanto verificamos a senha e enviamos o OTP
    suppressAuthRef.current = true;
    try {
      await signIn(email, password);   // valida credenciais
      await tick();                    // deixa eventos pendentes passarem (suprimidos)
      await signOut();                 // descarta a sessão temporária
      await resendLoginOtpService(email); // envia o código OTP por e-mail
    } finally {
      suppressAuthRef.current = false;
    }
    return { needsOtp: true };
  };

  const register = async (formData) => {
    const { profile, emailConfirmationRequired } = await signUp(formData);
    if (!emailConfirmationRequired) {
      setUser(profile);
      setIsAuthenticated(true);
    }
    return { success: true, user: profile, emailConfirmationRequired };
  };

  const updateProfile = async (fields) => {
    const updated = await updateProfileService(user.id, fields);
    setUser(prev => ({ ...prev, ...updated }));
    return { success: true };
  };

  const setPendingOtp = async (data) => {
    if (data) {
      await AsyncStorage.setItem(PENDING_OTP_KEY, JSON.stringify(data));
    } else {
      await AsyncStorage.removeItem(PENDING_OTP_KEY);
    }
    setPendingOtpState(data);
  };

  const verifyOtp = async (email, token) => {
    const { profile } = await verifySignupOtp(email, token);
    // onAuthStateChange seta isAuthenticated automaticamente após verificação
    // mas setamos o perfil imediatamente para evitar flickering
    await AsyncStorage.removeItem(PENDING_OTP_KEY);
    setPendingOtpState(null);
    setUser(profile);
    return { success: true };
  };

  const resendOtp = async (email) => {
    await resendOtpService(email);
    return { success: true };
  };

  const verifyLoginOtp = async (email, token) => {
    const { profile } = await verifyLoginOtpService(email, token);
    await AsyncStorage.removeItem(PENDING_OTP_KEY);
    setPendingOtpState(null);
    setUser(profile);
    return { success: true };
  };

  const resendLoginOtp = async (email) => {
    await resendLoginOtpService(email);
    return { success: true };
  };

  // Verifica o OTP de recuperação de senha.
  // Cria sessão temporária sem entrar no app normal → mostra ResetPasswordScreen.
  const verifyRecoveryOtp = async (email, token) => {
    suppressAuthRef.current = true;
    try {
      const { profile, session } = await verifyRecoveryOtpService(email, token);
      setSession(session);
      setUser(profile);
      setIsAuthenticated(false);
      setIsPasswordRecovery(true);
      await AsyncStorage.removeItem(PENDING_OTP_KEY);
      setPendingOtpState(null);
    } finally {
      suppressAuthRef.current = false;
    }
  };

  const changePassword = async (newPassword) => {
    await updatePasswordService(newPassword);
    return { success: true };
  };

  // Chamado após redefinição de senha: encerra a sessão de recovery
  const clearPasswordRecovery = async () => {
    setIsPasswordRecovery(false);
    setIsAuthenticated(false);
    setUser(null);
    await signOut();
  };

  const logout = async () => {
    await signOut();
    setUser(null);
    setSession(null);
    setIsAuthenticated(false);
  };

  return (
    <AuthContext.Provider value={{
      user, session, isAuthenticated, loading, pendingOtp,
      isPasswordRecovery,
      setPendingOtp, login, logout, register, updateProfile,
      changePassword, clearPasswordRecovery,
      verifyOtp, resendOtp, verifyLoginOtp, resendLoginOtp, verifyRecoveryOtp,
    }}>
      {children}
    </AuthContext.Provider>
  );
};
