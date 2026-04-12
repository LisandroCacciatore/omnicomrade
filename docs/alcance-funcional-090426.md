Alcance Funcional — TechFitness (OmniComrade)
1. Resumen Ejecutivo
1.1 Qué tipo de sistema es
TechFitness es una plataforma SaaS multitenant para la gestión integral de gyms y el seguimiento del rendimiento deportivo. El sistema opera como una aplicación web de múltiples páginas (MPA) con lógica de cliente pesado, donde cada vista es un archivo HTML independiente que consume servicios backend y persistencia directamente desde el navegador.
El modelo de negocio es B2B2C: el gimnasio (tenant) contratante cede acceso a sus empleados (administradores y profesores) y a sus clientes finales (alumnos). Cada tenant dispone de un espacio de datos aislado mediante la columna gym_id, lo que permite que múltiples gimnasios operen sobre la misma infraestructura de base de datos.
1.2 Qué problema resuelve
La plataforma resuelve tres problemas centrales para el ecosistema del gimnasio:
1. Fragmentación operativa: Los gyms pequeños y medianos suelen gestionar membresías en planillas, ejercicios en papel y comunicación por WhatsApp. TechFitness unifica这些 procesos en una única interfaz con trazabilidad completa.
2. Falta de visibilidad sobre el progreso del atleta: Los profesores no tienen forma sistematizada de ver la evolución de peso, volumen o bienestar de cada alumno. El sistema provee dashboards analíticos con métricas calculadas (1RM estimado, volumen semanal por grupo muscular, semáforo de riesgo).
3. Experiencia del alumno desconectada: El alumno típicamente recibe una rutina en papel y no tiene forma de registrar su entrenamiento. La plataforma le ofrece un flujo guiado desde el check de bienestar hasta el registro de ejercicios, con retroalimentación visual de su progreso.
1.3 Alcance general
El alcance actual cubre la operación diaria completa de un gimnasio: gestión de alumnos y membresías, construcción y asignación de rutinas, ejecución del entrenamiento con registro en tiempo real, seguimiento de progreso y bienestar, y configuración del tenant. El sistema soporta tres roles diferenciados con vistas y permisos específicos.
Estado de implementación: El proyecto se encuentra en etapa 5 completa según la documentación de proyecto (project-context.md), con las etapas 1-5 completamente implementadas y la etapa 6 (refactorización) en planificación.
---
2. Alcance Funcional por Módulos
2.1 Acceso y Autenticación
El sistema implementa un flujo de autenticación unificado que soporta múltiples métodos y realiza redirección inteligente según el rol del usuario.
Funcionalidades implementadas:
- Login con email y contraseña a través de Supabase Auth (login.html, js/auth.js).
- Redirección automática al dashboard correspondiente según el rol definido en app_metadata (js/auth-guard.js:19-31).
- Guardián de rutas que valida sesión activa y rol requerido antes de renderizar cada página (js/auth-guard.js).
- Cierre de sesión con limpieza de estado local.
Evidencia: login.html, js/auth.js, js/auth-guard.js, js/supabase.js.
Nota de observación: El sistema hace fallback a localStorage para persistir el rol cuando no está disponible en el JWT (js/auth-guard.js:58). Esto es un arreglo temporal que debería migrarse a consulta directa a profiles para mayor consistencia.
2.2 Backoffice / Administración
El módulo de backoffice corresponde al dashboard del administrador del gimnasio (gim_admin), donde se concentran las métricas operativas y la gestión centralizada.
Funcionalidades implementadas:
- KPIs operativos: Conteo de alumnos totales, membresías activas, ingresos proyectados (calculados a partir de la tabla memberships y gym_membership_plans), y alertas de estudiantes en riesgo (js/admin-dashboard.js).
- Panel de estudiantes recientes: Tabla con últimos alumnos registrados y su estado de membresía.
- Semáforo de riesgo global: Agregación de indicadores de riesgo por estudiante (bienestar, volumen, inactividad) para identificar atletas que requieren atención.
- Mapa de dolor por zona: Visualización de reportes de dolor/molestias agrupados por zona corporal.
- Acceso rápido a configuraciones: Links a gym-setting, student-list, membership-list.
Evidencia: admin-dashboard.html, js/admin-dashboard.js, js/kpiService.js.
2.3 Gestión de Alumnos
El módulo de gestión de alumnos permite el registro, consulta, modificación y eliminación lógica de estudiantes.
Funcionalidades implementadas:
- Alta de alumnos: Formulario de creación con datos personales, objetivo físico (fuerza, estética, rendimiento, rehabilitación, general), email, teléfono y fecha de nacimiento (js/student-create-modal.js).
- Listado y búsqueda: Tabla filtrable por nombre/email, estado de membresía y objetivo (student-list.html, js/student-list.js:48-80).
- Panel de detalle: Vista lateral con información completa del alumno, historial de membresías y acciones disponibles (js/student-list.js:250-450).
- Eliminación lógica: Soft-delete mediante columna deleted_at en la tabla students.
- Edición de perfil: Modificación de datos personales y notas del coach.
Entidades relacionadas: La tabla students tiene relación con profiles (cuenta de usuario), memberships (historial de pagos), y routines (rutina asignada).
Evidencia: student-list.html, js/student-list.js, js/student-create-modal.js, student-profile.html, js/student-profile.js.
Nota de observación: Existe un módulo de Athlete Insights (js/athlete-insights.js) que no está conectado a ninguna vista activa. Corresponde a funcionalidad parcialmente implementada o heredada.
2.4 Membresías
El módulo de membresías gestiona los planes, pagos y estados de suscripción de cada alumno.
Funcionalidades implementadas:
- Catálogo de planes: Planes predefinidos (mensual, trimestral, anual) con precio y duración configurables por gimnasio (membership-list.html, js/membership-list.js:69-90).
- Alta de membresía: Formulario de alta que vincula un estudiante a un plan, define fecha de inicio y registra método de pago.
- Estado automático: El sistema actualiza el estado de la membresía (activa, vencida, suspendida) según la fecha de fin mediante la función SQL sync_student_membership_status() (schema_complete.sql).
- Listado con filtros: Tabla de membresías con filtros por estado, plan, y rango de fechas.
- Renovación: Funcionalidad para extender la fecha de fin de una membresía activa.
Entidades relacionadas: memberships, gym_membership_plans, students.
Evidencia: membership-list.html, js/membership-list.js, server/routes/membership.js, server/services/membershipStateMachine.js.
2.5 Ejercicios
El módulo de ejercicios provee una biblioteca centralizada de movimientos con metadatos para facilitar la construcción de rutinas.
Funcionalidades implementadas:
- Biblioteca de ejercicios: Listado completo con nombre, grupo muscular, categoría, dificultad y equipamiento requerido (exercise-list.html, js/exercise-list.js).
- Filtros múltiples: Filtrado por grupo muscular, categoría (compound/aislado), dificultad (1-5), y objetivo (fuerza, hipertrofia, resistencia).
- Detalles del ejercicio: Modal con descripción, instrucciones, y notas de seguridad.
- Edición y alta: Formulario para crear o modificar ejercicios (solo para roles admin/profesor).
- Campos calculados: El sistema calcula automáticamente el tipo de ejercicio (compound/aislado) y asigna grupo muscular primario basándose en el nombre del ejercicio.
Entidades relacionadas: exercises.
Evidencia: exercise-list.html, js/exercise-list.js.
2.6 Rutinas y Programas
El módulo de rutinas permite la construcción, gestión y asignación de programas de entrenamiento.
Funcionalidades implementadas:
- Constructor de rutinas: Interfaz visual para crear rutinas con múltiples días, cada día con ejercicios específicos (routine-builder.html, js/routine-builder.js).
- Editor de ejercicios por día:inside each routine day, permite agregar ejercicios con series, repeticiones, peso objetivo, y notas de ejecución.
- Catálogo de rutinas: Listado de rutinas disponibles en el gimnasio con capacidad de búsqueda y filtro por objetivo y dificultad (routine-list.html, js/routine-list.js).
- Programas pre-armados: Templates de programas clásicos (Starting Strength, StrongLifts, GZCLP, Wendler 5/3/1, Cube, PPL) con generador automático de semanas (routine-programs.html, js/training-engine.js).
- Asignación: Modal para asignar una rutina o programa a uno o múltiples estudiantes (js/program-assign.js).
- Desasignación y reemplazo: Funcionalidad para quitar una rutina asignada y reemplazarla por otra, con confirmación.
Entidades relacionadas: routines, routine_days, routine_day_exercises, program_templates, student_programs, exercises.
Evidencia: routine-builder.html, js/routine-builder.js, routine-list.html, js/routine-list.js, routine-programs.html, js/training-engine.js, js/program-assign.js.
Nota de observación: El generador de programas (js/training-engine.js) contiene lógica para múltiples metodologías (StrongLifts, Wendler, etc.) pero la UI solo expone algunos de ellos. Hay potencial de expansión.
2.7 Sesión de Entrenamiento
El módulo de sesión de entrenamiento corresponde al flujo operativo donde el alumno ejecuta su rutina del día.
Funcionalidades implementadas:
- Activación de rutina: El alumno inicia su entrenamiento desde su dashboard y el sistema carga los ejercicios asignados (workout-session.html, js/workout-session.js:31-57).
- Registro de sets: Interfaz optimizada para registrar peso y repeticiones por cada set, con botones +/- para ajuste rápido.
- Carry-over de peso: El sistema recuerda el último peso usado en cada ejercicio y lo sugiere automáticamente en la siguiente sesión.
- Timer de descanso: Temporizador configurable entre ejercicios con notificación.
- Ajuste por bienestar: Si el check de bienestar arroja baja puntuación, el sistema sugiere reducir la carga en un 15%.
- Finalización: Al completar todos los sets, el sistema registra la sesión en workout_sessions y cada ejercicio loggeado en workout_exercise_logs.
- Estado de esfuerzo: El usuario puede marcar cada set con esfuerzo percibido (RPE/RIR).
Entidades relacionadas: workout_sessions, workout_exercise_logs, routines, routine_day_exercises.
Evidencia: workout-session.html, js/workout-session.js, js/training-math.js.
2.8 Asistencia
El módulo de asistencia permite registrar el ingreso de alumnos al gimnasio.
Funcionalidades implementadas:
- Check-in manual: El staff registra el ingreso de un estudiante mediante búsqueda y confirmación (attendance.html, js/attendance.js).
- Historial del día: Lista de ingresos registrados en la jornada actual.
- Conteo daily: Métrica de cuántos estudiantes ingresaron hoy.
Entidades relacionadas: attendance_logs.
Evidencia: attendance.html, js/attendance.js.
2.9 Analítica / Progreso / Bienestar
Este módulo agrupa tres componentes analíticos que proporcionan visibilidad sobre la evolución del atleta.
2.9.1 Progreso (Progress)
- Evolución de pesos: Gráfico temporal del peso máximo liftingado por ejercicio (progress.html, js/progress.js).
- Volumen semanal: Cantidad de series por grupo muscular por semana, calculado mediante vista v_weekly_volume.
- Detección de estancamiento: El sistema identifica cuando un estudiante no ha superado su peso en los últimos 3 intentos en un ejercicio dado, mediante la vista v_stagnation_check.
2.9.2 Bienestar (Wellbeing)
- Check pre-entrenamiento: Formulario breve con tres preguntas (sueño, dolor, energía) que el alumno completa antes de cada sesión (wellbeing-check.html, js/wellbeing-check.js).
- Registro de dolor por zona: El usuario puede reportar molestias en zonas corporales específicas.
- Score de bienestar: El sistema calcula un score de 0-100 que integra las tres métricas y ajusta la sugerencia de carga en la sesión.
2.9.3 Semáforo de Riesgo (Risk)
- Indicadores combinados: El dashboard del profesor muestra un semáforo que combina bienestar bajo, volumen excesivo e inactividad reciente.
- Vista por estudiante: Cada estudiante tiene un indicador de riesgo visible en su perfil.
Entidades relacionadas: wellbeing_logs, workout_exercise_logs, vistas analíticas (v_exercise_progress, v_weekly_volume, v_stagnation_check, v_athlete_risk).
Evidencia: progress.html, js/progress.js, wellbeing-check.html, js/wellbeing-check.js, profesor-dashboard.js (líneas 169-191).
2.10 Comunicaciones
El sistema provee un módulo de mensajería interna para la comunicación directa entre coaches y alumnos.
Funcionalidades implementadas:
- Drawer de mensajes: Interfaz lateral que se abre al hacer clic en el icono de mensaje.
- Conversación directa: Chat uno a uno entre el usuario actual y otro estudiante o profesor.
- Historial: Carga de mensajes previos desde la tabla gym_messages.
- Badge de no leídos: Indicador en tiempo real de mensajes sin leer, con polling cada 30 segundos.
- Notificaciones: Sistema de avisos que permite al admin enviar mensajes a grupos de estudiantes (ruta backend existente, frontend no implementado completamente).
Entidades relacionadas: gym_messages.
Evidencia: js/messages.js, server/routes/messages.js.
Nota de observación: La funcionalidad de avisos/notificaciones grupales tiene la ruta backend (server/routes/messages.js) pero no se encontró una UI de creación de avisos en el frontend. Queda como funcionalidad parcial.
2.11 Configuración
El módulo de configuración permite al administrador del gimnasio personalizar aspectos del tenant.
Funcionalidades implementadas:
- Datos del gimnasio: Nombre, slug (readonly) y logo (gym-setting.html, js/gym-setting.js).
- Branding: Color de acento del gimnasio, visible en la interfaz.
- Perfil del admin: Datos personales, avatar, nombre.
- Preferencias de notificación: Toggles para configurar qué notificaciones recibe el admin (nuevos alumnos, recordatorios de membresía, reportes de bienestar, solicitudes de acceso, resumen semanal). Persistencia en profiles.notification_preferences con autosave debounced.
Entidades relacionadas: gyms, profiles.
Evidencia: gym-setting.html, js/gym-setting.js.
2.12 Otros Módulos Detectados
Acceso y Solicitudes (access-requests.html, js/access-requests-admin.js): Sistema para gestionar solicitudes de acceso de potenciales nuevos alumnos. El admin puede aprobar o rechazar solicitudes de registro.
Onboarding (onboarding.html, js/onboarding.js, js/onboardingWizard.js, js/onboardingFunnel.js): Flujo de configuración inicial para el admin cuando crea su cuenta. Incluye paso 1: datos del gimnasio, paso 2: datos del primer atleta/admin, paso 3: membresía inicial, paso 4: selección de programa.
Tour de Usuario (js/student-onboarding-tour.js): Tour guiado de 4 pasos para nuevos alumnos que muestra las principales funcionalidades del dashboard del estudiante.
---
3. Alcance Funcional por Roles
3.1 Administrador (gim_admin)
El administrador es el usuario con permisos plenos sobre la operación del gimnasio. Tiene acceso a todas las funcionalidades del sistema y es el único rol que puede modificar la configuración del tenant.
Acceso permitido:
- Todas las páginas del sistema.
- CRUD completo sobre alumnos, membresías, rutinas, ejercicios y programas.
- Configuración del gimnasio (branding, planes, preferencias de notificación).
- Ver análisis y progreso de cualquier estudiante.
- Mensajería con cualquier usuario del gimnasio.
- Aprobación de solicitudes de acceso.
Evidencia de implementación: admin-dashboard.html, gym-setting.html, access-requests.html. El guardián de rutas permite este rol en todas las páginas (auth-guard.js:71).
3.2 Profesor (profesor / coach)
El profesor tiene acceso operativo al día a día del gimnasio pero con restricciones sobre la configuración del tenant.
Acceso permitido:
- Dashboard de profesor (profesor-dashboard.html):可以看到学生的风险信号灯。
- Gestión de alumnos (student-list.html): Solo lectura de datos completos, puede editar notas y asignar rutinas.
- Construcción de rutinas (routine-builder.html, routine-list.html).
- Seguimiento de progreso de estudiantes (progress.html).
- Registro de asistencia (attendance.html).
- Mensajería con estudiantes.
Restricciones:
- No puede acceder a gym-setting.html (configuración del gimnasio).
- No puede gestionar membresías de otros usuarios más allá de ver el estado.
- No puede eliminar alumnos.
Evidencia de implementación: profesor-dashboard.html, js/profesor-dashboard.js. El guardián valida este rol específicamente en las rutas autorizadas (auth-guard.js:71).
3.3 Alumno (alumno)
El alumno es el usuario final del sistema. Su experiencia está diseñada para ser simple y centrada en el entrenamiento.
Acceso permitido:
- Dashboard del estudiante (student-dashboard.html, student-profile.html): Vista de su rutina actual, estado de membresía, y progreso.
- Check de bienestar (wellbeing-check.html): Obligatorio antes de cada entrenamiento.
- Sesión de entrenamiento (workout-session.html): Registro de ejercicios.
- Progreso (progress.html): Gráficos de evolución personal.
- Perfil (student-profile.html): Datos personales y configuración básica.
Evidencia de implementación: student-dashboard.html, wellbeing-check.html, workout-session.html, progress.html. El guardián permite este rol en páginas específicas (auth-guard.js:71).
3.4 Otros roles
El sistema define el rol 'coach' como equivalente a 'profesor' (auth-guard.js:10, 15, 29). Este mapeo existe por compatibilidad con datos legacy donde algunos usuarios fueron creados con el rol 'coach'.
---
4. Flujos End-to-End
4.1 Flujo de Ingreso y Sesión
El flujo de ingreso es el punto de entrada de cualquier usuario al sistema.
1. El usuario accede a login.html.
2. Ingresa email y contraseña. El sistema valida credenciales contra Supabase Auth.
3. Si es válido, el sistema consulta el rol del usuario desde app_metadata (JWT) o desde la tabla profiles.
4. El sistema redirige según el rol:
   - gim_admin → admin-dashboard.html
   - profesor / coach → profesor-dashboard.html
   - alumno → student-profile.html o student-dashboard.html
