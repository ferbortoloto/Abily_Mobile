import { supabase } from '../lib/supabase';

/**
 * Valida credenciais e autentica diretamente (sem 2FA/OTP).
 * TODO: reativar 2FA antes de ir para produção.
 */
export async function signIn(email, password) {
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw error;
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
    licenseCategory, instructorRegNum, carModel, carYear, carOptions, vehicleType, pricePerHour, bio,
    hasCar, hasMoto, motoModel, motoYear, motoOptions,
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
      p_has_car:            hasCar ?? false,
      p_car_model:          hasCar ? (carModel || null) : null,
      p_car_year:           hasCar ? (carYear ? parseInt(carYear, 10) : null) : null,
      p_car_options:        carOptions || null,
      p_vehicle_type:       hasCar ? (vehicleType || 'manual') : null,
      p_price_per_hour:     parseFloat(pricePerHour) || 80,
      p_bio:                bio,
      p_has_moto:           hasMoto ?? false,
      p_moto_model:         hasMoto ? (motoModel || null) : null,
      p_moto_year:          hasMoto ? (motoYear ? parseInt(motoYear, 10) : null) : null,
      p_moto_options:       motoOptions || null,
    } : {
      p_has_car:   hasCar ?? false,
      p_car_model: hasCar ? (carModel || null) : null,
      p_car_year:  hasCar ? (carYear || null) : null,
    }),
  });
  const emailConfirmationRequired = !data.session;

  if (rpcError) {
    // Se o e-mail já foi confirmado (conta existente), propaga o erro para
    // o usuário ver a mensagem de "já cadastrado, faça login".
    if (rpcError.message?.includes('email_already_confirmed')) throw rpcError;
    // Para qualquer outro erro de RPC: o usuário auth já foi criado e o
    // e-mail de confirmação já foi enviado. Não bloqueia o fluxo — o
    // handle_new_user trigger já criou o perfil básico.
    console.warn('[signUp] complete_profile_after_signup falhou (RPC error):', rpcError.message);
    if (emailConfirmationRequired) {
      return {
        user: data.user,
        profile: { id: data.user.id, email, name, role, avatar_url: photoUri || null },
        emailConfirmationRequired: true,
      };
    }
    throw rpcError;
  }
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
 * Altera a senha do usuário autenticado.
 */
export async function updatePassword(newPassword) {
  const { error } = await supabase.auth.updateUser({ password: newPassword });
  if (error) throw error;
}

/**
 * Envia código OTP por e-mail para redefinição de senha.
 * Usa resetPasswordForEmail → aciona o template "Reset Password" do Supabase
 * (separado do template "Magic Link" usado para 2FA).
 */
export async function resetPassword(email) {
  const { error } = await supabase.auth.resetPasswordForEmail(email);
  if (error) throw error;
}

/**
 * Verifica o OTP de recuperação de senha e retorna sessão temporária.
 */
export async function verifyRecoveryOtp(email, token) {
  const { data, error } = await supabase.auth.verifyOtp({ email, token, type: 'recovery' });
  if (error) throw error;
  const profile = await getProfile(data.user.id) ?? { id: data.user.id, email };
  return { user: data.user, profile, session: data.session };
}

/**
 * Faz upload de uma foto de perfil local para o Supabase Storage.
 * Retorna a URL pública da imagem.
 * Requer que o bucket 'avatars' exista e seja público no Supabase.
 *
 * Usa XMLHttpRequest em vez de fetch() para compatibilidade com URIs
 * content:// do Android (expo-image-picker retorna content:// no Android,
 * que fetch() não consegue ler, mas XMLHttpRequest trata corretamente).
 */
export async function uploadProfilePhoto(userId, localUri) {
  const blob = await new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.onload = () => resolve(xhr.response);
    xhr.onerror = () => reject(new Error('Falha ao ler o arquivo de imagem.'));
    xhr.responseType = 'blob';
    xhr.open('GET', localUri, true);
    xhr.send(null);
  });

  const mimeType = blob.type || 'image/jpeg';
  const ext = mimeType.split('/')[1]?.split('+')[0] || 'jpg';
  const filename = `${userId}/avatar_${Date.now()}.${ext}`;

  const { error } = await supabase.storage
    .from('avatars')
    .upload(filename, blob, { upsert: true, contentType: mimeType });
  if (error) throw error;

  const { data } = supabase.storage.from('avatars').getPublicUrl(filename);
  return data.publicUrl;
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
