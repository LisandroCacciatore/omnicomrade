---
name: techfitness-ux-ui
description: >
  Diseña, revisa y mejora pantallas, componentes y flujos de UX/UI para el proyecto
  TechFitness SaaS. Activar cuando el usuario pida crear una pantalla nueva, un componente,
  revisar un diseño existente, definir un flujo de navegación, proponer un empty state,
  mejorar la jerarquía visual, o cuando diga "¿cómo se vería?", "diseñá esto",
  "hacé el mock de", "qué componentes necesito", "revisá la UI de", o "necesito el
  diseño de [pantalla/feature]". Activar también cuando haya decisiones de layout,
  tipografía, color, iconografía o spacing que tomar. Siempre usar este skill antes
  de que el dev empiece a codear una pantalla.
---

# TechFitness — UX/UI Design Skill

Diseñás pantallas y componentes para TechFitness siguiendo el design system establecido.
Tu output es HTML + Tailwind listo para que el dev tome de referencia, o especificaciones
escritas suficientemente detalladas para que no haya ambigüedad.

Leer `AGENT.md` antes de cualquier diseño para tener el contexto completo del proyecto.

---

## Design System — Reglas Rápidas

### Tokens que NO se modifican
```
primary:           #3B82F6   (azul — acción, links activos, foco)
success:           #10B981   (verde — OK, activo, positivo)
danger:            #EF4444   (rojo — error, eliminar, crítico)
warning:           #F59E0B   (amarillo — advertencia, pendiente)
background-dark:   #0B1218   (fondo principal)
surface-dark:      #161E26   (cards, panels, modales)
border-dark:       #1E293B   (bordes principales)
border-muted:      #334155   (bordes sutiles)
```

### Tipografía
- **Fuente única**: Space Grotesk
- **Jerarquía**:
  - `text-3xl font-black` — títulos de página (H1)
  - `text-xl font-bold` — títulos de sección (H2)
  - `text-lg font-bold` — títulos de card (H3)
  - `text-sm font-bold` — labels, etiquetas
  - `text-sm font-medium` — body, navegación
  - `text-xs font-medium` — metadata, timestamps, badges

### Iconografía
- **Solo Material Symbols Outlined** (Google)
- Tamaño base: `text-[20px]` inline, `text-[24px]` standalone
- Fill activo con: `style="font-variation-settings: 'FILL' 1"`
- Nunca mezclar con FontAwesome, Heroicons, etc.

### Espaciado y Radios
```
Padding card:     p-6 (24px)
Gap entre items:  gap-4 (16px) estándar, gap-6 (24px) secciones
Radio default:    rounded-lg (0.75rem)
Radio card:       rounded-xl (1rem)
Radio badge:      rounded-full
```

---

## Componentes Base del Sistema

### Header (Top Nav)
```html
<!-- Siempre sticky, altura py-3 o py-4 -->
<header class="flex items-center justify-between border-b border-slate-200
  dark:border-slate-800 bg-background-light dark:bg-background-dark px-6 py-3 z-10">
  <!-- Logo + Brand -->
  <div class="flex items-center gap-4">
    <div class="size-8 bg-primary rounded flex items-center justify-center text-white">
      <span class="material-symbols-outlined">fitness_center</span>
    </div>
    <h2 class="text-xl font-bold">Tech<span class="text-primary">Fitness</span></h2>
  </div>
  <!-- Nav + Actions -->
</header>
```

### Sidebar
```html
<aside class="w-64 border-r border-slate-200 dark:border-slate-800 p-4 space-y-1">
  <!-- Item inactivo -->
  <a class="flex items-center gap-3 px-3 py-2 rounded-lg
    text-slate-600 dark:text-slate-400
    hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
    <span class="material-symbols-outlined">dashboard</span>
    <span class="text-sm font-medium">Dashboard</span>
  </a>
  <!-- Item activo -->
  <a class="flex items-center gap-3 px-3 py-2 rounded-lg
    bg-primary/10 text-primary font-bold">
    <span class="material-symbols-outlined">group</span>
    <span class="text-sm font-bold">Alumnos</span>
  </a>
</aside>
```

### Card Base
```html
<div class="bg-white dark:bg-surface-dark border border-slate-200
  dark:border-slate-800 rounded-xl p-6 shadow-sm">
</div>
```

### Stat Card (KPI)
```html
<div class="flex flex-col gap-1 rounded-xl p-5 border border-slate-200
  dark:border-slate-800 bg-white/50 dark:bg-slate-900/30">
  <div class="flex items-center gap-2 text-slate-500 mb-1">
    <span class="material-symbols-outlined text-[18px]">[icon]</span>
    <p class="text-xs font-bold uppercase tracking-wider">[Label]</p>
  </div>
  <div class="flex items-baseline gap-2">
    <p class="text-2xl font-bold">[Valor]</p>
    <p class="text-emerald-500 text-xs font-bold">[Delta]</p>
  </div>
</div>
```

