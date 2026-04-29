-- Remove class_requests duplicados em awaiting_payment, mantendo apenas o mais recente por par (student, instructor).
-- Isso limpa os registros de testes anteriores ao fix de idempotência.
DELETE FROM class_requests
WHERE status = 'awaiting_payment'
  AND id NOT IN (
    SELECT DISTINCT ON (student_id, instructor_id) id
    FROM class_requests
    WHERE status = 'awaiting_payment'
    ORDER BY student_id, instructor_id, created_at DESC
  );

-- Remove avulsa_payments sem class_request correspondente (órfãos do cleanup acima).
DELETE FROM avulsa_payments
WHERE status = 'pending_payment'
  AND class_request_id IS NOT NULL
  AND class_request_id NOT IN (SELECT id FROM class_requests);

-- Impede dois class_requests com status 'awaiting_payment' para o mesmo aluno+instrutor.
-- Bloqueia corridas de dados onde duas chamadas simultâneas à edge function
-- passam pela checagem de idempotência antes de qualquer uma gravar no banco.
CREATE UNIQUE INDEX IF NOT EXISTS class_requests_one_pending_per_pair
  ON class_requests (student_id, instructor_id)
  WHERE status = 'awaiting_payment';

-- Mesma proteção para purchases: impede dois planos pendentes para o mesmo aluno+plano.
CREATE UNIQUE INDEX IF NOT EXISTS purchases_one_pending_per_plan
  ON purchases (student_id, plan_id)
  WHERE status = 'pending_payment';
