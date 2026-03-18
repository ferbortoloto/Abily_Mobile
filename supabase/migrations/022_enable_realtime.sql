-- Habilita filtragem por coluna no Realtime para class_requests e messages
-- Ambas as tabelas já estavam na publicação supabase_realtime
ALTER TABLE public.class_requests REPLICA IDENTITY FULL;
ALTER TABLE public.messages       REPLICA IDENTITY FULL;
