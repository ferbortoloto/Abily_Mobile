-- ============================================================
-- Melhoria de segurança: dados sensíveis (CPF, telefone, data de
-- nascimento) NÃO passam mais pelo raw_user_meta_data.
-- O perfil completo é criado via RPC com SECURITY DEFINER, que
-- valida a identidade antes de gravar.
--
-- Execute no SQL Editor do Supabase Dashboard.
-- Substitui a migration 003.
-- ============================================================

-- 1. Reverte o trigger para gravar apenas dados não-sensíveis.
--    O perfil completo é responsabilidade da RPC abaixo.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, name, email, role, avatar_url)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'name', ''),
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'role', 'user'),
    NEW.raw_user_meta_data->>'avatar_url'
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

-- 2. RPC chamada pelo cliente logo após o signUp para gravar o perfil completo.
--    Segurança: valida que user_id + email existem em auth.users e que a conta
--    foi criada há menos de 30 minutos (impede que terceiros chamem a função
--    com user_id alheio).
CREATE OR REPLACE FUNCTION public.complete_profile_after_signup(
  p_user_id          uuid,
  p_email            text,
  p_name             text,
  p_phone            text,
  p_cpf              text,
  p_birthdate        date,
  p_role             text,
  p_avatar_url       text    DEFAULT NULL,
  p_license_category   text  DEFAULT NULL,
  p_instructor_reg_num text  DEFAULT NULL,
  p_car_model          text  DEFAULT NULL,
  p_car_options        text  DEFAULT NULL,
  p_price_per_hour     numeric DEFAULT NULL,
  p_bio                text  DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  -- Valida: user_id + email devem existir em auth.users
  -- e a conta deve ter sido criada nos últimos 30 minutos.
  IF NOT EXISTS (
    SELECT 1 FROM auth.users
    WHERE id          = p_user_id
      AND email       = p_email
      AND created_at  > now() - interval '30 minutes'
  ) THEN
    RAISE EXCEPTION 'Unauthorized: user_id/email inválidos ou janela de cadastro expirada';
  END IF;

  INSERT INTO public.profiles (
    id, name, email, role, avatar_url,
    phone, cpf, birthdate,
    license_category, instructor_reg_num,
    car_model, car_options,
    price_per_hour, bio,
    rating, reviews_count, is_verified
  )
  VALUES (
    p_user_id, p_name, p_email, p_role, p_avatar_url,
    p_phone, p_cpf, p_birthdate,
    p_license_category, p_instructor_reg_num,
    p_car_model, p_car_options,
    p_price_per_hour, p_bio,
    CASE WHEN p_role = 'instructor' THEN 0     ELSE NULL  END,
    CASE WHEN p_role = 'instructor' THEN 0     ELSE NULL  END,
    CASE WHEN p_role = 'instructor' THEN false ELSE NULL  END
  )
  ON CONFLICT (id) DO UPDATE SET
    name               = EXCLUDED.name,
    phone              = EXCLUDED.phone,
    cpf                = EXCLUDED.cpf,
    birthdate          = EXCLUDED.birthdate,
    role               = EXCLUDED.role,
    avatar_url         = EXCLUDED.avatar_url,
    license_category   = EXCLUDED.license_category,
    instructor_reg_num = EXCLUDED.instructor_reg_num,
    car_model          = EXCLUDED.car_model,
    car_options        = EXCLUDED.car_options,
    price_per_hour     = EXCLUDED.price_per_hour,
    bio                = EXCLUDED.bio,
    rating             = COALESCE(profiles.rating,        EXCLUDED.rating),
    reviews_count      = COALESCE(profiles.reviews_count, EXCLUDED.reviews_count),
    is_verified        = COALESCE(profiles.is_verified,   EXCLUDED.is_verified);
END;
$$;

-- 3. Permite que usuários sem sessão (anon) chamem a função.
--    Necessário quando confirmação de e-mail está ativa.
GRANT EXECUTE ON FUNCTION public.complete_profile_after_signup TO anon, authenticated;
