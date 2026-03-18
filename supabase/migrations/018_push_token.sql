-- Adiciona coluna push_token na tabela profiles para notificações push
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS push_token text;
