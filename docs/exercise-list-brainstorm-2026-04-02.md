# Exercise List — Revisión BA + Lic. en Educación Física (Accionables)

**Fecha:** 2026-04-02  
**Pantallas revisadas:** `exercise-list.html`, `js/exercise-list.js`

## 1) Objetivo del documento

Definir mejoras funcionales y de contenido para la pantalla de lista de ejercicios, con foco en:

- mejorar el descubrimiento de ejercicios adecuados para cada alumno,
- reducir errores de selección por objetivo, nivel o equipamiento,
- incorporar criterios pedagógicos y de seguridad,
- dejar requisitos testables para desarrollo y QA.

## 2) Estado actual

### 2.1 Fortalezas

- La pantalla ya cuenta con filtros base por grupo muscular, categoría, origen y búsqueda.
- El diagrama corporal mejora el descubrimiento visual.
- Existe diferenciación entre ejercicios preset y custom.
- Hay metadata útil para prescripción parcial: dificultad, categoría y equipamiento.

### 2.2 Brechas detectadas

- La pantalla permite encontrar ejercicios, pero no ayuda suficientemente a elegir el ejercicio más adecuado para el objetivo del alumno.
- La ficha del ejercicio no explicita la intención técnica ni los criterios de ejecución.
- No hay señales suficientes de seguridad, contraindicaciones ni nivel de supervisión requerido.
- Falta metadata estructurada para programación y comparación entre ejercicios.
- La búsqueda es principalmente textual; falta descubrimiento guiado por reglas de recomendación.

## 3) Definiciones operativas

### 3.1 Objetivo principal

Campo que indica para qué uso se recomienda el ejercicio dentro de una rutina o sesión.

Valores sugeridos:

- `fuerza`
- `hipertrofia`
- `resistencia muscular`
- `movilidad`
- `potencia`
- `readaptación`

### 3.2 Patrón de movimiento

Campo que clasifica el ejercicio según su función mecánica principal.

Valores sugeridos:

- `empuje horizontal`
- `empuje vertical`
- `tracción horizontal`
- `tracción vertical`
- `dominante de rodilla`
- `dominante de cadera`
- `core anti-extensión`
- `core anti-rotación`
- `locomoción`

### 3.3 Complejidad técnica

Escala de 1 a 5 que expresa cuánta coordinación, control corporal y precisión técnica requiere el ejercicio.

- 1: ejecución simple, baja demanda técnica.
- 3: coordinación media, requiere atención a la forma.
- 5: alta demanda técnica, mayor probabilidad de error sin supervisión.

### 3.4 Nivel de seguridad

Clasificación visible que advierte si el ejercicio requiere precaución, supervisión o restricción por contexto clínico o de entrenamiento.

Valores sugeridos:

- `sin alerta`
- `precaución`
- `supervisión recomendada`
- `alerta alta`

### 3.5 Cue técnico

Indicación corta y visible que ayuda a mejorar la ejecución. Debe ser breve, concreta y accionable.

Ejemplos:

- `columna neutra`
- `rodillas alineadas con los pies`
- `escápulas activas`
- `control del descenso`

## 4) Prioridades de mejora

### P0 — Impacto alto / esfuerzo bajo

- agregar objetivo principal como filtro y metadata visible,
- agregar patrón de movimiento como filtro y metadata visible,
- mostrar cue técnico corto en la card,
- agregar nivel de seguridad como badge o ícono visible,
- validar campos mínimos en ejercicios custom.

### P1 — Impacto alto / esfuerzo medio

- incorporar progresiones y regresiones entre ejercicios,
- sumar complejidad técnica separada de dificultad,
- filtrar por equipamiento disponible del gimnasio,
- habilitar favoritos por profesor,
- sugerir reemplazos por patrón + objetivo.

### P2 — Impacto estratégico / esfuerzo alto

- motor de prescripción asistida por perfil del alumno,
- biblioteca audiovisual técnica,
- analytics de uso y abandono de ejercicios.

## 5) Requerimientos funcionales

### RF-01 — Filtrar por objetivo principal

El usuario debe poder filtrar ejercicios por objetivo principal.

### RF-02 — Filtrar por patrón de movimiento

El usuario debe poder filtrar ejercicios por patrón de movimiento.

### RF-03 — Visualizar cues técnicos

Cada ejercicio debe mostrar al menos un cue técnico corto en la card o en el detalle.

### RF-04 — Visualizar nivel de seguridad

Cada ejercicio debe mostrar su nivel de seguridad de forma visible en la grilla y en el detalle.

### RF-05 — Completar metadata mínima para ejercicios custom

Todo ejercicio custom debe contar con campos mínimos obligatorios para poder guardarse.

### RF-06 — Navegar progresiones y regresiones

Cada ejercicio debe poder vincularse con variantes más simples y más avanzadas.

### RF-07 — Filtrar por equipamiento disponible

El sistema debe ocultar o priorizar ejercicios según el equipamiento configurado para el gimnasio.

### RF-08 — Guardar favoritos

El usuario debe poder guardar ejercicios como favoritos para reutilizarlos.

### RF-09 — Sugerir reemplazos

Cuando un ejercicio no pueda utilizarse por falta de equipamiento, el sistema debe sugerir alternativas compatibles.

## 6) Criterios de aceptación

### CA-01 — Descubrimiento

Un profesor debe poder encontrar un ejercicio adecuado combinando objetivo + patrón en 3 interacciones o menos.

### CA-02 — Seguridad

Los ejercicios con alerta alta deben mostrar un aviso visible en la card y en el detalle.

### CA-03 — Calidad de datos

