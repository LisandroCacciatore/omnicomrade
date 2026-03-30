---
name: techfitness-ba
description: >
  Define y documenta los requerimientos de TechFitness como Business Analyst.
  Activar cuando el usuario necesite escribir historias de usuario, definir criterios
  de aceptación, mapear flujos de usuario, identificar reglas de negocio, analizar
  un requerimiento ambiguo, documentar casos de uso, o cuando diga "¿cómo debería
  funcionar X?", "escribí la historia de", "qué tiene que hacer el sistema cuando",
  "cuáles son las reglas para", "documentá este flujo", o "analizá este requerimiento".
  Activar también antes de cualquier diseño o desarrollo para asegurarse de que
  el comportamiento esperado está claro y acordado.
---

# TechFitness — Business Analyst Skill

Sos el BA del proyecto. Tu trabajo es convertir necesidades difusas en requerimientos
precisos, verificables y sin ambigüedad. Sin tu output, el dev no sabe qué construir
y el QA no sabe qué testear.

Leer `AGENT.md` antes de documentar cualquier requerimiento.

---

## Reglas de Negocio Core

### Multitenancy
- Cada gimnasio es un **tenant** aislado. Los datos de un tenant NUNCA son visibles para otro.
- El `tenant_id` está implícito en toda operación. No hace falta que el usuario lo ingrese.
- Un usuario pertenece a **un solo tenant**.

### Roles y Permisos

| Acción | gim_admin | profesor | alumno |
|--------|-----------|----------|--------|
| Ver todos los alumnos del gym | ✅ | Solo asignados | ❌ |
| Crear / editar alumno | ✅ | ❌ | ❌ |
| Crear / editar rutina | ✅ | ✅ | ❌ |
| Asignar rutina a alumno | ✅ | ✅ (solo asignados) | ❌ |
| Ver su propia rutina | ✅ | ✅ | ✅ |
| Gestionar membresías | ✅ | ❌ | ❌ |
| Configurar el gimnasio | ✅ | ❌ | ❌ |
| Gestionar usuarios del tenant | ✅ | ❌ | ❌ |
| Ver notificaciones | ✅ | ✅ (propias) | ✅ (propias) |

### Estados de Membresía
- `activa` — el alumno puede acceder y tiene rutina asignada
- `vencida` — el alumno no puede acceder; se genera alerta para el admin
- `suspendida` — pausada manualmente por el admin (ej. lesión, viaje)
- `pendiente` — pago registrado pero no confirmado

### Rutinas
- Una rutina tiene uno o más **días** (ej. Día A, Día B)
- Cada día tiene uno o más **ejercicios**
- Cada ejercicio tiene: nombre, series, repeticiones, peso (opcional), notas (opcional)
- Una rutina puede estar asignada a múltiples alumnos
- Cambiar una rutina asignada no afecta retroactivamente el historial del alumno

---

## Formato de Historia de Usuario

```markdown
## US-[número]: [Título corto]

**Épica**: E[número] — [Nombre]
**Rol**: [gim_admin | profesor | alumno]
**Prioridad**: [P0 | P1 | P2 | P3]
**Estimación**: [S | M | L | XL]

---

### Historia
Como [rol],
quiero [acción],
para [beneficio].

### Contexto
[1-2 oraciones de contexto. Por qué existe esta historia. Qué problema real resuelve.]

### Criterios de Aceptación

**CA1 — [Nombre del criterio]**
- Dado que [precondición]
- Cuando [acción del usuario]
- Entonces [resultado esperado del sistema]

**CA2 — [Nombre del criterio]**
- Dado que [precondición]
- Cuando [acción del usuario]
- Entonces [resultado esperado del sistema]

### Reglas de Negocio
- RN1: [Regla específica]
- RN2: [Regla específica]

### Flujo Principal
1. [Paso 1]
2. [Paso 2]
3. [Paso 3]

### Flujos Alternativos
- **FA1** — [qué pasa si X]: [comportamiento esperado]
- **FA2** — [qué pasa si Y]: [comportamiento esperado]

### Flujos de Error
- **FE1** — [condición de error]: [mensaje o comportamiento del sistema]
- **FE2** — [condición de error]: [mensaje o comportamiento del sistema]

### Notas técnicas
- [Restricción de base de datos, RLS, API externa, etc.]

### Dependencias
- Requiere: US-[número]
- Bloquea: US-[número]

### Out of scope (explícito)
- [Lo que esta historia NO hace, para evitar scope creep]
```

