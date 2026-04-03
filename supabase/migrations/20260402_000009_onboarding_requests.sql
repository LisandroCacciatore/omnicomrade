-- Ledger persistente para idempotencia de onboarding
CREATE TABLE IF NOT EXISTS onboarding_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id UUID NOT NULL UNIQUE,
  gym_id UUID NOT NULL REFERENCES gyms(id) ON DELETE CASCADE,
  actor_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  payload_hash TEXT,
  status TEXT NOT NULL DEFAULT 'processing' CHECK (status IN ('processing', 'success', 'failed')),
  result_json JSONB,
  error_code TEXT,
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_onboarding_requests_gym_created
  ON onboarding_requests(gym_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_onboarding_requests_status
  ON onboarding_requests(status, updated_at DESC);
