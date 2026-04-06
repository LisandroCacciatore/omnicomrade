-- Evita errores de FK en historial de planes cuando auth.uid() no existe en profiles.
CREATE OR REPLACE FUNCTION trg_gmp_track_amount_change()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_changed_by UUID;
BEGIN
  v_changed_by := auth.uid();

  IF v_changed_by IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM profiles p WHERE p.id = v_changed_by
  ) THEN
    v_changed_by := NULL;
  END IF;

  IF TG_OP = 'INSERT' THEN
    INSERT INTO gym_membership_plan_history (gym_id, plan_key, old_amount, new_amount, changed_by, source)
    VALUES (NEW.gym_id, NEW.plan_key, NULL, NEW.amount, v_changed_by, 'trigger_insert');
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE' AND (NEW.amount IS DISTINCT FROM OLD.amount) THEN
    INSERT INTO gym_membership_plan_history (gym_id, plan_key, old_amount, new_amount, changed_by, source)
    VALUES (NEW.gym_id, NEW.plan_key, OLD.amount, NEW.amount, v_changed_by, 'trigger_update');
  END IF;

  RETURN NEW;
END;
$$;
