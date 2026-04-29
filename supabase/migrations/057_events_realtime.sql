-- Habilita Realtime na tabela events para que cancelamentos
-- atualizem o calendário automaticamente em ambos os apps.
ALTER TABLE public.events REPLICA IDENTITY FULL;
DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.events;
EXCEPTION WHEN duplicate_object OR wrong_object_type THEN NULL;
END $$;
