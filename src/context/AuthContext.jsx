import React, { createContext, useState, useEffect, useRef } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { AppState } from 'react-native';
import { secureStorage } from '../utils/secureStorage';
import {
  signIn,
  signUp,
  signOut,
  getProfile,
  updateProfile as updateProfileService,
  updatePassword as updatePasswordService,
  acceptTerms as acceptTermsService,
  getSession,
  onAuthStateChange,
  verifySignupOtp,
  resendOtp as resendOtpService,
  verifyLoginOtp as verifyLoginOtpService,
  resendLoginOtp as resendLoginOtpService,
  verifyRecoveryOtp as verifyRecoveryOtpService,
  generateDeviceToken,
  saveDeviceToken,
  fetchDeviceToken,
} from '../services/auth.service';
import { TERMS_VERSION } from '../data/termsData';

const PENDING_OTP_KEY = 'pendingOtp';
const DEVICE_TOKEN_KEY = 'deviceToken';

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
  // Referência ao userId autenticado (usada no AppState listener)
  const sessionUserIdRef = useRef(null);

  useEffect(() => {
    let done = false;
    const finish = () => { if (!done) { done = true; setLoading(false); } };

    // Timeout de segurança: garante que o loading encerra mesmo se o Supabase travar
    const timeout = setTimeout(finish, 8000);

    // Carrega sessão e OTP pendente em paralelo ao abrir o app
    Promise.all([
      getSession(),
      AsyncStorage.getItem(PENDING_OTP_KEY).then(v => v ? JSON.parse(v) : null).catch(() => null),
    ]).then(async ([s, otp]) => {
      if (otp) setPendingOtpState(otp);
      if (s) {
        // Valida device token antes de restaurar sessão
        const kicked = await validateDeviceToken(s.user.id);
        if (kicked) { clearTimeout(timeout); finish(); return; }
        sessionUserIdRef.current = s.user.id;
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

    // Verifica device token quando app volta ao foreground
    const appStateSub = AppState.addEventListener('change', async (state) => {
      if (state === 'active' && sessionUserIdRef.current) {
        await validateDeviceToken(sessionUserIdRef.current);
      }
    });

    return () => { clearTimeout(timeout); unsubscribe(); appStateSub.remove(); };
  }, []);

  // Compara o token local com o banco. Se diferente, força logout (outro dispositivo logou).
  // Retorna true se o usuário foi desconectado.
  const validateDeviceToken = async (userId) => {
    try {
      const [localToken, remoteToken] = await Promise.all([
        secureStorage.getItem(DEVICE_TOKEN_KEY),
        fetchDeviceToken(userId),
      ]);
      // Se não há token local ainda (ex: usuário logado antes dessa feature), ignora
      if (!localToken) return false;
      if (localToken !== remoteToken) {
        await forceLogout();
        return true;
      }
    } catch {
      // Erro de rede: não desconecta o usuário por precaução
    }
    return false;
  };

  const forceLogout = async () => {
    await secureStorage.deleteItem(DEVICE_TOKEN_KEY).catch(() => {});
    await signOut().catch(() => {});
    sessionUserIdRef.current = null;
    setUser(null);
    setSession(null);
    setIsAuthenticated(false);
    setIsPasswordRecovery(false);
  };

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
    const { user: authUser, profile } = await verifyLoginOtpService(email, token);
    await AsyncStorage.removeItem(PENDING_OTP_KEY);
    setPendingOtpState(null);
    // Gera novo device token e registra no banco (invalida outros dispositivos)
    const deviceToken = generateDeviceToken();
    await secureStorage.setItem(DEVICE_TOKEN_KEY, deviceToken);
    await saveDeviceToken(authUser.id, deviceToken);
    sessionUserIdRef.current = authUser.id;
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

  const acceptTerms = async () => {
    const updated = await acceptTermsService(user.id, TERMS_VERSION);
    setUser(prev => ({ ...prev, ...updated }));
    return { success: true };
  };

  // Verdadeiro quando o usuário está autenticado mas ainda não aceitou a versão atual dos termos
  const needsTerms = isAuthenticated && !isPasswordRecovery && !!user && user.terms_version !== TERMS_VERSION;

  // Chamado após redefinição de senha: encerra a sessão de recovery
  const clearPasswordRecovery = async () => {
    setIsPasswordRecovery(false);
    setIsAuthenticated(false);
    setUser(null);
    await signOut();
  };

  const logout = async () => {
    await secureStorage.deleteItem(DEVICE_TOKEN_KEY).catch(() => {});
    sessionUserIdRef.current = null;
    await signOut();
    setUser(null);
    setSession(null);
    setIsAuthenticated(false);
  };

  return (
    <AuthContext.Provider value={{
      user, session, isAuthenticated, loading, pendingOtp,
      isPasswordRecovery, needsTerms,
      setPendingOtp, login, logout, register, updateProfile,
      changePassword, clearPasswordRecovery, acceptTerms,
      verifyOtp, resendOtp, verifyLoginOtp, resendLoginOtp, verifyRecoveryOtp,
    }}>
      {children}
    </AuthContext.Provider>
  );
};
