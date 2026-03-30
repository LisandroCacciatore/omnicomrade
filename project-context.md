# TechFitness SaaS — Contexto del Proyecto

## Idea General
TechFitness es una plataforma SaaS multitenancy para gestión de gimnasios.
Cada gimnasio es un tenant independiente con sus propios alumnos, rutinas y membresías.
Los usuarios tienen roles: gim_admin, profesor, alumno.
Frontend: HTML/CSS/JS vanilla + Tailwind CSS vía CDN (sin pipeline local de compilación).
Backend: Supabase (PostgreSQL + Auth + RLS + Storage).

---

## Stack Tecnológico
- Frontend: HTML5, Tailwind CSS vía CDN (con config extendida inline en cada HTML), JavaScript vanilla, Material Symbols Rounded (Google Icons), IBM Plex Mono (monospace), Space Grotesk (sans)
- Backend: Supabase (PostgreSQL, Auth, Row Level Security, Storage)
- Charts: Chart.js 4.4.0 vía CDN (student-profile.html, progress.html)
- SDK: @supabase/supabase-js@2 vía CDN
- Credenciales: ver `js/supabase.example.js` (el archivo real está en .gitignore)

---

## Convenciones del proyecto
- Nombres de archivos: guiones (`-`) siempre. Ej: `admin-dashboard.html`, NO `admin_dashboard.html`
- Tailwind: siempre CDN, nunca CSS compilado local (`assets/css/tailwind.css` NO existe ni se genera)
- `package.json`: no incluye scripts `build`/`watch` de Tailwind; el proyecto no requiere `npm install` para estilos
- Todos los HTML cargan `js/utils.js` antes del JS de la página
- El logout está centralizado en `window.tfUtils.logout`
- Los programas pre-armados (PROGRAMS) viven en `window.tfUtils.PROGRAMS` (utils.js)

---

## Estructura de Archivos

```
/
├── login.html                  ✅
├── admin-dashboard.html        ✅
├── student-list.html           ✅
├── membership-list.html        ✅
├── routine-list.html           ✅
├── attendance.html             ✅
├── exercise-list.html          ✅
├── routine-programs.html       ✅
├── routine-builder.html        ✅
├── gym-setting.html            ✅
├── profesor-dashboard.html     ✅
├── student-profile.html        ✅
├── workout-session.html        ✅
├── wellbeing-check.html        ✅
├── progress.html               ✅
├── schema_complete.sql         ✅ (schema completo, ejecutar en Supabase)
│
├── js/
│   ├── supabase.example.js     ✅ (plantilla — renombrar a supabase.js)
│   ├── supabase.js             🔒 (en .gitignore — contiene credenciales)
│   ├── auth.js                 ✅
│   ├── auth-guard.js           ✅
│   ├── utils.js                ✅ (toast, escHtml, debounce, logout, PROGRAMS)
│   ├── admin-dashboard.js      ✅
│   ├── student-list.js         ✅
│   ├── membership-list.js      ✅
│   ├── routine-list.js         ✅
│   ├── attendance.js           ✅
│   ├── exercise-list.js        ✅
│   ├── routine-programs.js     ✅
│   ├── routine-builder.js      ✅
│   ├── program-assign.js       ✅ (modal reutilizable, se inyecta en el DOM)
│   ├── gym-setting.js          ✅
│   ├── profesor-dashboard.js   ✅
│   ├── student-profile.js      ✅
│   ├── workout-session.js      ✅
│   ├── wellbeing-check.js      ✅
│   └── progress.js             ✅
│
└── assets/
    ├── img/logo.png
    └── css/
        └── readme.md            ✅ (documenta que Tailwind se sirve por CDN; sin build local)
```

---

## Base de Datos — Schema completo en `schema_complete.sql`

### Tablas

**gyms** — Tenants
- id, name, slug (unique), logo_url, color, plan (free/premium)
- Seed: id = c0a80121-7ac0-4e3b-b461-7509f6b64b15, slug = techfitness-demo

**profiles** — Extensión de auth.users
- id (FK auth.users), gym_id, full_name, avatar_url, role (gim_admin/profesor/alumno)

**students**
- id, gym_id, profile_id (nullable), full_name, email, phone, birth_date, avatar_url
- objetivo: CHECK IN ('fuerza','estetica','rendimiento','rehabilitacion','general')
- membership_status: CHECK IN ('activa','vencida','suspendida','pendiente')
- coach_notes, medical_certificate_url, notes
- soft delete: deleted_at

