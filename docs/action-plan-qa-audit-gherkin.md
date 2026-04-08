# Plan de Acción — QA Audit Fixes (P0/P1/P2)

**Fecha:** 2026-04-07  
**Tipo:** Action Plan / Implementation Guide  
**Alcance:** 11 historias de usuario (P0=3, P1=6, P2=2)

---

## SPRINT 1: P0 - Críticos ✅ COMPLETADOS (5/5)

**Estado:** Todos los P0 fueron verificados y ya están implementados en el código.

### US-QA-002: Tabs de Configuración en Gym Setting

**Archivo:** `gym-setting.html`  
**Línea aproximada:** 27 (JS busca `.settings-tab`)
**Estado:** ✅ YA IMPLEMENTADO (verificado líneas 408-443)

```gherkin
Feature: Navegación por tabs en gym-setting.html
  Como usuario gim_admin
  Quiero navegar entre las secciones de configuración
  Para gestionar Gimnasio/Perfil/Plan/Peligro

  Scenario: Admin hace clic en tab Gimnasio
    Given el usuario está en gym-setting.html
    And los botones tienen class="settings-tab" y data-tab
    When hace clic en el tab "Gimnasio"
    Then se muestra el panel #tab-gimnasio
    And el tab queda con clase active

  Scenario: Admin hace clic en tab Peligro
    Given el usuario está en gym-setting.html
    When hace clic en el tab "Peligro"
    Then se muestra el panel #tab-peligro
    And los otros paneles se ocultan
```

**Verificación:** Los botones ya existen con las clases correctas (líneas 408-443 gym-setting.html)

---

### US-QA-003: Draft Recovery en Routine Builder

**Archivo:** `routine-builder.js`
**Estado:** ✅ YA IMPLEMENTADO (verificado líneas 1598-1625)

```gherkin
Feature: Restaurar o descartar borrador en routine-builder
  Como usuario profesor
  Quiero restaurar o descartar un borrador guardado
  Para continuar editando o empezar de cero

  Scenario: Admin hace clic en restaurar borrador
    Given existe un borrador en localStorage
    When hace clic en #btn-restore-draft
    Then se restauran los datos al estado actual
    And se muestra toast "Borrador restaurado"

  Scenario: Admin hace clic en descartar borrador
    Given existe un borrador en localStorage
    When hace clic en #btn-discard-draft
    Then se elimina el borrador
    And se muestra toast "Borrador descartado"
```

**Verificación:** Los event listeners ya existen en routine-builder.js líneas 1598-1625

---

### US-QA-004: Botón "Entrenar" con Contexto

**Archivos:** `student-dashboard.html`, `student-dashboard.js`
**Estado:** ✅ YA IMPLEMENTADO (verificado líneas 182-198 en student-dashboard.js)

```gherkin
Feature: Botón Entrenar con parámetros de semana/día
  Como usuario alumno
  Quiero hacer clic en "Entrenar" con los parámetros correctos
  Para iniciar mi entrenamiento del día actual

  Scenario: Alumno hace clic en botón Entrenar
    Given el usuario está en student-dashboard.html
    And tiene un programa activo con week y day
    When hace clic en #btn-entrenar
    Then se guardan los parámetros en sessionStorage
    And se navega a student-profile.html (o workout-session)

  Scenario: student-profile lee los parámetros
    Given el usuario llegó a student-profile.html
    When se carga la página
    Then se leen los parámetros de sessionStorage
    And se muestra la semana/día correctos
```

**Verificación:** El handler ya existe con sessionStorage (líneas 182-198 student-dashboard.js)

---

## SPRINT 2: P1 - Medios

### US-QA-005: Selector de Ejercicio en Stats

**Archivo:** `student-profile.js`
**Estado:** ✅ YA IMPLEMENTADO (verificado líneas 255-262)

```gherkin
Feature: Filtrar gráfico de progreso por ejercicio
  Como usuario alumno
  Quiero seleccionar un ejercicio para ver su progreso
  Para analizar mi evolución específica

  Scenario: Alumno cambia el selector de ejercicio
    Given está en student-profile.html, pestaña Estadísticas
    When selecciona un ejercicio del dropdown #stats-exercise-select
    Then el gráfico se actualiza para mostrar solo ese ejercicio
```

**Verificación:** El change listener ya existe (líneas 255-262 student-profile.js)

---

### US-QA-006: Corregir Link "Entrenar" Circular

**Archivo:** `student-profile.html` (línea ~252-262)
**Estado:** ⚠️ REVISAR - El botón no tiene href, navegación es por click handler

