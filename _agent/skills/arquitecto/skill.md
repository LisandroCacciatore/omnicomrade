---
name: techfitness-arquitecto
description: >
  Define y valida la arquitectura técnica de TechFitness: schema de base de datos,
  políticas de RLS, estructura de APIs, decisiones de infraestructura y patrones
  de código. Activar cuando el usuario necesite diseñar o revisar el schema de una
  tabla, escribir una migración de Supabase, definir políticas RLS, diseñar un
  endpoint de API, tomar decisiones de estructura de carpetas, evaluar una decisión
  técnica, o cuando diga "¿cómo modelamos X en la DB?", "diseñá el schema de",
  "escribí la migración para", "¿cómo funciona el RLS de?", "qué política necesito",
  "definí la estructura del proyecto", o "validá esta arquitectura". Siempre consultar
  este skill antes de crear tablas o políticas en Supabase.
---

# TechFitness — Arquitecto Skill

Sos el arquitecto del sistema. Tomás las decisiones técnicas de estructura,
modelo de datos y seguridad que el resto del equipo implementa.
Cada tabla que se crea, cada política RLS que se define, pasa por vos.

Leer `AGENT.md` antes de cualquier decisión arquitectural.

---

## Principios de Arquitectura

1. **RLS primero** — Toda tabla nueva tiene políticas RLS desde el día 1. Sin excepción.
2. **tenant_id en todas las tablas de negocio** — No existe tabla de datos sin columna `gym_id`.
3. **Nunca exponer datos de otros tenants** — Incluso si hay un bug en el frontend, el DB no devuelve datos ajenos.
4. **Soft deletes** — Los registros no se borran físicamente. Usar `deleted_at timestamp`.
5. **Timestamps de auditoría** — Toda tabla tiene `created_at` y `updated_at`.
6. **UUIDs siempre** — No usar IDs seriales (integers). UUID v4 como PK en todas las tablas.

---

## Modelo de Datos

### Convenciones de Nomenclatura
```sql
-- Tablas: snake_case, plural
-- Columnas: snake_case
-- Índices: idx_[tabla]_[columna(s)]
-- Políticas RLS: [acción]_[tabla]_[rol]
-- Funciones: [verbo]_[sustantivo]
```

### Schema Principal

```sql
-- =============================================
-- TENANTS (Gimnasios)
-- =============================================
CREATE TABLE gyms (
  id          uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  name        text NOT NULL,
  slug        text UNIQUE NOT NULL,       -- URL-friendly identifier
  logo_url    text,
  color       text DEFAULT '#3B82F6',    -- Primary color del tenant
  plan        text DEFAULT 'free' CHECK (plan IN ('free', 'premium')),
  created_at  timestamptz DEFAULT now(),
  updated_at  timestamptz DEFAULT now(),
  deleted_at  timestamptz                -- soft delete
);

-- =============================================
-- PERFILES DE USUARIO (extiende auth.users)
-- =============================================
CREATE TABLE profiles (
  id          uuid REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  gym_id      uuid REFERENCES gyms(id) NOT NULL,
  full_name   text NOT NULL,
  avatar_url  text,
  role        text NOT NULL CHECK (role IN ('gim_admin', 'profesor', 'alumno')),
  created_at  timestamptz DEFAULT now(),
  updated_at  timestamptz DEFAULT now()
);

-- =============================================
-- ALUMNOS
-- =============================================
CREATE TABLE students (
  id              uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  gym_id          uuid REFERENCES gyms(id) NOT NULL,
  profile_id      uuid REFERENCES profiles(id),   -- null si no tiene acceso al sistema
  full_name       text NOT NULL,
  email           text,
  phone           text,
  birth_date      date,
  goal            text,
  notes           text,
  assigned_to     uuid REFERENCES profiles(id),   -- profesor asignado
  membership_status text DEFAULT 'pendiente'
    CHECK (membership_status IN ('activa','vencida','suspendida','pendiente')),
  created_at      timestamptz DEFAULT now(),
  updated_at      timestamptz DEFAULT now(),
  deleted_at      timestamptz,
  UNIQUE(gym_id, email)  -- email único por tenant, no global
);

-- =============================================
-- MEMBRESÍAS
-- =============================================
CREATE TABLE memberships (
  id          uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  gym_id      uuid REFERENCES gyms(id) NOT NULL,
  student_id  uuid REFERENCES students(id) NOT NULL,
  plan_name   text NOT NULL,
  starts_at   date NOT NULL,
  ends_at     date NOT NULL,
  status      text DEFAULT 'activa'
    CHECK (status IN ('activa','vencida','suspendida','pendiente')),
  price       numeric(10,2),
  notes       text,
  created_at  timestamptz DEFAULT now(),
  updated_at  timestamptz DEFAULT now()
);

-- =============================================
-- RUTINAS
-- =============================================
CREATE TABLE routines (
  id          uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  gym_id      uuid REFERENCES gyms(id) NOT NULL,
  created_by  uuid REFERENCES profiles(id) NOT NULL,
  name        text NOT NULL,
  description text,
  created_at  timestamptz DEFAULT now(),
  updated_at  timestamptz DEFAULT now(),
  deleted_at  timestamptz
);

CREATE TABLE routine_days (
  id          uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  routine_id  uuid REFERENCES routines(id) ON DELETE CASCADE NOT NULL,
  name        text NOT NULL,   -- "Día A", "Lunes", etc.
  order_index integer NOT NULL DEFAULT 0
);

CREATE TABLE exercises (
  id          uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  day_id      uuid REFERENCES routine_days(id) ON DELETE CASCADE NOT NULL,
  name        text NOT NULL,
  sets        integer NOT NULL,
  reps        text NOT NULL,   -- "8-12", "15", "hasta fallo"
  weight      text,            -- "60kg", "BW", null
  notes       text,
  order_index integer NOT NULL DEFAULT 0
);

-- =============================================
-- ASIGNACIÓN DE RUTINAS A ALUMNOS
-- =============================================
CREATE TABLE student_routines (
  id          uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  gym_id      uuid REFERENCES gyms(id) NOT NULL,
  student_id  uuid REFERENCES students(id) NOT NULL,
  routine_id  uuid REFERENCES routines(id) NOT NULL,
  assigned_at timestamptz DEFAULT now(),
  assigned_by uuid REFERENCES profiles(id) NOT NULL,
  is_current  boolean DEFAULT true  -- solo una activa por alumno
);

-- =============================================
-- NOTIFICACIONES
-- =============================================
CREATE TABLE notifications (
  id          uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  gym_id      uuid REFERENCES gyms(id) NOT NULL,
  for_role    text CHECK (for_role IN ('gim_admin','profesor','alumno','all')),
  for_user_id uuid REFERENCES profiles(id),   -- null = para todos del rol
  type        text NOT NULL
    CHECK (type IN ('critical','warning','info','system')),
  title       text NOT NULL,
  body        text NOT NULL,
  read_at     timestamptz,
  created_at  timestamptz DEFAULT now()
);
```

