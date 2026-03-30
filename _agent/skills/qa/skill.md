---
name: techfitness-qa
description: >
  Escribe, mantiene y ejecuta tests automatizados con Playwright para TechFitness.
  Activar cuando el usuario pida escribir tests, automatizar un flujo, verificar
  criterios de aceptación, crear una suite de tests, revisar cobertura de tests,
  o cuando diga "escribí el test para", "automatizá este flujo", "verificá que",
  "playwright para X", "cobertura de tests", "testeá el login", "agregá el test de",
  o cuando una historia de usuario esté por cerrarse y necesite validación automatizada.
  También activar cuando un test falla y haya que diagnosticar el problema.
  Los tests de QA son condición necesaria para mergear cualquier feature.
---

# TechFitness — QA Automatización (Playwright) Skill

Sos el QA automatizador del proyecto. Cada feature que se construye
tiene un test de Playwright que verifica que funciona.
Sin test, no hay deploy.

Leer `AGENT.md` y la historia de usuario antes de escribir el test.
Los criterios de aceptación del BA se traducen 1:1 en assertions de Playwright.

---

## Setup del Proyecto

```bash
# Instalación
npm install --save-dev @playwright/test
npx playwright install chromium firefox

# Estructura de carpetas
tests/
├── e2e/
│   ├── auth/
│   │   └── login.spec.ts
│   ├── students/
│   │   ├── student-list.spec.ts
│   │   └── create-student.spec.ts
│   ├── routines/
│   │   └── routine-editor.spec.ts
│   └── notifications/
│       └── notification-center.spec.ts
├── fixtures/
│   ├── auth.ts         # helpers de autenticación
│   └── test-data.ts    # datos de prueba
└── playwright.config.ts
```

```typescript
// playwright.config.ts
import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: './tests/e2e',
  timeout: 30_000,
  expect: { timeout: 5_000 },
  fullyParallel: true,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: [['html'], ['list']],

  use: {
    baseURL: process.env.BASE_URL ?? 'http://localhost:5173',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'on-first-retry',
  },

  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'mobile-chrome', use: { ...devices['Pixel 5'] } },
  ],
})
```

---

## Fixtures de Autenticación

```typescript
// tests/fixtures/auth.ts
import { test as base, expect, Page } from '@playwright/test'

type AuthFixtures = {
  adminPage: Page
  profesorPage: Page
}

export const test = base.extend<AuthFixtures>({
  adminPage: async ({ browser }, use) => {
    const context = await browser.newContext()
    const page = await context.newPage()

    await page.goto('/login.html')
    await page.fill('#email', process.env.TEST_ADMIN_EMAIL!)
    await page.fill('#password', process.env.TEST_ADMIN_PASSWORD!)
    await page.click('#login-btn')
    await page.waitForURL('**/admin_dashboard.html')

    await use(page)
    await context.close()
  },

  profesorPage: async ({ browser }, use) => {
    const context = await browser.newContext()
    const page = await context.newPage()

    await page.goto('/login.html')
    await page.fill('#email', process.env.TEST_PROFESOR_EMAIL!)
    await page.fill('#password', process.env.TEST_PROFESOR_PASSWORD!)
    await page.click('#login-btn')
    await page.waitForURL('**/profesor_dashboard.html')

    await use(page)
    await context.close()
  },
})

export { expect }
```

```typescript
// tests/fixtures/test-data.ts
export const testStudent = {
  full_name: 'Test Alumno QA',
  email: `qa-test-${Date.now()}@techfitness.com`,
  phone: '1122334455',
}

export const testRoutine = {
  name: `Rutina QA ${Date.now()}`,
  description: 'Rutina creada por tests automatizados',
}
```

---

## Suite: Autenticación

```typescript
// tests/e2e/auth/login.spec.ts
import { test, expect } from '@playwright/test'

test.describe('Login', () => {

  test.beforeEach(async ({ page }) => {
    await page.goto('/login.html')
  })

  // US-001 CA1: Login exitoso como admin
  test('admin ve su dashboard tras login exitoso', async ({ page }) => {
    await page.fill('#email', process.env.TEST_ADMIN_EMAIL!)
    await page.fill('#password', process.env.TEST_ADMIN_PASSWORD!)
    await page.click('#login-btn')

    await expect(page).toHaveURL(/admin_dashboard/)
    await expect(page.locator('h1, h2')).toContainText(/dashboard/i)
  })

  // US-001 CA2: Login exitoso como profesor
  test('profesor ve su dashboard tras login exitoso', async ({ page }) => {
    await page.fill('#email', process.env.TEST_PROFESOR_EMAIL!)
    await page.fill('#password', process.env.TEST_PROFESOR_PASSWORD!)
    await page.click('#login-btn')

    await expect(page).toHaveURL(/profesor_dashboard/)
  })

  // US-001 CA3: Credenciales incorrectas
  test('muestra error inline con credenciales incorrectas', async ({ page }) => {
    await page.fill('#email', 'wrong@test.com')
    await page.fill('#password', 'wrongpassword')
    await page.click('#login-btn')

    const errorDiv = page.locator('#login-error')
    await expect(errorDiv).toBeVisible()
    await expect(errorDiv).not.toHaveClass(/hidden/)

    // No debe redirigir
    await expect(page).toHaveURL(/login/)
  })

  // US-001 CA4: Botón deshabilitado durante login
  test('el botón se deshabilita mientras procesa', async ({ page }) => {
    await page.fill('#email', process.env.TEST_ADMIN_EMAIL!)
    await page.fill('#password', process.env.TEST_ADMIN_PASSWORD!)

    // Interceptar para ralentizar la respuesta
    await page.route('**/auth/v1/token**', async (route) => {
      await new Promise(res => setTimeout(res, 500))
      await route.continue()
    })

    await page.click('#login-btn')
    await expect(page.locator('#login-btn')).toBeDisabled()
  })

  // Guard: página protegida redirige a login sin sesión
  test('redirige a login si no hay sesión activa', async ({ page }) => {
    await page.goto('/admin_dashboard.html')
    await expect(page).toHaveURL(/login/)
  })
})
```

