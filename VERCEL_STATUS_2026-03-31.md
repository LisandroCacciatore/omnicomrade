# Estado actual del proyecto en contexto Vercel (2026-03-31)

## Resumen ejecutivo
El proyecto está en un estado **deployable en Vercel como sitio estático** y el comando de build local actual finaliza correctamente.

Sin embargo, persisten temas funcionales y operativos para producción:
1. Inconsistencia de redirección para rol `alumno` entre `index.html` y `js/auth.js`/`js/auth-guard.js`.
2. Dependencia de `js/supabase.js` generado en build (requiere variables de entorno correctas).
3. No hay evidencia en este snapshot de pipeline moderno (Vite/ESLint/Prettier) ni modularización reportada.

## Evidencia verificada

### 1) Configuración Vercel
- `vercel.json` define salida en raíz (`outputDirectory: "."`) y redirección de `/` hacia `/login`.
- También aplica rewrite genérico a `/$1`.

### 2) Build actual
- `package.json` incluye script `build` que genera `js/supabase.js` vía `printf` con `SUPABASE_URL` y `SUPABASE_ANON_KEY`.
- El build local ejecuta correctamente (`npm run build` con exit code 0).

### 3) Riesgo funcional post-deploy
- `index.html`: rol `alumno` => `student-profile.html`.
- `js/auth.js`: rol `alumno` => `student-dashboard.html`.
- `js/auth-guard.js`: fallback de rol `alumno` => `student-dashboard.html`.

Resultado: hay riesgo de navegación inconsistente para alumnos según punto de entrada.

## Checklist inmediato (hoy)
1. Definir única home para `alumno` y unificarla en los 3 archivos.
2. Confirmar variables de entorno en Vercel:
   - `SUPABASE_URL`
   - `SUPABASE_ANON_KEY`
3. Verificar en producción:
   - login admin
   - login profesor
   - login alumno (ruta final esperada)
4. Revisar que `js/supabase.js` no quede cacheado con valores viejos entre despliegues.

## Conclusión
Sí: están "en Vercel" técnicamente.
No: todavía no está completamente "hardeneado" para producción consistente en flujo de alumno.

## Actualización aplicada (2026-03-31)
- Se unificó la ruta de `alumno` en los puntos críticos a `student-profile.html`.
- El script `build` ahora falla explícitamente si faltan `SUPABASE_URL` o `SUPABASE_ANON_KEY`, para evitar deploys inválidos en Vercel.
