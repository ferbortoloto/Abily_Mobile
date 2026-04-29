-- Vincula evento ao pedido de aula que o originou
-- Permite que o instrutor cancele corretamente com estorno automático
ALTER TABLE events ADD COLUMN IF NOT EXISTS class_request_id UUID REFERENCES class_requests(id) ON DELETE SET NULL;

-- Adiciona tipo 'debit' para registrar estornos da carteira do instrutor ao cancelar aulas
ALTER TABLE wallet_transactions DROP CONSTRAINT IF EXISTS wallet_transactions_type_check;
ALTER TABLE wallet_transactions ADD CONSTRAINT wallet_transactions_type_check
  CHECK (type IN ('credit', 'withdrawal', 'debit'));
