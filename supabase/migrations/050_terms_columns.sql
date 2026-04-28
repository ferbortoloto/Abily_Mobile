-- Adiciona colunas de controle de aceite dos Termos de Uso ao profiles
-- (idempotente: IF NOT EXISTS)

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS terms_version    TEXT,
  ADD COLUMN IF NOT EXISTS terms_accepted_at TIMESTAMPTZ;
