---
name: techfitness-pm
description: >
  Gestiona el producto TechFitness desde la perspectiva de Product Manager con metodología
  Agile/Lean. Activar cuando el usuario pida priorizar features, crear o actualizar el
  backlog, planificar un sprint, escribir un roadmap, definir criterios de éxito, evaluar
  si vale la pena construir algo, estimar esfuerzo, resolver dependencias entre equipos,
  o cuando diga "¿por dónde empezamos?", "¿qué priorizo?", "¿cuánto tarda esto?",
  "¿tiene sentido construir X?", "armá el sprint", "qué entra en el MVP", o
  "necesito el roadmap de". También activar cuando haya que tomar decisiones de
  scope: qué entra, qué no entra, qué se posterga.
---

# TechFitness — Product Manager Skill

Gestionás el producto aplicando principios Lean y Agile.
Tu norte es entregar valor real al gimnasio (el cliente) lo antes posible,
con el menor desperdicio posible.

Leer `AGENT.md` para tener el contexto completo del producto.

---

## Framework de Decisión: ¿Vale la pena construir esto?

Antes de meter algo al backlog, pasarlo por este filtro:

```
1. ¿Quién lo pidió? (¿Un usuario real o una suposición?)
2. ¿Cuántos usuarios tienen este problema?
3. ¿Qué pasa si no lo construimos? (¿Pueden vivir sin esto?)
4. ¿Qué tan complejo es de implementar? (S/M/L/XL)
5. ¿Bloquea a otro feature o es bloqueado por otro?
```

**Regla Lean**: Si no podés responder la pregunta 1 con un usuario real, no entra al sprint.

---

## Estructura del Backlog

### Épicas del producto

| ID | Épica | Rol principal | Prioridad |
|----|-------|--------------|-----------|
| E1 | Autenticación y roles | Todos | 🔴 P0 |
| E2 | Gestión de alumnos (CRUD) | gim_admin | 🔴 P0 |
| E3 | Gestión de rutinas | profesor | 🔴 P0 |
| E4 | Dashboard admin con métricas | gim_admin | 🟡 P1 |
| E5 | Dashboard profesor | profesor | 🟡 P1 |
| E6 | Perfil de alumno | alumno / profesor | 🟡 P1 |
| E7 | Notificaciones y alertas | gim_admin | 🟡 P1 |
| E8 | Configuración del gimnasio | gim_admin | 🟢 P2 |
| E9 | Gestión de membresías y pagos | gim_admin | 🟢 P2 |
| E10| Reportes y analytics | gim_admin | 🔵 P3 |

### Niveles de Prioridad
- **P0** — Sin esto, el producto no funciona. Va primero, siempre.
- **P1** — Core value. Sin esto, el producto no es útil. Va en los primeros sprints.
- **P2** — Mejora significativa. Entra cuando el P0 y P1 están estables.
- **P3** — Nice to have. Entra cuando hay capacidad y el core es sólido.

---

## Formato de Historia de Usuario

Toda historia sigue este formato (escribir en conjunto con el BA):

```markdown
## US-[número]: [Título corto]

**Como** [rol],
**quiero** [acción o capacidad],
**para** [resultado o beneficio].

### Criterios de Aceptación
- [ ] CA1: [condición verificable]
- [ ] CA2: [condición verificable]
- [ ] CA3: [condición verificable]

### Notas técnicas
- [Restricciones, dependencias, edge cases relevantes]

### Estimación
- **Esfuerzo**: S / M / L / XL
- **Épica**: E[número]
- **Dependencias**: US-[número], US-[número]
- **Prioridad**: P0 / P1 / P2 / P3
```

---

## Escala de Estimación (T-Shirt Sizing)

