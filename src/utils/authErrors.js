/**
 * Mapeia erros do Supabase para mensagens amigáveis e seguras.
 * Nunca expõe detalhes internos do backend ao usuário.
 */
export function mapAuthError(error) {
  const msg  = (error?.message || '').toLowerCase();
  const code = (error?.code    || '').toLowerCase();

  // E-mail já cadastrado / conta já confirmada
  if (
    msg.includes('already registered') ||
    msg.includes('already been registered') ||
    msg.includes('user already exists') ||
    msg.includes('email_already_confirmed') ||
    msg.includes('conta já confirmada') ||
    code === 'user_already_exists'
  ) return 'Este e-mail já está cadastrado. Tente fazer login.';

  // Credenciais inválidas
  if (
    msg.includes('invalid login credentials') ||
    msg.includes('invalid credentials') ||
    code === 'invalid_credentials'
  ) return 'E-mail ou senha incorretos. Verifique e tente novamente.';

  // E-mail não confirmado
  if (
    msg.includes('email not confirmed') ||
    code === 'email_not_confirmed'
  ) return 'Confirme seu e-mail antes de entrar.';

  // Conta desativada / banida
  if (msg.includes('user banned') || code === 'user_banned')
    return 'Esta conta foi suspensa. Entre em contato com o suporte.';

  // Senha igual à anterior
  if (
    msg.includes('different from the old password') ||
    msg.includes('same as the old password') ||
    msg.includes('password should be different')
  ) return 'A nova senha deve ser diferente da senha atual.';

  // Senha fraca (Supabase valida no server)
  if (msg.includes('password') && msg.includes('character'))
    return 'A senha não atende aos requisitos mínimos de segurança.';

  // Limite de tentativas
  if (
    msg.includes('rate limit') ||
    msg.includes('too many requests') ||
    msg.includes('for security purposes') ||
    code === 'over_request_rate_limit' ||
    code === 'over_email_send_rate_limit'
  ) return 'Muitas tentativas. Aguarde alguns minutos e tente novamente.';

  // Erro de rede
  if (
    msg.includes('network') ||
    msg.includes('fetch') ||
    msg.includes('failed to fetch') ||
    msg.includes('network request failed')
  ) return 'Sem conexão. Verifique sua internet e tente novamente.';

  // Genérico — nunca expõe detalhes internos
  return 'Ocorreu um erro inesperado. Tente novamente.';
}