5. Cada página carga su script JS asociado que ejecuta authGuard([rol]) para validar sesión y rol antes de renderizar contenido.
Evidencia: login.html, js/auth.js, js/auth-guard.js:19-90.
4.2 Flujo de Alta y Gestión de Alumno
Este flujo representa la operación más frecuente del admin: registrar un nuevo estudiante y darle acceso al sistema.
1. El admin accede a student-list.html desde su dashboard.
2. Hace clic en "Nuevo alumno" → Se abre el modal de creación (StudentCreateModal).
3. Completa los datos: nombre, email, teléfono, objetivo, fecha de nacimiento.
4. Al guardar, el sistema:
   - Crea un registro en students con el gym_id del admin.
   - Crea una cuenta en auth.users mediante la API de Supabase (o utiliza una cuenta existente si el email ya está registrado).
   - Crea un registro en profiles vinculado al usuario y al gimnasio.
   - Envía credenciales de acceso al nuevo estudiante (funcionalidad partial, depende de configuración de email en Supabase).
5. El nuevo alumno aparece en el listado de estudiantes.
Variante: El alumno puede solicitar acceso de forma autónoma mediante access-requests.html. El admin recibe la solicitud y puede aprobarla, lo que activa el flujo inverso.
Evidencia: js/student-create-modal.js, js/student-list.js, server/routes/access.js.
4.3 Flujo de Asignación de Programa/Rutina
Este flujo conecta la gestión de programas con los estudiantes.
1. El profesor o admin selecciona un estudiante desde student-list.html.
2. Abre el panel de detalle del estudiante.
3. Hace clic en "Asignar rutina" → Se abre el modal de asignación (program-assign.js).
4. Selecciona un programa de la lista (programas pre-armados o rutinas personalizadas).
5. Confirma la asignación.
6. El sistema:
   - Crea un registro en student_programs o actualiza students.routine_id.
   - Si es un programa pre-armado, genera las semanas correspondientes.
