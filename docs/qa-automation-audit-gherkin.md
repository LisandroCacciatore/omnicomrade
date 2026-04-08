# TechFitness — Gherkin Log: QA Automation Audit

**Fecha:** 2026-04-07  
**Fuente:** QA Automation Audit — TechFitness Interaction Gaps  
**Estado:** Active

---

## BLOQUE 1: Auditoría de Botones Muertos

### 🔴 CRÍTICOS — Funcionalidad rota que el usuario ve

#### US-QA-001: Modal de Membresía en Admin Dashboard

**ID:** US-QA-001  
**Prioridad:** P0 - Crítico  
**Archivo:** admin-dashboard.html (líneas 670-770)  
**Estado:** ✅ IMPLEMENTADO

```gherkin
Feature: Modal de Membresía en Admin Dashboard
  Como usuario gim_admin
  Quiero poder crear una nueva membresía desde el dashboard
  Para gestionar rápidamente la membresía de un alumno

  Scenario: Admin hace clic en botón "Nueva Membresía"
    Given el usuario está en admin-dashboard.html
    And existe un botón con data-action="nueva-membresia"
    When hace clic en el botón
    Then se abre el modal "modal-membresia-backdrop"
    And puede seleccionar un plan, fecha inicio, monto y método de pago
    And al hacer clic en "Guardar" se persiste la membresía

  Scenario: Admin cierra el modal de membresía
    Given el modal de membresía está abierto
    When hace clic en el botón cerrar (id="modal-membresia-close")
    Or hace clic en el backdrop
    Then el modal se cierra

  Scenario: Admin cancela la creación de membresía
    Given el modal de membresía está abierto
    When hace clic en "Cancelar" (id="modal-membresia-cancel")
    Then el modal se cierra
    And no se persiste ninguna membresía
```

**Fix aplicado:** `setupMembershipModal()` ya se llama en línea 75 de admin-dashboard.js.

---

#### US-QA-002: Tabs de Configuración en Gym Setting

**ID:** US-QA-002  
**Prioridad:** P0 - Crítico  
**Archivo:** gym-setting.html  
**Estado:** 🔴 PENDIENTE

```gherkin
Feature: Navegación por tabs en Configuración del Gimnasio
  Como usuario gim_admin
  Quiero navegar entre las secciones de configuración (Gimnasio/Perfil/Plan/Peligro)
  Para gestionar la información del gimnasio

  Scenario: Admin hace clic en tab "Gimnasio"
    Given el usuario está en gym-setting.html
    When hace clic en el tab con data-tab="gym"
    Then se muestra el contenido de la sección Gimnasio
    And el tab activo tiene estilo visual diferente

  Scenario: Admin hace clic en tab "Plan"
    Given el usuario está en gym-setting.html
    When hace clic en el tab con data-tab="plan"
    Then se muestra el contenido de la sección Plan
    And el tab activo tiene estilo visual diferente

  Scenario: Admin hace clic en tab "Peligro"
    Given el usuario está en gym-setting.html
    When hace clic en el tab con data-tab="danger"
    Then se muestra el contenido de la sección Peligro
    And el tab activo tiene estilo visual diferente
```

**Fix requerido:** Agregar clase `settings-tab` y `data-tab` a los botones de tab en gym-setting.html.

---

#### US-QA-003: Draft Recovery en Routine Builder

**ID:** US-QA-003  
**Prioridad:** P0 - Crítico  
**Archivo:** routine-builder.html, routine-builder.js  
**Estado:** 🔴 PENDIENTE

```gherkin
Feature: Restaurar o descartar borrador en Routine Builder
  Como usuario profesor
  Quiero poder restaurar un borrador guardado o descartarlo
  Para continuar editando o empezar de cero

  Scenario: Admin tiene un borrador guardado y hace clic en restaurar
    Given existe un borrador en localStorage con key "routine-builder-draft"
    And se muestra el banner de borrador (#draft-restore-banner)
    When hace clic en #btn-restore-draft
    Then se restauran los datos del borrador al estado actual
    And se renderizan todos los días
    And se muestra toast "Borrador restaurado"
    And el banner se oculta

  Scenario: Admin hace clic en descartar borrador
    Given existe un borrador en localStorage
    And se muestra el banner de borrador
    When hace clic en #btn-discard-draft
    Then se elimina el borrador del localStorage
    And se muestra toast "Borrador descartado"
    And el banner se oculta

  Scenario: No existe borrador al cargar la página
    Given no hay datos en localStorage con key "routine-builder-draft"
    When se carga routine-builder.html
    Then no se muestra el banner de borrador
```

**Fix requerido:** Agregar event listeners para `btn-restore-draft` y `btn-discard-draft` en routine-builder.js.

---

#### US-QA-004: Botón "Entrenar" con Contexto en Student Dashboard

**ID:** US-QA-004  
**Prioridad:** P0 - Crítico  
**Archivo:** student-dashboard.html, student-dashboard.js  
**Estado:** 🔴 PENDIENTE

