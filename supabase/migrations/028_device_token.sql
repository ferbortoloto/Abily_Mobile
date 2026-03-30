-- Controle de sessão por dispositivo (um aparelho por vez).
-- device_token é gerado no cliente ao fazer login e salvo aqui.
-- Se outro dispositivo logar, sobrescreve o token → app anterior detecta mismatch e faz logout.
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS device_token text DEFAULT NULL;
