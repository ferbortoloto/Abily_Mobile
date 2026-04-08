-- Integração com Asaas: campos de pagamento em purchases e customer_id em profiles

-- 1. Atualiza o constraint de status para incluir pending_payment
ALTER TABLE purchases
  DROP CONSTRAINT IF EXISTS purchases_status_check;

ALTER TABLE purchases
  ADD CONSTRAINT purchases_status_check
  CHECK (status IN ('pending_payment', 'active', 'expired', 'refund_requested', 'refunded'));

-- 2. Campos de pagamento Asaas em purchases
ALTER TABLE purchases
  ADD COLUMN IF NOT EXISTS asaas_payment_id  TEXT,
  ADD COLUMN IF NOT EXISTS payment_method    TEXT CHECK (payment_method IN ('pix', 'credit_card', 'boleto')),
  ADD COLUMN IF NOT EXISTS pix_qrcode        TEXT,
  ADD COLUMN IF NOT EXISTS pix_copy_paste    TEXT,
  ADD COLUMN IF NOT EXISTS boleto_url        TEXT,
  ADD COLUMN IF NOT EXISTS boleto_barcode    TEXT,
  ADD COLUMN IF NOT EXISTS invoice_url       TEXT;

-- 3. ID do cliente Asaas em profiles (reutilizado em todas as compras)
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS asaas_customer_id TEXT;
