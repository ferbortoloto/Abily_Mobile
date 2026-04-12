-- ============================================================
-- Sistema de múltiplas categorias CNH para alunos.
-- Um aluno pode cursar mais de uma categoria (ex: já tem B,
-- quer adicionar A). Cada solicitação de aula fica vinculada
-- à categoria-alvo para rastreamento correto do progresso.
-- ============================================================

-- 1. Tabela de categorias-objetivo do aluno
CREATE TABLE IF NOT EXISTS public.student_goal_categories (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id  uuid        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  category    text        NOT NULL CHECK (category IN ('A', 'B', 'C', 'D', 'E')),
  status      text        NOT NULL DEFAULT 'studying'
              CHECK (status IN ('studying', 'obtained')),
  started_at  timestamptz DEFAULT now(),
  obtained_at timestamptz,
  UNIQUE (student_id, category)
);

-- 2. RLS
ALTER TABLE public.student_goal_categories ENABLE ROW LEVEL SECURITY;

-- Aluno gerencia apenas suas próprias categorias
CREATE POLICY "sgc_own_all" ON public.student_goal_categories
  FOR ALL USING (auth.uid() = student_id);

-- Instrutores podem ler (para exibir info do aluno na solicitação)
CREATE POLICY "sgc_instructor_read" ON public.student_goal_categories
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role = 'instructor'
    )
  );

-- 3. Coluna de categoria na solicitação de aula
ALTER TABLE public.class_requests
  ADD COLUMN IF NOT EXISTS license_category text
  CHECK (license_category IN ('A', 'B', 'C', 'D', 'E'));

-- 4. Popula a tabela para alunos existentes com categoria simples (A ou B)
INSERT INTO public.student_goal_categories (student_id, category, status)
SELECT id, license_category, 'studying'
FROM   public.profiles
WHERE  role = 'user'
  AND  license_category IN ('A', 'B', 'C', 'D', 'E')
ON CONFLICT (student_id, category) DO NOTHING;

-- Para alunos com 'A+B' ou 'AB', insere ambas as categorias
INSERT INTO public.student_goal_categories (student_id, category, status)
SELECT id, 'A', 'studying'
FROM   public.profiles
WHERE  role = 'user'
  AND  license_category IN ('A+B', 'AB')
ON CONFLICT (student_id, category) DO NOTHING;

INSERT INTO public.student_goal_categories (student_id, category, status)
SELECT id, 'B', 'studying'
FROM   public.profiles
WHERE  role = 'user'
  AND  license_category IN ('A+B', 'AB')
ON CONFLICT (student_id, category) DO NOTHING;

-- 5. Habilita Realtime para que atualizações reflitam ao vivo
ALTER PUBLICATION supabase_realtime ADD TABLE public.student_goal_categories;
