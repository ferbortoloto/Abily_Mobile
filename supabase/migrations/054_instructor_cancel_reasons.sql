-- ============================================================
-- Motivos de cancelamento pelo instrutor na class_request
-- ============================================================
ALTER TABLE class_requests
  ADD COLUMN IF NOT EXISTS cancellation_reason TEXT
    CHECK (cancellation_reason IN ('emergency', 'refused', 'student') OR cancellation_reason IS NULL);
