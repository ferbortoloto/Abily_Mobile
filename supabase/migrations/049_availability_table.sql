-- Cria tabela de disponibilidade de instrutores (se ainda não existir)
-- Usada pelo AvailabilityManager para gravar os slots de horário disponíveis.

CREATE TABLE IF NOT EXISTS availability (
  id           UUID       PRIMARY KEY DEFAULT gen_random_uuid(),
  instructor_id UUID      NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  day_of_week  SMALLINT   NOT NULL CHECK (day_of_week BETWEEN 1 AND 7),
  time_slot    TEXT       NOT NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (instructor_id, day_of_week, time_slot)
);

-- Índice para buscas por instrutor
CREATE INDEX IF NOT EXISTS availability_instructor_idx ON availability(instructor_id);

-- Row Level Security
ALTER TABLE availability ENABLE ROW LEVEL SECURITY;

-- Qualquer usuário autenticado pode visualizar a disponibilidade de instrutores
-- (necessário para alunos buscarem horários disponíveis)
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'availability' AND policyname = 'public_view_availability'
  ) THEN
    CREATE POLICY "public_view_availability"
      ON availability FOR SELECT
      USING (true);
  END IF;
END $$;

-- Instrutor pode inserir sua própria disponibilidade
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'availability' AND policyname = 'instructor_insert_own_availability'
  ) THEN
    CREATE POLICY "instructor_insert_own_availability"
      ON availability FOR INSERT
      WITH CHECK (auth.uid() = instructor_id);
  END IF;
END $$;

-- Instrutor pode excluir sua própria disponibilidade
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'availability' AND policyname = 'instructor_delete_own_availability'
  ) THEN
    CREATE POLICY "instructor_delete_own_availability"
      ON availability FOR DELETE
      USING (auth.uid() = instructor_id);
  END IF;
END $$;
