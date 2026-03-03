import { supabase } from '../lib/supabase';

/**
 * Valida credenciais e envia OTP para 2FA.
 * Fluxo: signInWithPassword (valida senha) → signOut (descarta sessão temporária)
 *        → signInWithOtp (envia código ao e-mail).
 * O AuthContext suprime os eventos de auth durante este processo.
 */
export async function signIn(email, password) {
  // 1. Valida senha — lança erro se inválida
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw error;

  // 2. Descarta a sessão temporária antes de disparar o OTP
  await supabase.auth.signOut();

  // 3. Envia OTP ao e-mail (usa o template "Magic Link" do Supabase)
  const { error: otpError } = await supabase.auth.signInWithOtp({
    email,
    options: { shouldCreateUser: false },
  });
  if (otpError) throw otpError;
}

/**
 * Converte data DD/MM/AAAA → YYYY-MM-DD (formato ISO esperado pelo PostgreSQL).
 */
function parseISODate(ddmmyyyy) {
  if (!ddmmyyyy) return null;
  const digits = ddmmyyyy.replace(/\D/g, '');
  if (digits.length !== 8) return null;
  const day   = digits.slice(0, 2);
  const month = digits.slice(2, 4);
  const year  = digits.slice(4, 8);
  return `${year}-${month}-${day}`;
}

/**
 * Cria conta e perfil completo no banco.
 */
export async function signUp(formData) {
  const {
    name, email, password, phone, cpf, birthdate, role, photoUri,
    licenseCategory, instructorRegNum, carModel, carOptions, pricePerHour, bio,
  } = formData;

  // Apenas dados não-sensíveis no metadata (serão exibidos no JWT).
  // CPF, telefone e data de nascimento NÃO entram aqui.
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: { data: { name, role, avatar_url: photoUri || null } },
  });
  if (error) throw error;

  // Completa o perfil via RPC com SECURITY DEFINER.
  // Funciona com ou sem sessão ativa (confirmação de e-mail ON ou OFF).
  const { error: rpcError } = await supabase.rpc('complete_profile_after_signup', {
    p_user_id:  data.user.id,
    p_email:    email,
    p_name:     name,
    p_phone:    phone,
    p_cpf:      cpf,
    p_birthdate: parseISODate(birthdate),
    p_role:     role,
    p_avatar_url: photoUri || null,
    ...(role === 'instructor' ? {
      p_license_category:   licenseCategory,
      p_instructor_reg_num: instructorRegNum,
      p_car_model:          carModel || null,
      p_car_options:        carOptions,
      p_price_per_hour:     parseFloat(pricePerHour) || 80,
      p_bio:                bio,
    } : {}),
  });
  if (rpcError) throw rpcError;

  const emailConfirmationRequired = !data.session;
  console.log('[signUp] session:', emailConfirmationRequired ? 'NULL — confirmar e-mail está ON' : 'ATIVA');

  if (emailConfirmationRequired) {
    return {
      user: data.user,
      profile: { id: data.user.id, email, name, role, avatar_url: photoUri || null },
      emailConfirmationRequired: true,
    };
  }

  const profile = await getProfile(data.user.id) ?? { id: data.user.id, email, name, role };
  return { user: data.user, profile, emailConfirmationRequired: false };
}

/**
 * Faz logout.
 */
export async function signOut() {
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
}

/**
 * Busca o perfil completo de um usuário pelo ID.
 */
export async function getProfile(userId) {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .maybeSingle();          // retorna null em vez de erro quando não existe linha
  if (error) throw error;
  return data;               // pode ser null se o perfil ainda não foi criado
}

/**
 * Atualiza campos do perfil do usuário autenticado.
 */
export async function updateProfile(userId, fields) {
  const { data, error } = await supabase
    .from('profiles')
    .update(fields)
    .eq('id', userId)
    .select()
    .single();
  if (error) throw error;
  return data;
}

/**
 * Retorna a sessão ativa (ou null se não há sessão).
 */
export async function getSession() {
  const { data: { session } } = await supabase.auth.getSession();
  return session;
}

/**
 * Escuta mudanças de estado de autenticação (login/logout/refresh).
 * Retorna a função de unsubscribe.
 */
export function onAuthStateChange(callback) {
  const { data: { subscription } } = supabase.auth.onAuthStateChange(callback);
  return () => subscription.unsubscribe();
}

/**
 * Verifica o código OTP de confirmação de e-mail.
 * Retorna { user, profile, session } ou lança erro.
 */
export async function verifySignupOtp(email, token) {
  const { data, error } = await supabase.auth.verifyOtp({
    email,
    token,
    type: 'signup',
  });
  if (error) throw error;
  const profile = await getProfile(data.user.id) ?? { id: data.user.id, email };
  return { user: data.user, profile, session: data.session };
}

/**
 * Reenvia o e-mail com o código OTP de confirmação (cadastro).
 */
export async function resendOtp(email) {
  const { error } = await supabase.auth.resend({ type: 'signup', email });
  if (error) throw error;
}

/**
 * Verifica o OTP de login (2FA).
 * Usa type: 'email' (magic link OTP), diferente do type: 'signup'.
 */
export async function verifyLoginOtp(email, token) {
  const { data, error } = await supabase.auth.verifyOtp({
    email,
    token,
    type: 'email',
  });
  if (error) throw error;
  const profile = await getProfile(data.user.id) ?? { id: data.user.id, email };
  return { user: data.user, profile, session: data.session };
}

/**
 * Reenvia o OTP de login (2FA).
 */
export async function resendLoginOtp(email) {
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: { shouldCreateUser: false },
  });
  if (error) throw error;
}
