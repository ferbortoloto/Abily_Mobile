-- Corrige constraint de status em purchases e avulsa_payments
-- para incluir todos os estados possíveis (pending_payment, cancelled)

ALTER TABLE purchases
  DROP CONSTRAINT IF EXISTS purchases_status_check;

ALTER TABLE purchases
  ADD CONSTRAINT purchases_status_check
  CHECK (status IN (
    'pending_payment',
    'active',
    'expired',
    'refund_requested',
    'refunded',
    'cancelled'
  ));

-- Garante coluna payment_method acessível
ALTER TABLE purchases
  ADD COLUMN IF NOT EXISTS payment_method TEXT;

-- avulsa_payments: adiciona status cancelled
ALTER TABLE avulsa_payments
  DROP CONSTRAINT IF EXISTS avulsa_payments_status_check;

ALTER TABLE avulsa_payments
  ADD CONSTRAINT avulsa_payments_status_check
  CHECK (status IN (
    'pending_payment',
    'paid',
    'cancelled',
    'refunded'
  ));
