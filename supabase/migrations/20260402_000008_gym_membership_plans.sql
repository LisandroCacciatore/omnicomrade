-- Catálogo de planes de membresía por gimnasio
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

CREATE POLICY "gym_membership_plans_select" ON gym_membership_plans
  FOR SELECT USING (gym_id = get_current_gym_id());

CREATE POLICY "gym_membership_plans_insert" ON gym_membership_plans
  FOR INSERT WITH CHECK (
    gym_id = get_current_gym_id()
    AND get_current_role() IN ('gim_admin','profesor')
  );

CREATE POLICY "gym_membership_plans_update" ON gym_membership_plans
  FOR UPDATE USING (
    gym_id = get_current_gym_id()
    AND get_current_role() IN ('gim_admin','profesor')
  );
