-- Garante que as tabelas com assinaturas realtime filtradas por coluna
-- incluam TODOS os campos no payload de UPDATE/DELETE. Sem isso, filtros
-- como student_id=eq.X silenciosamente falham em eventos UPDATE.
-- A publicação já é FOR ALL TABLES, então não é preciso adicionar tabelas.

ALTER TABLE public.purchases REPLICA IDENTITY FULL;
ALTER TABLE public.profiles REPLICA IDENTITY FULL;
ALTER TABLE public.instructor_locations REPLICA IDENTITY FULL;
ALTER TABLE public.conversations REPLICA IDENTITY FULL;
ALTER TABLE public.plans REPLICA IDENTITY FULL;

DO $$ BEGIN
  ALTER TABLE public.notifications REPLICA IDENTITY FULL;
EXCEPTION WHEN undefined_table THEN NULL;
END $$;