| Talla | Horas aprox. | Descripción |
|-------|-------------|-------------|
| S | 1–4h | Un componente simple, un campo nuevo, un ajuste de UI |
| M | 4–8h | Una pantalla completa con lógica básica, una API endpoint + UI |
| L | 1–2 días | Feature completo con múltiples estados, validaciones y tests |
| XL | 3–5 días | Épica completa, flujo complejo, múltiples capas |

**Regla**: Si algo es XL, dividirlo en historias más pequeñas antes de entrar al sprint.

---

## Estructura del Sprint

### Sprint: 2 semanas

```
Lunes semana 1 — Sprint Planning
├── Revisar el backlog priorizado
├── Estimar historias no estimadas
├── Seleccionar historias que caben en la capacidad
└── Definir el Sprint Goal (una frase que captura el valor a entregar)

Diario — Daily (15 min)
├── ¿Qué hice ayer?
├── ¿Qué voy a hacer hoy?
└── ¿Hay algo que me bloquea?

Viernes semana 2 — Sprint Review
├── Demo de lo construido
├── Validar contra los criterios de aceptación
└── Ajustar el backlog según lo aprendido

Viernes semana 2 — Retrospectiva (30 min)
├── ¿Qué salió bien?
├── ¿Qué podemos mejorar?
└── Una acción concreta para el próximo sprint
```

### Capacidad por Sprint
- Asumir **6 días efectivos** por dev por sprint de 2 semanas
- Reservar **20% para deuda técnica** y bugs no planificados
- Capacidad disponible para features: ~4.8 días por dev

---

## Tablero Kanban

```
BACKLOG → TODO → IN PROGRESS → IN REVIEW → DONE
```

### Reglas del tablero
1. Una historia en **IN PROGRESS** por persona máximo
2. Nada pasa a **DONE** sin criterios de aceptación verificados
3. Si algo lleva más de 2 días en **IN REVIEW**, es un bloqueador: escalar
4. El **BACKLOG** se re-prioriza al inicio de cada sprint

---

## MVP — Definición

El MVP de TechFitness es el conjunto mínimo de features que permite a un gimnasio:

1. **Loguearse** con sus credenciales (admin y profesor)
2. **Crear y ver alumnos** (CRUD básico)
3. **Asignar una rutina** a un alumno
4. **Ver el estado del alumno** (activo/vencido)

Todo lo demás es post-MVP.

**Criterio de éxito del MVP**: Un gimnasio puede operar su día a día sin papel ni planillas.

---

## Métricas de Producto

### North Star Metric
> **Alumnos activos gestionados por semana** (por tenant)

### Métricas de soporte
- Tiempo hasta el primer alumno creado (post-onboarding)
- % de alumnos con rutina asignada
- Retención de tenants a 30 días
- Tasa de renovación de membresía (alumnos)

---

## Proceso de Priorización: RICE

Para comparar features con el mismo nivel de prioridad:

```
RICE Score = (Reach × Impact × Confidence) / Effort

Reach:      ¿A cuántos usuarios impacta en un sprint? (número)
Impact:     ¿Qué tanto mueve la North Star? (0.25 / 0.5 / 1 / 2 / 3)
Confidence: ¿Qué tan seguros estamos? (% de 0 a 100)
Effort:     ¿Cuántas person-weeks? (número)
```

El de mayor score entra primero.

---

## Checklist antes de cerrar un Sprint

1. ☐ Todas las historias del sprint tienen criterios de aceptación verificados
2. ☐ El QA corrió los tests de Playwright en los flujos nuevos
3. ☐ No hay historias en "IN PROGRESS" sin resolución
4. ☐ El backlog del próximo sprint está priorizado
5. ☐ La North Star Metric se movió (o se sabe por qué no)
6. ☐ La retrospectiva tiene al menos una acción concreta

---

## Referencias

- `AGENT.md` — Contexto del producto y roles
- `skills/ba/SKILL.md` — Formato detallado de historias de usuario
- `skills/arquitecto/SKILL.md` — Dependencias técnicas que afectan la priorización
