-- Adiciona campos de pagamento avulso na solicitação de aula
ALTER TABLE class_requests
  ADD COLUMN IF NOT EXISTS is_avulsa      BOOLEAN   DEFAULT false,
  ADD COLUMN IF NOT EXISTS payment_method TEXT,
  ADD COLUMN IF NOT EXISTS avulsa_price   DECIMAL(10,2);

-- Liga avulsa_payments a uma class_request existente (quando pagamento é gerado após aceitação)
ALTER TABLE avulsa_payments
  ADD COLUMN IF NOT EXISTS class_request_id UUID REFERENCES class_requests(id) ON DELETE SET NULL;

-- Adiciona awaiting_payment como status válido para class_requests
ALTER TABLE class_requests
  DROP CONSTRAINT IF EXISTS class_requests_status_check;

ALTER TABLE class_requests
  ADD CONSTRAINT class_requests_status_check
  CHECK (status IN ('pending','awaiting_payment','accepted','rejected','cancelled','completed'));
