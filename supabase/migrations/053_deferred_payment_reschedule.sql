-- ============================================================
-- 1. Vincula sessão diretamente ao pedido de aula
--    (facilita lookup no trigger de crédito)
-- ============================================================
ALTER TABLE sessions
  ADD COLUMN IF NOT EXISTS class_request_id UUID REFERENCES class_requests(id) ON DELETE SET NULL;

-- ============================================================
-- 2. Campos de reagendamento na solicitação de aula
-- ============================================================
ALTER TABLE class_requests
  ADD COLUMN IF NOT EXISTS reschedule_requested BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS reschedule_date      DATE,
  ADD COLUMN IF NOT EXISTS reschedule_slots     TEXT[];

-- ============================================================
-- 3. Trigger: credita o instrutor SOMENTE após a aula concluída
--    (aula avulsa, quando session.status active → completed)
-- ============================================================
CREATE OR REPLACE FUNCTION credit_instructor_on_session_complete()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_class_request_id UUID;
  v_avulsa_id        UUID;
  v_avulsa_price     DECIMAL;
  v_payment_method   TEXT;
  v_price_per_hour   DECIMAL;
  v_fee_pct          DECIMAL;
  v_effective_amount DECIMAL;
  v_asaas_fee        DECIMAL;
  v_min_fee          DECIMAL;
  v_platform_fee     DECIMAL;
  v_net_amount       DECIMAL;
BEGIN
  -- Apenas na transição active → completed
  IF OLD.status <> 'active' OR NEW.status <> 'completed' THEN
    RETURN NEW;
  END IF;

  -- Localiza class_request_id: primeiro no campo da sessão, depois via evento
  v_class_request_id := NEW.class_request_id;

  IF v_class_request_id IS NULL AND NEW.event_id IS NOT NULL THEN
    SELECT class_request_id INTO v_class_request_id
    FROM events WHERE id = NEW.event_id;
  END IF;

  -- Fallback: pedido avulsa aceito mais recente para o par instrutor/aluno
  IF v_class_request_id IS NULL THEN
    SELECT id INTO v_class_request_id
    FROM class_requests
    WHERE instructor_id = NEW.instructor_id
      AND student_id    = NEW.student_id
      AND status        = 'accepted'
      AND is_avulsa     = TRUE
    ORDER BY created_at DESC
    LIMIT 1;
  END IF;

  IF v_class_request_id IS NULL THEN
    RETURN NEW; -- aula de plano, crédito já consumido no agendamento
  END IF;

  -- Busca pagamento avulsa pago (status = 'paid' = ainda não creditado/estornado)
  SELECT id, price, payment_method
  INTO   v_avulsa_id, v_avulsa_price, v_payment_method
  FROM   avulsa_payments
  WHERE  class_request_id = v_class_request_id AND status = 'paid';

  IF v_avulsa_id IS NULL THEN
    RETURN NEW; -- já creditado ou estornado anteriormente
  END IF;

  -- Calcula taxa da plataforma (espelha TypeScript em accept-avulsa)
  SELECT COALESCE(price_per_hour, 80) INTO v_price_per_hour
  FROM profiles WHERE id = NEW.instructor_id;

  v_fee_pct := GREATEST(0.10, 0.20 - FLOOR((v_price_per_hour - 80.0) / 10.0) * 0.01);

  IF v_payment_method = 'pix' THEN
    v_effective_amount := v_avulsa_price * 0.97;
    v_asaas_fee        := GREATEST(0.99, v_effective_amount * 0.0099);
  ELSIF v_payment_method = 'credit_card' THEN
    v_effective_amount := v_avulsa_price;
    v_asaas_fee        := 0.49 + v_effective_amount * 0.0299;
  ELSE -- boleto
    v_effective_amount := v_avulsa_price;
    v_asaas_fee        := 3.49;
  END IF;

  v_min_fee      := ROUND((12.0 + (v_avulsa_price - v_effective_amount) + v_asaas_fee) * 100.0) / 100.0;
  v_platform_fee := GREATEST(ROUND(v_avulsa_price * v_fee_pct * 100.0) / 100.0, v_min_fee);
  v_net_amount   := ROUND((v_avulsa_price - v_platform_fee) * 100.0) / 100.0;

  -- Credita carteira do instrutor
  PERFORM increment_instructor_wallet(NEW.instructor_id, v_net_amount);

  INSERT INTO wallet_transactions (
    instructor_id, amount, gross_amount, platform_fee, fee_pct,
    type, description, reference_id
  ) VALUES (
    NEW.instructor_id,
    v_net_amount,
    v_avulsa_price,
    v_platform_fee,
    ROUND(v_fee_pct * 100.0 * 100.0) / 100.0,
    'credit',
    'Aula avulsa concluída',
    v_avulsa_id
  );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_credit_instructor_on_completion ON sessions;
CREATE TRIGGER trigger_credit_instructor_on_completion
  AFTER UPDATE ON sessions
  FOR EACH ROW
  EXECUTE FUNCTION credit_instructor_on_session_complete();
