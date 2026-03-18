-- ============================================================
-- MOCK DATA — Alunos para demonstração (conta bortolotoplay)
-- Execute no SQL Editor do Supabase Dashboard
-- ============================================================

-- ──────────────────────────────────────────────────────────
-- 0. Garante que todas as colunas necessárias existem
--    (equivalente à migration 006, seguro rodar mais de uma vez)
-- ──────────────────────────────────────────────────────────
ALTER TABLE public.class_requests
  ADD COLUMN IF NOT EXISTS type            text    DEFAULT 'Aula Prática',
  ADD COLUMN IF NOT EXISTS car_option      text    DEFAULT 'instructor',
  ADD COLUMN IF NOT EXISTS meeting_point   jsonb,
  ADD COLUMN IF NOT EXISTS requested_slots text[],
  ADD COLUMN IF NOT EXISTS requested_date  date,
  ADD COLUMN IF NOT EXISTS price           numeric,
  ADD COLUMN IF NOT EXISTS message         text,
  ADD COLUMN IF NOT EXISTS purchase_id     uuid;

ALTER TABLE public.plans
  ADD COLUMN IF NOT EXISTS purchased_by integer DEFAULT 0;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS coordinates   jsonb,
  ADD COLUMN IF NOT EXISTS location      text,
  ADD COLUMN IF NOT EXISTS goal          text,
  ADD COLUMN IF NOT EXISTS class_duration integer DEFAULT 60;

-- ──────────────────────────────────────────────────────────
-- 1-5. Insere os dados mockados
-- ──────────────────────────────────────────────────────────
DO $$
DECLARE
  v_instructor_email text := 'gustavomaran@hotmail.com';
  v_instructor_id    uuid := (SELECT id FROM public.profiles WHERE email = v_instructor_email);

  s1 uuid := 'a1000000-0000-0000-0000-000000000001';
  s2 uuid := 'a1000000-0000-0000-0000-000000000002';
  s3 uuid := 'a1000000-0000-0000-0000-000000000003';
  s4 uuid := 'a1000000-0000-0000-0000-000000000004';
  s5 uuid := 'a1000000-0000-0000-0000-000000000005';

  r1 uuid := 'b1000000-0000-0000-0000-000000000001';
  r2 uuid := 'b1000000-0000-0000-0000-000000000002';
  r3 uuid := 'b1000000-0000-0000-0000-000000000003';
  r4 uuid := 'b1000000-0000-0000-0000-000000000004';
  r5 uuid := 'b1000000-0000-0000-0000-000000000005';
  r6 uuid := 'b1000000-0000-0000-0000-000000000006';
  r7 uuid := 'b1000000-0000-0000-0000-000000000007';

  e1 uuid := 'c1000000-0000-0000-0000-000000000001';
  e2 uuid := 'c1000000-0000-0000-0000-000000000002';
  e3 uuid := 'c1000000-0000-0000-0000-000000000003';
  e4 uuid := 'c1000000-0000-0000-0000-000000000004';
  e5 uuid := 'c1000000-0000-0000-0000-000000000005';
  e6 uuid := 'c1000000-0000-0000-0000-000000000006';
