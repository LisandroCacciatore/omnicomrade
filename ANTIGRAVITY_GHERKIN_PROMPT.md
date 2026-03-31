# Prompt para Antigravity — Historias Gherkin orientadas a Unit Testing

Copiá y pegá este prompt en Antigravity:

---

Actuá como **Product Owner + QA Lead + Test Architect** para un SaaS de gestión de gimnasios (TechFitness), frontend en HTML/JS vanilla y backend Supabase.

## Objetivo
Generar un backlog de historias en **Gherkin (Feature/Scenario/Scenario Outline)**, priorizado para acelerar la implementación de **tests unitarios** primero y luego cambios de UI.

## Reglas de salida
1. Escribir en español.
2. Entregar en este orden:
   - **P0 Unit Tests Críticos**
   - **P1 Unit Tests de Dominio**
   - **P2 Contract Tests (DB wrapper)**
   - **P3 Smoke/E2E mínimos recomendados**
3. Cada historia debe incluir:
   - ID (`US-UT-XX`)
   - Título
   - Valor de negocio (1 línea)
   - Bloque Gherkin completo
   - Criterios de aceptación claros
4. Priorizar historias para:
   - Mapeo de rutas por rol (`gim_admin`, `profesor`, `alumno`, `coach`)
   - Validación de variables de entorno (`SUPABASE_URL`, `SUPABASE_ANON_KEY`)
   - Generación de config de Supabase
   - Lógica de progresiones/rutinas (cuando se extraiga `training-engine`)
   - Validaciones puras del builder de rutinas (sin DOM)
5. No inventar frameworks pesados; asumir Node test runner nativo (`node --test`) como base.
6. Incluir para cada historia una sugerencia de archivo test (`tests/unit/...`).

## Contexto funcional actual
- `alumno` debe resolver a `student-profile.html`.
- `coach` debe normalizar a `profesor`.
- El build debe fallar si faltan env vars de Supabase.
- Queremos testear primero lógica pura para ganar velocidad y reducir regresiones antes de tocar UI.

## Formato exacto de salida
- Tabla inicial con prioridad, ID, título, impacto y esfuerzo.
- Luego cada historia con:
  - `### US-UT-XX - <Título>`
  - `**Prioridad:**`
  - `**Test file sugerido:**`
  - `**Gherkin**`
  - `**Acceptance Criteria**`
  - `**Definition of Done (test-first)**`

## Entregable final obligatorio
Cerrar con:
1. “Top 5 historias para arrancar mañana”.
2. Orden de implementación recomendado en 2 sprints.
3. Riesgos si se implementa UI antes de estos tests.

---

