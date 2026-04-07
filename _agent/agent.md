# TechFitness — Agent de Proyecto

Sos el agente de desarrollo del proyecto **TechFitness**: un SaaS multitenant de gestión de gimnasios.
El proyecto se reinicia desde cero. Cada decisión que tomás tiene que ser consistente con este documento.

---

# TechFitness — Agent de Proyecto
**Actualizado**: 2026-04-07
**Estado**: Post-MVP — Motor de entrenamiento completo, listo para piloto

> ⚠️ Este documento reemplaza la versión anterior del AGENT.md.
> El proyecto evolucionó significativamente más allá del MVP original.

---

## Lo que realmente es TechFitness

**No es** un CRM de gimnasio con rutinas.
**Es** un motor de autorregulación deportiva con capa de gestión de gimnasio.

La diferencia importa para priorizar: el valor competitivo está en el motor
de entrenamiento (`training-engine`, `athlete-insights`, `workout-session`),
no en los CRUDs operativos.

---

## Arquitectura Real del Sistema

### Capas del producto

```
┌─────────────────────────────────────────────────────────┐
│  CAPA DE INTELIGENCIA (ventaja competitiva)             │
│  training-engine.js  · athlete-insights.js              │
│  training-math.js    · wellbeing-check.js               │
│  4 Vistas SQL: v_athlete_risk, v_stagnation_check,      │
│                v_exercise_progress, v_weekly_volume      │
├─────────────────────────────────────────────────────────┤
│  CAPA DE EJECUCIÓN                                      │
│  workout-session.js  · routine-builder.js               │
│  wellbeing-check.js  · workout-session.html             │
├─────────────────────────────────────────────────────────┤
│  CAPA DE INFRAESTRUCTURA                                │
│  db.js · auth.js · auth-guard.js · supabase.js          │
│  route-map.js · store.js · instrumentation.js           │
├─────────────────────────────────────────────────────────┤
│  CAPA OPERATIVA (gestión del gimnasio)                  │
│  student-list · membership-list · routine-list          │
│  attendance · gym-setting · exercise-list               │
└─────────────────────────────────────────────────────────┘
```

### Stack tecnológico

| Capa | Tecnología |
|------|-----------|
| Frontend | HTML + Tailwind CSS (config custom) + Vite |
| JS | Vanilla JS modular (ESM en utils, legacy global en controllers) |
| Backend | Express.js (`server/`) + Supabase como DB principal |
| DB | PostgreSQL vía Supabase (RLS + vistas SQL analíticas) |
| Auth | Supabase Auth + Google OAuth |
| Deploy | Vercel (frontend) |
| Tests | Playwright (E2E) + Jest (unit — pendiente en athlete-insights) |

---

## Roles del Sistema

| Rol | Acceso | Dashboard |
|-----|--------|-----------|
| `gim_admin` | Gestión total del tenant | `admin-dashboard.html` |
| `profesor` | Alumnos asignados + rutinas + semáforo de riesgo | `profesor-dashboard.html` |
| `alumno` | Su perfil, rutina, sesiones, progreso | `student-dashboard.html` |

> **Nota de nomenclatura**: los archivos usan guión (`admin-dashboard.html`),
> no underscore. Usar siempre la nomenclatura del árbol de archivos.

---

## Design System

```js
// tailwind.config.js (runtime via tailwind-config.js)
colors: {
  primary:           "#3B82F6",
  success:           "#10B981",
  danger:            "#EF4444",
  warning:           "#F59E0B",
  "background-dark": "#0B1218",
  "surface-dark":    "#161E26",
  "border-dark":     "#1E293B",
  "border-muted":    "#334155",
  "background-light":"#f1f5f9",
}
// Fuente: Space Grotesk
// Iconos: Material Symbols Outlined
// Modo: Dark por defecto (class="dark" en <html>)
```

---

## Módulos Core — Referencia Rápida

### Motor de Entrenamiento (`training-engine.js`)
- `window.tfTrainingEngine`
- 6 programas: Starting Strength, StrongLifts 5×5, GZCLP, Wendler 5/3/1, Cube Method, PPL
- Entrada: 1RMs por movimiento → Salida: semanas de entrenamiento con sets/reps/% carga
- Dispatcher: `generateProgram(id, rms)` → busca en catálogo, fallback a legacy

### Matemática de Entrenamiento (`training-math.js`)
- `tfTrainingMath.roundWeight(value, step=2.5)` — **fuente de verdad del redondeo**
- `tfTrainingMath.pct(base, percent, step)` — % del 1RM redondeado
- `tfTrainingMath.estimate1RM(weight, reps)` — Brzycki: `weight × 36 / (37 - reps)`
- `tfTrainingMath.estimateRPE(reps, percentage)` — aproximación de RPE

### Insights del Atleta (`athlete-insights.js`)
- `AthleteInsights.calcAthleteScore({wbLogs, sessions, logs, daysPerWeek})`
  → Score 0-100: bienestar 7d (30) + consistencia 30d (25) + progresión 30d (25) + fatiga 7d (20)
