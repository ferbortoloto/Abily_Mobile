-- Adiciona colunas de controle na wallet_transactions
ALTER TABLE wallet_transactions
  ADD COLUMN IF NOT EXISTS gross_amount    DECIMAL(10,2),
  ADD COLUMN IF NOT EXISTS platform_fee   DECIMAL(10,2),
  ADD COLUMN IF NOT EXISTS fee_pct        DECIMAL(5,2);

-- Adiciona asaas_transfer_id nos pedidos de saque (para rastrear a transferência)
ALTER TABLE withdrawal_requests
  ADD COLUMN IF NOT EXISTS asaas_transfer_id TEXT;