```gherkin
Feature: Botón Entrenar con parámetros de semana/día
  Como usuario alumno
 Quiero hacer clic en "Entrenar" desde el dashboard
  Para iniciar mi entrenamiento del día correcto

  Scenario: Alumno hace clic en botón Entrenar
    Given el usuario está en student-dashboard.html
    And tiene un programa activo con currentWeek y daysPerWeek
    When hace clic en #btn-entrenar
    Then se guardan los parámetros (week, day, daysPerWeek) en sessionStorage
    And se navega a student-profile.html

  Scenario: Alumno inicia sesión y ve parámetros correctos
    Given el usuario llegó a student-profile.html desde el dashboard
    When se carga la página
    Then se leen los parámetros de sessionStorage
    And se muestra la semana y día correctos del programa
```

**Fix requerido:** Agregar event listener en student-dashboard.js y ajustar HTML.

---

### 🟡 MEDIOS — UX degradada pero no bloqueante

#### US-QA-005: Selector de Ejercicio en Stats de Student Profile

**ID:** US-QA-005  
**Prioridad:** P1 - Medio  
**Archivo:** student-profile.html, student-profile.js  
**Estado:** 🔴 PENDIENTE

```gherkin
Feature: Filtrar gráfico de progreso por ejercicio
  Como usuario alumno
 Quiero seleccionar un ejercicio específico en el dropdown
  Para ver mi progreso solo en ese ejercicio

  Scenario: Alumno cambia el selector de ejercicio
    Given está en la pestaña "Estadísticas" de student-profile.html
    And existe #stats-exercise-select con opciones de ejercicios
    When selecciona un ejercicio del dropdown
    Then el gráfico se actualiza para mostrar solo ese ejercicio
    And los datos muestran historial de ese ejercicio específico
```

**Fix requerido:** Agregar change listener en student-profile.js.

---

#### US-QA-006: Botón "Entrenar" apuntando a la misma página

**ID:** US-QA-006  
**Prioridad:** P1 - Medio  
**Archivo:** student-profile.html (línea 127)  
**Estado:** 🔴 PENDIENTE

```gherkin
Feature: Navegación correcta desde Student Profile
  Como usuario alumno
  Quiero que el botón "Entrenar" navegue a la sesión de entrenamiento
  Para no quedarme en la misma página

  Scenario: Alumno hace clic en botón "Entrenar" del nav inferior
    Given está en student-profile.html
    When hace clic en el botón "Entrenar" del navigation bar inferior
    Then se navega a workout-session.html
    And no se queda en la misma página (student-profile.html)
```

**Fix requerido:** Corregir href en student-profile.html línea 127.

---

#### US-QA-007: Error Handling en Student Dashboard

**ID:** US-QA-007  
**Prioridad:** P1 - Medio  
**Archivo:** student-dashboard.js (líneas 99-157)  
**Estado:** 🔴 PENDIENTE

```gherkin
Feature: Manejo de errores en carga de datos del dashboard
  Como usuario alumno
  Quiero ver un mensaje claro si los datos no cargan
  Para saber qué pasó y poder reintentar

  Scenario: Fallo en Promise.all al cargar datos
    Given el usuario está en student-dashboard.html
    When ocurre un error en Promise.all (ej: timeout de red, error de permisos)
    Then se oculta el contenido del dashboard
    And se muestra el estado de error (#dashboard-error)
    And se muestra mensaje de error específico
    And aparece botón "Reintentar" que recarga la página
```

**Fix requerido:** Agregar try/catch y estados de error en HTML/JS.

---

#### US-QA-008: Confirmaciones para Acciones Destructivas

**ID:** US-QA-008  
**Prioridad:** P1 - Medio  
**Archivos:** múltiplos  
**Estado:** 🔴 PENDIENTE

```gherkin
Feature: Confirmaciones para acciones destructivas
  Como usuario profesor/admin
 Quiero confirmar antes de ejecutar acciones irreversibles
  Para evitar errores costosos

  Scenario: Eliminar día de rutina
    Given está en routine-builder.html editando una rutina
    When hace clic en eliminar un día
    Then se muestra confirm "¿Eliminar este día y todos sus ejercicios?"
    And si confirma, se elimina el día
    And si cancela, no pasa nada

  Scenario: Eliminar ejercicio de un día
    Given está en routine-builder.html viendo un día
    When hace clic en eliminar un ejercicio
    Then se muestra confirm "¿Eliminar este ejercicio?"
    And si confirma, se elimina

  Scenario: Forzar ingreso con membresía vencida
    Given está en attendance.js registrando ingreso
    When la membresía del alumno está vencida
    And intenta registrar el ingreso
    Then se muestra confirm "Ingreso irregular: la membresía está vencida. ¿Continuar?"

  Scenario: Aprobar/rechazar acceso
    Given está en access-requests-admin.js
    When hace clic en aprobar o rechazar
    Then se muestra confirm "¿Aprobar acceso para [nombre]?" o "¿Rechazar acceso para [nombre]?"
```

