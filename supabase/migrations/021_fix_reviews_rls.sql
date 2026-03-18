-- Corrige a política de INSERT de reviews para permitir avaliações nos dois sentidos:
-- 'student' avalia como student_id = auth.uid()
-- 'instructor' avalia como instructor_id = auth.uid()
DROP POLICY IF EXISTS "reviews_insert" ON public.reviews;

CREATE POLICY "reviews_insert"
  ON public.reviews FOR INSERT
  TO authenticated
  WITH CHECK (
    student_id = auth.uid() OR instructor_id = auth.uid()
  );
