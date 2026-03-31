# OmniComrade — Priorización de Cambios + US en Gherkin

Fecha: 2026-03-30

## 1) Opinión sobre tu análisis
Tu análisis es **muy sólido** y en general **superador** respecto al primero porque baja la estrategia a acciones técnicas concretas (training engine, modularización real, build local, capa DB, calidad).

Lo más valioso:
- Atacar deuda técnica **antes** de sumar más features.
- Proponer cambios con impacto sistémico (Vite, módulos ES, wrapper DB).
- Enfocar en mantenibilidad y velocidad futura del equipo.

## 2) Priorización recomendada (orden de ejecución)

### P0 — Bloqueantes de MVP estable
1. Unificar rutas/redirects por rol (`student-profile` vs `student-dashboard`) y navegación crítica.
2. Wrapper de acceso a Supabase (`DB.*`) con manejo de errores estandarizado.
3. Extraer `training-engine.js` (lógica pura y testeable).
4. Dividir `utils.js` en módulos mínimos (`ui-utils`, `auth-service`, `domain-logic`).

### P1 — Calidad y DX para acelerar iteración
5. Configurar Vite + ES Modules + `.env`.
6. Tailwind build local (sin CDN) para eliminar FOUC y purgar CSS.
7. ESLint + Prettier + reglas base de calidad.
8. JSDoc en funciones críticas (engine + DB + auth).

### P2 — Confiabilidad de release
9. Tests unitarios para cálculos (progresiones, RM, redondeos, reglas de riesgo).
10. Smoke tests E2E para login/redirects y flujo principal alumno/admin.
11. Estandarizar migraciones versionadas (en vez de depender de SQL full-reset).

### P3 — Mejora continua
12. Patrón simple de estado (Store + Custom Events) para desacoplar pantallas.
13. Instrumentación de eventos de producto (activación, retención, embudo).

## 3) US (Gherkin) — MVP hardening y launch readiness

> Nota: se agrupan por épica para que puedas pasarlas directo a backlog.

### Épica A — Autenticación y navegación robusta

#### US-A1: Redirección consistente por rol
```gherkin
Feature: Redirección consistente por rol
  As un usuario autenticado
  I want ser redirigido siempre a la misma página según mi rol
  So that la navegación inicial sea confiable

  Scenario: Usuario alumno inicia sesión
    Given un usuario con rol "alumno"
    When inicia sesión correctamente
    Then es redirigido a "student-profile.html"
    And no existen redirecciones a "student-dashboard.html"
```

#### US-A2: Guardia de rutas unificada
```gherkin
Feature: Guardia de rutas por rol
  Scenario: Usuario sin sesión intenta abrir una ruta protegida
    Given que no hay sesión activa
    When abre "admin-dashboard.html"
    Then es redirigido a "login.html"

  Scenario: Usuario con rol incorrecto abre ruta protegida
    Given un usuario autenticado con rol "alumno"
    When abre "admin-dashboard.html"
    Then es redirigido a su home de rol
```

### Épica B — Capa de datos y manejo de errores

#### US-B1: Wrapper DB para alumnos
```gherkin
Feature: Wrapper DB para operaciones de alumnos
  Scenario: Obtener listado de alumnos vía API interna
    Given que existe el módulo DB.students
    When se ejecuta DB.students.getAll()
    Then retorna un resultado tipado { data, error }
    And aplica manejo estándar de errores de red/red de permisos
```

#### US-B2: Error UX consistente en fallos de Supabase
```gherkin
Feature: Mensajes de error consistentes
  Scenario: Timeout en consulta de membresías
    Given una operación DB.memberships.getAll() con timeout
    When ocurre timeout
    Then el usuario ve un mensaje "No pudimos cargar membresías. Reintentá"
    And el error técnico queda logueado
```

### Épica C — Modularización del dominio de entrenamiento

#### US-C1: Extracción de Training Engine
```gherkin
Feature: Motor de entrenamiento desacoplado del DOM
  Scenario: Cálculo de progresión lineal
    Given un 1RM inicial de sentadilla en 100kg
    When se calcula la semana 1 con el training engine
    Then se obtiene una progresión determinística
    And el cálculo no depende de window ni del DOM
```

#### US-C2: Reutilización de lógica de programas
```gherkin
Feature: Reutilización de programas
  Scenario: Programas usan el mismo núcleo de cálculo
    Given los programas Starting Strength y StrongLifts
    When generan su plan semanal
    Then ambos consumen funciones compartidas del training engine
    And no duplican fórmulas de redondeo o porcentaje
```

