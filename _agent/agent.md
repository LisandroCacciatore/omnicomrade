# TechFitness — Agent de Proyecto

Sos el agente de desarrollo del proyecto **TechFitness**: un SaaS multitenant de gestión de gimnasios.
El proyecto se reinicia desde cero. Cada decisión que tomás tiene que ser consistente con este documento.

---

## Contexto del Producto

**TechFitness** es una plataforma SaaS B2B que los dueños de gimnasios contratan para gestionar:
- Alumnos y sus membresías
- Rutinas y ejercicios asignados por profesores
- Asistencia y métricas de rendimiento
- Comunicación interna (notificaciones, alertas)
- Configuración del gimnasio como tenant

### Modelo de negocio
- **Multitenant**: cada gimnasio es un tenant aislado
- **Roles dentro de cada tenant**: `gim_admin`, `profesor`, `alumno`
- **Planes de suscripción**: Free, Premium Analytics
- **Stack de backend**: Supabase (Auth + Postgres + RLS + Realtime)

---

## Roles del Sistema

| Rol | Acceso | Dashboard |
|-----|--------|-----------|
| `gim_admin` | Gestión total del tenant | `admin_dashboard` |
| `profesor` | Alumnos asignados + rutinas | `profesor_dashboard` |
| `alumno` | Su perfil y rutina | `student_profile` |

---

## Stack Tecnológico

### Frontend
- **Framework**: HTML + Tailwind CSS (con config personalizada)
- **Iconografía**: Material Symbols Outlined (Google)
- **Tipografía**: Space Grotesk (Google Fonts)
- **Modo**: Dark mode por defecto (`class="dark"` en `<html>`)

### Design Tokens (Tailwind)
```js
colors: {
  primary:           "#3B82F6",  // Azul — acción principal
  success:           "#10B981",  // Verde — estados OK
  danger:            "#EF4444",  // Rojo — errores / crítico
  warning:           "#F59E0B",  // Amarillo — advertencias
  secondary:         "#10B981",  // Alias de success
  "background-dark": "#0B1218",  // Fondo principal dark
  "surface-dark":    "#161E26",  // Cards/panels dark
  "border-dark":     "#1E293B",  // Bordes dark
  "border-muted":    "#334155",  // Bordes sutiles
  "background-light":"#f1f5f9",  // Fondo light
}
```

### Backend
- **Auth**: Supabase Auth (email + password)
- **DB**: PostgreSQL vía Supabase
- **Row Level Security**: Activado — cada query está filtrada por tenant
- **Realtime**: Para notificaciones y presencia
- **Storage**: Para logos y assets de gimnasios

---

## Pantallas Existentes (como referencia de diseño)

| Archivo | Rol | Descripción |
|---------|-----|-------------|
| `login.html` | Todos | Autenticación, redirige por rol |
| `admin_dashboard.html` | gim_admin | Overview con métricas y accesos rápidos |
| `student_list.html` | gim_admin / profesor | Lista de alumnos con filtros |
| `student_profile.html` | gim_admin / profesor | Perfil individual de alumno |
| `routine_editor.html` | profesor | Editor de rutinas drag-and-drop |
| `user_management.html` | gim_admin | CRUD de usuarios del tenant |
| `profesor_dashboard.html` | profesor | Dashboard específico del profesor |
| `gym_setting.html` | gim_admin | Config técnica del gimnasio |
| `notification_center.html` | Todos | Panel lateral de notificaciones |
| `empty_state_no_alert.html` | gim_admin | Estado vacío — sin alertas |
| `empty_state_no_student.html` | gim_admin | Estado vacío — sin alumnos |

---

## Principios No Negociables

### Arquitectura
1. **RLS siempre activo** — ninguna tabla es accesible sin política de seguridad por tenant
2. **Un tenant, un schema lógico** — los datos nunca se mezclan entre gimnasios
3. **Auth state global** — el rol del usuario se lee de `app_metadata.role` al login
4. **Mobile-first** — todas las pantallas deben funcionar en móvil

### Diseño
1. **Dark mode es el default** — `class="dark"` en `<html>`, soporte light opcional
2. **Design tokens de Tailwind** — no usar colores hardcodeados fuera del config
3. **Material Symbols** — no mezclar con otras librerías de iconos
4. **Space Grotesk** — tipografía única del sistema
5. **Estados vacíos explícitos** — toda lista o sección que pueda estar vacía tiene su empty state

### Desarrollo
1. **Componentes primero** — antes de una pantalla, definir los componentes que la componen
2. **TypeScript estricto** — si el proyecto evoluciona a un framework (React/Next), TS obligatorio
3. **Sin lógica en el HTML** — la UI no hace consultas directas; toda data pasa por una capa de servicio
4. **Tests de integración** — Playwright cubre los flujos críticos antes de mergear

### Proceso
1. **User stories antes de código** — el BA define el comportamiento antes de que el dev lo implemente
2. **Diseño aprobado antes de código** — el UX/UI entrega mocks antes del sprint de desarrollo
3. **QA bloquea el deploy** — si hay un test de Playwright roto, no se mergea
4. **Lean primero** — no construir features que no tienen un usuario que la pidió

---

## Flujo de Trabajo del Equipo

```
BA define historia
     ↓
UX/UI diseña pantalla / componente
     ↓
Arquitecto valida schema y API
     ↓
Dev implementa
     ↓
QA escribe test Playwright
     ↓
PM cierra historia en el tablero
```

---

## Cómo Usar este Documento

Este `AGENT.md` es la fuente de verdad del proyecto.
Antes de tomar cualquier decisión técnica o de diseño, consultalo.

Cada rol tiene su propio `SKILL.md` con instrucciones específicas:

| Rol | Archivo |
|-----|---------|
| UX/UI Designer | `skills/ux-ui/SKILL.md` |
| Product Manager | `skills/pm/SKILL.md` |
| Business Analyst | `skills/ba/SKILL.md` |
| Arquitecto | `skills/arquitecto/SKILL.md` |
| Desarrollador | `skills/dev/SKILL.md` |
| QA (Playwright) | `skills/qa/SKILL.md` |

---

## Estado Actual del Proyecto

El proyecto se reinicia desde cero. Las pantallas HTML existentes son **referencia de diseño**, no código de producción.

**Lo que existe**: Mocks HTML estáticos con el design system definido.
**Lo que falta**: Todo el resto.

Empezar por: BA → arquitecto → dev (en ese orden).
