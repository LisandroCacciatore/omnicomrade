---
name: techfitness-dev
description: >
  Implementa features de TechFitness siguiendo el stack y las convenciones del proyecto.
  Activar cuando el usuario pida escribir código, implementar una historia de usuario,
  crear un componente, escribir una función de acceso a datos, conectar el frontend
  con Supabase, agregar interactividad a una pantalla, o cuando diga "implementá",
  "codéalo", "escribí el código para", "conectá esto con Supabase", "hacé funcionar X",
  "creá el servicio de", "agregá la lógica de", o "refactorizá". También activar
  cuando haya que revisar código existente, depurar un bug, o mejorar la performance.
  Siempre leer el AGENT.md y la historia de usuario correspondiente antes de codear.
---

# TechFitness — Developer Skill

Implementás features siguiendo las convenciones del proyecto.
Antes de escribir una sola línea de código, tenés que saber:
1. Qué historia de usuario estás implementando (del BA)
2. Cómo se ve la pantalla (del UX/UI)
3. Qué tablas y políticas RLS existen (del Arquitecto)

Leer `AGENT.md` + la historia relevante antes de arrancar.

---

## Stack y Dependencias

```json
{
  "core": {
    "css": "Tailwind CSS (CDN con config personalizada)",
    "icons": "Material Symbols Outlined (Google Fonts)",
    "font": "Space Grotesk (Google Fonts)",
    "backend": "@supabase/supabase-js@2"
  },
  "futuro (cuando se migre a framework)": {
    "framework": "Next.js 14+ (App Router)",
    "language": "TypeScript strict",
    "state": "Zustand o Context API"
  }
}
```

---

## Inicialización de Supabase

```typescript
// src/lib/supabase.ts
import { createClient } from '@supabase/supabase-js'
import type { Database } from '../types/database'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY

export const supabase = createClient<Database>(supabaseUrl, supabaseKey)
```

```typescript
// src/lib/auth.ts
import { supabase } from './supabase'

export async function signIn(email: string, password: string) {
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password
  })
  if (error) throw error
  return data
}

export function getRole(user: User): string {
  return user.app_metadata?.role ?? ''
}

export async function getSession() {
  const { data: { session } } = await supabase.auth.getSession()
  return session
}
```

---

## Servicios de Datos

Toda consulta a Supabase vive en `src/services/`. El HTML/componente no hace queries directas.

### Patrón base

```typescript
// src/services/students.ts
import { supabase } from '../lib/supabase'
import type { Database } from '../types/database'

type Student = Database['public']['Tables']['students']['Row']
type StudentInsert = Database['public']['Tables']['students']['Insert']

export async function getStudents(): Promise<Student[]> {
  const { data, error } = await supabase
    .from('students')
    .select('*, profiles!assigned_to(full_name)')
    .is('deleted_at', null)
    .order('full_name')

  if (error) throw error
  return data
}

export async function createStudent(student: StudentInsert): Promise<Student> {
  const { data, error } = await supabase
    .from('students')
    .insert(student)
    .select()
    .single()

  if (error) throw error
  return data
}

export async function updateStudent(
  id: string,
  updates: Partial<StudentInsert>
): Promise<Student> {
  const { data, error } = await supabase
    .from('students')
    .update(updates)
    .eq('id', id)
    .select()
    .single()

  if (error) throw error
  return data
}

export async function softDeleteStudent(id: string): Promise<void> {
  const { error } = await supabase
    .from('students')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', id)

  if (error) throw error
}
```

### Manejo de Errores

```typescript
// Wrapper estándar para operaciones de UI
export async function withErrorHandling<T>(
  operation: () => Promise<T>,
  onError?: (message: string) => void
): Promise<T | null> {
  try {
    return await operation()
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Error inesperado'
    console.error(message)
    onError?.(message)
    return null
  }
}
```

---

## Patrón de Componentes HTML

Los componentes HTML con interactividad siguen este patrón:

```html
<!-- Estructura base de una pantalla -->
<!DOCTYPE html>
<html class="dark" lang="es">
<head>
  <meta charset="utf-8"/>
  <meta content="width=device-width, initial-scale=1.0" name="viewport"/>
  <title>[Título] | TechFitness</title>
  <!-- Siempre en este orden: Tailwind → Fonts → Supabase -->
  <script src="https://cdn.tailwindcss.com?plugins=forms,container-queries"></script>
  <link href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@300;400;500;600;700&display=swap" rel="stylesheet"/>
  <link href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght,FILL@100..700,0..1&display=swap" rel="stylesheet"/>
  <script>
    tailwind.config = {
      darkMode: "class",
      theme: {
        extend: {
          colors: {
            "primary": "#3B82F6",
            "success": "#10B981",
            "danger": "#EF4444",
            "warning": "#F59E0B",
            "background-dark": "#0B1218",
            "surface-dark": "#161E26",
            "border-dark": "#1E293B",
            "border-muted": "#334155",
            "background-light": "#f1f5f9"
          },
          fontFamily: { "display": ["Space Grotesk"] }
        }
      }
    }
  </script>
  <style>
    body { font-family: 'Space Grotesk', sans-serif; }
    .material-symbols-outlined {
      font-variation-settings: 'FILL' 0, 'wght' 400, 'GRAD' 0, 'opsz' 24;
    }
  </style>
</head>
<body class="bg-background-light dark:bg-background-dark text-slate-900
  dark:text-slate-100 min-h-screen">

  <!-- [Contenido de la pantalla] -->

  <script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>
  <script>
    // Inicialización
    const { createClient } = window.supabase
    const client = createClient(
      '[SUPABASE_URL]',
      '[SUPABASE_ANON_KEY]'
    )

    // Verificar sesión al cargar
    async function init() {
      const { data: { session } } = await client.auth.getSession()
      if (!session) {
        window.location.href = 'login.html'
        return
      }
      // Cargar datos de la pantalla
      await loadPageData()
    }

    // Lógica de la pantalla
    async function loadPageData() {
      // ...
    }

    init()
  </script>
</body>
</html>
```

---

## Validación de Formularios

```javascript
// Validación inline (sin librerías externas)
function validateForm(fields) {
  const errors = {}

  if (!fields.full_name?.trim() || fields.full_name.trim().length < 3) {
    errors.full_name = 'El nombre debe tener al menos 3 caracteres'
  }

  if (fields.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(fields.email)) {
    errors.email = 'El email no tiene un formato válido'
  }

  if (fields.phone && fields.phone.replace(/\D/g, '').length < 8) {
    errors.phone = 'El teléfono debe tener al menos 8 dígitos'
  }

  return errors
}

// Mostrar errores en el form
function showFieldError(fieldId, message) {
  const field = document.getElementById(fieldId)
  field?.classList.add('border-danger', 'focus:ring-danger')
  field?.classList.remove('border-slate-200', 'dark:border-slate-700')

  const errorEl = document.getElementById(`${fieldId}-error`)
  if (errorEl) {
    errorEl.textContent = message
    errorEl.classList.remove('hidden')
  }
}

function clearFieldErrors() {
  document.querySelectorAll('[data-error]').forEach(el => {
    el.classList.add('hidden')
  })
}
```

---

## Estados de UI

Toda acción asíncrona maneja estos tres estados:

```javascript
// Loading
function setLoading(buttonId, isLoading) {
  const btn = document.getElementById(buttonId)
  const text = btn?.querySelector('[data-text]')
  const spinner = btn?.querySelector('[data-spinner]')

  if (isLoading) {
    btn?.setAttribute('disabled', '')
    btn?.classList.add('opacity-70', 'cursor-not-allowed')
    spinner?.classList.remove('hidden')
    if (text) text.textContent = 'Guardando...'
  } else {
    btn?.removeAttribute('disabled')
    btn?.classList.remove('opacity-70', 'cursor-not-allowed')
    spinner?.classList.add('hidden')
  }
}

// Toast de éxito/error
function showToast(message, type = 'success') {
  const colors = {
    success: 'bg-success text-white',
    error: 'bg-danger text-white',
    warning: 'bg-warning text-white'
  }

  const toast = document.createElement('div')
  toast.className = `fixed bottom-6 right-6 z-50 px-6 py-3 rounded-xl
    font-bold text-sm shadow-xl ${colors[type]} transition-all`
  toast.textContent = message

  document.body.appendChild(toast)
  setTimeout(() => toast.remove(), 3000)
}
```

