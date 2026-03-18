-- ============================================================
-- Corrige o CHECK constraint de license_category para aceitar
-- o valor 'A+B' usado pela UI (Moto + Carro).
-- ============================================================

ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS profiles_license_category_check;

ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_license_category_check
  CHECK (license_category IN ('A', 'B', 'A+B', 'AB'));
