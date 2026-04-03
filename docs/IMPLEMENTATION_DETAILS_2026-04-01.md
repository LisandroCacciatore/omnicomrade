# Documentación de Cambios - Sesión 2026-04-01

## Resumen Ejecutivo

Se implementaron 10 historias de usuario (US-01 a US-10) relacionadas con el flujo de onboarding transaccional, machine de estados de membresía, wizard UI, KPIs centralizados e instrumentación del funnel.

---

## US-01: Onboarding Transaccional (Alumno + Membresía + Programa)

### Problema

El flujo actual está separado en pasos UI (`saveNewStudent` y `saveMembresia`) y puede cortarse a mitad de proceso, dejando estados inconsistentes.

### Solución

Backend API con lógica transaccional atómica (all-or-nothing).

### Archivos Creados

| Archivo                                | Descripción                        |
| -------------------------------------- | ---------------------------------- |
| `server/index.js`                      | Entry point del servidor Express   |
| `server/routes/onboarding.js`          | Endpoint POST /api/onboarding      |
| `server/services/onboardingService.js` | Lógica transaccional con auditoría |

### Características

- **Atomicidad**: Si falla la membresía, se elimina el alumno creado (rollback)
- **Idempotencia**: Soporta `request_id` para evitar duplicados
- **Auditoría**: Cada intento se registra en `onboarding_audit`
- **Estados claros**: Devuelve estados intermedios (`partial: true` si falla programa)

### API Endpoint

```
POST /api/onboarding
{
  "request_id": "uuid",
  "gym_id": "uuid",
  "student": { "full_name": "...", "email": "...", ... },
  "membership": { "plan": "mensual", "start_date": "...", "amount": ... },
  "program": { "template_id": "uuid" }
}
```

### Migración SQL

```sql
-- supabase/migrations/20260331_000002_onboarding_audit.sql
CREATE TABLE onboarding_audit (
  id UUID, request_id UUID, gym_id UUID, actor_id UUID,
  student_id UUID, membership_id UUID, program_id UUID,
  step TEXT, status TEXT, data JSONB, error_code TEXT,
  error_message TEXT, recoverable BOOLEAN, ...
);
```

---

## US-02: Máquina de Estados de Membresía

### Problema

Múltiples estados en UI sin gobernanza única de transición.

### Solución

FSM formal con transiciones validadas server-side.

### Archivos Creados

| Archivo                                     | Descripción                              |
| ------------------------------------------- | ---------------------------------------- |
| `server/services/membershipStateMachine.js` | Definición de estados y transiciones     |
| `server/routes/membership.js`               | Endpoint POST /api/membership/transition |

### Estados Válidos

```
pendiente → {activa, suspendida}
activa → {por_vencer, vencida, suspendida}
por_vencer → {activa, vencida, suspendida}
vencida → {activa, suspendida}
suspendida → {activa, pendiente}
```

### Validación

- Solo acepta transiciones definidas en la matriz
- Devuelve 422 con mensaje claro si es inválida
- Registra cada transición en `membership_transitions`

### Migración SQL

```sql
-- supabase/migrations/20260331_000003_membership_transitions.sql
CREATE TABLE membership_transitions (
  id UUID, student_id UUID, from_state TEXT, to_state TEXT,
  actor_id UUID, reason TEXT, triggered_by TEXT
);
```

---

## US-03: Wizard UI de Onboarding en 1 Solo Flujo

### Problema

Flujo fragmentado con modal post-alta que puede cortarse.

### Solución

Wizard de 3 pasos con progreso visible y botón "Omitir".

### Archivos Creados

| Archivo                  | Descripción                               |
| ------------------------ | ----------------------------------------- |
| `js/onboardingWizard.js` | Clase del wizard con renderizado dinámico |

### Steps

1. **Alumno**: Nombre, email, teléfono, fecha nacimiento, objetivo
2. **Membresía**: Plan, fecha inicio, monto, método de pago, notas
3. **Programa**: Selección de programa (opcional)

### Integración

- Modificado `admin-dashboard.html` para usar el wizard
- Modificado `js/admin-dashboard.js` para usar `window.onboardingWizard.open()`
- Botones "Omitir" en pasos 2 y 3 para flujos parciales

### Características

- **Stepper visual**: Muestra progreso con icons/check
- **Reanudable**: Mantiene `_data` en memoria durante el flujo
- **Feedback visual**: Errores inline, spinners de carga

---

## US-04: KPI y Métricas con Definición de Negocio Única

