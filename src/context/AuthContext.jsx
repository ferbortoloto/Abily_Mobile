import React, { createContext, useState, useEffect, useRef } from 'react';
import {
  signIn,
  signUp,
  signOut,
  getProfile,
  updateProfile as updateProfileService,
  getSession,
  onAuthStateChange,
  verifySignupOtp,
  resendOtp as resendOtpService,
  verifyLoginOtp as verifyLoginOtpService,
  resendLoginOtp as resendLoginOtpService,
} from '../services/auth.service';

export const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);       // profile completo do banco
  const [session, setSession] = useState(null); // sessão do Supabase Auth
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [loading, setLoading] = useState(true);

  // Suprime eventos de onAuthStateChange durante o fluxo de login 2FA
  // (signInWithPassword cria sessão temporária que é descartada antes do OTP)
  const suppressAuthRef = useRef(false);

  useEffect(() => {
    let done = false;
    const finish = () => { if (!done) { done = true; setLoading(false); } };

    // Timeout de segurança: garante que o loading encerra mesmo se o Supabase travar
    const timeout = setTimeout(finish, 8000);

    // Carrega sessão existente ao abrir o app
    getSession().then((s) => {
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
    const unsubscribe = onAuthStateChange(async (_event, s) => {
      // Ignora eventos disparados durante o fluxo de login 2FA
      if (suppressAuthRef.current) return;
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
      }
    });

    return () => { clearTimeout(timeout); unsubscribe(); };
  }, []);

  const login = async (email, password) => {
    // Suprime eventos de auth enquanto valida senha + descarta sessão temporária + envia OTP
    suppressAuthRef.current = true;
    try {
      await signIn(email, password);
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
    setUser(updated);
    return { success: true };
  };

  const verifyOtp = async (email, token) => {
    const { profile } = await verifySignupOtp(email, token);
    // onAuthStateChange seta isAuthenticated automaticamente após verificação
    // mas setamos o perfil imediatamente para evitar flickering
    setUser(profile);
    return { success: true };
  };

  const resendOtp = async (email) => {
    await resendOtpService(email);
    return { success: true };
  };

  const verifyLoginOtp = async (email, token) => {
    const { profile } = await verifyLoginOtpService(email, token);
    setUser(profile);
    return { success: true };
  };

  const resendLoginOtp = async (email) => {
    await resendLoginOtpService(email);
    return { success: true };
  };

  const logout = async () => {
    await signOut();
    setUser(null);
    setSession(null);
    setIsAuthenticated(false);
  };

  return (
    <AuthContext.Provider value={{ user, session, isAuthenticated, loading, login, logout, register, updateProfile, verifyOtp, resendOtp, verifyLoginOtp, resendLoginOtp }}>
      {children}
    </AuthContext.Provider>
  );
};
