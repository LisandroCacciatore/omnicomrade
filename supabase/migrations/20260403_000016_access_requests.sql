-- Invite-only OAuth funnel (cupo limitado)
CREATE TABLE IF NOT EXISTS access_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL,
  email_normalized TEXT GENERATED ALWAYS AS (lower(email)) STORED,
  full_name TEXT,
  source TEXT NOT NULL DEFAULT 'landing_form',
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  role TEXT NOT NULL DEFAULT 'alumno' CHECK (role IN ('alumno', 'profesor', 'gim_admin')),
  gym_id UUID REFERENCES gyms(id) ON DELETE SET NULL,
  notes TEXT,
  requested_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  approved_at TIMESTAMPTZ,
  approved_by UUID REFERENCES profiles(id) ON DELETE SET NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_access_requests_email_unique
  ON access_requests (email_normalized);

CREATE INDEX IF NOT EXISTS idx_access_requests_status_requested
  ON access_requests(status, requested_at DESC);
