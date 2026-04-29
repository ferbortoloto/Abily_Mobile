-- ============================================================
-- 1. Coluna plan_purchase_id em wallet_transactions
--    Permite somar/estornar todos os créditos de um plano de uma vez.
-- ============================================================
ALTER TABLE wallet_transactions
  ADD COLUMN IF NOT EXISTS plan_purchase_id UUID REFERENCES purchases(id) ON DELETE SET NULL;

-- ============================================================
-- 2. Trigger: credita o instrutor SOMENTE após sessão concluída
--    Cobre aulas avulsas E aulas de plano.
--    (substitui a versão da migration 053)
-- ============================================================
CREATE OR REPLACE FUNCTION credit_instructor_on_session_complete()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_class_request_id UUID;
  v_purchase_id      UUID;
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
  v_price_paid       DECIMAL;
  v_classes_total    INTEGER;
BEGIN
  -- Apenas na transição active → completed
  IF OLD.status <> 'active' OR NEW.status <> 'completed' THEN
    RETURN NEW;
  END IF;

  -- Resolve class_request_id: campo direto → evento → fallback avulsa
  v_class_request_id := NEW.class_request_id;

  IF v_class_request_id IS NULL AND NEW.event_id IS NOT NULL THEN
    SELECT class_request_id INTO v_class_request_id
    FROM events WHERE id = NEW.event_id;
  END IF;

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
    RETURN NEW;
  END IF;

  -- Taxa da plataforma (idêntica ao _shared/fees.ts)
  SELECT COALESCE(price_per_hour, 80) INTO v_price_per_hour
  FROM profiles WHERE id = NEW.instructor_id;

  v_fee_pct := GREATEST(0.10, 0.20 - FLOOR((v_price_per_hour - 80.0) / 10.0) * 0.01);

  -- ── Aula avulsa ─────────────────────────────────────────────────────────────
  SELECT id, price, payment_method
  INTO   v_avulsa_id, v_avulsa_price, v_payment_method
  FROM   avulsa_payments
  WHERE  class_request_id = v_class_request_id AND status = 'paid';

  IF v_avulsa_id IS NOT NULL THEN
    -- Guarda contra crédito duplo
    IF EXISTS (
      SELECT 1 FROM wallet_transactions
      WHERE reference_id = v_avulsa_id AND type = 'credit'
    ) THEN
      RETURN NEW;
    END IF;

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
  END IF;

  -- ── Aula de plano ────────────────────────────────────────────────────────────
  SELECT purchase_id INTO v_purchase_id
  FROM class_requests WHERE id = v_class_request_id;

  IF v_purchase_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- Guarda contra crédito duplo por sessão
  IF EXISTS (
    SELECT 1 FROM wallet_transactions
    WHERE reference_id = NEW.id AND type = 'credit'
  ) THEN
    RETURN NEW;
  END IF;

  SELECT price_paid, classes_total
  INTO   v_price_paid, v_classes_total
  FROM   purchases WHERE id = v_purchase_id;

  IF v_price_paid IS NULL OR v_classes_total IS NULL OR v_classes_total = 0 THEN
    RETURN NEW;
  END IF;

  -- Crédito proporcional: (price_paid * net_pct) / classes_total
  -- Sem min_fee por aula — a taxa Asaas foi absorvida na compra completa
  v_net_amount := ROUND(v_price_paid * (1.0 - v_fee_pct) / v_classes_total * 100.0) / 100.0;

  PERFORM increment_instructor_wallet(NEW.instructor_id, v_net_amount);

  INSERT INTO wallet_transactions (
    instructor_id, amount, gross_amount, platform_fee, fee_pct,
    type, description, reference_id, plan_purchase_id
  ) VALUES (
    NEW.instructor_id,
    v_net_amount,
    ROUND(v_price_paid / v_classes_total * 100.0) / 100.0,
    ROUND(v_price_paid * v_fee_pct / v_classes_total * 100.0) / 100.0,
    ROUND(v_fee_pct * 100.0 * 100.0) / 100.0,
    'credit',
    'Aula de plano concluída',
    NEW.id,
    v_purchase_id
  );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_credit_instructor_on_completion ON sessions;
CREATE TRIGGER trigger_credit_instructor_on_completion
  AFTER UPDATE ON sessions
  FOR EACH ROW
  EXECUTE FUNCTION credit_instructor_on_session_complete();
