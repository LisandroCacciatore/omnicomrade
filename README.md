# TechFitness (omnicomrade)

**Sistema multitenant para gestión de gimnasios y seguimiento de rendimiento deportivo. Pre-MVP, y con el proceso de QA documentado dentro del repositorio.**

🔗 **[omnicomrade.vercel.app](https://omnicomrade.vercel.app/)** · 19 páginas · 127 commits · 42 ramas

---

## Qué resuelve

Un gimnasio opera con planillas, WhatsApp y memoria: quién vino, quién pagó, qué le tocaba entrenar y cómo venía progresando. TechFitness centraliza esas tres capas en un solo sistema, con roles separados:

- **Administrador** — alumnos, membresías, vencimientos, KPIs del local, avisos.
- **Profesor** — constructor de rutinas, seguimiento de progreso (1RM, volumen), asignación de programas (StrongLifts, Wendler).
- **Alumno** — dashboard del día, log de sesión en vivo, check-in de bienestar y gráficos de evolución.

Es **multitenant**: cada gimnasio es un inquilino aislado, con sus propios datos y su propio branding.

## Mi rol

Definí el alcance funcional y construí el producto, con foco explícito en calidad:

- Especificaciones y alcance por rol antes de implementar.
- **Estrategia de testing en tres capas** (`unit`, `contract`, `e2e`) ejecutable con `npm run test:all`.
- **Auditoría de QA en Gherkin**: barrido de "botones muertos" y gaps de interacción, con IDs, prioridad y estado por historia.
- **Hardening multitenant**: resolución centralizada de `gymId` desde el JWT, filtrado por `gym_id` en todas las consultas, saneamiento de entradas con `escHtml`.

## Stack

JavaScript (ES modules, MPA) · Supabase (Auth, Postgres, RLS) · Express · Vite · Tailwind con build propio (no CDN) · ESLint + Prettier · `node --test` · Vercel

## Evidencia — acá está el valor del repo

| Qué | Dónde |
|---|---|
| Suite de tests en 3 capas | `package.json`: `test:unit` · `test:contract` · `test:e2e` · `test:all` |
| Auditoría de botones muertos en Gherkin (399 líneas, US-QA-001…) | `docs/qa-automation-audit-gherkin.md` |
| Plan de acción de la auditoría QA | `docs/action-plan-qa-audit-gherkin.md` |
| Estrategia de testing para cambios de UI | `TEST_STRATEGY_FOR_UI_CHANGES.md` |
| Smoke test de un flujo completo | `docs/smoke-test-student-workout-intent-flow.md` |
| Alcance funcional por rol | `ALCANCE_Y_ESPECIFICACIONES.md` |
| Estado operativo y migraciones | `docs/OPERATIVE_STATUS_2026-04-08.md` · `docs/migrations.md` |
| 6 skills de agente (arquitecto, BA, dev, PM, QA, UI) | `_agent/skills/` |

## Estado

Pre-MVP, desarrollo pausado desde abril de 2026. Puntos abiertos, verificados:

- Archivos que no deberían estar versionados: `err.txt`, `build_output_4.txt`, `access-requests.html.tmp`, y `readme.md` vacíos en `assets/css/` y `assets/img/`.
- 42 ramas acumuladas: conviene podar las ya mergeadas en `main`.
- El repositorio no tenía README; este es el primero.
