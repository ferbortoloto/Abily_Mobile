-- ============================================================
-- Detecção automática de no-show para sessões de aula.
-- Regras (disparadas 15 min após o horário agendado):
--   - Instrutor confirmou presença, aluno não → student_no_show  (crédito consumido)
--   - Aluno confirmou chegada, instrutor não  → instructor_no_show (crédito devolvido)
--   - Nenhum confirmou                        → missed            (crédito devolvido)
-- ============================================================

-- 1. Colunas de check-in
ALTER TABLE public.sessions
  ADD COLUMN IF NOT EXISTS instructor_checked_in_at timestamptz,
  ADD COLUMN IF NOT EXISTS student_checked_in_at    timestamptz;

-- 2. Atualiza constraint de status para incluir os novos valores
DO $$
DECLARE con_name text;
BEGIN
  SELECT constraint_name INTO con_name
  FROM information_schema.table_constraints
  WHERE table_name    = 'sessions'
    AND constraint_type = 'CHECK'
    AND constraint_name ILIKE '%status%';
  IF con_name IS NOT NULL THEN
    EXECUTE format('ALTER TABLE public.sessions DROP CONSTRAINT %I', con_name);
  END IF;
END $$;

ALTER TABLE public.sessions
  ADD CONSTRAINT sessions_status_check
  CHECK (status IN ('pending', 'active', 'completed', 'missed', 'student_no_show', 'instructor_no_show'));

-- 3. Função principal: detecta sessões pendentes 15 min após o horário e classifica
CREATE OR REPLACE FUNCTION public.detect_no_shows()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  rec   RECORD;
  total integer := 0;
BEGIN
  FOR rec IN
    SELECT id, instructor_id, student_id,
           instructor_checked_in_at, student_checked_in_at
    FROM   sessions
    WHERE  status              = 'pending'
      AND  scheduled_start_at IS NOT NULL
      AND  scheduled_start_at + interval '15 minutes' < now()
  LOOP

    IF rec.instructor_checked_in_at IS NOT NULL
       AND rec.student_checked_in_at IS NULL THEN
      -- Instrutor estava lá, aluno não → crédito consumido
      UPDATE sessions SET status = 'student_no_show' WHERE id = rec.id;

    ELSIF rec.student_checked_in_at IS NOT NULL
          AND rec.instructor_checked_in_at IS NULL THEN
      -- Aluno estava lá, instrutor não → devolver crédito
      UPDATE sessions SET status = 'instructor_no_show' WHERE id = rec.id;

      UPDATE purchases
        SET classes_remaining = classes_remaining + 1,
            status = CASE WHEN status = 'expired' THEN 'active' ELSE status END
        WHERE id = (
          SELECT purchase_id FROM class_requests
          WHERE instructor_id = rec.instructor_id
            AND student_id    = rec.student_id
            AND status        = 'accepted'
            AND purchase_id   IS NOT NULL
          ORDER BY created_at DESC
          LIMIT 1
        );

    ELSE
      -- Nenhum apareceu (ou ambos, o que não deve ocorrer) → benefício da dúvida
      UPDATE sessions SET status = 'missed' WHERE id = rec.id;

      UPDATE purchases
        SET classes_remaining = classes_remaining + 1,
            status = CASE WHEN status = 'expired' THEN 'active' ELSE status END
        WHERE id = (
          SELECT purchase_id FROM class_requests
          WHERE instructor_id = rec.instructor_id
            AND student_id    = rec.student_id
            AND status        = 'accepted'
            AND purchase_id   IS NOT NULL
          ORDER BY created_at DESC
          LIMIT 1
        );
    END IF;

    total := total + 1;
  END LOOP;

  RETURN total;
END;
$$;

GRANT EXECUTE ON FUNCTION public.detect_no_shows() TO service_role;

-- 4. RPC auxiliar: retorna pagamentos avulsa pendentes de estorno
--    (usada pela edge function refund-no-show-avulsa)
CREATE OR REPLACE FUNCTION public.get_avulsa_no_show_refunds()
RETURNS TABLE (
  avulsa_payment_id uuid,
  asaas_payment_id  text,
  student_id        uuid,
  push_token        text,
  session_status    text
)
LANGUAGE sql
SECURITY DEFINER SET search_path = public
AS $$
  SELECT DISTINCT ON (ap.id)
    ap.id              AS avulsa_payment_id,
    ap.asaas_payment_id,
    ap.student_id,
    p.push_token,
    s.status           AS session_status
  FROM avulsa_payments ap
  JOIN sessions s ON (
    s.instructor_id = ap.instructor_id
    AND s.student_id = ap.student_id
    AND s.status IN ('instructor_no_show', 'missed')
  )
  LEFT JOIN profiles p ON p.id = ap.student_id
  WHERE ap.status = 'paid'
  ORDER BY ap.id, s.created_at DESC;
$$;

GRANT EXECUTE ON FUNCTION public.get_avulsa_no_show_refunds() TO service_role;

-- 5. Agenda detecção de no-show a cada 5 minutos
SELECT cron.unschedule('detect-no-shows') WHERE EXISTS (
  SELECT 1 FROM cron.job WHERE jobname = 'detect-no-shows'
);
SELECT cron.schedule(
  'detect-no-shows',
  '*/5 * * * *',
  $$ SELECT public.detect_no_shows(); $$
);

-- 6. Agenda reembolso avulsa a cada 5 minutos (logo após detect-no-shows)
SELECT cron.unschedule('refund-no-show-avulsa') WHERE EXISTS (
  SELECT 1 FROM cron.job WHERE jobname = 'refund-no-show-avulsa'
);
SELECT cron.schedule(
  'refund-no-show-avulsa',
  '*/5 * * * *',
  $$
    SELECT net.http_post(
      url     := current_setting('app.supabase_url') || '/functions/v1/refund-no-show-avulsa',
      headers := jsonb_build_object(
        'Content-Type',  'application/json',
        'Authorization', 'Bearer ' || current_setting('app.service_role_key')
      ),
      body    := '{}'::jsonb
    );
  $$
);
