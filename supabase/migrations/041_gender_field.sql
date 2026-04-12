-- ============================================================
-- Adiciona campo de gênero aos perfis de instrutores e alunos.
--
-- Valores permitidos: 'male' | 'female' | 'undisclosed'
-- ============================================================

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS gender text DEFAULT NULL;

-- Remove versão anterior da RPC para substituir com novo parâmetro
DROP FUNCTION IF EXISTS public.complete_profile_after_signup(uuid,text,text,text,text,date,text,text,text,text,text,integer,text,numeric,numeric,text,text,boolean,boolean,text,integer,text);

CREATE OR REPLACE FUNCTION public.complete_profile_after_signup(
  p_user_id              uuid,
  p_email                text,
  p_name                 text,
  p_phone                text,
  p_cpf                  text,
  p_birthdate            date,
  p_role                 text,
  p_avatar_url           text    DEFAULT NULL,
  p_license_category     text    DEFAULT NULL,
  p_instructor_reg_num   text    DEFAULT NULL,
  p_car_model            text    DEFAULT NULL,
  p_car_year             integer DEFAULT NULL,
  p_car_options          text    DEFAULT NULL,
  p_price_per_hour       numeric DEFAULT NULL,
  p_price_per_hour_moto  numeric DEFAULT NULL,
  p_bio                  text    DEFAULT NULL,
  p_vehicle_type         text    DEFAULT 'manual',
  p_has_car              boolean DEFAULT NULL,
  p_has_moto             boolean DEFAULT NULL,
  p_moto_model           text    DEFAULT NULL,
  p_moto_year            integer DEFAULT NULL,
  p_moto_options         text    DEFAULT NULL,
  p_gender               text    DEFAULT NULL
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
  IF auth.uid() IS NULL THEN
    SELECT email_confirmed_at INTO v_confirmed_at
    FROM auth.users WHERE id = p_user_id;

    IF v_confirmed_at IS NOT NULL THEN
      RAISE EXCEPTION 'email_already_confirmed: conta já confirmada, faça login';
    END IF;
  ELSE
    -- 2b. Com sessão ativa (confirmação de e-mail OFF):
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
    price_per_hour, price_per_hour_moto, bio,
    has_car,
    has_moto, moto_model, moto_year, moto_options,
    gender,
    rating, reviews_count, is_verified
  )
  VALUES (
    p_user_id, p_name, p_email, p_role, p_avatar_url,
    p_phone, p_cpf, p_birthdate,
    p_license_category, p_instructor_reg_num,
    p_car_model, p_car_year, p_car_options, p_vehicle_type,
    p_price_per_hour, p_price_per_hour_moto, p_bio,
    p_has_car,
    p_has_moto, p_moto_model, p_moto_year, p_moto_options,
    p_gender,
    CASE WHEN p_role = 'instructor' THEN 0     ELSE NULL  END,
    CASE WHEN p_role = 'instructor' THEN 0     ELSE NULL  END,
    CASE WHEN p_role = 'instructor' THEN false ELSE NULL  END
  )
  ON CONFLICT (id) DO UPDATE SET
    name                 = EXCLUDED.name,
    phone                = EXCLUDED.phone,
    cpf                  = EXCLUDED.cpf,
    birthdate            = EXCLUDED.birthdate,
    role                 = EXCLUDED.role,
    avatar_url           = EXCLUDED.avatar_url,
    license_category     = EXCLUDED.license_category,
    instructor_reg_num   = EXCLUDED.instructor_reg_num,
    car_model            = EXCLUDED.car_model,
    car_year             = EXCLUDED.car_year,
    car_options          = EXCLUDED.car_options,
    vehicle_type         = EXCLUDED.vehicle_type,
    price_per_hour       = EXCLUDED.price_per_hour,
    price_per_hour_moto  = EXCLUDED.price_per_hour_moto,
    bio                  = EXCLUDED.bio,
    has_car              = EXCLUDED.has_car,
    has_moto             = EXCLUDED.has_moto,
    moto_model           = EXCLUDED.moto_model,
    moto_year            = EXCLUDED.moto_year,
    moto_options         = EXCLUDED.moto_options,
    gender               = EXCLUDED.gender,
    rating               = COALESCE(profiles.rating,        EXCLUDED.rating),
    reviews_count        = COALESCE(profiles.reviews_count, EXCLUDED.reviews_count),
    is_verified          = COALESCE(profiles.is_verified,   EXCLUDED.is_verified);
END;
$$;

GRANT EXECUTE ON FUNCTION public.complete_profile_after_signup TO anon, authenticated;
