-- One-shot SQL bundle (idempotent) for current backend rollout
-- Includes: messaging, plans, onboarding ledger, workout intents,
-- membership automation, progress indexes, plan history, logging upgrades,
-- and invite-only access funnel.

BEGIN;

-- =========================================================
-- gym_messages
-- =========================================================
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
DROP POLICY IF EXISTS "gym_messages_select" ON gym_messages;
CREATE POLICY "gym_messages_select" ON gym_messages
  FOR SELECT USING (
    gym_id = get_current_gym_id()
    AND get_current_role() IN ('gim_admin', 'profesor')
  );

DROP POLICY IF EXISTS "gym_messages_insert" ON gym_messages;
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

-- =========================================================
-- gym_membership_plans
-- =========================================================
CREATE TABLE IF NOT EXISTS gym_membership_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  gym_id UUID NOT NULL REFERENCES gyms(id) ON DELETE CASCADE,
  plan_key TEXT NOT NULL CHECK (plan_key IN ('mensual','trimestral','anual')),
  label TEXT NOT NULL,
  duration_days INTEGER NOT NULL CHECK (duration_days > 0),
  amount NUMERIC(10,2) NOT NULL CHECK (amount >= 0),
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (gym_id, plan_key)
);

CREATE INDEX IF NOT EXISTS idx_gym_membership_plans_gym ON gym_membership_plans(gym_id);

ALTER TABLE gym_membership_plans ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "gym_membership_plans_select" ON gym_membership_plans;
CREATE POLICY "gym_membership_plans_select" ON gym_membership_plans
  FOR SELECT USING (gym_id = get_current_gym_id());

DROP POLICY IF EXISTS "gym_membership_plans_insert" ON gym_membership_plans;
CREATE POLICY "gym_membership_plans_insert" ON gym_membership_plans
  FOR INSERT WITH CHECK (
    gym_id = get_current_gym_id()
    AND get_current_role() IN ('gim_admin','profesor')
  );

DROP POLICY IF EXISTS "gym_membership_plans_update" ON gym_membership_plans;
CREATE POLICY "gym_membership_plans_update" ON gym_membership_plans
  FOR UPDATE USING (
    gym_id = get_current_gym_id()
    AND get_current_role() IN ('gim_admin','profesor')
  );

-- =========================================================
-- onboarding requests ledger
-- =========================================================
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

-- =========================================================
-- workout intents + events
-- =========================================================
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

-- =========================================================
-- membership automation
-- =========================================================
CREATE OR REPLACE FUNCTION fn_membership_compute_status(p_end_date DATE)
RETURNS TEXT
LANGUAGE plpgsql
AS $$
DECLARE
  v_today DATE := (NOW() AT TIME ZONE 'America/Argentina/Buenos_Aires')::DATE;
BEGIN
  IF p_end_date IS NULL THEN
    RETURN 'pendiente';
  END IF;

  IF p_end_date < v_today THEN
    RETURN 'vencida';
  END IF;

  IF p_end_date <= (v_today + 7) THEN
    RETURN 'por_vencer';
  END IF;

  RETURN 'activa';
END;
$$;

CREATE OR REPLACE FUNCTION fn_membership_recompute_student(p_student_id UUID)
RETURNS TEXT
LANGUAGE plpgsql
AS $$
DECLARE
  v_latest_end DATE;
  v_new_status TEXT;
BEGIN
  SELECT m.end_date
  INTO v_latest_end
  FROM memberships m
  WHERE m.student_id = p_student_id
  ORDER BY m.end_date DESC NULLS LAST
  LIMIT 1;

  v_new_status := fn_membership_compute_status(v_latest_end);

  UPDATE students
  SET membership_status = v_new_status,
      updated_at = NOW()
  WHERE id = p_student_id;

  RETURN v_new_status;
END;
$$;

CREATE OR REPLACE FUNCTION trg_membership_recompute_student()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_student_id UUID;
BEGIN
  v_student_id := COALESCE(NEW.student_id, OLD.student_id);
  PERFORM fn_membership_recompute_student(v_student_id);
  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS trg_memberships_recompute_status ON memberships;
CREATE TRIGGER trg_memberships_recompute_status
AFTER INSERT OR UPDATE OR DELETE ON memberships
FOR EACH ROW
EXECUTE FUNCTION trg_membership_recompute_student();

