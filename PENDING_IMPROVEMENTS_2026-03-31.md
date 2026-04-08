# OmniComrade — Pendientes de mejoras acordadas (2026-03-31)

> ⚠️ Documento histórico (corte 2026-03-31). Para estado operativo validado más reciente ver `docs/OPERATIVE_STATUS_2026-04-08.md`.

## Resumen rápido
Con los últimos cambios, quedó **cerrado** el problema de ruta de `alumno` y se agregó validación de env vars en build.
Lo demás del plan de refactor/hardening sigue mayormente pendiente.

## ✅ Completado recientemente
1. **US-A1/A2 (parcial clave):** ruta `alumno` unificada a `student-profile.html` en auth + guard + sesión.
2. **Hardening de deploy:** `npm run build` ahora falla si faltan `SUPABASE_URL` o `SUPABASE_ANON_KEY`.
3. **Higiene de repo:** `.gitignore` con `node_modules/` y `js/supabase.js`.

## 🔴 Pendiente crítico (P0)
1. **US-C1/C2 — Training Engine desacoplado**
   - Falta `js/training-engine.js`.
   - La lógica de programas sigue en `js/utils.js`.
2. **US-D1/D2 — Split de utilidades**
   - Falta `js/ui-utils.js` y adapter transitorio formal.
   - `js/utils.js` sigue centralizando UI + dominio.
3. **US-B1/B2 — Wrapper DB**
   - Falta `js/db.js` con API `DB.*`.
   - Las pantallas siguen usando `window.supabaseClient` directamente.

## 🟠 Pendiente importante (P1)
1. **US-E1 — Vite/ES Modules**
   - Falta `vite.config.js` y estructura de entrada/salida moderna.
2. **US-E2 — Tailwind local (sin CDN/FOUC)**
   - El proyecto sigue cargando Tailwind por CDN.
3. **US-F1/F2 — Calidad estática + JSDoc**
   - Faltan `.eslintrc`/`prettier` y cobertura JSDoc sistemática.

## 🟡 Pendiente de confiabilidad (P2)
1. **US-G1 — Tests unitarios de cálculos**
2. **US-G2 — Smoke tests E2E de rutas/login**
3. **US-H1 — Migraciones versionadas**
4. **US-H2 — Validación post-migración**

## 🔵 Pendiente de evolución (P3)
1. **US-I1 — Store mínimo con Custom Events**
2. **US-J1 — Instrumentación de eventos (activación/retención)**

## Orden recomendado (próximo sprint)
1. `training-engine.js` (extraer cálculos puros + test unitario inicial)
2. `db.js` (wrapper mínimo: `students.getAll`, `memberships.getAll`)
3. Split de `utils.js` en módulos pequeños
4. Vite + Tailwind local
