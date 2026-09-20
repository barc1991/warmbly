ALTER TABLE public.sessions
    DROP COLUMN IF EXISTS mfa_verified,
    DROP COLUMN IF EXISTS reauth_at;

ALTER TABLE public.user_totp_settings
    DROP COLUMN IF EXISTS last_used_step;