CREATE OR REPLACE FUNCTION rpc_membership_recompute_student(p_student_id UUID)
RETURNS TEXT
LANGUAGE SQL
AS $$
  SELECT fn_membership_recompute_student(p_student_id);
$$;

CREATE OR REPLACE FUNCTION rpc_membership_recompute_gym(p_gym_id UUID)
RETURNS INTEGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_count INTEGER := 0;
  v_row RECORD;
BEGIN
  FOR v_row IN
    SELECT id FROM students WHERE gym_id = p_gym_id AND deleted_at IS NULL
  LOOP
    PERFORM fn_membership_recompute_student(v_row.id);
    v_count := v_count + 1;
  END LOOP;

  RETURN v_count;
END;
$$;

-- =========================================================
-- progress indexes
-- =========================================================
CREATE INDEX IF NOT EXISTS idx_workout_sessions_student_completed
  ON workout_sessions(student_id, completed_at DESC);
CREATE INDEX IF NOT EXISTS idx_workout_logs_session_exercise
  ON workout_exercise_logs(session_id, exercise_name);

-- =========================================================
-- membership plan history + updated_at trigger
-- =========================================================
CREATE TABLE IF NOT EXISTS gym_membership_plan_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  gym_id UUID NOT NULL REFERENCES gyms(id) ON DELETE CASCADE,
  plan_key TEXT NOT NULL,
  old_amount NUMERIC(10,2),
  new_amount NUMERIC(10,2) NOT NULL,
  changed_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  source TEXT NOT NULL DEFAULT 'system',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_gmph_gym_plan_created
  ON gym_membership_plan_history(gym_id, plan_key, created_at DESC);

CREATE OR REPLACE FUNCTION trg_gmp_track_amount_change()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO gym_membership_plan_history (gym_id, plan_key, old_amount, new_amount, changed_by, source)
    VALUES (NEW.gym_id, NEW.plan_key, NULL, NEW.amount, auth.uid(), 'trigger_insert');
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE' AND (NEW.amount IS DISTINCT FROM OLD.amount) THEN
    INSERT INTO gym_membership_plan_history (gym_id, plan_key, old_amount, new_amount, changed_by, source)
    VALUES (NEW.gym_id, NEW.plan_key, OLD.amount, NEW.amount, auth.uid(), 'trigger_update');
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_gmp_amount_history ON gym_membership_plans;
CREATE TRIGGER trg_gmp_amount_history
AFTER INSERT OR UPDATE ON gym_membership_plans
FOR EACH ROW
EXECUTE FUNCTION trg_gmp_track_amount_change();

CREATE OR REPLACE FUNCTION trg_set_updated_at_gym_membership_plans()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at := NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_set_updated_at_gmp ON gym_membership_plans;
CREATE TRIGGER trg_set_updated_at_gmp
BEFORE UPDATE ON gym_membership_plans
FOR EACH ROW
EXECUTE FUNCTION trg_set_updated_at_gym_membership_plans();

-- =========================================================
-- coach assignment + set logging + wellbeing alert pattern
-- =========================================================
ALTER TABLE students
  ADD COLUMN IF NOT EXISTS coach_id UUID REFERENCES profiles(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_students_coach_id ON students(coach_id);

ALTER TABLE workout_exercise_logs
  ADD COLUMN IF NOT EXISTS logged_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

CREATE INDEX IF NOT EXISTS idx_workout_logs_session_logged_at
  ON workout_exercise_logs(session_id, logged_at);

CREATE OR REPLACE FUNCTION trg_wellbeing_pattern_alert()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_pain_streak INT;
BEGIN
  NEW.pattern_alert := NULL;

  IF COALESCE(NEW.pain, 0) < 4 THEN
    RETURN NEW;
  END IF;

  SELECT COUNT(*)
    INTO v_pain_streak
  FROM wellbeing_logs wl
  WHERE wl.student_id = NEW.student_id
    AND wl.check_date BETWEEN (NEW.check_date - INTERVAL '2 days')::date AND NEW.check_date
    AND wl.pain >= 4;

  IF v_pain_streak >= 3 THEN
    NEW.pattern_alert := 'dolor_sostenido_3d';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_wellbeing_pattern_alert ON wellbeing_logs;
CREATE TRIGGER trg_wellbeing_pattern_alert
BEFORE INSERT OR UPDATE ON wellbeing_logs
FOR EACH ROW
EXECUTE FUNCTION trg_wellbeing_pattern_alert();

-- =========================================================
-- invite-only access requests
-- =========================================================
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

COMMIT;
