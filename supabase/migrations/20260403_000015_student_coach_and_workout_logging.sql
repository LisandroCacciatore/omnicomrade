-- Deuda técnica: coach asignado, timestamp de logs por set y alerta de patrón wellbeing
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
