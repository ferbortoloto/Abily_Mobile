-- Trigger: ao cancelar uma aula que já estava 'accepted' e vinculada a um plano,
-- devolve automaticamente 1 crédito ao purchases (estorno de aula).
CREATE OR REPLACE FUNCTION refund_credit_on_cancel()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.status = 'accepted'
     AND NEW.status = 'cancelled'
     AND NEW.purchase_id IS NOT NULL
  THEN
    UPDATE purchases
    SET
      classes_remaining = classes_remaining + 1,
      status = CASE
                 WHEN status = 'expired' THEN 'active'
                 ELSE status
               END
    WHERE id = NEW.purchase_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trigger_refund_credit_on_cancel ON class_requests;

CREATE TRIGGER trigger_refund_credit_on_cancel
  AFTER UPDATE ON class_requests
  FOR EACH ROW
  EXECUTE FUNCTION refund_credit_on_cancel();
