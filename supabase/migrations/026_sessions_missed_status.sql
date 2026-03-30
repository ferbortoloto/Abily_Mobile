-- Garante que o status 'missed' seja aceito na tabela sessions.
-- Remove qualquer CHECK constraint existente no campo status e recria com os valores válidos.
DO $$
DECLARE
  con_name text;
BEGIN
  SELECT constraint_name INTO con_name
  FROM information_schema.table_constraints
  WHERE table_name = 'sessions'
    AND constraint_type = 'CHECK'
    AND constraint_name ILIKE '%status%';

  IF con_name IS NOT NULL THEN
    EXECUTE format('ALTER TABLE public.sessions DROP CONSTRAINT %I', con_name);
  END IF;
END $$;

ALTER TABLE public.sessions
  ADD CONSTRAINT sessions_status_check
  CHECK (status IN ('pending', 'active', 'completed', 'missed'));
