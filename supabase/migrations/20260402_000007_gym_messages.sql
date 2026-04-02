-- Mensajería interna de staff a alumnos (log persistente)
CREATE TABLE IF NOT EXISTS gym_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  gym_id UUID NOT NULL REFERENCES gyms(id) ON DELETE CASCADE,
  sender_profile_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  target_type TEXT NOT NULL DEFAULT 'single' CHECK (target_type IN ('single', 'multiple')),
  recipient_student_ids UUID[] NOT NULL,
  recipient_count INTEGER NOT NULL DEFAULT 1 CHECK (recipient_count > 0),
  message TEXT NOT NULL CHECK (char_length(message) BETWEEN 1 AND 500),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_gym_messages_gym ON gym_messages(gym_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_gym_messages_sender ON gym_messages(sender_profile_id, created_at DESC);

ALTER TABLE gym_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "gym_messages_select" ON gym_messages
  FOR SELECT USING (
    gym_id = get_current_gym_id()
    AND get_current_role() IN ('gim_admin', 'profesor')
  );

CREATE POLICY "gym_messages_insert" ON gym_messages
  FOR INSERT WITH CHECK (
    gym_id = get_current_gym_id()
    AND sender_profile_id = auth.uid()
    AND get_current_role() IN ('gim_admin', 'profesor')
    AND recipient_count = cardinality(recipient_student_ids)
    AND NOT EXISTS (
      SELECT 1
      FROM unnest(recipient_student_ids) AS rid
      LEFT JOIN students s ON s.id = rid
      WHERE s.id IS NULL OR s.gym_id <> get_current_gym_id() OR s.deleted_at IS NOT NULL
    )
  );
