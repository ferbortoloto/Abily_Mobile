-- Fix 1: Remover constraint única que não inclui reviewer_role.
-- A constraint antiga bloqueia o instrutor de avaliar quando o aluno já avaliou
-- a mesma sessão (mesmo event_id), pois não diferencia os papéis.
ALTER TABLE public.reviews
  DROP CONSTRAINT IF EXISTS reviews_instructor_id_student_id_event_id_key;

-- Nova constraint: um por (instrutor, aluno, evento, papel)
-- Quando event_id é NOT NULL: um review por evento por papel
CREATE UNIQUE INDEX IF NOT EXISTS reviews_with_event_unique
  ON public.reviews (instructor_id, student_id, event_id, reviewer_role)
  WHERE event_id IS NOT NULL;

-- Quando event_id é NULL: um review por par instrutor-aluno por papel
CREATE UNIQUE INDEX IF NOT EXISTS reviews_without_event_unique
  ON public.reviews (instructor_id, student_id, reviewer_role)
  WHERE event_id IS NULL;

-- Fix 2: Trigger deve contar apenas reviews do aluno (reviewer_role = 'student')
-- para o rating público do instrutor.
CREATE OR REPLACE FUNCTION public.update_instructor_rating()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  UPDATE public.profiles
  SET
    rating        = (
      SELECT COALESCE(ROUND(AVG(rating)::numeric, 1), 0)
      FROM public.reviews
      WHERE instructor_id = NEW.instructor_id
        AND reviewer_role = 'student'
    ),
    reviews_count = (
      SELECT COUNT(*)
      FROM public.reviews
      WHERE instructor_id = NEW.instructor_id
        AND reviewer_role = 'student'
    )
  WHERE id = NEW.instructor_id;
  RETURN NEW;
END;
$$;

-- Recalcula rating/reviews_count de todos os instrutores com os dados corretos
UPDATE public.profiles p
SET
  rating = sub.avg_rating,
  reviews_count = sub.cnt
FROM (
  SELECT
    instructor_id,
    COALESCE(ROUND(AVG(rating)::numeric, 1), 0) AS avg_rating,
    COUNT(*) AS cnt
  FROM public.reviews
  WHERE reviewer_role = 'student'
  GROUP BY instructor_id
) sub
WHERE p.id = sub.instructor_id
  AND p.role = 'instructor';
