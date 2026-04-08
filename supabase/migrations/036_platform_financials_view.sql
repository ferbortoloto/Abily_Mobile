-- View de resumo financeiro da plataforma
-- Mostra em tempo real: quanto pertence a instrutores vs lucro da empresa
CREATE OR REPLACE VIEW platform_financials AS
SELECT
  -- Total acumulado em taxas (lucro bruto da plataforma)
  COALESCE(SUM(t.platform_fee), 0)                          AS total_platform_fees,

  -- Total que ainda está "preso" como saldo dos instrutores (dívida da empresa)
  COALESCE((SELECT SUM(wallet_balance) FROM profiles WHERE role = 'instructor'), 0) AS total_instructor_wallets,

  -- Quantos saques já foram processados (saíram da conta Asaas)
  COALESCE((
    SELECT SUM(amount)
    FROM withdrawal_requests
    WHERE status IN ('processing', 'paid')
  ), 0)                                                      AS total_withdrawn,

  -- Lucro já "realizado" (taxas de aulas cujo saldo o instrutor já sacou)
  COALESCE(SUM(t.platform_fee) FILTER (
    WHERE EXISTS (
      SELECT 1 FROM withdrawal_requests w
      WHERE w.instructor_id = t.instructor_id
        AND w.status IN ('processing', 'paid')
    )
  ), 0)                                                      AS realized_profit,

  COUNT(DISTINCT t.instructor_id)                            AS active_instructors,
  COUNT(*)                                                   AS total_transactions

FROM wallet_transactions t
WHERE t.type = 'credit' AND t.platform_fee IS NOT NULL;

-- Acesso apenas para service_role (não exposto ao app)
REVOKE ALL ON platform_financials FROM anon, authenticated;