```gherkin
Feature: Corregir navegación del botón Entrenar
  Como usuario alumno
  Quiero que el botón "Entrenar" navegue a workout-session
  Para iniciar mi entrenamiento

  Scenario: Alumno hace clic en botón "Entrenar" del nav
    Given está en student-profile.html
    When hace clic en el botón con icono fitness_center
    Then se navega a workout-session.html (no a student-profile)
```

**Nota:** El botón actual navega a student-dashboard.html (línea 253). Verificar si esto es correcto o debe ir a workout-session.

---

### US-QA-006: Corregir Link "Entrenar" Circular

**Archivo:** `student-profile.html` línea 127

```gherkin
Feature: Corregir navegación del botón Entrenar
  Como usuario alumno
  Quiero que el botón "Entrenar" navegue a workout-session
  Para no quedarme en la misma página

  Scenario: Corregir href del botón Entrenar
    Given student-profile.html línea 127
    When se modifica el elemento
    Then cambiar de:
    """
    <a href="student-profile.html">...</a>
    """
    A:
    """
    <a href="workout-session.html">...</a>
    """
```

---

### US-QA-007: Error Handling en Student Dashboard

**Archivos:** `student-dashboard.js`, `student-dashboard.html`
**Estado:** 🔴 PENDIENTE

```gherkin
Feature: Manejo de errores con try/catch
  Como usuario alumno
  Quiero ver error claro si los datos no cargan
  Para saber qué pasó y poder reintentar

  Scenario: Fallo en Promise.all al cargar datos
    Given el usuario está en student-dashboard.html
    When ocurre un error en Promise.all (timeout, permisos, etc.)
    Then se oculta el contenido del dashboard
    And se muestra el estado de error (#dashboard-error)
    And se muestra mensaje de error específico
    And aparece botón "Reintentar"
```

**Fix requerido:** Agregar try/catch y estados de error en HTML/JS (líneas 99-157 student-dashboard.js)

---

### US-QA-008: Confirmaciones para Acciones Destructivas

**Archivos:** Múltiples
**Estado:** 🔴 PENDIENTE (parcial)

```gherkin
Feature: Confirmaciones antes de acciones destructivas
  Como usuario profesor/admin
  Quiero confirmar antes de ejecutar acciones irreversibles
  Para evitar errores costosos

  Scenario: Eliminar día de rutina
    Given routine-builder.js
    When se intenta eliminar un día
    Then debe mostrar confirm "¿Eliminar este día y todos sus ejercicios?"

  Scenario: Eliminar ejercicio de día
    Given routine-builder.js
    When se intenta eliminar un ejercicio
    Then debe mostrar confirm "¿Eliminar este ejercicio?"

  Scenario: Forzar ingreso con membresía vencida
    Given attendance.js
    When la membresía está vencida
    Then debe mostrar confirm "Ingreso irregular: la membresía está vencida. ¿Continuar?"

  Scenario: Aprobar acceso
    Given access-requests-admin.js
    When se hace clic en aprobar
    Then debe mostrar confirm "¿Aprobar acceso para [nombre]?"

  Scenario: Rechazar acceso
    Given access-requests-admin.js
    When se hace clic en rechazar
    Then debe mostrar confirm "¿Rechazar acceso para [nombre]?"
```

**Fix requerido:** Agregar confirm() en routine-builder.js, attendance.js, access-requests-admin.js

---

### US-QA-009: Loading States para Operaciones Lentas

**Archivos:** `student-dashboard.js`, `admin-dashboard.js`
**Estado:** 🔴 PENDIENTE

```gherkin
Feature: Estados de carga para operaciones asincrónicas
  Como usuario
  Quiero feedback visual durante operaciones lentas
  Para saber que el sistema está trabajando

  Scenario: Upload de certificado médico con loading
    Given student-dashboard.js (upload de certificado)
    When se selecciona archivo para upload
    Then debe deshabilitar el input
    And mostrar indicador de loading
    And prevenir doble-click

  Scenario: Logout con confirmación
    Given student-dashboard.js (logout)
    When se hace clic en logout
    Then debe mostrar confirm "¿Cerrar sesión?"

  Scenario: Alert masiva con preview
    Given admin-dashboard.js (enviar alerta)
    When se hace clic en enviar
    Then debe mostrar modal de confirmación con cantidad de destinatarios
```

**Fix requerido:** Agregar loading states y confirmations en múltiples archivos

---

## SPRINT 3: P2 - Bajos

### US-QA-010: Sesiones Pasadas Clickeables

**Archivo:** `student-dashboard.js`
**Estado:** 🔴 PENDIENTE

