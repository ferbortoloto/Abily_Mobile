-- Saldo na carteira do instrutor
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS wallet_balance DECIMAL(10,2) DEFAULT 0;

-- Histórico de transações da carteira
CREATE TABLE IF NOT EXISTS wallet_transactions (
  id            UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  instructor_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  amount        DECIMAL(10,2) NOT NULL,
  type          TEXT NOT NULL CHECK (type IN ('credit', 'withdrawal')),
  description   TEXT,
  reference_id  UUID,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE wallet_transactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "instructors_see_own_transactions" ON wallet_transactions
  FOR SELECT USING (instructor_id = auth.uid());

-- Pedidos de saque
CREATE TABLE IF NOT EXISTS withdrawal_requests (
  id            UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  instructor_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  amount        DECIMAL(10,2) NOT NULL,
  bank_info     JSONB NOT NULL,
  status        TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'paid', 'rejected')),
  notes         TEXT,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE withdrawal_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "instructors_manage_own_withdrawals" ON withdrawal_requests
  FOR ALL USING (instructor_id = auth.uid());

-- Função para incrementar saldo atomicamente (evita race condition)
CREATE OR REPLACE FUNCTION increment_instructor_wallet(
  p_instructor_id UUID,
  p_amount        DECIMAL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE profiles
  SET wallet_balance = GREATEST(0, COALESCE(wallet_balance, 0) + p_amount)
  WHERE id = p_instructor_id;
END;
$$;
