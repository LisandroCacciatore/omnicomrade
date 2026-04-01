-- ══════════════════════════════════════════════════════════════
-- ONBOARDING AUDIT LOG
-- ══════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS onboarding_audit (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id          UUID NOT NULL,
  gym_id              UUID NOT NULL REFERENCES gyms(id),
  actor_id            UUID REFERENCES profiles(id),
  student_id          UUID REFERENCES students(id),
  membership_id       UUID REFERENCES memberships(id),
  program_id          UUID REFERENCES student_programs(id),
  step                TEXT NOT NULL,
  status              TEXT NOT NULL CHECK (status IN ('success', 'error', 'in_progress')),
  data                JSONB,
  error_code          TEXT,
  error_message       TEXT,
  recoverable         BOOLEAN DEFAULT true,
  started_at          TIMESTAMPTZ,
  completed_at        TIMESTAMPTZ,
  duration_ms         INT,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_onboarding_audit_request_id ON onboarding_audit(request_id);
CREATE INDEX idx_onboarding_audit_gym_id    ON onboarding_audit(gym_id);
CREATE INDEX idx_onboarding_audit_student_id ON onboarding_audit(student_id);
CREATE INDEX idx_onboarding_audit_created_at ON onboarding_audit(created_at);

ALTER TABLE onboarding_audit ENABLE ROW LEVEL SECURITY;

CREATE POLICY "onboarding_audit_select" ON onboarding_audit
  FOR SELECT USING (gym_id = get_current_gym_id()
    AND get_current_role() IN ('gim_admin','profesor'));

CREATE POLICY "onboarding_audit_insert" ON onboarding_audit
  FOR INSERT WITH CHECK (gym_id = get_current_gym_id()
    AND get_current_role() IN ('gim_admin','profesor'));