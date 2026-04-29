-- A publicação supabase_realtime já está em modo FOR ALL TABLES neste projeto,
-- portanto ADD TABLE é desnecessário. Este bloco é mantido como no-op seguro
-- para não quebrar o histórico de migrations.
DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.class_requests;
EXCEPTION WHEN duplicate_object OR wrong_object_type THEN NULL;
END $$;

DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.sessions;
EXCEPTION WHEN duplicate_object OR wrong_object_type THEN NULL;
END $$;

DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;
EXCEPTION WHEN duplicate_object OR wrong_object_type THEN NULL;
END $$;
