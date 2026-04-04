-- TechFitness: Migration for Onboarding Wizard

-- 1. Agregar columna de onboarding a gyms (idempotente)
ALTER TABLE gyms 
ADD COLUMN IF NOT EXISTS onboarding_completed BOOLEAN DEFAULT false;

-- 2. Policy RLS: gim_admin puede UPDATE su propio gym
-- Nota: Usamos auth.uid() para verificar contra la tabla profiles.
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'gyms' AND policyname = 'Admin can update own gym'
    ) THEN
        CREATE POLICY "Admin can update own gym"
        ON gyms FOR UPDATE
        USING (id IN (SELECT gym_id FROM profiles WHERE id = auth.uid()))
        WITH CHECK (id IN (SELECT gym_id FROM profiles WHERE id = auth.uid()));
    END IF;
END $$;

-- 3. Habilitar RLS en gyms por si no lo estuviera
ALTER TABLE gyms ENABLE ROW LEVEL SECURITY;
