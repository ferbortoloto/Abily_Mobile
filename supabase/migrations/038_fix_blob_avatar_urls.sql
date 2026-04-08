-- Remove URLs de blob inválidas salvas como avatar_url.
-- Blob URLs (blob:http://...) são temporárias e inválidas após a sessão do browser.
UPDATE profiles
SET avatar_url = NULL
WHERE avatar_url LIKE 'blob:%';
