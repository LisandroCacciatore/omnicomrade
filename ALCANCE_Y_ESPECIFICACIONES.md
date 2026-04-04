# Especificaciones Técnicas y Alcance Funcional: TechFitness SaaS

Este documento detalla la arquitectura, el alcance funcional y la implementación técnica del proyecto **TechFitness (OmniComrade)**, un sistema multitenant para la gestión inteligente de gimnasios y el seguimiento del rendimiento deportivo.

---

## 1. Alcance Funcional

TechFitness centraliza la operación de un gimnasio y la experiencia del atleta en una única plataforma. El alcance se divide por roles principales:

### **Administrador de Gimnasio (GimAdmin)**
*   **Gestión de Alumnos:** Alta, baja y modificación de perfiles.
*   **Gestión de Membresías:** Control de pagos, vencimientos y planes automáticos.
*   **KPIs en Tiempo Real:** Monitor de salud del gimnasio (total de alumnos, membresías activas, ingresos proyectados).
*   **Comunicación Directa:** Sistema de avisos y alertas individuales o grupales.
*   **Configuración del Local:** Personalización de branding y reglas del gimnasio.

### **Profesor / Coach**
*   **Constructor de Rutinas:** Herramienta avanzada para diseñar entrenamientos personalizados o basados en plantillas.
*   **Seguimiento de Progreso:** Visualización del historial de levantamientos (1RM, volumen) de cada alumno.
*   **Asignación Inteligente:** Selección de programas pre-armados (StrongLifts, Wendler, etc.) con cálculo automático de pesos.

### **Alumno / Atleta**
*   **Dashboard Personal:** Vista rápida de la rutina del día y objetivos semanales.
*   **Log de Sesión:** Registro interactivo de repeticiones y pesos durante el entrenamiento.
*   **Check-in de Bienestar:** Evaluación de sueño, estrés y fatiga antes de cada sesión (Wellbeing Check).
*   **Gráficos de Rendimiento:** Analítica visual de la evolución muscular y de fuerza.

---

## 2. Descripción de Archivos HTML (Estructura de Vistas)

La aplicación utiliza un enfoque de **Multi-Page Application (MPA)** servida estáticamente, con lógica de ruteo y protección por JavaScript.

*   `index.html`: Landing page principal con redirección inteligente según el rol del usuario.
*   `login.html`: Punto de entrada unificado para Auth (Email/Pass y Google OAuth).
*   `admin-dashboard.html`: Panel ejecutivo para el gestor del gimnasio.
*   `profesor-dashboard.html`: Panel operativo para entrenadores.
*   `student-dashboard.html`: Resumen de actividad para el alumno.
*   `student-profile.html`: Perfil detallado del atleta con métricas y rutinas activas.
*   `student-list.html`: Directorio searchable de todos los alumnos registrados.
*   `membership-list.html`: Listado de planes y estados de pago.
*   `exercise-list.html`: Biblioteca de ejercicios con filtros por grupo muscular.
*   `routine-builder.html`: IDE visual para la creación de programas de entrenamiento.
*   `routine-list.html`: Catálogo de rutinas disponibles en el gimnasio.
*   `routine-programs.html`: Detalle de programas clásicos de fuerza (Starting Strength, GZCLP, etc.).
*   `progress.html`: Analítica avanzada y gráficos de evolución (Chart.js integration).
*   `wellbeing-check.html`: Formulario diario de estado físico/mental.
*   `workout-session.html`: Interfaz optimizada para el registro de ejercicios en vivo.
*   `attendance.html`: Registro de presencias y accesos.
*   `gym-setting.html`: Configuración de preferencias del tenant (gimnasio).

---

## 3. Sistema de Diseño y Clases CSS

TechFitness utiliza una estética **Premium Dark Mode** basada en **Tailwind CSS**, con componentes personalizados definidos en cada HTML o mediante utilidades globales.

