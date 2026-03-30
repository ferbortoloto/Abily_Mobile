-- Adiciona horário agendado na sessão para impedir início muito antes da hora marcada
ALTER TABLE public.sessions
  ADD COLUMN IF NOT EXISTS scheduled_start_at timestamptz;