---

## Políticas RLS

```sql
-- Habilitar RLS en todas las tablas
ALTER TABLE gyms ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE students ENABLE ROW LEVEL SECURITY;
ALTER TABLE memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE routines ENABLE ROW LEVEL SECURITY;
ALTER TABLE routine_days ENABLE ROW LEVEL SECURITY;
ALTER TABLE exercises ENABLE ROW LEVEL SECURITY;
ALTER TABLE student_routines ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- Helper: obtener gym_id del usuario autenticado
CREATE OR REPLACE FUNCTION get_current_gym_id()
RETURNS uuid AS $$
  SELECT gym_id FROM profiles WHERE id = auth.uid()
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- Helper: obtener rol del usuario autenticado
CREATE OR REPLACE FUNCTION get_current_role()
RETURNS text AS $$
  SELECT role FROM profiles WHERE id = auth.uid()
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- =============================================
-- STUDENTS: RLS
-- =============================================

-- SELECT: admin ve todos, profesor ve solo los asignados, alumno ve el suyo
CREATE POLICY select_students_admin ON students
  FOR SELECT USING (
    gym_id = get_current_gym_id()
    AND get_current_role() = 'gim_admin'
    AND deleted_at IS NULL
  );

CREATE POLICY select_students_profesor ON students
  FOR SELECT USING (
    gym_id = get_current_gym_id()
    AND get_current_role() = 'profesor'
    AND assigned_to = auth.uid()
    AND deleted_at IS NULL
  );

CREATE POLICY select_students_self ON students
  FOR SELECT USING (
    profile_id = auth.uid()
  );

-- INSERT: solo admin
CREATE POLICY insert_students_admin ON students
  FOR INSERT WITH CHECK (
    gym_id = get_current_gym_id()
    AND get_current_role() = 'gim_admin'
  );

-- UPDATE: solo admin
CREATE POLICY update_students_admin ON students
  FOR UPDATE USING (
    gym_id = get_current_gym_id()
    AND get_current_role() = 'gim_admin'
  );

-- =============================================
-- ROUTINES: RLS
-- =============================================

-- SELECT: admin y profesor ven todas las del gym
CREATE POLICY select_routines ON routines
  FOR SELECT USING (
    gym_id = get_current_gym_id()
    AND deleted_at IS NULL
  );

-- INSERT/UPDATE: admin y profesor
CREATE POLICY write_routines ON routines
  FOR ALL USING (
    gym_id = get_current_gym_id()
    AND get_current_role() IN ('gim_admin', 'profesor')
  );

-- =============================================
-- NOTIFICATIONS: RLS
-- =============================================
CREATE POLICY select_notifications ON notifications
  FOR SELECT USING (
    gym_id = get_current_gym_id()
    AND (
      for_user_id = auth.uid()
      OR for_role = get_current_role()
      OR for_role = 'all'
    )
  );
```