### **Tokens de Diseño**
*   **Tipografía:** 'Space Grotesk' (moderna y técnica).
*   **Iconografía:** Material Symbols Rounded.
*   **Paleta de Colores:**
    *   `primary`: Azul/Verde gradiente.
    *   `surface`: Mezcla de Slate-900 y 950 con transparencias.
    *   `border`: Blanco con baja opacidad (5%-10%).

### **Clases CSS Principales**
*   `.glass-panel`: Fondo semi-transparente, `backdrop-filter: blur(12px)` y bordes sutiles. Provee la profundidad visual del sistema.
*   `.hero-gradient`: Clase para títulos impactantes que usan el gradiente de marca.
*   `.btn-primary`: Gradiente de acción principal con efectos de sombra y transformación on-hover.
*   `.feature-card`: Layout para tarjetas interactivas con transiciones suaves.
*   `.input-dark`: Estilo para campos de formulario adaptados al fondo oscuro.
*   `.status-badge`: Clases dinámicas para estados (activa, vencida, pendiente) con colores semánticos.

---

## 4. Arquitectura JavaScript (Lógica Core)

El proyecto utiliza **Vanilla JS (ES6+)** con un enfoque modular.

### **Utilidades y Servicios (`js/`)**
*   `supabase.js`: Cliente centralizado para la comunicación con Supabase (Auth + DB).
*   `auth-guard.js`: Middleware que verifica sesiones y roles antes de renderizar la página.
*   `utils.js`: El "corazón" de la lógica. Incluye:
    *   **Toast System:** Notificaciones no intrusivas.
    *   **Command Palette (Ctrl+K):** Navegador rápido de acciones y páginas.
    *   **Training Math:** Funciones para redondear pesos (2.5kg steps) y calcular porcentajes de 1RM.
    *   **Program Generators:** Algoritmos para generar semanas de entrenamiento (Starting Strength, Wendler 5/3/1, etc.).
*   `db.js`: Capa de abstracción para queries frecuentes a tablas de alumnos, membresías y rutinas.
*   `ui-utils.js`: Helpers para el manejo del DOM, carga de estados en botones y validaciones.
*   `training-engine.js`: Motor encargado de la lógica de progresión y selección de ejercicios.
*   `kpiService.js`: Agregadores de datos para los dashboards (conteos, promedios, alertas).

### **Scripts de Vista**
Cada HTML tiene un archivo `.js` homónimo que gestiona sus eventos específicos (ej: `admin-dashboard.js` orquesta la carga de KPIs y el modal de nuevos alumnos).

---

## 5. Features Implementadas Destacadas

1.  **Redirección Inteligente:** Al loguearse, el sistema detecta el rol en `app_metadata` y envía al usuario a su dashboard correspondiente de forma instantánea.
2.  **Command Palette Global:** Implementación de acceso rápido mediante `Ctrl+K` para navegación por teclado, mejorando la productividad del administrador.
3.  **Motor de Entrenamiento 1RM:** Cálculo dinámico de cargas. Si un alumno actualiza su 1RM, todas sus rutinas futuras basadas en porcentajes se recalculan automáticamente.
4.  **Check-in de Bienestar (US-24):** Sistema que recolecta datos cualitativos previos al entreno para que el coach pueda ajustar la intensidad preventivamente.
5.  **Multitenancy Nativa:** Estructura de base de datos diseñada para aislar datos por `gym_id`, permitiendo que el sistema escale a múltiples gimnasios independientes.
6.  **Soporte Off-line/Optimista:** Manejo de estados de carga y errores de conexión mediante UI reactiva y feedback inmediato al usuario.