**memberships**
- id, gym_id, student_id, plan (mensual/trimestral/anual)
- amount, payment_method (efectivo/transferencia)
- start_date, end_date (calculada por trigger)

**routines**
- id, gym_id, name, description, objetivo, difficulty, duration_weeks, days_per_week
- source_program (slug del programa base), source_rm_values (JSONB)
- soft delete: deleted_at

**routine_days** — Días de una rutina (routine-builder)
- id, routine_id, day_number, name

**exercises** — Biblioteca global + custom por gym
- id, gym_id (NULL si is_global), is_global, name, description
- muscle_group, category, difficulty, equipment, video_url
- 30 ejercicios preset globales incluidos en el seed

**routine_day_exercises** — Ejercicios dentro de un día
- id, routine_day_id, exercise_id, exercise_name
- sets, reps, rest_seconds, rpe, weight_kg, weight_pct, weight_ref, notes

**program_templates** — 6 programas pre-armados
- id, slug, name, author, description, level, focus[], weeks, days_per_week
- Slugs: starting-strength, stronglifts-5x5, gzclp, wendler-531, cube-method, ppl

**student_programs** — Asignaciones de programas a alumnos
- id, gym_id, student_id, template_id
- rm_values (JSONB), started_at, current_week, status (activo/pausado/completado/cancelado)

**workout_sessions** — Sesiones de entrenamiento completadas
- id, gym_id, student_id, routine_name, day_name
- started_at, completed_at, duration_minutes

**workout_exercise_logs** — Log por ejercicio dentro de una sesión
- id, gym_id, session_id, exercise_name, muscle_group
- set_number, reps_target, reps_actual, weight_target, weight_used ← nombre canónico
- status (logrado/ajustado/fallido/omitido), effort_level (facil/normal/muy_pesado/al_fallo)

**attendance_logs** — Control de acceso
- id, gym_id, student_id, check_in_time

**wellbeing_logs** — Check de bienestar pre-entrenamiento
- id, gym_id, student_id
- sleep (1-5), pain (1-5, 1=sin dolor), energy (1-5)
- checked_at — UNIQUE por alumno por día

### Vistas analíticas

**v_exercise_progress** — Peso máximo por ejercicio por sesión por alumno

**v_weekly_volume** — Sets por grupo muscular por semana por alumno

**v_stagnation_check** — Detecta ejercicios sin progresión en últimas 3 sesiones
- Campos clave: is_stagnant (bool), progress_pct

**v_athlete_risk** — Semáforo de riesgo por alumno
- Cruza: bienestar (7 días) + spike de volumen + inactividad + estancamientos
- Campos: risk_score (0-100), risk_level (red/yellow/green), risk_reason

### Funciones SQL
- `get_current_gym_id()` → gym_id del usuario autenticado
- `get_current_role()` → role del usuario autenticado
- `handle_user_role_sync()` → trigger que sincroniza role/gym_id al JWT
- `calculate_membership_end_date()` → trigger BEFORE INSERT en memberships
- `sync_student_membership_status()` → trigger AFTER INSERT/UPDATE en memberships

### Notas críticas de Supabase
- La columna es `raw_app_meta_data` (sin la 'a' final en metadata)
- Usar LANGUAGE plpgsql en funciones que referencian tablas propias
- Usar legacy anon key (formato eyJhbGci...), NO la sb_publishable_
- Para crear usuarios SIEMPRE usar el dashboard de Auth, nunca SQL directo
- Siempre agregar DROP preventivos antes de CREATE en migraciones
- El trigger de membresías recibe end_date = start_date y lo sobreescribe

### Storage (3 buckets privados, crear desde Dashboard)
- `medical-certificates` — path: `{student_id}/certificado.{ext}`
- `gym-logos` — path: `{gym_id}/logo.{ext}`
- `avatars` — path: `{user_id}/avatar.{ext}`
- Todos usan `createSignedUrl` con 1 año de validez y `upsert: true`

---

## Autenticación

### supabase.example.js → renombrar a supabase.js
```javascript
const SUPABASE_URL = 'https://TU_PROJECT.supabase.co'
const SUPABASE_ANON_KEY = 'TU_ANON_KEY'
try {
    if (!window.supabase) throw new Error('SDK de Supabase no cargó')
    const { createClient } = window.supabase
    window.supabaseClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
} catch (e) { console.error('❌ Error inicializando Supabase:', e.message) }
```

### auth.js — Redirección post-login por rol
- gim_admin → `admin-dashboard.html`
- profesor → `profesor-dashboard.html`
- alumno → `student-profile.html`

### auth-guard.js
- `window.authGuard(allowedRoles[])` — si no hay sesión redirige a login.html