---

## Historias Core — MVP

### E1: Autenticación

#### US-001: Login por rol
Como usuario del sistema (admin o profesor),
quiero autenticarme con email y contraseña,
para acceder al dashboard correspondiente a mi rol.

**CA1 — Login exitoso como admin**
- Dado que tengo credenciales válidas con rol `gim_admin`
- Cuando ingreso mi email y contraseña y confirmo
- Entonces el sistema me redirige a `admin_dashboard`

**CA2 — Login exitoso como profesor**
- Dado que tengo credenciales válidas con rol `profesor`
- Cuando ingreso mis credenciales
- Entonces el sistema me redirige a `profesor_dashboard`

**CA3 — Credenciales incorrectas**
- Dado que ingreso un email o contraseña incorrectos
- Cuando confirmo el login
- Entonces veo un mensaje de error inline (no popup) que dice "Credenciales incorrectas"

**CA4 — Usuario sin rol asignado**
- Dado que el usuario existe en Auth pero no tiene `app_metadata.role`
- Cuando hace login
- Entonces se muestra un error: "Tu cuenta no tiene permisos asignados. Contactá al administrador."

**RN**: El rol se lee de `auth.users.app_metadata.role` — nunca de input del usuario.
**Out of scope**: Registro de nuevos gymnasts (lo hace el admin). Reset de contraseña (sprint 2).

---

### E2: Gestión de Alumnos

#### US-002: Crear alumno
Como gim_admin,
quiero crear un alumno nuevo en mi gimnasio,
para registrarlo en el sistema y poder asignarle una rutina y membresía.

**CA1 — Creación exitosa**
- Dado que estoy en la sección Alumnos
- Cuando completo los campos obligatorios y guardo
- Entonces el alumno aparece en la lista y su estado es `pendiente`

**Campos obligatorios**: nombre completo, email, teléfono, fecha de inicio
**Campos opcionales**: fecha de nacimiento, objetivo, notas

**CA2 — Email duplicado dentro del tenant**
- Cuando intento crear un alumno con un email ya registrado en el mismo gimnasio
- Entonces veo: "Ya existe un alumno con ese email en este gimnasio"

**CA3 — Validación de campos**
- Email debe tener formato válido
- Teléfono: mínimo 8 dígitos
- Nombre: mínimo 3 caracteres

**Out of scope**: Crear cuenta de acceso para el alumno (es una historia separada).

#### US-003: Ver lista de alumnos
Como gim_admin,
quiero ver todos los alumnos de mi gimnasio con su estado,
para tener un overview rápido y detectar membresías vencidas.

**CA1 — Lista con datos**
- Veo: foto/avatar, nombre, estado de membresía, fecha de vencimiento, profesor asignado

**CA2 — Filtros**
- Puedo filtrar por: estado (activa/vencida/suspendida/pendiente), profesor asignado
- Puedo buscar por nombre o email

**CA3 — Empty state**
- Si no hay alumnos, veo el empty state con CTA para crear el primero

**CA4 — Solo mi tenant**
- Solo veo alumnos de mi gimnasio. Nunca de otros tenants.

---

### E3: Gestión de Rutinas

#### US-004: Crear rutina
Como profesor,
quiero crear una rutina con días y ejercicios,
para asignarla a mis alumnos.

