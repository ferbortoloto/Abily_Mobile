-- ============================================================
-- Prazo de resposta para solicitações de aula: 24 horas.
-- Após esse prazo sem aceite/recusa, o status muda para
-- 'expired' automaticamente via pg_cron (a cada 15 min).
-- ============================================================

-- 1. Adiciona coluna expires_at
ALTER TABLE public.class_requests
  ADD COLUMN IF NOT EXISTS expires_at timestamptz
    DEFAULT (now() + interval '24 hours');

-- 2. Preenche linhas existentes que ainda estejam pendentes e sem prazo
UPDATE public.class_requests
  SET expires_at = created_at + interval '24 hours'
  WHERE expires_at IS NULL
    AND status = 'pending';

-- 3. Coluna para evitar notificação duplicada
ALTER TABLE public.class_requests
  ADD COLUMN IF NOT EXISTS expiry_notified_at timestamptz DEFAULT NULL;

-- 4. Função chamada pelo cron — marca como expiradas e retorna a contagem
CREATE OR REPLACE FUNCTION public.expire_stale_requests()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  expired_count integer;
BEGIN
  UPDATE public.class_requests
    SET status = 'expired'
    WHERE status = 'pending'
      AND expires_at IS NOT NULL
      AND expires_at < now();

  GET DIAGNOSTICS expired_count = ROW_COUNT;
  RETURN expired_count;
END;
$$;

GRANT EXECUTE ON FUNCTION public.expire_stale_requests() TO service_role;

-- 5. Ativa extensões necessárias
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- 6. Agenda expiração a cada 15 minutos
SELECT cron.unschedule('expire-stale-requests') WHERE EXISTS (
  SELECT 1 FROM cron.job WHERE jobname = 'expire-stale-requests'
);
SELECT cron.schedule(
  'expire-stale-requests',
  '*/15 * * * *',
  $$ SELECT public.expire_stale_requests(); $$
);

-- 7. Agenda notificação de expiração a cada 15 minutos (logo após a expiração)
--    Chama a edge function notify-expired-requests via HTTP
SELECT cron.unschedule('notify-expired-requests') WHERE EXISTS (
  SELECT 1 FROM cron.job WHERE jobname = 'notify-expired-requests'
);
SELECT cron.schedule(
  'notify-expired-requests',
  '*/15 * * * *',
  $$
    SELECT net.http_post(
      url    := current_setting('app.supabase_url') || '/functions/v1/notify-expired-requests',
      headers := jsonb_build_object(
        'Content-Type',  'application/json',
        'Authorization', 'Bearer ' || current_setting('app.service_role_key')
      ),
      body   := '{}'::jsonb
    );
  $$
);