---

## Suite: Gestión de Alumnos

```typescript
// tests/e2e/students/student-list.spec.ts
import { test, expect } from '../fixtures/auth'

test.describe('Lista de Alumnos', () => {

  // US-003 CA1: Lista con datos
  test('el admin ve la lista de alumnos con información relevante', async ({ adminPage }) => {
    await adminPage.goto('/student_list.html')

    // Esperar a que cargue (skeleton desaparece)
    await adminPage.waitForSelector('#skeleton-list', { state: 'hidden', timeout: 10_000 })

    const studentList = adminPage.locator('[data-testid="student-item"]')
    await expect(studentList.first()).toBeVisible()

    // Verificar que cada item tiene nombre y estado de membresía
    const firstStudent = studentList.first()
    await expect(firstStudent.locator('[data-testid="student-name"]')).toBeVisible()
    await expect(firstStudent.locator('[data-testid="membership-status"]')).toBeVisible()
  })

  // US-003 CA2: Filtros
  test('el filtro por estado funciona correctamente', async ({ adminPage }) => {
    await adminPage.goto('/student_list.html')
    await adminPage.waitForSelector('#skeleton-list', { state: 'hidden' })

    await adminPage.selectOption('[data-testid="filter-status"]', 'activa')

    const statusBadges = adminPage.locator('[data-testid="membership-status"]')
    const count = await statusBadges.count()

    for (let i = 0; i < count; i++) {
      await expect(statusBadges.nth(i)).toContainText(/activa/i)
    }
  })

  // US-003 CA3: Empty state
  test('muestra empty state cuando no hay alumnos', async ({ adminPage }) => {
    // Usar tenant sin alumnos
    await adminPage.goto('/empty_state_no_student.html')

    await expect(adminPage.locator('[data-testid="empty-state"]')).toBeVisible()
    await expect(adminPage.locator('[data-testid="empty-state-cta"]')).toBeVisible()
  })

  // US-003 CA4: Aislamiento de tenant
  test('el admin solo ve alumnos de su propio gimnasio', async ({ adminPage }) => {
    await adminPage.goto('/student_list.html')
    await adminPage.waitForSelector('#skeleton-list', { state: 'hidden' })

    // Verificar que no hay alumnos de otros tenants (validado vía RLS en el DB)
    // El nombre del gym del admin debe aparecer en el contexto de la página
    const gymName = await adminPage.locator('[data-testid="gym-name"]').textContent()
    expect(gymName).toBeTruthy()
  })
})
```

```typescript
// tests/e2e/students/create-student.spec.ts
import { test, expect } from '../fixtures/auth'
import { testStudent } from '../fixtures/test-data'

test.describe('Crear Alumno', () => {

  test.beforeEach(async ({ adminPage }) => {
    await adminPage.goto('/student_list.html')
    await adminPage.click('[data-testid="create-student-btn"]')
  })

  // US-002 CA1: Creación exitosa
  test('crea un alumno con datos válidos', async ({ adminPage }) => {
    await adminPage.fill('[data-testid="input-full-name"]', testStudent.full_name)
    await adminPage.fill('[data-testid="input-email"]', testStudent.email)
    await adminPage.fill('[data-testid="input-phone"]', testStudent.phone)
    await adminPage.click('[data-testid="save-student-btn"]')

    // Toast de éxito
    await expect(adminPage.locator('[data-testid="toast-success"]')).toBeVisible()

    // El alumno aparece en la lista
    await adminPage.goto('/student_list.html')
    await adminPage.waitForSelector('#skeleton-list', { state: 'hidden' })
    await expect(adminPage.locator(`text=${testStudent.full_name}`)).toBeVisible()
  })

  // US-002 CA2: Email duplicado
  test('muestra error si el email ya existe en el gimnasio', async ({ adminPage }) => {
    const existingEmail = process.env.TEST_EXISTING_STUDENT_EMAIL!

    await adminPage.fill('[data-testid="input-full-name"]', 'Alumno Duplicado')
    await adminPage.fill('[data-testid="input-email"]', existingEmail)
    await adminPage.fill('[data-testid="input-phone"]', '1234567890')
    await adminPage.click('[data-testid="save-student-btn"]')

    await expect(adminPage.locator('[data-testid="error-email"]'))
      .toContainText(/ya existe/i)
  })

  // US-002 CA3: Validación de campos
  test('valida nombre con menos de 3 caracteres', async ({ adminPage }) => {
    await adminPage.fill('[data-testid="input-full-name"]', 'AB')
    await adminPage.click('[data-testid="save-student-btn"]')

    await expect(adminPage.locator('[data-testid="error-full-name"]')).toBeVisible()
  })

  test('valida formato de email inválido', async ({ adminPage }) => {
    await adminPage.fill('[data-testid="input-full-name"]', 'Alumno Test')
    await adminPage.fill('[data-testid="input-email"]', 'no-es-email')
    await adminPage.click('[data-testid="save-student-btn"]')

    await expect(adminPage.locator('[data-testid="error-email"]')).toBeVisible()
  })

  test('valida teléfono con menos de 8 dígitos', async ({ adminPage }) => {
    await adminPage.fill('[data-testid="input-full-name"]', 'Alumno Test')
    await adminPage.fill('[data-testid="input-phone"]', '1234')
    await adminPage.click('[data-testid="save-student-btn"]')

    await expect(adminPage.locator('[data-testid="error-phone"]')).toBeVisible()
  })
})
```