### Problema

Lógica de "activos", "por vencer" y "vencidos" en frontend puede divergir.

### Solución

Capa de servicio centralizada (`kpiService.js`).

### Archivos Creados

| Archivo            | Descripción                           |
| ------------------ | ------------------------------------- |
| `js/kpiService.js` | Definición única de KPIs con timezone |

### Definiciones

```javascript
ACTIVA: { status: 'activa', description: 'Alumnos con membresía vigente' }
POR_VENCER: { status: 'por_vencer', daysUntilExpiry: 7 }
VENCIDA: { status: 'vencida' }
PENDIENTE: { status: 'pendiente' }
```

### API

```javascript
kpiService.fetch(supabase, gymId, { timezone: 'America/Argentina/Buenos_Aires' });
kpiService.calculateStatus(endDate, { timezone });
```

---

## US-05: Instrumentación del Funnel de Onboarding

### Problema

No hay tracking de eventos del funnel.

### Solución

Eventos `student_created`, `membership_started`, `program_assigned`, `onboarding_abandoned`.

### Archivos Creados

| Archivo                  | Descripción                    |
| ------------------------ | ------------------------------ |
| `js/onboardingFunnel.js` | Tracking de eventos del funnel |

### Eventos

```javascript
trackStudentCreated(gymId, actorId, studentData);
trackMembershipStarted(gymId, actorId, studentId, membershipData);
trackProgramAssigned(gymId, actorId, studentId, programData);
trackOnboardingCompleted(gymId, actorId, studentId, context);
trackOnboardingAbandoned(gymId, actorId, step, studentId);
```

### Métricas de Conversión

```javascript
calculateFunnelConversion(events);
// Returns: { counts, conversions }
// { student_to_membership: 85%, membership_to_program: 60%, overall_completion: 45% }
```

---

## US-06: Unificación de Componente de Filtros

### Problema

Patrón de filtros duplicado en student-list, membership-list, routine-list.

### Solución

Componente reusable `FilterDropdown`.

### Archivos Creados

| Archivo                 | Descripción                       |
| ----------------------- | --------------------------------- |
| `js/filterComponent.js` | Clase FilterDropdown reutilizable |

### Uso

```javascript
const filter = new FilterDropdown({
  id: 'filter-status',
  label: 'Estado',
  placeholder: 'Todos',
  options: [
    { value: 'activa', label: 'Activa' },
    { value: 'vencida', label: 'Vencida' }
  ],
  onChange: (value) => {
    /* handle filter */
  }
});
filter.mount('#filter-container');
```

### Características

- Click outside para cerrar
- Selección con highlight
- Soporte para iconos y badges

---

## US-07: Resiliencia de Acciones Rápidas (ProgramAssign Fallback)

### Problema

Si ProgramAssignModal falla, solo hay toast de error sin camino alternativo.

### Solución

Fallback navegable a pantalla completa.

### Modificación

```javascript
// js/program-assign.js:388-408
catch (err) {
  footer.innerHTML = `
    <div class="flex-1 text-left">
      <p class="text-red-400 text-sm mb-2">${msg}</p>
      <a href="program-assign.html?student=${studentId}"
         class="inline-flex items-center gap-2 text-primary hover:underline">
        Ir a pantalla de asignación
      </a>
    </div>
    <button onclick="this.closest('form').querySelector('#pa-next').click()">
      Reintentar
    </button>
  `;
}
```

---

## US-08: Normalización de Adaptadores Legacy en tfUtils

### Problema

Aliases legacy para compatibilidad sin gobernanza.

### Solución

Sistema de telemetría de deprecación + documentación.

### Archivos Creados

| Archivo                      | Descripción                |
| ---------------------------- | -------------------------- |
| `js/deprecationTelemetry.js` | Tracking de uso de aliases |

### Aliases Marcados

```javascript
{
  'showToast': { replacement: 'toast' },
  'escapeHtml': { replacement: 'escHtml' },
  'setButtonLoading': { replacement: 'setBtnLoading' },
  'openModalLegacy': { replacement: 'showModal' }
}
```

### Uso

```javascript
window.tfDeprecationTelemetry.init({ endpoint: '/api/telemetry' });
window.tfDeprecationTelemetry.track('showToast', { page: 'admin-dashboard' });
```

### Documentación

Agregado en header de `js/utils.js`:

```javascript
/**
 * ─── DEPRECATION NOTES (US-08) ───────────────────────────────
 * Los siguientes alias están marcados para deprecación gradual:
 * - showToast -> toast
 * - escapeHtml -> escHtml
 * ...
 */
```

