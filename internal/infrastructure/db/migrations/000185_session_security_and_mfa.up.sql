-- Record whether a session proved a second factor, when it last re-proved, and remember spent TOTP steps.

ALTER TABLE public.sessions
    ADD COLUMN IF NOT EXISTS mfa_verified boolean NOT NULL DEFAULT false,
    ADD COLUMN IF NOT EXISTS reauth_at timestamptz;

COMMENT ON COLUMN public.sessions.mfa_verified IS
    'True when this session was established with a second factor: a TOTP code, a recovery code, or a passkey (which is itself multi-factor).';

COMMENT ON COLUMN public.sessions.reauth_at IS
    'When this session last re-proved the account holder (password, TOTP, recovery code or passkey). Read by RequireFreshAuth.';

ALTER TABLE public.user_totp_settings
    ADD COLUMN IF NOT EXISTS last_used_step bigint NOT NULL DEFAULT 0;

COMMENT ON COLUMN public.user_totp_settings.last_used_step IS
    'Highest TOTP time step already accepted for this user. A code at or below it is a replay and is refused.';