**Fix requerido:** Agregar confirm() antes de acciones destructivas en múltiples archivos.

---

#### US-QA-009: Loading States para Operaciones Lentas

**ID:** US-QA-009  
**Prioridad:** P1 - Medio  
**Archivos:** student-dashboard.js, admin-dashboard.js  
**Estado:** 🔴 PENDIENTE

```gherkin
Feature: Estados de carga para operaciones asincrónicas
  Como usuario
 Quiero feedback visual mientras se procesa una operación lenta
  Para saber que el sistema está trabajando

  Scenario: Upload de certificado médico con loading
    Given está en student-dashboard.js subiendo certificado (líneas 402-437)
    When selecciona un archivo para subir
    Then se deshabilita el input
    And se muestra indicador de loading
    And el usuario no puede hacer otra запрос hasta que termine

  Scenario: Logout con confirmación
    Given hace clic en botón de logout en sidebar
    When el sistema está por cerrar sesión
    Then se muestra confirm "¿Cerrar sesión?"
    And si confirma, se ejecuta logout
    And si cancela, no pasa nada

  Scenario: Alert masiva con preview
    Given está en admin-dashboard.js enviando alerta (líneas 730-791)
    When hace clic en enviar
    Then se muestra modal de confirmación con cantidad de destinatarios
    And el usuario puede confirmar o cancelar
```

**Fix requerido:** Agregar loading states y confirmations.

---

### 🔵 BAJOS — Nice-to-have

#### US-QA-010: Sesiones Pasadas Clickeables

**ID:** US-QA-010  
**Prioridad:** P2 - Bajo  
**Archivo:** student-dashboard.js (líneas 313-321)  
**Estado:** 🔴 PENDIENTE

```gherkin
Feature: Ver detalle de sesiones pasadas
  Como usuario alumno
 Quiero hacer clic en una sesión pasada del historial
  Para ver los ejercicios, pesos y RPE de esa sesión

  Scenario: Click en sesión histórica
    Given está en student-dashboard.html en la sección de historial
    When hace clic en una sesión del pasado
    Then se abre un modal o drawer con el detalle de esa sesión
    And se muestran los ejercicios realizados, pesos usados y nivel de esfuerzo
```

---

#### US-QA-011: Undo en eliminación de rutinas

**ID:** US-QA-011  
**Prioridad:** P2 - Bajo  
**Archivo:** student-list.js  
**Estado:** 🔴 PENDIENTE

```gherkin
Feature: Deshacer eliminación de rutina
  Como usuario profesor
 Quiero poder deshacer una eliminación de rutina rápidamente
  Para recuperarla si fue un error

  Scenario: Eliminación con undo
    Given elimina una rutina de un alumno
    When se ejecuta la eliminación
    Then se muestra un toast con botón "Deshacer"
    And el toast dura 5 segundos
    And si hace clic en "Deshacer", se restaura la rutina
```

---

## Resumen de Estado

| ID        | Descripción                           | Prioridad    | Estado       |
| --------- | ------------------------------------- | ------------ | ------------ |
| US-QA-001 | Modal de Membresía en Admin Dashboard | P0 - Crítico | ✅ Listo     |
| US-QA-002 | Tabs de Configuración en Gym Setting  | P0 - Crítico | 🔴 Pendiente |
| US-QA-003 | Draft Recovery en Routine Builder     | P0 - Crítico | 🔴 Pendiente |
| US-QA-004 | Botón "Entrenar" con contexto         | P0 - Crítico | 🔴 Pendiente |
| US-QA-005 | Selector de Ejercicio en Stats        | P1 - Medio   | 🔴 Pendiente |
| US-QA-006 | Botón "Entrenar" evitando ciclo       | P1 - Medio   | 🔴 Pendiente |
| US-QA-007 | Error Handling en Student Dashboard   | P1 - Medio   | 🔴 Pendiente |
| US-QA-008 | Confirmaciones destructivas           | P1 - Medio   | 🔴 Pendiente |
| US-QA-009 | Loading states                        | P1 - Medio   | 🔴 Pendiente |
| US-QA-010 | Sesiones pasadas clickeables          | P2 - Bajo    | 🔴 Pendiente |
| US-QA-011 | Undo en eliminación                   | P2 - Bajo    | 🔴 Pendiente |

---

## Orden de Implementación Recomendado

### Sprint 1 (P0 - Críticos)

1. US-QA-002: Tabs de gym-setting.html
2. US-QA-003: Draft recovery en routine-builder
3. US-QA-004: Botón entrenar con contexto

### Sprint 2 (P1 - Medios)

4. US-QA-005: Selector de ejercicio en stats
5. US-QA-006: Corregir link "Entrenar" circular
6. US-QA-007: Error handling con try/catch
7. US-QA-008: Confirmaciones destructivas
8. US-QA-009: Loading states

### Sprint 3 (P2 - Bajos)

9. US-QA-010: Sesiones clickeables
10. US-QA-011: Undo en eliminaciones
