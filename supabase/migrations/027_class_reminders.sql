-- Adiciona coluna para rastrear envio de lembrete de aula
ALTER TABLE events
  ADD COLUMN IF NOT EXISTS reminder_sent_at timestamptz DEFAULT NULL;

-- Índice para a Edge Function encontrar eventos próximos eficientemente
CREATE INDEX IF NOT EXISTS idx_events_reminder
  ON events (status, start_datetime, reminder_sent_at)
  WHERE status = 'scheduled';