### Orden de scripts en TODOS los HTML
1. `@supabase/supabase-js@2` (CDN)
2. `js/supabase.js`
3. `js/auth-guard.js`
4. `js/utils.js`
5. `js/[página].js`

---

## Flujos principales

### Flujo alumno
```
login → student-profile → [click Comenzar]
→ wellbeing-check (guarda en wellbeing_logs, usa pendingWorkout)
→ workout-session (lee activeWorkout de sessionStorage)
→ student-profile (post, con tab Estadísticas y Chart.js)
```

### Flujo admin/profesor
```
login → admin-dashboard (KPIs) → student-list (panel lateral 6 tabs)
→ routine-programs (asignar programa via program-assign.js)
→ profesor-dashboard (semáforo via v_athlete_risk)
→ progress.html?student=ID (analytics: pesos, volumen, estancamiento)
```

### Flujo construcción de rutinas
```
exercise-list → routine-builder (modo libre ó desde programa)
→ routine-list → asignar desde student-list tab Rutina
```

### Flujo asistencia
```
admin/profesor → attendance.html → buscar alumno → registrar ingreso
→ attendance_logs INSERT → log en tiempo real
```

---

## utils.js — API pública de window.tfUtils
```javascript
window.tfUtils = {
    toast(msg, type)        // type: 'success' | 'error'
    escHtml(str)            // previene XSS
    debounce(func, wait)
    logout()                // signOut → login.html
    round(v, step)          // redondea a múltiplo (default 2.5 kg)
    pct(base, percent)      // calcula porcentaje con round
    PROGRAMS[]              // array de 6 programas con sus generadores
}
```

## program-assign.js — Modal reutilizable de asignación
```javascript
const modal = new window.ProgramAssignModal({ gymId, db, onSuccess })

// Desde catálogo (programa pre-seleccionado, elige alumno):
modal.open({ preProgram: programObj })

// Desde perfil del alumno (alumno pre-seleccionado, elige programa):
modal.open({ preStudent: { id, full_name } })

// Lógica automática: si hay programa activo → lo marca 'cancelado' antes del INSERT
```

---

## Diseño / UI

### Tailwind config (en todos los HTML)
```javascript
tailwind.config = {
  theme: { extend: { colors: {
    'bg-dark':      '#0B1218',
    'surface-dark': '#161E26',
    'surface-2':    '#1A2330',
    'border-dark':  '#1E293B',
    'primary':      '#3B82F6',
    'success':      '#10B981',
    'danger':       '#EF4444',
    'warning':      '#F59E0B',
  }, fontFamily: { sans: ['Space Grotesk', 'sans-serif'] } } }
}
```

### Componentes CSS custom (en `<style>` de cada página)
- `.nav-link` — sidebar links con estados hover/active
- `.skeleton` — animate-pulse bg-[#1E293B] para loading states
- `#toast` — notificaciones bottom-right, clases `.show .success .error`
- Modales: `.modal-backdrop` + `.modal-box` con transición scale+opacity
- Drawers: posición fixed right-0, `transform: translateX(100%)` → `.open`

---

## Estado del proyecto — Transición a Optimización y Escala 🚀

| Etapa | Descripción | Estado |
|-------|-------------|--------|
| 1 | Login · Dashboard · Alumnos · Membresías · Rutinas · Config | ✅ |
| 2 | Ejercicios · Programas · Asignación · Builder · Vista alumno | ✅ |
| 3 | Sesión activa · Asistencia · Dashboard profesor | ✅ |
| 4 | Evolución de pesos · Volumen semanal · Estancamiento | ✅ |
| 5 | Check bienestar · Control de carga · Semáforo de riesgo | ✅ |
| 6 | Refactorización: Centralización de lógica de programas, modularización de utils.js y migración local de Tailwind | 🏗️ En Planificación |

---

## 🛠️ Próximos Pasos Técnicos (Roadmap de Mejora)

1. **Unificación del Motor de Entrenamiento**: Extraer la lógica duplicada de `PROGRAMS` a `js/training-engine.js`.
2. **Modularización de Utils**: Dividir `utils.js` en módulos especializados (UI, Auth, Dominio).
3. **Optimización de Estilos**: Reemplazar Tailwind CDN por un build local para mejorar performance y FOUC.
4. **Resiliencia de Datos**: Mejorar el manejo de errores en queries de Supabase para evitar fallos por desincronización de schema.
5. **Calidad de Código**: Introducir JSDoc y tests unitarios para los cálculos críticos de progresión y 1RM.