-- Historial de cambios de precio para planes por gimnasio
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
