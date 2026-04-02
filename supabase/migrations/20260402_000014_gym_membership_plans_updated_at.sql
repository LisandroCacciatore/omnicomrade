-- Actualiza updated_at automáticamente en gym_membership_plans
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