- `AthleteInsights.predictSessionQuality({wbLogs, logs, sessions})`
  → Predicción: 4 flags → risk 0-100 → mala/moderada/buena
- `AthleteInsights.calcRisks(...)` → Riesgo sobrecarga + riesgo abandono
- `AthleteInsights.calcAutoProgression({logs, sessions})`
  → Por ejercicio: ≥2 fallidos→-5% / al fallo sin fallar→mantener / todo bien→+2.5kg

### Capa de Datos (`db.js`)
- `window.tfDb` — Fachada por tabla con retry automático
- `runWithRetry(op, table, opType, maxRetries=3)` — backoff 1s→2s→4s
- `DBError` — Clasificación semántica: schema / transitorio / auth / duplicado
- **Usar siempre tfDb, nunca el cliente de Supabase directamente en los controllers**

### Vistas SQL Analíticas
| Vista | Propósito |
|-------|-----------|
| `v_exercise_progress` | Max weight por ejercicio por sesión |
| `v_weekly_volume` | Sets semanales por grupo muscular |
| `v_stagnation_check` | Estancamiento: 3+ sesiones sin mejora |
| `v_athlete_risk` | Score compuesto 0-100 con 5 señales (5 CTEs) |

---

## Flujo Principal del Atleta

```
student-dashboard
    → pendingWorkout (sessionStorage)
        → wellbeing-check (score + bienestar)
            → activeWorkout + wellbeing (sessionStorage)
                → workout-session (card deck, carry-over, timer)
                    → POST /api/workouts/sessions/:id/complete
                    → fallback: INSERT directo Supabase
                        → workout_sessions + workout_exercise_logs + wellbeing_logs
                            → v_athlete_risk (5 CTEs)
                                → athlete-insights.js (score, riesgo, auto-progression)
                                    → progress.html / profesor-dashboard / student-dashboard
```

---

## Cobertura Funcional Actual (~90%)

### ✅ Implementado
- Autenticación: email + Google OAuth, guard por rol, access requests
- Onboarding: wizard 4 pasos (gym → atleta → membresía → programa)
- Gestión: alumnos, membresías, rutinas, ejercicios, asistencia
- Motor: 6 programas de entrenamiento con generación dinámica
- Sesión activa: card deck, carry-over, timer con vibración, anti-fallback
- Bienestar: check pre-entreno, score, integración con sesión
- Analítica: 4 vistas SQL, gauges, sparklines, charts
- Insights: score atleta, predicción sesión, riesgo, auto-progression
- Semáforo de riesgo: panel profesor con alertas por atleta
- Configuración: gym-setting, planes de membresía

### ⬜ Faltante (~10%)
- Feedback post-sesión al alumno (qué fue bien, qué ajustar)
- Plan de recuperación automático (deload sugerido por sistema)
- Comunicación coach-atleta dentro del flujo de entreno
- Tests unitarios de `athlete-insights.js` (deuda crítica)

---

## Deuda Técnica — Top 3

| # | Deuda | Impacto | Ubicación |
|---|-------|---------|-----------|
| 1 | `athlete-insights.js` sin tests | 🔴 Alto | 355 líneas de lógica crítica sin validación |
| 2 | Thresholds hardcodeados en JS | 🔴 Alto | Reglas de riesgo/auto-progression no configurables sin deploy |
| 3 | Redondeo duplicado | 🟡 Medio | `Math.round(x/2.5)*2.5` en workout-session y athlete-insights — usar `tfTrainingMath.roundWeight` |

---

## Reglas de Desarrollo — Actualización

### Siempre
- Redondeo de peso: `tfTrainingMath.roundWeight(value, step)` — nunca `Math.round(x/2.5)*2.5`
- Acceso a datos: `tfDb.[tabla].[método]()` — nunca cliente Supabase directo en controllers
- Escape de HTML: `tfUiUtils.escHtml()` — nunca `innerHTML` con datos de usuario
- Toast: `tfUiUtils.toast(message, type)` — no implementar toasts propios

### Nunca
- Lógica de scoring o riesgo en los controllers — va en `athlete-insights.js`
- Lógica de generación de programas fuera de `training-engine.js`
- Queries directas al cliente Supabase en archivos de pantalla

---

## Skills del Equipo

| Rol | Archivo |
|-----|---------|
| UX/UI | `skills/ux-ui/SKILL.md` |
| PM | `skills/pm/SKILL.md` |
| BA | `skills/ba/SKILL.md` |
| Arquitecto | `skills/arquitecto/SKILL.md` |
| Dev | `skills/dev/SKILL.md` |
| QA | `skills/qa/SKILL.md` |

> Los skills fueron escritos para el MVP original.
> Las convenciones de código del Dev skill siguen siendo válidas.
> El schema del Arquitecto skill es referencia — el schema real está en `schema_complete.sql`.