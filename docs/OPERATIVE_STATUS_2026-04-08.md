# Estado operativo validado — 2026-04-08

## Objetivo
Actualizar el estado real del repositorio y reducir tres riesgos inmediatos:

1. Confiabilidad CI (`test:all` en rojo)
2. Deuda técnica de lint sin plan incremental
3. Desalineación documental entre estado actual y documentos históricos

## Acciones ejecutadas

### 1) Confiabilidad CI
- Se corrigió un problema de compatibilidad de entorno de tests en `js/utils.js`:
  - El listener de `unhandledrejection` ahora se registra solo si `window.addEventListener` existe.
- Se ajustó la sensibilidad del riesgo en `js/athlete-insights.js`:
  - Dolor alto del día (`pain >= 4`) ahora suma `+30` (antes `+20`) para alinear la clasificación con escenarios críticos ya cubiertos por test.

### 2) Deuda técnica de lint
- Se mantiene deuda transversal de lint en el repositorio.
- Estrategia recomendada (sin bloquear releases críticos):
  1. Corregir lint por dominio (`server/`, `js/core`, `js/pages`, `tests/`).
  2. Introducir gate gradual en CI por carpetas estabilizadas.
  3. Mantener un presupuesto de deuda (errores/warnings) decreciente por sprint.

### 3) Desalineación documental
- `PENDING_IMPROVEMENTS_2026-03-31.md` queda etiquetado explícitamente como documento histórico.
- Este archivo pasa a ser la referencia de estado operativo validado al 2026-04-08.

## Verificación sugerida
- `npm run test:all`
- `npm run lint`

## Criterio de uso
- Para decisiones actuales de ejecución y priorización, usar este documento.
- Para contexto del proceso y evolución, conservar y consultar los documentos históricos.