---

## US-09: E2E de Flujo Crítico Admin

### Problema

No hay tests del circuito completo: crear alumno → membresía → programa → validar.

### Solución

Tests E2E con mock de Supabase.

### Archivos Creados

| Archivo                                   | Descripción         |
| ----------------------------------------- | ------------------- |
| `tests/e2e/admin-onboarding-flow.test.js` | Tests E2E del flujo |

### Tests Implementados

1. **Happy path**: Completo flujo crear alumno → membresía → programa
2. **Error controlado 1**: Falla creación de membresía (datos incompletos)
3. **Error controlado 2**: Template de programa inexistente (error recuperable)
4. **Idempotencia**: Mismo request_id devuelve resultado cacheado

### Ejecución

```bash
node --test tests/e2e/admin-onboarding-flow.test.js
# Result: 4 pass, 0 fail
```

---

## US-10: Estándar de Fechas y Timezone de Negocio

### Problema

`new Date()` dispersos pueden causar off-by-one por timezone.

### Solución

Util central `businessDateUtils.js`.

### Archivos Creados

| Archivo                   | Descripción                              |
| ------------------------- | ---------------------------------------- |
| `js/businessDateUtils.js` | Util de fechas con timezone configurable |

### API

```javascript
import { businessDate, addDays, diffDays, isExpired, isExpiringSoon } from './businessDateUtils.js';

// Configurar timezone por gym
setBusinessTimezone('America/Argentina/Buenos_Aires');

// Usage
const today = businessDate(); // Fecha local sin hora
const daysUntil = getDaysUntil(endDate); // Días hasta expiry
const isExpiring = isExpiringSoon(endDate, 7); // ¿Vence en 7 días?
const isPast = isExpired(endDate); // ¿Ya venció?
```

### Funciones Disponibles

- `setBusinessTimezone(timezone)` / `getBusinessTimezone()`
- `businessDate(timezone)` - Fecha actual en timezone
- `businessDateString(timezone)` - ISO string local
- `addDays()`, `addMonths()`, `addYears()`
- `diffDays()`, `isSameDay()`, `isToday()`
- `isBefore()`, `isAfter()`, `isBetween()`
- `getDaysUntil()`, `isExpiringSoon()`, `isExpired()`
- `startOfWeek()`, `endOfWeek()`, `startOfMonth()`, `endOfMonth()`

---

## Cambios Adicionales

### package.json

Agregadas dependencias:

```json
{
  "dependencies": {
    "@supabase/supabase-js": "^2.39.0",
    "express": "^4.18.2",
    "uuid": "^9.0.0"
  },
  "scripts": {
    "dev:api": "node server/index.js",
    "start": "node server/index.js"
  }
}
```

### .eslintrc.json

Cambiado `sourceType` de `script` a `module` para soportar ES6 modules.

---

## Lista de Archivos Creados/Modificados

### Nuevos (21 archivos)

```
js/businessDateUtils.js
js/deprecationTelemetry.js
js/filterComponent.js
js/kpiService.js
js/onboardingFunnel.js
js/onboardingWizard.js
server/index.js
server/routes/membership.js
server/routes/onboarding.js
server/services/membershipStateMachine.js
server/services/onboardingService.js
supabase/migrations/20260331_000002_onboarding_audit.sql
supabase/migrations/20260331_000003_membership_transitions.sql
tests/e2e/admin-onboarding-flow.test.js
```

### Modificados (7 archivos)

```
.eslintrc.json
admin-dashboard.html
js/admin-dashboard.js
js/program-assign.js
js/utils.js
package-lock.json
package.json
```

---

## Próximos Pasos (Pendientes)

| US    | Descripción                           | Estado    |
| ----- | ------------------------------------- | --------- |
| US-11 | Integrar tests en CI/CD               | Pendiente |
| US-12 | Dashboard de conversión por gym/coach | Pendiente |
| US-13 | Alertas de drop-off (>30%)            | Pendiente |

---

## Notas de Seguridad

- No exponer `SUPABASE_SERVICE_KEY` en cliente
- Validar `gym_id` en todos los endpoints
- Rate limiting en `/api/onboarding`
- Sanitizar inputs para evitar SQL injection (Supabase lo maneja)

---

_Documento generado: 2026-04-01_
_Repo: github.com/LisandroCacciatore/omnicomrade_
_Commit: 28c1188_
