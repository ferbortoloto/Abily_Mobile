-- Coluna que registra a escolha do aluno após interrupção de emergência pelo instrutor.
-- NULL = aluno ainda não decidiu (modal será exibido ao abrir o app)
ALTER TABLE public.sessions
  ADD COLUMN IF NOT EXISTS student_resolution TEXT
    CHECK (student_resolution IN ('refund', 'reschedule'));
