-- ============================================================
-- Interrupção de emergência durante a aula.
-- Casos: carro/moto quebrou, acidente, emergência pessoal, etc.
-- O instrutor decide se devolve o crédito ao aluno.
-- Regra padrão: < 50 % da aula concluída → devolve crédito.
-- ============================================================

-- 1. Colunas de incidente
ALTER TABLE public.sessions
  ADD COLUMN IF NOT EXISTS incident_reason  text,
  ADD COLUMN IF NOT EXISTS credit_refunded  boolean DEFAULT false;

-- 2. Atualiza constraint de status para incluir 'interrupted'
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
  CHECK (status IN (
    'pending', 'active', 'completed', 'missed',
    'student_no_show', 'instructor_no_show', 'interrupted'
  ));

-- 3. Função principal: registra interrupção e, opcionalmente, devolve crédito
CREATE OR REPLACE FUNCTION public.interrupt_session(
  p_session_id    uuid,
  p_reason        text,
  p_refund_credit boolean DEFAULT true
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_instructor_id uuid;
  v_student_id    uuid;
BEGIN
  UPDATE sessions
    SET status          = 'interrupted',
        ended_at        = now(),
        incident_reason = p_reason,
        credit_refunded = p_refund_credit
  WHERE id = p_session_id
    AND status = 'active'
  RETURNING instructor_id, student_id
    INTO v_instructor_id, v_student_id;

  IF NOT FOUND THEN RETURN; END IF;

  IF p_refund_credit THEN
    UPDATE purchases
      SET classes_remaining = classes_remaining + 1,
          status = CASE WHEN status = 'expired' THEN 'active' ELSE status END
      WHERE id = (
        SELECT purchase_id FROM class_requests
        WHERE instructor_id = v_instructor_id
          AND student_id    = v_student_id
          AND status        = 'accepted'
          AND purchase_id   IS NOT NULL
        ORDER BY created_at DESC
        LIMIT 1
      );
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.interrupt_session(uuid, text, boolean)
  TO service_role, authenticated;