No debe poder guardarse un ejercicio custom sin completar la metadata mínima obligatoria.

### CA-04 — Eficiencia

El tiempo promedio para seleccionar un ejercicio válido debe reducirse en al menos 20% respecto de la línea base.

### CA-05 — Adopción

Al menos 60% de los profesores debe utilizar filtros avanzados dentro de los primeros 30 días.

## 7) Accionables en Gherkin

### 7.1 Filtrar por objetivo principal

```gherkin
Feature: Filtrado por objetivo principal
  As a profesor
  I want to filtrar ejercicios por objetivo principal
  So that I can encontrar opciones adecuadas para el plan del alumno

  Scenario: El usuario filtra ejercicios por objetivo
    Given que estoy en la lista de ejercicios
    And existen ejercicios con objetivos distintos
    When selecciono el filtro "hipertrofia"
    Then el sistema muestra solo ejercicios con objetivo "hipertrofia"
    And el contador de resultados se actualiza
```

### 7.2 Filtrar por patrón de movimiento

```gherkin
Feature: Filtrado por patrón de movimiento
  As a profesor
  I want to filtrar ejercicios por patrón de movimiento
  So that I can armar rutinas equilibradas

  Scenario: El usuario filtra por patrón
    Given que estoy en la lista de ejercicios
    And existen ejercicios con patrones distintos
    When selecciono el patrón "empuje horizontal"
    Then el sistema muestra solo ejercicios con patrón "empuje horizontal"
    And oculta los ejercicios de otros patrones
```

### 7.3 Mostrar cue técnico en la card

```gherkin
Feature: Visualización de cues técnicos
  As a profesor
  I want to ver un cue técnico breve en cada ejercicio
  So that I can corregir rápidamente la ejecución

  Scenario: La card muestra un cue técnico
    Given que un ejercicio tiene un cue técnico cargado
    When visualizo la grilla de ejercicios
    Then la card muestra el cue técnico de forma visible y breve
```

### 7.4 Mostrar nivel de seguridad

```gherkin
Feature: Indicador de seguridad del ejercicio
  As a profesor
  I want to ver el nivel de seguridad de un ejercicio
  So that I can evitar opciones inadecuadas para ciertos alumnos

  Scenario: Un ejercicio tiene alerta alta
    Given que un ejercicio tiene nivel de seguridad "alerta alta"
    When visualizo la lista de ejercicios
    Then el ejercicio muestra un indicador destacado
    And el indicador es visible sin abrir el detalle
```

### 7.5 Validar metadata mínima en ejercicios custom

```gherkin
Feature: Validación de ejercicios custom
  As a profesor
  I want to completar la metadata mínima antes de guardar un ejercicio custom
  So that the catalog remains usable and consistent

  Scenario: Guardado bloqueado por campos faltantes
    Given que estoy creando un ejercicio custom
    And faltan campos obligatorios
    When intento guardar el ejercicio
    Then el sistema bloquea el guardado
    And muestra errores inline en los campos faltantes
```

### 7.6 Navegar progresiones y regresiones

```gherkin
Feature: Progresiones y regresiones de ejercicios
  As a profesor
  I want to navegar entre variantes de un ejercicio
  So that I can adaptar la dificultad al nivel del alumno

  Scenario: El ejercicio tiene una progresión asociada
    Given que un ejercicio tiene variantes relacionadas
    When abro el detalle del ejercicio
    Then veo las opciones de regresión y progresión
    And puedo navegar a cada variante desde la ficha
```

### 7.7 Filtrar por equipamiento disponible

```gherkin
Feature: Compatibilidad con equipamiento disponible
  As a profesor
  I want to ver solo ejercicios compatibles con el equipamiento disponible
  So that I can armar rutinas ejecutables

  Scenario: El gimnasio no tiene cierto equipamiento
    Given que el gimnasio no cuenta con "polea"
    And existen ejercicios que requieren "polea"
    When activo el filtro de equipamiento disponible
    Then el sistema oculta o desprioriza esos ejercicios
```

### 7.8 Guardar favoritos

```gherkin
Feature: Guardado de favoritos
  As a profesor
  I want to guardar ejercicios favoritos
  So that I can reutilizar mis selecciones habituales

  Scenario: Un ejercicio se guarda como favorito
    Given que estoy viendo un ejercicio
    When hago clic en "Guardar en favoritos"
    Then el ejercicio queda marcado como favorito
    And aparece en mi lista de favoritos
```

### 7.9 Sugerir reemplazos

```gherkin
Feature: Sugerencia de reemplazos
  As a profesor
  I want to recibir alternativas cuando un ejercicio no sea viable
  So that I can mantener la lógica del plan sin interrumpir la sesión

  Scenario: Falta equipamiento para el ejercicio original
    Given que seleccioné un ejercicio que requiere un equipamiento no disponible
    When el sistema detecta la incompatibilidad
    Then muestra ejercicios alternativos con el mismo patrón o un patrón equivalente
    And prioriza opciones con el mismo objetivo principal
```

## 8) Riesgos y mitigaciones

### Riesgo 1 — Sobrecarga de filtros en la UI

Mitigación: agrupar filtros avanzados en un panel colapsable y permitir presets guardados.

### Riesgo 2 — Baja calidad de datos en ejercicios custom

Mitigación: validaciones obligatorias, plantillas guiadas y revisión periódica del catálogo.

### Riesgo 3 — Confusión entre dificultad y complejidad técnica

Mitigación: separar ambos campos en el diseño y definir cada uno con tooltip o ayuda contextual.

### Riesgo 4 — Alertas de seguridad demasiado genéricas

Mitigación: usar un vocabulario controlado y limitar los valores disponibles.
