-- ============================================================
-- Fix: restaura a lógica de segurança correta da migration 005.
--
-- Problema: as migrations 009, 010 e 011 reintroduziram a janela de
-- 30 minutos que havia sido removida na migration 005. Isso quebra
-- cadastros quando:
--   • O usuário tenta novamente após uma falha (conta já existe há > 30 min)
--   • O Supabase retorna o usuário existente (e-mail não confirmado) ao
--     chamar signUp com um e-mail já registrado.
--
-- Lógica correta (da migration 005):
--   • Sem sessão ativa (confirmação de e-mail ON):
--       → Permite apenas se email_confirmed_at IS NULL (conta não confirmada)
--   • Com sessão ativa (confirmação de e-mail OFF):
--       → Permite apenas se auth.uid() = p_user_id
--
-- Mantém todos os campos adicionados pelas migrations 009, 010 e 011
-- (vehicle_type, car_year, has_car).
-- ============================================================

-- Remove todas as versões anteriores para evitar conflito de assinatura
DROP FUNCTION IF EXISTS public.complete_profile_after_signup(uuid,text,text,text,text,date,text,text,text,text,text,integer,text,numeric,text,text,boolean);
DROP FUNCTION IF EXISTS public.complete_profile_after_signup(uuid,text,text,text,text,date,text,text,text,text,text,integer,text,numeric,text,text);
DROP FUNCTION IF EXISTS public.complete_profile_after_signup(uuid,text,text,text,text,date,text,text,text,text,text,text,numeric,text,text);
DROP FUNCTION IF EXISTS public.complete_profile_after_signup(uuid,text,text,text,text,date,text,text,text,text,text,text,numeric,text);

CREATE OR REPLACE FUNCTION public.complete_profile_after_signup(
  p_user_id            uuid,
  p_email              text,
  p_name               text,
  p_phone              text,
  p_cpf                text,
  p_birthdate          date,
  p_role               text,
  p_avatar_url         text    DEFAULT NULL,
  p_license_category   text    DEFAULT NULL,
  p_instructor_reg_num text    DEFAULT NULL,
  p_car_model          text    DEFAULT NULL,
  p_car_year           integer DEFAULT NULL,
  p_car_options        text    DEFAULT NULL,
  p_price_per_hour     numeric DEFAULT NULL,
  p_bio                text    DEFAULT NULL,
  p_vehicle_type       text    DEFAULT 'manual',
  p_has_car            boolean DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_confirmed_at timestamptz;
BEGIN
  -- 1. user_id + email devem existir em auth.users
  IF NOT EXISTS (
    SELECT 1 FROM auth.users
    WHERE id    = p_user_id
      AND email = p_email
  ) THEN
    RAISE EXCEPTION 'Unauthorized: user_id/email inválidos';
  END IF;

  -- 2a. Sem sessão ativa (confirmação de e-mail ON):
  --     Permite apenas se o e-mail ainda não foi confirmado.
  IF auth.uid() IS NULL THEN
    SELECT email_confirmed_at INTO v_confirmed_at
    FROM auth.users WHERE id = p_user_id;

    IF v_confirmed_at IS NOT NULL THEN
      RAISE EXCEPTION 'email_already_confirmed: conta já confirmada, faça login';
    END IF;
  ELSE
    -- 2b. Com sessão ativa (confirmação de e-mail OFF):
    --     Permite apenas se a sessão pertence ao mesmo usuário.
    IF auth.uid() != p_user_id THEN
      RAISE EXCEPTION 'Unauthorized: sessão não pertence a este usuário';
    END IF;
  END IF;

  -- 3. Insere ou atualiza o perfil completo
  INSERT INTO public.profiles (
    id, name, email, role, avatar_url,
    phone, cpf, birthdate,
    license_category, instructor_reg_num,
    car_model, car_year, car_options, vehicle_type,
    price_per_hour, bio,
    has_car,
    rating, reviews_count, is_verified
  )
  VALUES (
    p_user_id, p_name, p_email, p_role, p_avatar_url,
    p_phone, p_cpf, p_birthdate,
    p_license_category, p_instructor_reg_num,
    p_car_model, p_car_year, p_car_options, p_vehicle_type,
    p_price_per_hour, p_bio,
    p_has_car,
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
    car_year           = EXCLUDED.car_year,
    car_options        = EXCLUDED.car_options,
    vehicle_type       = EXCLUDED.vehicle_type,
    price_per_hour     = EXCLUDED.price_per_hour,
    bio                = EXCLUDED.bio,
    has_car            = EXCLUDED.has_car,
    rating             = COALESCE(profiles.rating,        EXCLUDED.rating),
    reviews_count      = COALESCE(profiles.reviews_count, EXCLUDED.reviews_count),
    is_verified        = COALESCE(profiles.is_verified,   EXCLUDED.is_verified);
END;
$$;

GRANT EXECUTE ON FUNCTION public.complete_profile_after_signup TO anon, authenticated;