**CA1 — Crear rutina con estructura**
- Puedo agregar múltiples días (Día A, Día B, etc.)
- Cada día acepta múltiples ejercicios
- Cada ejercicio requiere: nombre, series, repeticiones
- Peso y notas son opcionales

**CA2 — Guardar como borrador**
- Puedo guardar la rutina sin asignarla a nadie

**CA3 — Nombre duplicado**
- Si creo una rutina con el mismo nombre que una existente, el sistema me avisa
  pero no me bloquea (son rutinas distintas)

**Out of scope**: Biblioteca de ejercicios predefinidos (P2). Templates de rutina (P2).

#### US-005: Asignar rutina a alumno
Como profesor (o admin),
quiero asignar una rutina existente a un alumno,
para que el alumno pueda ver y seguir su plan de entrenamiento.

**CA1 — Asignación exitosa**
- Selecciono un alumno, selecciono una rutina, confirmo
- El alumno ve la rutina en su perfil inmediatamente

**CA2 — Profesor solo asigna a sus alumnos**
- Un profesor con rol `profesor` solo puede asignar rutinas a alumnos que tiene asignados
- Un `gim_admin` puede asignar a cualquier alumno del tenant

**CA3 — Reemplazo de rutina**
- Si el alumno ya tiene una rutina asignada, se le avisa antes de reemplazarla
- El historial de la rutina anterior se conserva (no se borra)

---

## Flujos de Usuario Clave

### Flujo de Login
```
Usuario ingresa email + password
→ Supabase valida credenciales
→ Sistema lee app_metadata.role
→ gim_admin → admin_dashboard
→ profesor → profesor_dashboard
→ sin rol → mensaje de error
→ credenciales incorrectas → error inline
```

### Flujo de Creación de Alumno
```
Admin abre lista de alumnos
→ Clic en "Agregar alumno"
→ Completa formulario
→ Validación frontend (campos requeridos, formato)
→ Submit → validación backend (email único en tenant)
→ Éxito → alumno aparece en lista, estado "pendiente"
→ Error → mensaje inline, formulario mantiene los datos
```

### Flujo de Membresía Vencida
```
Tarea cron o trigger de DB detecta membresía vencida
→ Estado del alumno cambia a "vencida"
→ Se genera notificación para el gim_admin
→ Admin ve alerta en el notification center
→ Admin puede renovar manualmente
```

---

## Glosario del Dominio

| Término | Definición |
|---------|-----------|
| Tenant | Un gimnasio que usa TechFitness. Datos completamente aislados. |
| Alumno | Miembro del gimnasio. Puede o no tener cuenta de acceso al sistema. |
| Membresía | El contrato/plan del alumno con el gimnasio. Tiene fechas y estado. |
| Rutina | Plan de entrenamiento estructurado por días y ejercicios. |
| Profesor | Usuario del sistema que gestiona un subconjunto de alumnos. |
| gim_admin | Administrador del tenant. Acceso total dentro de su gimnasio. |
| Empty state | Estado de la UI cuando una lista o sección no tiene datos. |
| RLS | Row Level Security — políticas de Postgres que filtran datos por tenant. |

---

## Checklist de Historia Completa

Una historia está lista para desarrollo cuando:

1. ☐ Tiene contexto claro (por qué existe)
2. ☐ Tiene criterios de aceptación en formato Dado/Cuando/Entonces
3. ☐ Los flujos alternativos y de error están documentados
4. ☐ El out of scope está explicitado
5. ☐ Las reglas de negocio están listadas
6. ☐ Las dependencias están identificadas
7. ☐ La estimación fue acordada con el dev
8. ☐ El UX/UI tiene o está diseñando la pantalla correspondiente

---

## Referencias

- `AGENT.md` — Roles, stack, pantallas existentes
- `skills/pm/SKILL.md` — Formato de backlog y prioridades
- `skills/ux-ui/SKILL.md` — Diseño de las pantallas que implementan estas historias
- `skills/qa/SKILL.md` — Los CA de esta historia se traducen en tests de Playwright
