-- ============================================================
-- Fix: trigger cria perfil COMPLETO a partir do raw_user_meta_data
-- Necessário para funcionar com "Confirm email" ATIVADO no Supabase,
-- pois nesse caso não há sessão após o signUp e o cliente não pode
-- fazer upsert via RLS.
-- Execute no SQL Editor do Supabase Dashboard.
-- ============================================================

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  meta      jsonb := NEW.raw_user_meta_data;
  user_role text  := COALESCE(meta->>'role', 'user');
BEGIN
  INSERT INTO public.profiles (
    id, name, email, role, avatar_url,
    phone, cpf, birthdate,
    license_category, instructor_reg_num,
    car_model, car_options,
    price_per_hour, bio,
    rating, reviews_count, is_verified
  )
  VALUES (
    NEW.id,
    COALESCE(meta->>'name', ''),
    NEW.email,
    user_role,
    meta->>'avatar_url',
    meta->>'phone',
    meta->>'cpf',
    -- birthdate chega como 'YYYY-MM-DD' (já convertido pelo client)
    CASE
      WHEN meta->>'birthdate' IS NOT NULL AND meta->>'birthdate' <> ''
      THEN (meta->>'birthdate')::date
      ELSE NULL
    END,
    -- campos exclusivos de instrutor
    CASE WHEN user_role = 'instructor' THEN meta->>'license_category' ELSE NULL END,
    CASE WHEN user_role = 'instructor' THEN meta->>'instructor_reg_num' ELSE NULL END,
    CASE WHEN user_role = 'instructor' THEN meta->>'car_model'          ELSE NULL END,
    CASE WHEN user_role = 'instructor' THEN meta->>'car_options'        ELSE NULL END,
    CASE
      WHEN user_role = 'instructor' AND meta->>'price_per_hour' IS NOT NULL
      THEN (meta->>'price_per_hour')::numeric
      ELSE NULL
    END,
    CASE WHEN user_role = 'instructor' THEN meta->>'bio' ELSE NULL END,
    CASE WHEN user_role = 'instructor' THEN 0   ELSE NULL END,
    CASE WHEN user_role = 'instructor' THEN 0   ELSE NULL END,
    CASE WHEN user_role = 'instructor' THEN false ELSE NULL END
  )
  ON CONFLICT (id) DO UPDATE SET
    name        = EXCLUDED.name,
    phone       = EXCLUDED.phone,
    cpf         = EXCLUDED.cpf,
    birthdate   = EXCLUDED.birthdate,
    role        = EXCLUDED.role,
    avatar_url  = EXCLUDED.avatar_url,
    license_category   = EXCLUDED.license_category,
    instructor_reg_num = EXCLUDED.instructor_reg_num,
    car_model          = EXCLUDED.car_model,
    car_options        = EXCLUDED.car_options,
    price_per_hour     = EXCLUDED.price_per_hour,
    bio                = EXCLUDED.bio,
    rating             = COALESCE(profiles.rating, EXCLUDED.rating),
    reviews_count      = COALESCE(profiles.reviews_count, EXCLUDED.reviews_count),
    is_verified        = COALESCE(profiles.is_verified, EXCLUDED.is_verified);

  RETURN NEW;
END;
$$;
