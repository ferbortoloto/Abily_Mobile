-- Tabela para rastrear pagamentos de aulas avulsas (sem plano).
-- Armazena os dados da solicitação até o pagamento ser confirmado.

CREATE TABLE IF NOT EXISTS avulsa_payments (
  id                 UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  student_id         UUID        REFERENCES profiles(id) NOT NULL,
  instructor_id      UUID        REFERENCES profiles(id) NOT NULL,
  price              NUMERIC(10,2) NOT NULL,
  asaas_payment_id   TEXT,
  payment_method     TEXT        CHECK (payment_method IN ('pix', 'credit_card', 'boleto')),
  status             TEXT        DEFAULT 'pending_payment'
                                 CHECK (status IN ('pending_payment', 'paid', 'refunded')),
  pix_qrcode         TEXT,
  pix_copy_paste     TEXT,
  boleto_url         TEXT,
  boleto_barcode     TEXT,
  invoice_url        TEXT,
  -- Dados da solicitação de aula, criada no banco quando o pagamento for confirmado
  request_data       JSONB       NOT NULL,
  created_at         TIMESTAMPTZ DEFAULT NOW()
);

-- RLS: aluno só vê os seus próprios pagamentos
ALTER TABLE avulsa_payments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "student_own_avulsa" ON avulsa_payments
  FOR ALL USING (student_id = auth.uid());
