-- Suporte à política de reembolso em 7 dias:
-- Adiciona coluna refund_requested_at e novo status 'refund_requested' em purchases.

-- 1. Remove o constraint existente de status (se existir) e adiciona o novo valor
ALTER TABLE purchases
  DROP CONSTRAINT IF EXISTS purchases_status_check;

ALTER TABLE purchases
  ADD CONSTRAINT purchases_status_check
  CHECK (status IN ('active', 'expired', 'refund_requested', 'refunded'));

-- 2. Coluna para registrar quando o reembolso foi solicitado
ALTER TABLE purchases
  ADD COLUMN IF NOT EXISTS refund_requested_at TIMESTAMPTZ;

-- 3. RPC para o aluno solicitar reembolso
--    Regras: compra feita há no máximo 7 dias E nenhuma aula utilizada
CREATE OR REPLACE FUNCTION request_purchase_refund(p_purchase_id UUID, p_student_id UUID)
RETURNS VOID AS $$
DECLARE
  v_purchase purchases%ROWTYPE;
BEGIN
  SELECT * INTO v_purchase
  FROM purchases
  WHERE id = p_purchase_id
    AND student_id = p_student_id
    AND status = 'active'
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Compra não encontrada ou não pertence ao usuário.';
  END IF;

  -- Verifica janela de 7 dias (CDC art. 49)
  IF v_purchase.purchased_at < NOW() - INTERVAL '7 days' THEN
    RAISE EXCEPTION 'O prazo de 7 dias para solicitar reembolso expirou.';
  END IF;

  -- Verifica que nenhuma aula foi utilizada
  IF v_purchase.classes_remaining < v_purchase.classes_total THEN
    RAISE EXCEPTION 'Não é possível solicitar reembolso após utilizar aulas do plano.';
  END IF;

  UPDATE purchases
  SET
    status              = 'refund_requested',
    refund_requested_at = NOW()
  WHERE id = p_purchase_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
