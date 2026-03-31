# Estrategia recomendada: cambios de interfaz + testing

## Respuesta corta
Para no frenar producto: **hacemos ambos**, pero en este orden:
1. Dejar una base mínima de tests unitarios hoy (ya agregado).
2. Implementar cambios de interfaz de rutinas.
3. Ejecutar suite completa + smoke manual al final de cada incremento.

## Por qué este enfoque
- Si primero cambiamos mucha UI sin baseline de tests, es más difícil detectar regresiones.
- Con una base mínima (ruteo + build/env + lógica pura) ganamos red de seguridad para iterar rápido.

## Qué quedó cubierto ahora
- Ruteo por rol (`alumno`, `coach`, fallback).
- Validación de `SUPABASE_URL` y `SUPABASE_ANON_KEY` para generación de `js/supabase.js`.

## Checklist para próximos cambios en interfaz de rutinas
1. Extraer función pura (sin DOM) por cada lógica nueva importante.
2. Agregar test unitario de esa función en `tests/unit`.
3. Recién después conectar UI/DOM.
4. Correr:
   - `npm run test:unit`
   - `npm run build` (con env vars)
5. Hacer smoke manual:
   - login por rol
   - abrir builder de rutinas
   - guardar rutina
   - volver a perfil y verificar asignación
