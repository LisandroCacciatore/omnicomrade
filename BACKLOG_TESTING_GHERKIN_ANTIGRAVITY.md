# Backlog de Testing - TechFitness (OmniComrade)

## Tabla de priorización general
| Prioridad | ID | Título | Impacto | Esfuerzo | Estado actual |
|---|---|---|---|---|---|
| P0 | US-UT-01 | Validar mapeo de rutas por rol | Crítico | Bajo | ✅ Cubierto (unit tests) |
| P0 | US-UT-02 | Validar variables de entorno de Supabase | Crítico | Bajo | ✅ Cubierto (unit tests) |
| P0 | US-UT-03 | Validar normalización de rol `coach` → `profesor` | Crítico | Bajo | ✅ Cubierto (unit tests) |
| P1 | US-UT-04 | Testing de lógica de redondeo de pesos | Alto | Bajo | ✅ Cubierto (unit tests) |
| P1 | US-UT-05 | Testing de cálculo de porcentajes de entrenamiento | Alto | Bajo | ✅ Cubierto (unit tests) |
| P1 | US-UT-06 | Testing de generación de programas de fuerza | Alto | Medio | ✅ Cubierto (unit tests) |
| P1 | US-UT-07 | Testing del parser de formato `3×5` | Alto | Bajo | ✅ Cubierto (unit tests) |
| P2 | US-UT-08 | Testing contract de generación de config Supabase | Medio | Medio | ✅ Cubierto (contract tests) |
| P3 | US-UT-09 | Smoke test de integración rutas-auth | Medio | Alto | ✅ Cubierto (e2e smoke) |

---

## P0 — Unit Tests críticos

### US-UT-01 — Validar mapeo de rutas por rol
**Prioridad:** P0  
**Test file sugerido:** `tests/unit/routes/role-mapping.test.js`

```gherkin
Feature: Mapeo de rutas por rol de usuario
  Como sistema de navegación
  Necesito resolver la URL correcta según el rol del usuario
  Para redirigir al dashboard apropiado

  Scenario: Administrador de gimnasio accede al sistema
    Given el usuario tiene el rol "gim_admin"
    When llamo a getDashboardUrl("gim_admin")
    Then debería retornar "admin-dashboard.html"

  Scenario: Profesor accede al sistema
    Given el usuario tiene el rol "profesor"
    When llamo a getDashboardUrl("profesor")
    Then debería retornar "profesor-dashboard.html"

  Scenario: Alumno accede al sistema
    Given el usuario tiene el rol "alumno"
    When llamo a getDashboardUrl("alumno")
    Then debería retornar "student-profile.html"

  Scenario: Rol desconocido redirige a login
    Given el usuario tiene un rol no registrado "visitante"
    When llamo a getDashboardUrl("visitante")
    Then debería retornar "login.html"
```

### US-UT-02 — Validar variables de entorno de Supabase
**Prioridad:** P0  
**Test file sugerido:** `tests/unit/supabase/env-validation.test.js`

```gherkin
Feature: Validación de variables de entorno en build
  Como proceso de build
  Necesito validar que las variables de Supabase estén presentes
  Para fallar tempranamente si faltan credenciales

  Scenario Outline: Build con variables completas
    Given el entorno tiene SUPABASE_URL definido como "<url>"
    And el entorno tiene SUPABASE_ANON_KEY definido como "<key>"
    When ejecuto el script generate-supabase-config.cjs
    Then el build debería completar sin error

  Scenario: Build sin SUPABASE_URL
    Given el entorno no tiene SUPABASE_URL definido
    When ejecuto el script generate-supabase-config.cjs
    Then debería fallar con mensaje "Missing SUPABASE_URL or SUPABASE_ANON_KEY"
```

### US-UT-03 — Validar normalización de rol `coach` → `profesor`
**Prioridad:** P0  
**Test file sugerido:** `tests/unit/auth/role-normalization.test.js`

```gherkin
Feature: Normalización de roles heredados
  Como sistema de autenticación
  Necesito normalizar roles antiguos a la estructura actual
  Para mantener compatibilidad hacia atrás

  Scenario: Rol 'coach' se normaliza a 'profesor'
    Given el usuario tiene el rol "coach"
    When llamo a getDashboardUrl("coach")
    Then debería retornar "profesor-dashboard.html"
```

---

## P1 — Unit tests de dominio
- ✅ US-UT-04: redondeo de pesos (`round`).
- ✅ US-UT-05: cálculo de porcentajes (`pct`).
- ✅ US-UT-06: generación de programas de fuerza.
- ✅ US-UT-07: parser de formato `3×5`.

## P2 — Contract tests
- ✅ US-UT-08: contrato de generación de `supabase.js` (filesystem/output path).

## P3 — Smoke/E2E mínimos
- ✅ US-UT-09: integración `auth` + `auth-guard` + rutas.

---

## Top 5 historias para arrancar mañana
1. Cobertura adicional de casos borde en `round` y `pct`
2. Cobertura de casos avanzados de parser `3×5+`
3. Cobertura de casos avanzados en generadores PPL/Wendler
4. Contract test de subida de avatars/storage
5. Smoke test de flujo completo de workout

## Orden recomendado en 2 sprints
### Sprint 1 (completado)
US-UT-04, US-UT-05, US-UT-07 ✅

### Sprint 2 (completado)
US-UT-08, US-UT-09 ✅

## Riesgo si se hace UI antes de estos tests
- Regresiones silenciosas en rutas/auth.
- Cálculos de cargas incorrectos en programas.
- Parser de sets inestable.
- Deploy roto por config incompleta.
