import { supabase } from '../lib/supabase';

/**
 * Faz login com email e senha.
 * Retorna { user } ou lança erro.
 * O perfil é carregado pelo AuthContext via onAuthStateChange.
 */
export async function signIn(email, password) {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw error;
  return { user: data.user };
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
