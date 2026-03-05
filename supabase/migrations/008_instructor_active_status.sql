-- ============================================================
-- Adiciona flag de disponibilidade para receber solicitações
-- em profiles de instrutores.
--
-- Execute no SQL Editor do Supabase Dashboard.
-- ============================================================

-- 1. Coluna para controlar se instrutor aceita novos pedidos
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS is_accepting_requests boolean DEFAULT true;

-- 2. Garante que existe policy RLS de UPDATE para o próprio perfil
--    (sem isso, o instrutor não consegue salvar o status pelo app)
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
CREATE POLICY "Users can update own profile"
  ON public.profiles
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);