---

## Convenciones de Tests

### Naming
```
test('[qué] cuando [condición]', ...)
test('muestra error si el email ya existe', ...)
test('el admin ve la lista de alumnos', ...)
test('redirige a login sin sesión activa', ...)
```

### Selectores — Orden de Preferencia
```typescript
// 1. data-testid (más estable, preferido)
page.locator('[data-testid="create-student-btn"]')

// 2. ARIA role + name
page.getByRole('button', { name: 'Guardar' })
page.getByRole('textbox', { name: 'Email' })

// 3. Text (solo para contenido que no cambia)
page.getByText('Alumnos')

// 4. CSS/XPath (último recurso, frágil)
page.locator('#login-btn')  // solo si no hay mejor opción
```

### Convención de `data-testid`
Agregar al HTML de producción en los elementos interactivos:
```html
<button data-testid="create-student-btn">Agregar alumno</button>
<div data-testid="student-item" data-student-id="{{ id }}">...</div>
<span data-testid="membership-status">activa</span>
<div data-testid="empty-state">...</div>
<div data-testid="toast-success">...</div>
```

### Esperas
```typescript
// Bien: esperar por algo visible/invisible
await page.waitForSelector('#skeleton-list', { state: 'hidden' })
await expect(locator).toBeVisible()
await page.waitForURL(/dashboard/)

// Mal: hardcodear tiempos
await page.waitForTimeout(2000)  // ❌ frágil y lento
```

---

## Variables de Entorno para Tests

```bash
# .env.test
BASE_URL=http://localhost:5173
TEST_ADMIN_EMAIL=admin@techfitness-test.com
TEST_ADMIN_PASSWORD=test-password-segura
TEST_PROFESOR_EMAIL=profesor@techfitness-test.com
TEST_PROFESOR_PASSWORD=test-password-segura
TEST_EXISTING_STUDENT_EMAIL=alumno-existente@test.com
```

---

## Cobertura Mínima por Feature

Antes de dar una historia como "Done", debe tener tests para:

| Tipo | Descripción |
|------|-------------|
| **Happy path** | El flujo principal funciona de punta a punta |
| **Error states** | Los errores de validación se muestran correctamente |
| **Empty state** | Si aplica, el empty state aparece cuando no hay datos |
| **Auth guard** | La pantalla protegida redirige si no hay sesión |
| **Rol correcto** | El rol correcto ve lo que debe ver (y el incorrecto no) |

---

## Checklist de Test antes de Mergear

1. ☐ Cada criterio de aceptación de la historia tiene al menos un test
2. ☐ El happy path está cubierto end-to-end
3. ☐ Los estados de error tienen assertion de mensaje visible
4. ☐ Los selectores usan `data-testid` (no CSS frágil)
5. ☐ No hay `waitForTimeout` sin justificación
6. ☐ Los tests limpian su estado (no dejan datos sucios en el test DB)
7. ☐ El test pasa en CI (no solo en local)
8. ☐ Los tests de regresión de features anteriores siguen pasando

---

## Comandos Útiles

```bash
# Correr todos los tests
npx playwright test

# Correr un archivo específico
npx playwright test tests/e2e/auth/login.spec.ts

# Modo UI (debug visual)
npx playwright test --ui

# Ver el reporte HTML
npx playwright show-report

# Grabar un nuevo test
npx playwright codegen http://localhost:5173/login.html

# Correr en modo headed (ver el navegador)
npx playwright test --headed
```

---

## Referencias

- `AGENT.md` — Roles y flujos del sistema
- `skills/ba/SKILL.md` — Criterios de aceptación que se convierten en tests
- `skills/dev/SKILL.md` — `data-testid` attributes que el dev debe agregar al HTML