---

## Triggers de Base de Datos

```sql
-- Auto-update updated_at
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Aplicar a todas las tablas relevantes
CREATE TRIGGER set_updated_at
  BEFORE UPDATE ON students
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
-- (repetir para gyms, profiles, routines, memberships)

-- Sincronizar estado de membresía en students
CREATE OR REPLACE FUNCTION sync_membership_status()
RETURNS trigger AS $$
BEGIN
  UPDATE students
  SET membership_status = NEW.status
  WHERE id = NEW.student_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER sync_student_membership
  AFTER INSERT OR UPDATE ON memberships
  FOR EACH ROW EXECUTE FUNCTION sync_membership_status();
```

---

## Índices

```sql
-- Filtros más comunes
CREATE INDEX idx_students_gym_id ON students(gym_id);
CREATE INDEX idx_students_assigned_to ON students(assigned_to);
CREATE INDEX idx_students_membership_status ON students(membership_status);
CREATE INDEX idx_routines_gym_id ON routines(gym_id);
CREATE INDEX idx_memberships_student_id ON memberships(student_id);
CREATE INDEX idx_memberships_ends_at ON memberships(ends_at);
CREATE INDEX idx_notifications_gym_id ON notifications(gym_id);
CREATE INDEX idx_notifications_for_user ON notifications(for_user_id);
```

---

## Estructura de Carpetas del Proyecto

```
techfitness/
├── supabase/
│   ├── migrations/           # SQL migrations versionadas
│   │   ├── 001_create_gyms.sql
│   │   ├── 002_create_profiles.sql
│   │   └── ...
│   ├── seed.sql              # Datos de prueba para desarrollo
│   └── config.toml
├── src/
│   ├── lib/
│   │   ├── supabase.ts       # Client singleton
│   │   └── auth.ts           # Helpers de autenticación
│   ├── services/             # Toda la lógica de acceso a datos
│   │   ├── students.ts
│   │   ├── routines.ts
│   │   └── notifications.ts
│   ├── types/                # TypeScript types derivados del schema
│   │   └── database.ts       # Auto-generado por Supabase CLI
│   ├── components/           # Componentes UI reutilizables
│   └── pages/                # Pantallas
├── tests/
│   └── e2e/                  # Tests Playwright
└── AGENT.md
```

---

## Decisiones Técnicas Registradas

| # | Decisión | Alternativa considerada | Razón |
|---|----------|------------------------|-------|
| 1 | UUIDs como PKs | Integer serial | Seguridad (no expone conteo), compatible con Supabase |
| 2 | Soft deletes (`deleted_at`) | Delete físico | Auditoría y posibilidad de recuperar datos |
| 3 | `gym_id` en tablas de negocio | Schema separado por tenant | Más simple de operar, RLS lo protege |
| 4 | Estado de membresía en `students` además de `memberships` | Solo en `memberships` | Evita JOINs en la lista de alumnos (performance) |
| 5 | `reps` como text | Integer | Permite "8-12", "hasta fallo", "20s" |

---

## Checklist Arquitectural para Tablas Nuevas

1. ☐ ¿Tiene `id uuid DEFAULT gen_random_uuid() PRIMARY KEY`?
2. ☐ ¿Tiene `gym_id uuid REFERENCES gyms(id)`?
3. ☐ ¿Tiene `created_at` y `updated_at`?
4. ☐ ¿Tiene `deleted_at` para soft delete?
5. ☐ ¿RLS está habilitado con `ALTER TABLE ... ENABLE ROW LEVEL SECURITY`?
6. ☐ ¿Hay políticas para SELECT, INSERT, UPDATE (y DELETE si aplica)?
7. ☐ ¿Las políticas usan `get_current_gym_id()` para filtrar por tenant?
8. ☐ ¿Hay índices en las columnas de filtro más comunes?
9. ☐ ¿Hay un trigger para `updated_at`?
10. ☐ ¿La migración está versionada en `supabase/migrations/`?

---

## Referencias

- `AGENT.md` — Stack, roles y contexto del sistema
- `skills/ba/SKILL.md` — Requerimientos funcionales que este schema implementa
- `skills/dev/SKILL.md` — Cómo el dev consume este schema desde el frontend
- `skills/qa/SKILL.md` — Tests de integración que validan el comportamiento del DB
