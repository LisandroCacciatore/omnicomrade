-- Centraliza cálculo de estado de membresía y automatiza updates en students
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