7. El estudiante al iniciar sesión verá la rutina asignada en su dashboard.
Evidencia: js/program-assign.js, js/student-list.js:300-400.
4.4 Flujo de Entrenamiento
El flujo de entrenamiento es el的核心用户体验 del alumno.
1. El alumno inicia sesión y accede a student-dashboard.html.
2. Ve su rutina asignada del día. Hace clic en "Comenzar a entrenar".
3. El sistema redirige a wellbeing-check.html:
   - El aluno selecciona nivel de sueño, dolor (si aplica) y energía.
   - Reporta zonas de dolor si corresponde.
   - El sistema calcula un score y ajustar la carga si es necesario.
4. Al confirmar, el sistema redirige a workout-session.html.
5. El sistema carga los ejercicios de la rutina del día.
6. Por cada ejercicio:
   - El usuario ingresa el peso y las repeticiones por set.
   - Puede ajustar el peso con botones +/-.
   - El sistema registra cada set al marcarlo como "completado".
   - El peso usado se guarda para la próxima sesión (carry-over).
7. Al finalizar todos los ejercicios, el sistema:
   - Registra la sesión completa en workout_sessions.
   - Registra cada ejercicio loggeado en workout_exercise_logs.
   - Registra el estado de bienestar en wellbeing_logs.