### Épica D — Refactor de utilidades

#### US-D1: Separación de utilidades UI/Auth/Domain
```gherkin
Feature: Utilidades modulares
  Scenario: Carga modular por página
    Given los módulos ui-utils.js auth-service.js domain-logic.js
    When se carga login.html
    Then solo importa auth-service y ui-utils necesarios
    And no carga lógica de dominio de entrenamientos
```

#### US-D2: Compatibilidad hacia atrás controlada
```gherkin
Feature: Compatibilidad transitoria
  Scenario: Transición sin romper pantallas actuales
    Given una pantalla legacy que usa window.tfUtils
    When se despliega el refactor
    Then mantiene funcionamiento mediante un adapter temporal
```

### Épica E — Build system y performance percibida

#### US-E1: Migración a Vite
```gherkin
Feature: Build moderno con Vite
  Scenario: Ejecutar entorno local
    Given la configuración de Vite
    When el desarrollador ejecuta "npm run dev"
    Then la app levanta con recarga rápida
    And permite uso de ES Modules y variables de entorno
```

#### US-E2: Tailwind local sin FOUC
```gherkin
Feature: Estilos compilados localmente
  Scenario: Primera carga de login
    Given Tailwind compilado localmente
    When el usuario abre login.html
    Then no percibe FOUC
    And el CSS entregado está purgado y minificado
```

### Épica F — Calidad de código

#### US-F1: Linting obligatorio
```gherkin
Feature: Calidad estática del código
  Scenario: Validación en CI
    Given ESLint y Prettier configurados
    When se ejecuta el pipeline de CI
    Then falla si hay errores de lint
    And sugiere correcciones automáticas donde aplique
```

#### US-F2: JSDoc en funciones críticas
```gherkin
Feature: Tipado ligero con JSDoc
  Scenario: Documentar funciones del training engine
    Given funciones de cálculo de cargas
    When se agregan anotaciones JSDoc
    Then VS Code ofrece autocompletado y validación de tipos
```

### Épica G — Testing

#### US-G1: Unit tests del motor de entrenamiento
```gherkin
Feature: Pruebas unitarias del dominio
  Scenario Outline: Cálculo de peso redondeado
    Given un 1RM de <rm>
    When calculo <porcentaje>%
    Then el resultado redondeado es <resultado>

    Examples:
      | rm | porcentaje | resultado |
      | 100 | 55 | 55 |
      | 87.5 | 60 | 52.5 |
```

#### US-G2: Smoke tests de rutas críticas
```gherkin
Feature: Pruebas smoke de autenticación y navegación
  Scenario: Login admin y apertura de dashboard
    Given credenciales válidas de gim_admin
    When inicia sesión
    Then llega a admin-dashboard
    And visualiza KPIs sin error de autorización
```

### Épica H — Base de datos y migraciones

#### US-H1: Migraciones versionadas
```gherkin
Feature: Versionado de esquema
  Scenario: Aplicar migraciones en entorno nuevo
    Given una base vacía
    When se ejecutan migraciones versionadas en orden
    Then el esquema final coincide con producción
    And no requiere ejecutar un script de reset total
```

#### US-H2: Validación post-migración
```gherkin
Feature: Verificación de integridad de esquema
  Scenario: Comprobar dependencias críticas
    Given migraciones aplicadas
    When corre el check de integridad
    Then existen tablas, políticas RLS y triggers requeridos
```

### Épica I — Estado y comunicación entre pantallas

#### US-I1: Store mínimo con eventos
```gherkin
Feature: Gestión de estado simple
  Scenario: Actualización de estado global
    Given un store con eventos CustomEvent
    When cambia el usuario activo
    Then las vistas suscritas se actualizan sin recargar la página
```

### Épica J — Métricas de negocio

#### US-J1: Eventos de activación y retención
```gherkin
Feature: Instrumentación de eventos de producto
  Scenario: Registro de activación inicial
    Given un alumno completa su primer workout
    When finaliza la sesión
    Then se registra el evento "student_first_workout_completed"
    And queda disponible para análisis de cohortes
```

## 4) Recomendación práctica de arranque (sprint 0)
1. US-A1 + US-A2 (rutas/auth).
2. US-C1 + US-C2 (training engine).
3. US-D1 (split utils mínimo).
4. US-B1 (primer wrapper DB por módulo students).

Con esto destrabás estabilidad + mantenibilidad y dejás preparado el terreno para Vite/tests sin frenar negocio.
