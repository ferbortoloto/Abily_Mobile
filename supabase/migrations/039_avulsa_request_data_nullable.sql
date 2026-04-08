-- No novo fluxo avulsa, o class_request é criado antes do pagamento,
-- então request_data não é mais necessário (substituído por class_request_id).
ALTER TABLE avulsa_payments
  ALTER COLUMN request_data DROP NOT NULL;