Análisis Funcional - TechFitness (OmniComrade)
1. Visión General del Proyecto
TechFitness es una plataforma SaaS multitenancy para gestión integral de gimnasios. Permite a administradores, profesores y alumnos gestionar membresías, rutinas, ejercicios, asistencia y progreso deportivo desde una interfaz web moderna.
Stack Tecnológico:
- Frontend: HTML5 + JavaScript vanilla + Tailwind CSS (vía CDN) + Chart.js
- Backend: Express.js (API server) + Supabase (PostgreSQL + Auth + RLS + Storage)
- Build: Vite + Node.js
---
2. Arquitectura de Datos (Schema SQL)
2.1 Tablas Principales (Multitenancy)
Tabla	Descripción
gyms	Tenants (gimnasios)
profiles	Usuarios del sistema
students	Alumnos registrados
memberships	Planes de membresía
routines	Rutinas creadas
routine_days	Días de una rutina
exercises	Biblioteca de ejercicios
routine_day_exercises	Ejercicios en cada día
program_templates	6 programas pre-armados
student_programs	Asignaciones de programas
workout_sessions	Sesiones completadas
workout_exercise_logs	Log de cada ejercicio
attendance_logs	Control de acceso
wellbeing_logs	Check de bienestar
2.2 Vistas Analíticas
Vista	Propósito
v_exercise_progress	Peso máximo por ejercicio por sesión
v_weekly_volume	Sets por grupo muscular por semana
v_stagnation_check	Detecta estancamiento (últimas 3 sesiones)
v_athlete_risk	Semáforo de riesgo (bienestar + volumen + inactividad)
2.3 Funciones SQL (Backend Logic)
- get_current_gym_id() - Retorna gym_id del usuario autenticado
- get_current_role() - Retorna rol del usuario
- handle_user_role_sync() - Sincroniza role/gym_id al JWT
- calculate_membership_end_date() - Calcula fecha de vencimiento
- sync_student_membership_status() - Actualiza estado de membresía
---
3. Roles de Usuario
Rol	Descripción
gim_admin	Administrador del gimnasio (dueño/gerente)
profesor	Coach/entrenador
alumno	Cliente final
Cada rol tiene acceso a vistas y funcionalidades específicas.
---
4. Módulos Funcionales (Frontend)
4.1 Autenticación
- login.html - Login unificado (email/password + Google OAuth)
- js/auth.js - Redirección post-login según rol
- js/auth-guard.js - Middleware de protección de rutas
- js/supabase.js - Cliente Supabase
4.2 Dashboard y Gestión
Página
admin-dashboard.html
profesor-dashboard.html
student-dashboard.html
student-profile.html
4.3 Catálogos
Página	Función
student-list.html	Directorio de alumnos (CRUD)
membership-list.html	Gestión de membresías
exercise-list.html	Biblioteca de ejercicios (filtros por grupo muscular)
routine-list.html	Catálogo de rutinas disponibles
4.4 Construcción de Rutinas
Página	Función
routine-programs.html	Catálogo de programas clásicos (Starting Strength, StrongLifts, GZCLP, Wendler 5/3/1, Cube, PPL)
routine-builder.html	IDE visual para crear rutinas personalizadas
program-assign.js	Modal reutilizable para asignar programas a alumnos
4.5 Flujo de Entrenamiento (Alumno)
Página	Función
wellbeing-check.html	Check de bienestar pre-entrenamiento (sueño, dolor, energía)
workout-session.html	Registro interactivo de repeticiones y pesos
progress.html	Gráficos de evolución (Chart.js)
4.6 Operaciones
Página	Función
attendance.html	Registro de asistencia/check-in
gym-setting.html	Configuración del gimnasio (branding, reglas)
access-requests.html	Gestión de solicitudes de acceso
---
5. API Server (Express.js)
5.1 Rutas Endpoints
Ruta	Descripción
/api/onboarding	Proceso de onboarding de nuevos alumnos
/api/membership	Transiciones de estado de membresía
/api/workouts	Gestión de sesiones de entrenamiento
/api/progress	Datos analíticos de progreso
/api/messages	Sistema de mensajes/avisos
/api/plans	Gestión de planes
/api/access	Solicitudes de acceso y aprobación
5.2 Servicios Backend
Servicio
onboardingService.js
membershipStateMachine.js
accessPolicy.js
---
6. Lógica Core (JavaScript)
6.1 Utilidades Principales
Archivo	Responsabilidad
js/utils.js	Toast, XSS protection, debounce, logout, global shortcuts
js/ui-utils.js	Helpers DOM, validaciones
js/training-engine.js	Generador de programas (Starting Strength, StrongLifts, GZCLP, Wendler, etc.)
js/training-math.js	Cálculos de 1RM, porcentajes, redondeo de pesos
js/db.js	Capa de abstracción para queries frecuentes
js/kpiService.js	Agregadores de datos para dashboards
js/instrumentation.js	Telemetría y logging
6.2 Estado y Datos
Archivo
js/store.js
js/route-map.js
---
7. Flujos de Usuario Principales
7.1 Flujo Alumno
login → student-profile → [Comenzar] 
→ wellbeing-check (guarda en wellbeing_logs) 
→ workout-session (registra ejercicios) 
→ student-profile (ver estadísticas)
7.2 Flujo Admin/Profesor
login → admin-dashboard → student-list 
→ routine-programs (asignar programa) 
→ profesor-dashboard (ver semáforo de riesgo) 
→ progress.html?student=ID (analítica)
7.3 Flujo de Construcción de Rutinas
exercise-list → routine-builder → routine-list → asignar desde student-list
---
## 8. Sistema de Diseño
### 8.1 Tailwind CSS (CDN)
- Paleta dark mode: `bg-dark`, `surface-dark`, `primary`, `success`, `danger`, `warning`
- Tipografía: Space Grotesk (sans), IBM Plex Mono (monospace)
- Iconografía: Material Symbols Rounded
### 8.2 Componentes Custom
- `.glass-panel` - Paneles translúcidos con blur
- `.btn-primary` - Botones con gradiente
- `.status-badge` - Badges dinámicos por estado
- `.nav-link` - Links del sidebar
- `.skeleton` - Estados de carga
- Modales y drawers con transiciones
---
9. Características Destacadas
1. Redirección inteligente por rol - Login redirige según app_metadata
2. Command Palette (Ctrl+K) - Navegación rápida
3. Motor de entrenamiento 1RM - Cálculo dinámico de cargas
4. Check-in de bienestar - Datos cualitativos pre-entreno
5. Multitenancy nativa - Aislamiento por gym_id
6. Programas pre-armados - 6 programas clásicos con generadores
7. Semáforo de riesgo - Visión holística del atleta
8. Vistas analíticas - Progreso, volumen, estancamiento
---
10. Testing y Quality Assurance
- Tests unitarios: tests/unit/*.test.js
- Tests de contrato: tests/contract/*.test.js
- Tests E2E: tests/e2e/*.test.js
- Linting: ESLint + Prettier
- Comandos: npm run test:unit, npm run lint, npm run format
---
11. Dependencias
Paquete	Versión
@supabase/supabase-js	^2.39.0
express	^4.18.2
uuid	^9.0.0
vite	^5.4.0
tailwindcss	^3.4.19
eslint	^8.57.0
prettier	^3.3.0
---
12. Estado Actual del Proyecto
El proyecto se encuentra en la Etapa 5 completa (según project-context.md):
Etapa	Descripción
1	Login · Dashboard · Alumnos · Membresías · Rutinas · Config
2	Ejercicios · Programas · Asignación · Builder · Vista alumno
3	Sesión activa · Asistencia · Dashboard profesor
4	Evolución de pesos · Volumen semanal · Estancamiento
5	Check bienestar · Control de carga · Semáforo de riesgo
6	Refactorización (en planificación)
---
13. Consideraciones para Futuras Mejoras
1. Unificación del Motor de Entrenamiento - Extraer lógica duplicada de PROGRAMS
2. Modularización de Utils - Dividir en módulos especializados
3. Optimización de Estilos - Reemplazar Tailwind CDN por build local
4. Resiliencia de Datos - Mejorar manejo de errores en queries
5. Calidad de Código - JSDoc y tests unitarios para lógica crítica