BEGIN
  IF v_instructor_id IS NULL THEN
    RAISE EXCEPTION 'Instrutor "%" não encontrado em public.profiles.', v_instructor_email;
  END IF;

  -- ── 0. Remove dados mockados anteriores ───────────────
  DELETE FROM public.sessions       WHERE student_id IN (s1,s2,s3,s4,s5) OR instructor_id IN (s1,s2,s3,s4,s5);
  DELETE FROM public.events         WHERE id IN (e1,e2,e3,e4,e5,e6);
  DELETE FROM public.class_requests WHERE id IN (r1,r2,r3,r4,r5,r6,r7);
  DELETE FROM public.profiles       WHERE id IN (s1,s2,s3,s4,s5);
  DELETE FROM auth.users            WHERE id IN (s1,s2,s3,s4,s5);

  -- ── 1. Usuários no auth.users ──────────────────────────
  INSERT INTO auth.users (
    id, aud, role, email, encrypted_password,
    email_confirmed_at, created_at, updated_at,
    raw_app_meta_data, raw_user_meta_data,
    is_super_admin, is_sso_user
  ) VALUES
    (s1,'authenticated','authenticated','ana.silva.demo@abily.app',
     crypt('Demo@1234',gen_salt('bf')), now(), now(), now(),
     '{"provider":"email","providers":["email"]}','{}', false, false),

    (s2,'authenticated','authenticated','carlos.ferreira.demo@abily.app',
     crypt('Demo@1234',gen_salt('bf')), now(), now(), now(),
     '{"provider":"email","providers":["email"]}','{}', false, false),

    (s3,'authenticated','authenticated','mariana.costa.demo@abily.app',
     crypt('Demo@1234',gen_salt('bf')), now(), now(), now(),
     '{"provider":"email","providers":["email"]}','{}', false, false),

    (s4,'authenticated','authenticated','pedro.almeida.demo@abily.app',
     crypt('Demo@1234',gen_salt('bf')), now(), now(), now(),
     '{"provider":"email","providers":["email"]}','{}', false, false),

    (s5,'authenticated','authenticated','julia.santos.demo@abily.app',
     crypt('Demo@1234',gen_salt('bf')), now(), now(), now(),
     '{"provider":"email","providers":["email"]}','{}', false, false)
  ON CONFLICT (id) DO NOTHING;

  -- ── 2. Perfis dos alunos ───────────────────────────────
  INSERT INTO public.profiles (id, name, email, role, phone, cpf, birthdate, goal, avatar_url, coordinates, location)
  VALUES
    (s1,'Ana Silva',       'ana.silva.demo@abily.app',       'user','(35) 99111-1001','111.222.333-01','2000-05-14','Tirar habilitação B',       'https://randomuser.me/api/portraits/women/44.jpg', '{"latitude":-21.7903,"longitude":-46.5625}', 'Poços de Caldas, MG'),
    (s2,'Carlos Ferreira', 'carlos.ferreira.demo@abily.app', 'user','(35) 99111-1002','222.333.444-02','1998-08-22','Melhorar direção defensiva','https://randomuser.me/api/portraits/men/32.jpg',   '{"latitude":-21.7875,"longitude":-46.5580}', 'Poços de Caldas, MG'),
    (s3,'Mariana Costa',   'mariana.costa.demo@abily.app',   'user','(35) 99111-1003','333.444.555-03','2001-11-30','Tirar habilitação B',       'https://randomuser.me/api/portraits/women/68.jpg', '{"latitude":-21.7890,"longitude":-46.5615}', 'Poços de Caldas, MG'),
    (s4,'Pedro Almeida',   'pedro.almeida.demo@abily.app',   'user','(35) 99111-1004','444.555.666-04','1999-03-07','Renovar habilitação',       'https://randomuser.me/api/portraits/men/85.jpg',   '{"latitude":-21.7860,"longitude":-46.5640}', 'Poços de Caldas, MG'),
    (s5,'Júlia Santos',    'julia.santos.demo@abily.app',    'user','(35) 99111-1005','555.666.777-05','2002-07-19','Tirar habilitação B',       'https://randomuser.me/api/portraits/women/12.jpg', '{"latitude":-21.7932,"longitude":-46.5598}', 'Poços de Caldas, MG')
  ON CONFLICT (id) DO UPDATE SET
    name        = EXCLUDED.name,
    avatar_url  = EXCLUDED.avatar_url,
    coordinates = EXCLUDED.coordinates,
    location    = EXCLUDED.location;

  -- ── 3. Solicitações PENDENTES ──────────────────────────
  INSERT INTO public.class_requests (
    id, student_id, instructor_id, status,
    type, car_option, price,
    requested_date, requested_start, requested_end, requested_slots, meeting_point, message, created_at
  ) VALUES
    (r1, s1, v_instructor_id, 'pending',
     'Aula Prática', 'instructor', 120.00,
     '2026-03-19', '2026-03-19 09:00:00-03', '2026-03-19 10:00:00-03', ARRAY['09:00','09:30'],
     '{"address":"Praça Pedro Sanches, s/n — Poços de Caldas, MG"}',
     'Olá! Gostaria de agendar minha primeira aula.',
     now() - interval '2 hours'),

    (r2, s2, v_instructor_id, 'pending',
     'Aula Prática', 'instructor', 120.00,
     '2026-03-20', '2026-03-20 14:00:00-03', '2026-03-20 15:00:00-03', ARRAY['14:00','14:30'],
     '{"address":"Av. Francisco Sales, 500 — Poços de Caldas, MG"}',
     'Preciso melhorar minha direção defensiva antes de viajar.',
     now() - interval '45 minutes'),

    (r3, s5, v_instructor_id, 'pending',
     'Aula Prática', 'student', 120.00,
     '2026-03-21', '2026-03-21 10:00:00-03', '2026-03-21 11:00:00-03', ARRAY['10:00','10:30'],
     '{"address":"Terminal Rodoviário — Poços de Caldas, MG"}',
     NULL,
     now() - interval '10 minutes')
  ON CONFLICT (id) DO NOTHING;

  -- ── 4. Mais solicitações PENDENTES ─────────────────────
  INSERT INTO public.class_requests (
    id, student_id, instructor_id, status,
    type, car_option, price,
    requested_date, requested_start, requested_end, requested_slots, meeting_point, message, created_at
  ) VALUES
    (r4, s3, v_instructor_id, 'pending',
     'Aula Prática', 'instructor', 120.00,
     '2026-03-24', '2026-03-24 08:00:00-03', '2026-03-24 09:00:00-03', ARRAY['08:00','08:30'],
     '{"address":"Rua Major Venâncio, 200 — Poços de Caldas, MG"}',
     'Quero começar o quanto antes!',
     now() - interval '1 day'),

    (r5, s4, v_instructor_id, 'pending',
     'Aula Prática', 'instructor', 120.00,
     '2026-03-25', '2026-03-25 15:00:00-03', '2026-03-25 16:00:00-03', ARRAY['15:00','15:30'],
     '{"address":"Rua João Pinheiro, 300 — Poços de Caldas, MG"}',
     NULL,
     now() - interval '2 days'),

    (r6, s1, v_instructor_id, 'pending',
     'Aula Prática', 'student', 120.00,
     '2026-03-27', '2026-03-27 09:00:00-03', '2026-03-27 10:00:00-03', ARRAY['09:00','09:30'],
     '{"address":"Praça Pedro Sanches, s/n — Poços de Caldas, MG"}',
     'Pode ser com o meu carro mesmo.',
     now() - interval '3 days'),

    (r7, s2, v_instructor_id, 'pending',
     'Aula Prática', 'instructor', 120.00,
     '2026-03-28', '2026-03-28 14:00:00-03', '2026-03-28 15:00:00-03', ARRAY['14:00','14:30'],
     '{"address":"Av. Francisco Sales, 500 — Poços de Caldas, MG"}',
     NULL,
     now() - interval '4 days')
  ON CONFLICT (id) DO NOTHING;

  RAISE NOTICE 'Sucesso! Instrutor: % | ID: %', v_instructor_email, v_instructor_id;
END $$;
