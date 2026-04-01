-- ══════════════════════════════════════════════════════════════
-- MEMBERSHIP STATE TRANSITIONS LOG
-- ══════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS membership_transitions (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id    UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  from_state    TEXT NOT NULL,
  to_state      TEXT NOT NULL,
  actor_id      UUID REFERENCES profiles(id),
  reason        TEXT,
  triggered_by  TEXT NOT NULL DEFAULT 'manual',
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_membership_transitions_student_id ON membership_transitions(student_id);
CREATE INDEX idx_membership_transitions_created_at ON membership_transitions(created_at);

ALTER TABLE membership_transitions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "membership_transitions_select" ON membership_transitions
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM students s
      JOIN profiles p ON p.gym_id = s.gym_id
      WHERE s.id = membership_transitions.student_id
        AND p.id = auth.uid()
    )
  );

CREATE POLICY "membership_transitions_insert" ON membership_transitions
  FOR INSERT WITH CHECK (true);