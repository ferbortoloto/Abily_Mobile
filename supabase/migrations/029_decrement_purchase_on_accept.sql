-- Trigger: ao instrutor aceitar uma solicitação vinculada a um plano,
-- decrementa automaticamente classes_remaining no purchases.
CREATE OR REPLACE FUNCTION decrement_purchase_on_accept()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'accepted'
     AND OLD.status IS DISTINCT FROM 'accepted'
     AND NEW.purchase_id IS NOT NULL
  THEN
    UPDATE purchases
    SET
      classes_remaining = GREATEST(classes_remaining - 1, 0),
      status = CASE
                 WHEN classes_remaining - 1 <= 0 THEN 'expired'
                 ELSE status
               END
    WHERE id = NEW.purchase_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trigger_decrement_purchase_on_accept ON class_requests;

CREATE TRIGGER trigger_decrement_purchase_on_accept
  AFTER UPDATE ON class_requests
  FOR EACH ROW
  EXECUTE FUNCTION decrement_purchase_on_accept();