### Badge / Status Tag
```html
<!-- Success -->
<span class="px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-900/30
  text-emerald-600 dark:text-emerald-400 text-[10px] font-bold uppercase tracking-wider">
  Activo
</span>
<!-- Danger -->
<span class="px-2 py-0.5 rounded-full bg-red-100 dark:bg-red-900/30
  text-red-600 dark:text-red-400 text-[10px] font-bold uppercase tracking-wider">
  Crítico
</span>
<!-- Warning -->
<span class="px-2 py-0.5 rounded-full bg-amber-100 dark:bg-amber-900/30
  text-amber-600 dark:text-amber-400 text-[10px] font-bold uppercase tracking-wider">
  Pendiente
</span>
```

### Botón Primario
```html
<button class="flex items-center justify-center gap-2 rounded-lg bg-primary
  hover:bg-blue-600 text-white text-sm font-bold py-3 px-6 transition-all
  shadow-lg shadow-primary/20">
  <span class="material-symbols-outlined text-[18px]">[icon]</span>
  <span>[Texto]</span>
</button>
```

### Botón Secundario
```html
<button class="flex items-center justify-center gap-2 rounded-lg
  border border-slate-200 dark:border-slate-700
  bg-transparent hover:bg-slate-50 dark:hover:bg-slate-800
  text-slate-700 dark:text-slate-300 text-sm font-bold py-3 px-6 transition-all">
  [Texto]
</button>
```

### Input de Formulario
```html
<div class="flex flex-col gap-2">
  <label class="text-xs font-bold uppercase tracking-wider
    text-slate-600 dark:text-slate-400">[Label]</label>
  <input type="text"
    class="w-full bg-slate-50 dark:bg-surface-dark/50
    border border-slate-200 dark:border-slate-700 rounded-lg
    focus:ring-2 focus:ring-primary focus:border-primary
    text-slate-900 dark:text-white py-3 px-4
    placeholder:text-slate-400"
    placeholder="..." />
</div>
```

### Toggle / Switch
```html
<!-- ON -->
<div class="relative inline-flex h-6 w-11 items-center rounded-full bg-success">
  <span class="ml-6 inline-block h-4 w-4 rounded-full bg-white shadow-sm"></span>
</div>
<!-- OFF -->
<div class="relative inline-flex h-6 w-11 items-center rounded-full
  bg-slate-300 dark:bg-slate-700">
  <span class="ml-1 inline-block h-4 w-4 rounded-full bg-white shadow-sm"></span>
</div>
```

---

## Patrones de Layout

### Dashboard Principal
```
Header (sticky)
└── body
    ├── Sidebar (w-64, hidden en mobile)
    └── Main Content (flex-1)
        ├── Breadcrumb (text-xs uppercase)
        ├── Page Title + Actions
        ├── KPI Row (grid 2-4 cols)
        └── Content Grid (main 2/3 + aside 1/3)
```

### Lista con Filtros
```
Header (sticky)
└── body
    ├── Sidebar
    └── Main
        ├── Page Header + Botón Primario (agregar)
        ├── Filtros / Search bar
        └── Tabla o Lista de items
            └── Empty State (si no hay datos)
```

### Modal / Slideover
```
overlay (bg-black/40 backdrop-blur-sm fixed inset-0 z-40)
panel (fixed right-0 top-0 z-50 h-screen w-full max-w-md)
└── Header del panel
└── Contenido scrolleable (flex-1 overflow-y-auto)
└── Footer con acciones (sticky bottom)
```

---

## Empty States

Todo estado vacío tiene estos tres elementos:
1. **Ícono grande** (size-16 o mayor) con contexto visual del estado
2. **Título claro** — qué pasó o qué falta
3. **CTA** — qué puede hacer el usuario para resolverlo

```html
<div class="flex-1 flex flex-col items-center justify-center p-12 text-center">
  <div class="size-20 bg-primary/10 rounded-full flex items-center
    justify-center mb-6">
    <span class="material-symbols-outlined text-[48px] text-primary">
      [icon_contextual]
    </span>
  </div>
  <h2 class="text-xl font-bold mb-2">[Qué está vacío]</h2>
  <p class="text-slate-500 text-sm mb-8 max-w-xs">[Instrucción o contexto]</p>
  <button class="...btn-primario...">[Acción principal]</button>
</div>
```

---

## Checklist de Entrega UX/UI

Antes de pasar un diseño al dev, verificar:

1. ☐ ¿El diseño usa solo tokens del design system (sin colores hardcoded)?
2. ☐ ¿Existe versión dark mode (la default)?
3. ☐ ¿La pantalla funciona en mobile (min-width: 375px)?
4. ¿Todos los estados están definidos?
   - ☐ Estado con datos
   - ☐ Estado vacío (empty state)
   - ☐ Estado de carga (skeleton o spinner)
   - ☐ Estado de error
5. ☐ ¿Cada acción destructiva tiene confirmación?
6. ☐ ¿Los formularios tienen labels, placeholders y mensajes de error?
7. ☐ ¿La jerarquía visual guía al usuario al CTA principal?
8. ☐ ¿El breadcrumb refleja la ruta correcta?
9. ☐ ¿Los íconos son Material Symbols y tienen sentido contextual?
10. ☐ ¿El espaciado es consistente con el sistema (múltiplos de 4px)?

---

## Referencias adicionales

- `AGENT.md` — Stack, tokens, roles y pantallas existentes
- `skills/ba/SKILL.md` — User stories que este diseño implementa
- Pantallas de referencia: `/*.html` (en el root)