```gherkin
Feature: Ver detalle de sesiones pasadas
  Como usuario alumno
  Quiero hacer clic en una sesión del historial
  Para ver ejercicios, pesos y RPE de esa sesión

  Scenario: Click en sesión histórica
    Given student-dashboard.js (historial de sesiones)
    When hace clic en una sesión del pasado
    Then debe abrir un modal/drawer con el detalle
    And mostrar ejercicios, pesos y nivel de esfuerzo

  Scenario: Tooltip en heatmap de consistencia
    Given student-dashboard.js (heatmap)
    When se hace hover en un dot
    Then debe mostrar tooltip con fecha y descripción breve
```

**Fix requerido:** Agregar click handlers + modal + tooltips en student-dashboard.js

---

### US-QA-011: Undo en Eliminación de Rutinas

**Archivo:** `student-list.js`
**Estado:** 🔴 PENDIENTE

```gherkin
Feature: Deshacer eliminación de rutina
  Como usuario profesor
  Quiero poder deshacer una eliminación rápidamente
  Para recuperarla si fue un error

  Scenario: Mostrar toast con undo después de eliminar
    Given student-list.js (eliminación de rutina)
    When se elimina una rutina
    Then debe mostrar toast con botón "Deshacer"
    And el toast debe durar 5 segundos

  Scenario: Implementar restauración
    Given existe función de restauración
    When usuario hace click en "Deshacer" dentro de 5 segundos
    Then debe restaurar la rutina eliminada

  Scenario: Skeleton en refiltros
    Given student-list.js (cambio de filtro)
    When cambia el filtro
    Then debe mostrar skeleton antes de re-render
```

**Fix requerido:** Agregar undo + skeleton en student-list.js

---

## Matriz de Archivos a Modificar

| Historia  | Archivos                                                                                           | Tipo cambio                 |
| --------- | -------------------------------------------------------------------------------------------------- | --------------------------- |
| US-QA-002 | gym-setting.html                                                                                   | HTML + clases               |
| US-QA-003 | routine-builder.js                                                                                 | JS + event listeners        |
| US-QA-004 | student-dashboard.html, student-dashboard.js                                                       | HTML + JS                   |
| US-QA-005 | student-profile.js                                                                                 | JS + change listener        |
| US-QA-006 | student-profile.html                                                                               | HTML + href                 |
| US-QA-007 | student-dashboard.js, student-dashboard.html                                                       | JS + try/catch + HTML       |
| US-QA-008 | routine-builder.js, attendance.js, access-requests-admin.js, student-list.js, student-dashboard.js | JS + confirm()              |
| US-QA-009 | student-dashboard.js, admin-dashboard.js                                                           | JS + loading states         |
| US-QA-010 | student-dashboard.js                                                                               | JS + click handlers + modal |
| US-QA-011 | student-list.js                                                                                    | JS + undo + toast           |

---

## Definición de Done por Historia

Cada historia se considera completa cuando:

1. ✅ Código modificado según el plan
2. ✅ Probado manualmente en browser
3. ✅ No hay errores en consola
4. ✅ Toast de feedback visible (donde aplica)
5. ✅ Tests unitarios pasan (si existen)

---

## Resumen de Estado (Post-Verificación de Código)

| ID        | Descripción                           | Prioridad    | Estado       | Verificación                                     |
| --------- | ------------------------------------- | ------------ | ------------ | ------------------------------------------------ |
| US-QA-001 | Modal de Membresía en Admin Dashboard | P0 - Crítico | ✅ Listo     | setupMembershipModal() línea 75                  |
| US-QA-002 | Tabs de Configuración en Gym Setting  | P0 - Crítico | ✅ Listo     | clases ya existen (líneas 408-443)               |
| US-QA-003 | Draft Recovery en Routine Builder     | P0 - Crítico | ✅ Listo     | listeners ya existen (líneas 1598-1625)          |
| US-QA-004 | Botón "Entrenar" con contexto         | P0 - Crítico | ✅ Listo     | sessionStorage implementado (líneas 182-198)     |
| US-QA-005 | Selector de Ejercicio en Stats        | P1 - Medio   | ✅ Listo     | listener ya existe (líneas 255-262)              |
| US-QA-006 | Botón "Entrenar" en student-profile   | P1 - Medio   | ⚠️ Revisar   | navega a student-dashboard (vs workout-session?) |
| US-QA-007 | Error Handling en Student Dashboard   | P1 - Medio   | 🔴 Pendiente | falta try/catch                                  |
| US-QA-008 | Confirmaciones destructivas           | P1 - Medio   | 🔴 Pendiente | faltan confirm()                                 |
| US-QA-009 | Loading states                        | P1 - Medio   | 🔴 Pendiente | faltan loading states                            |
| US-QA-010 | Sesiones pasadas clickeables          | P2 - Bajo    | 🔴 Pendiente | falta click handler + modal                      |
| US-QA-011 | Undo en eliminación                   | P2 - Bajo    | 🔴 Pendiente | falta undo + skeleton                            |
