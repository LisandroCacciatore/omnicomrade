-- Orquestación backend para flujo de entrenamiento
CREATE TABLE IF NOT EXISTS workout_intents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  gym_id UUID NOT NULL REFERENCES gyms(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  initiated_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  routine_name TEXT,
  day_name TEXT,
  source_payload JSONB,
  wellbeing_payload JSONB,
  status TEXT NOT NULL DEFAULT 'created' CHECK (status IN ('created', 'wellbeing_done', 'started', 'completed', 'expired', 'cancelled')),
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '12 hours'),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_workout_intents_student_created
  ON workout_intents(student_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_workout_intents_gym_status
  ON workout_intents(gym_id, status, created_at DESC);

CREATE TABLE IF NOT EXISTS workout_intent_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  intent_id UUID NOT NULL REFERENCES workout_intents(id) ON DELETE CASCADE,
  gym_id UUID NOT NULL REFERENCES gyms(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,
  actor_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  payload JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_workout_intent_events_intent
  ON workout_intent_events(intent_id, created_at ASC);