8. El usuario vuelve a su dashboard y puede ver los gráficos de progreso actualizados.
Evidencia: js/student-dashboard.js, js/wellbeing-check.js, js/workout-session.js, js/training-math.js.
4.5 Flujo de Seguimiento y Analítica
Este flujo permite al profesor o admin monitorear la evolución de los estudiantes.
1. El profesor accede a profesor-dashboard.html.
2. Observa el semáforo de riesgo: estudiantes con bienestar bajo, volumen excesivo o inactividad prolongada.
3. Hace clic en un estudiante específico → Accede a student-profile.html del estudiante.
4. Desde allí puede ver:
   - Gráficos de progreso por ejercicio (progress.html).
   - Historial de sesiones.
   - Estado de membresía.
5. Puede comunicarse con el estudiante mediante el sistema de mensajería.
Evidencia: js/profesor-dashboard.js, js/student-profile.js, js/progress.js.
4.6 Flujo de Operación Diaria del Gimnasio
Este flujo representa la operación típica de un día en el gimnasio:
Mañana:
- El admin revisa su dashboard, verifica KPIs y alertas.
- Llega un nuevo cliente interesado: el admin crea una solicitud de acceso o registra al alumno directamente.
- Un estudiante renueva su membresía: el admin la actualiza en membership-list.html.
Durante el día:
- Los estudiantes entrenan: registran sus sesiones en workout-session.html.
- El profesor asigna una nueva rutina a un estudiante que progresó.
- El profesor revisa el progreso de un estudiante en progress.html.
Fin del día:
- El staff registra ingresos en attendance.html.
- El admin revisa el resumen de la jornada.
Evidencia: Múltiples archivos descritos en las secciones anteriores.
---
5. Alcance Técnico Relevante
5.1 Frontend
El frontend está construido como una Multi-Page Application (MPA) donde cada vista es un archivo HTML independiente. No existe framework de JavaScript (React, Vue, etc.); el sistema utiliza Vanilla JS con modularización por archivo.
Componentes clave:
- Tailwind CSS (vía CDN): Sistema de estilos. La configuración se encuentra en tailwind.config.js y se compila con el script de Tailwind.
- Chart.js: Librería para gráficos de progreso (progress.html).
- Material Symbols Rounded: Iconografía a través de Google Fonts.
- Space Grotesk / IBM Plex Mono: Tipografía del sistema.
Estructura de scripts: Cada página HTML carga su script homónimo en la carpeta js/. Estos scripts ejecutan la lógica específica de la vista, incluyendo la llamada a authGuard para protección de rutas.
Utilidades compartidas: Los scripts centralizados en js/ proveen funciones reutilizables:
- js/utils.js: Toast system, protección XSS, logout, atajos de teclado (Ctrl+K command palette).
- js/ui-utils.js: Helpers de DOM, validaciones, manage de estados de carga en botones.
- js/supabase.js: Cliente centralizado de Supabase.
- js/route-map.js: Mapeo de roles a URLs de dashboard.
- js/training-engine.js: Generador de programas.
- js/training-math.js: Cálculos de 1RM, porcentajes, redondeo de pesos.
- js/kpiService.js: Agregadores de datos para dashboards.
Evidencia: Archivos listados en la sección de módulos funcionales.
5.2 Backend
El backend consiste en un servidor Express.js que actúa como capa intermedia para operaciones que requieren lógica de negocio compleja o que no pueden ejecutarse completamente desde el cliente.
Stack:
- Express.js: Framework servidor.
- Supabase Client (Server-side): Acceso a la base de datos desde el servidor.
Rutas implementadas (server/routes/):
- /api/onboarding: Proceso de configuración inicial del gimnasio.
- /api/membership: Máquina de estados de membresía, transiciones de estado.
- /api/workouts: Gestión de sesiones de entrenamiento.
- /api/progress: Datos analíticos de progreso.
- /api/messages: Sistema de mensajería.
- /api/plans: Catálogo de planes de membresía.
- /api/access: Solicitudes de acceso y aprobación.
- /api/seed: Datos de prueba.
Servicios backend (server/services/):
- onboardingService.js: Lógica de onboarding.
- membershipStateMachine.js: Transiciones de estado de membresía.
- accessPolicy.js: Políticas de acceso.
Puerto: El servidor corre en el puerto 3001 (configurable mediante variable de entorno PORT).
Evidencia: server/index.js, archivos en server/routes/ y server/services/.
5.3 Persistencia
El sistema utiliza PostgreSQL a través de Supabase como base de datos principal.
Modelo de datos (multitenant):
- Cada tabla relevante tiene una columna gym_id que aísla los datos de cada gimnasio.
- Las políticas RLS (Row Level Security) en Supabase filtran automáticamente los registros según el gym_id del usuario autenticado.
- La función get_current_gym_id() (definida en schema_complete.sql) retorna el gym_id del usuario actual para ser usada en las políticas.
Tablas principales:
- gyms: Tenants (datos del gimnasio).
- profiles: Extensión de usuarios de auth (rol, gym_id, datos personales).
- students: Alumnos registrados.
- memberships: Planes de membresía por estudiante.
- routines, routine_days, routine_day_exercises: Estructura de rutinas.
- exercises: Biblioteca de ejercicios.
- program_templates: Programas pre-armados.
- workout_sessions, workout_exercise_logs: Sesiones completadas.
- wellbeing_logs: Registros de bienestar.
- attendance_logs: Ingresos registrados.
- gym_messages: Mensajería interna.
Vistas analíticas (calculadas en la base de datos):
- v_exercise_progress: Peso máximo por ejercicio por sesión.
- v_weekly_volume: Series por grupo muscular por semana.
- v_stagnation_check: Detección de estancamiento.
- v_athlete_risk: Semáforo de riesgo.
Evidencia: schema_complete.sql, políticas RLS en las definiciones de tabla.
5.4 Integraciones
Supabase (core):
- Auth: Manejo de usuarios y sesiones.
- Database: PostgreSQL con RLS.
- Storage: Almacenamiento de imágenes (logos de gimnasio, avatares de usuarios).
- Edge Functions: No utilizadas en el alcance actual.
Google OAuth: Configurado en Supabase Auth como método de login alternativo (no verificado en detalle en esta auditoría).
Librerías externas (CDN):
- Tailwind CSS (CDN).
- Chart.js (CDN).
- Supabase JS (CDN).
- Google Fonts (Material Symbols, Space Grotesk, IBM Plex Mono).
Evidencia: Referencias en los <head> de cada archivo HTML y package.json.
5.5 Dependencias Estructurales
Node.js:
- express: Servidor backend.
- @supabase/supabase-js: Cliente de Supabase.
- uuid: Generación de IDs.
Build:
- vite: Build tool para el proyecto (config en vite.config.js).
- tailwindcss: Compilación de estilos.
Calidad de código:
- eslint: Linting.
- prettier: Formateo.
Evidencia: package.json.
---
6. Fuera de Alcance / Pendiente / Roadmap
6.1 Funcionalidades No Implementadas
Las siguientes funcionalidades están parcialmente definidas en el código pero no tienen una UI activa o están incompletas:
1. Notificaciones push: El sistema tiene estructura para notification_preferences (ahora implementada en gym-setting) pero no existe un sistema de notificación push activo. Los toggles están definidos pero el backend de envío no está implementado.
2. Generación de invoices: No existe módulo de facturación. Los pagos de membresía se registran manualmente o no tienen trazabilidad de pagos individuales.
3. Gamificación: No hay sistema de logros, badges ni recompensas por consistencia de entrenamiento.
4. Integración con dispositivos: No hay integración con wearables (Apple Watch, Fitbit, etc.) para captura automática de datos.
5. Reportes exportables (avanzados): Solo existe exportación CSV básica en membership-list. No hay reportes PDF ni exportables para analítica avanzada.
6. Multidioma: Todo el sistema está en español hardcodeado. No hay soporte para internacionalización.
6.2 Refactors Identificados
1. Unificación del Motor de Entrenamiento: La lógica de generación de programas está dispersa en múltiples archivos. Debería extraerse a un módulo único (ALCANCE_Y_ESPECIFICACIONES.md, sección 13).
2. Modularización de Utils: utils.js contiene demasiadas responsabilidades (toast, XSS, logout, command palette, training math). Debería dividirse en módulos especializados.
3. Optimización de Estilos: El uso de Tailwind vía CDN tiene implicaciones de performance. Un build local con purge sería más eficiente.
4. Estado y Datos: Los módulos js/store.js y js/route-map.js tienen funciones de estado global pero no están totalmente integrados en todas las páginas.
6.3 Mejoras Técnicas
1. Resiliencia de Datos: El manejo de errores en queries a Supabase es inconsistente. Algunas páginas muestran errores al usuario y otras no. Debería estandarizarse el patrón de manejo.
2. Calidad de Código: Falta JSDoc en funciones críticas y tests unitarios para lógica de negocio (cálculos de 1RM, generación de programas, estado de membresías).
3. Accesibilidad: Los modales y drawers no tienen gestión completa de foco. Los cambios recientes en el tour de onboarding (student-onboarding-tour.js) corrigieron el acceso a localStorage, pero la navegación por teclado de drawers todavía es parcial.
4. Performance de cargas: Los skeleton loaders están implementados pero los tiempos de carga de datos pueden optimizarse con menor cantidad de queries en paralelo.
6.4 Zonas de Riesgo o Deuda Técnica
1. Fallback de rol en localStorage (auth-guard.js:58): El sistema guarda el rol en localStorage como fallback. Esto puede causar inconsistencias si el JWT se actualiza pero el localStorage no se limpia.
2. Polling de mensajes (messages.js:27): El sistema hace polling cada 30 segundos sin mecanismo de limpieza al cambiar de página. Esto puede generar múltiples intervalos activos en navegación SPAs futuras.
3. athlete-insights.js no conectado: Este archivo existe pero no se carga en ninguna vista activa. Indica trabajo abandonado o planificado.
4. Validación de datos: La validación de formularios es básica (mayormente HTML5). No hay validación robusta de datos en el cliente antes de enviar a Supabase.
6.5 Notas sobre Documentación Existente
El archivo ALCANCE_Y_ESPECIFICACIONES.md ya contiene una especificación del sistema que es coherente con lo observado en el código. Sin embargo, la documentación presenta la etapa 6 como "en planificación" mientras que esta auditoría no identifica trabajo activo en refactorización. La documentación debería actualizarse para reflejar el estado real.
---
7. Evidencia
Cada bloque importante de este documento está respaldado por los siguientes archivos del repositorio:
Autenticación y Acceso:
- login.html: UI de login.
- js/auth.js: Lógica de redirección.
- js/auth-guard.js: Protección de rutas y validación de roles.
- js/supabase.js: Cliente Supabase.
Gestión de Alumnos:
- student-list.html, js/student-list.js: Listado y CRUD.
- student-profile.html, js/student-profile.js: Perfil detallado.
- js/student-create-modal.js: Modal de alta.
Membresías:
- membership-list.html, js/membership-list.js.
- server/routes/membership.js, server/services/membershipStateMachine.js.
Ejercicios y Rutinas:
- exercise-list.html, js/exercise-list.js.
- routine-builder.html, js/routine-builder.js.
- routine-list.html, js/routine-list.js.
- routine-programs.html, js/training-engine.js, js/training-math.js.
- js/program-assign.js: Asignación.
Entrenamiento y Bienestar:
- wellbeing-check.html, js/wellbeing-check.js.
- workout-session.html, js/workout-session.js.
- progress.html, js/progress.js.
- attendance.html, js/attendance.js.
Configuración:
- gym-setting.html, js/gym-setting.js.
Dashboards:
- admin-dashboard.html, js/admin-dashboard.js.
- profesor-dashboard.html, js/profesor-dashboard.js.
- student-dashboard.html, js/student-dashboard.js.
Backend:
- server/index.js: Servidor Express.
- server/routes/*.js: Rutas API.
- server/services/*.js: Servicios de lógica de negocio.
Persistencia:
- schema_complete.sql: Definición completa de tablas, funciones, triggers, vistas y políticas RLS.
---
Documento generado a partir del análisis exhaustivo del repositorio. Las afirmaciones se basan en evidencia directa del código, no en suposiciones o documentación desactualizada. Las áreas de incertidumbre están marcadas como "por confirmar".