---

## Skeleton Loader (estado de carga de listas)

```html
<!-- Usar mientras carga la data. Reemplazar con el contenido real. -->
<div class="animate-pulse space-y-3" id="skeleton-list">
  <div class="h-16 bg-slate-200 dark:bg-slate-800 rounded-xl"></div>
  <div class="h-16 bg-slate-200 dark:bg-slate-800 rounded-xl opacity-70"></div>
  <div class="h-16 bg-slate-200 dark:bg-slate-800 rounded-xl opacity-40"></div>
</div>
```

---

## Guard de Autenticación y Rol

```javascript
// Al inicio de cada pantalla protegida
async function authGuard(requiredRoles = []) {
  const { data: { session } } = await client.auth.getSession()

  if (!session) {
    window.location.href = 'login.html'
    return null
  }

  const role = session.user.app_metadata?.role

  if (requiredRoles.length > 0 && !requiredRoles.includes(role)) {
    // Redirigir al dashboard correcto según el rol
    const dashboards = {
      gim_admin: 'admin_dashboard.html',
      profesor: 'profesor_dashboard.html',
      alumno: 'student_profile.html'
    }
    window.location.href = dashboards[role] ?? 'login.html'
    return null
  }

  return session
}

// Uso en cada pantalla:
// admin_dashboard.html:
const session = await authGuard(['gim_admin'])
if (!session) return

// profesor_dashboard.html:
const session = await authGuard(['profesor', 'gim_admin'])
if (!session) return
```

---

## Convenciones de Código

### Naming
- Funciones: `camelCase` — `getStudents()`, `createRoutine()`
- Variables: `camelCase` — `studentList`, `currentUser`
- IDs en DOM: `kebab-case` — `student-list`, `create-btn`
- Data attributes: `data-[nombre]` — `data-student-id`, `data-role`

### Comentarios
```javascript
// Bien: explica el POR QUÉ, no el QUÉ
// El email se normaliza a lowercase para evitar duplicados case-insensitive
const normalizedEmail = email.toLowerCase().trim()

// Mal: explica lo que ya se ve en el código
// Convierte a lowercase
const normalizedEmail = email.toLowerCase()
```

### Seguridad
- Nunca exponer la `SERVICE_ROLE` key en el frontend
- Usar siempre la `anon` key — el RLS hace el filtrado
- No construir queries SQL con string interpolation
- Sanitizar inputs antes de mostrarlos en el DOM (`textContent`, no `innerHTML`)

---

## Checklist antes de Mergear

1. ☐ La pantalla pasa el auth guard correcto
2. ☐ Los datos se cargan desde el servicio (no query directo en el HTML)
3. ☐ Hay skeleton loader mientras cargan los datos
4. ☐ Hay empty state si la lista puede estar vacía
5. ☐ Los formularios tienen validación frontend
6. ☐ Los errores de Supabase se muestran al usuario (no solo en console)
7. ☐ Las acciones asíncronas deshabilitan el botón durante la carga
8. ☐ No hay `console.log` en código de producción
9. ☐ Los tests de Playwright del QA pasan en el flujo nuevo
10. ☐ El código se puede leer sin comentarios (es autoexplicativo)

---

## Referencias

- `AGENT.md` — Stack, roles, pantallas existentes
- `skills/ba/SKILL.md` — Historia de usuario que estás implementando
- `skills/ux-ui/SKILL.md` — Componentes y design system
- `skills/arquitecto/SKILL.md` — Schema, RLS y servicios de datos
- `skills/qa/SKILL.md` — Tests que deben pasar antes del deploy
