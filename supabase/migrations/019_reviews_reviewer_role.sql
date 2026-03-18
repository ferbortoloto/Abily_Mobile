-- Adiciona campo reviewer_role para suportar avaliações nos dois sentidos:
-- 'student' = aluno avalia o instrutor (comportamento original)
-- 'instructor' = instrutor avalia o aluno
ALTER TABLE public.reviews
  ADD COLUMN IF NOT EXISTS reviewer_role text NOT NULL DEFAULT 'student'
    CHECK (reviewer_role IN ('student', 'instructor'));
