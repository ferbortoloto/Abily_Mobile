-- Habilita Realtime para a tabela sessions e garante que code seja text(6)
-- Necessário para o aluno receber o código em tempo real quando o instrutor gera a sessão

-- Habilita REPLICA IDENTITY FULL para que eventos realtime incluam todos os campos
ALTER TABLE public.sessions REPLICA IDENTITY FULL;

-- Garante que code seja text (não integer) para evitar truncamento
ALTER TABLE public.sessions
  ALTER COLUMN code TYPE text USING lpad(code::text, 6, '0');

-- Adiciona constraint: código deve ter exatamente 6 dígitos numéricos
ALTER TABLE public.sessions
  DROP CONSTRAINT IF EXISTS sessions_code_format;
ALTER TABLE public.sessions
  ADD CONSTRAINT sessions_code_format CHECK (code ~ '^[0-9]{6}$');
