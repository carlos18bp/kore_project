# KÓRE Health

**Plataforma integral de bienestar y entrenamiento personalizado.**

KÓRE Health conecta a personas con programas de movimiento consciente — sesiones personalizadas, semi-personalizadas y terapéuticas — a través de un flujo completo: descubrimiento de programas, agendamiento de sesiones, pago en línea y seguimiento continuo. El proyecto incluye un panel administrativo para gestionar paquetes, disponibilidad, reservas, pagos, contenido del sitio y analítica de conversiones.

---

## Stack Tecnológico

| Capa | Tecnología |
|---|---|
| **Backend** | Django 4.2 + Django REST Framework + SimpleJWT |
| **Frontend** | Next.js 16 + React 19 + TypeScript + Zustand + Tailwind CSS |
| **Animaciones** | GSAP + ScrollTrigger |
| **Testing Backend** | pytest + pytest-django + pytest-cov + coverage |
| **Testing Frontend** | Jest + React Testing Library (unit) · Playwright + V8 (E2E) |
| **Base de datos** | SQLite (desarrollo) |

---

## Modelos de Dominio (Backend)

El backend se organiza en `core_app` con los siguientes modelos:

| Modelo | Propósito |
|---|---|
| **User** | Usuario custom con autenticación por email. Roles: `customer`, `admin`. |
| **Package** | Paquete de sesiones con precio, duración, vigencia y políticas. |
| **AvailabilitySlot** | Bloque de tiempo disponible para agendar (con soporte de bloqueos). |
| **Booking** | Reserva que vincula un cliente + paquete + slot. Estados: `pending`, `confirmed`, `canceled`. |
| **Payment** | Registro de pago con trazabilidad. Proveedores: Wompi, PayU, ePayco, PayPal. Estados: `pending`, `confirmed`, `failed`, `canceled`, `refunded`. |
| **Notification** | Notificaciones de confirmación de reserva, pago y recibo por email. |
| **SiteSettings** | Configuración global del sitio (singleton): contacto, redes sociales, footer. |
| **FAQItem** | Preguntas frecuentes administrables desde el panel. |
| **AnalyticsEvent** | Eventos de conversión: clic WhatsApp, vista de paquete, reserva creada, pago confirmado. |

Todos los modelos (excepto User y SiteSettings) heredan de `TimestampedModel` que provee `created_at` y `updated_at`.

---

## Vistas Principales (Frontend)

| Ruta | Vista | Propósito |
|---|---|---|
| `/` | Home | Landing page con secciones Hero, Filosofía, Programas, Tarifas, Proceso y Galería. |
| `/kore-brand` | La Marca | Historia de la marca, pilares (flor interactiva), proceso diagnóstico, programas y seguimiento. |
| `/programs` | Programas | Selección interactiva de programa y plan con precios, CTA de reserva. |
| `/login` | Login | Formulario de autenticación con validación y toggle de contraseña. |
| `/dashboard` | Dashboard | Panel del cliente: programa activo, sesiones restantes, próxima cita, acciones rápidas y actividad reciente. |
| `/calendar` | Calendario | Ruta de compatibilidad que redirige al flujo de agendamiento en `/book-session`. |

---

## Setup del Entorno

### 1. Backend

```bash
cd backend

# Crear y activar entorno virtual
python3 -m venv venv
source venv/bin/activate

# Instalar dependencias
pip install -r requirements.txt

# Configurar variables de entorno
cp .env.example .env

# Ejecutar migraciones
python manage.py migrate

# Crear superusuario
python manage.py createsuperuser --email admin@kore.com
```

### 2. Frontend

```bash
cd frontend

# Instalar dependencias
npm install

# Configurar variables de entorno
cp .env.example .env.local

# Instalar navegadores para Playwright (E2E)
npx playwright install chromium
```

---

## Ejecutar los Servidores

### Backend (API)

```bash
cd backend
source venv/bin/activate
python manage.py runserver
```

API base URL: `http://localhost:8000/api/`  
Admin panel: `http://localhost:8000/admin/`

### Frontend

```bash
cd frontend
npm run dev
```

Frontend URL: `http://localhost:3000`

---

## Datos de Prueba (Fake Data)

### Crear datos de prueba

Genera usuarios, paquetes, slots, reservas, pagos, notificaciones, FAQs y eventos de analítica:

```bash
cd backend
source venv/bin/activate
python manage.py create_fake_data
```

Opciones disponibles:

| Flag | Descripción | Default |
|---|---|---|
| `--customers N` | Cantidad de clientes a crear | 10 |
| `--password PWD` | Contraseña para clientes | `customer123456` |
| `--admin-email EMAIL` | Email del admin | `admin@kore.com` |
| `--admin-password PWD` | Contraseña del admin | `admin123456` |
| `--days N` | Días de disponibilidad a generar | 14 |
| `--bookings N` | Cantidad de reservas | 20 |
| `--payments N` | Cantidad de pagos | 20 |
| `--skip-users` | Omitir creación de usuarios | — |
| `--skip-packages` | Omitir creación de paquetes | — |
| `--skip-slots` | Omitir creación de slots | — |

También se pueden ejecutar comandos individuales:

```bash
python manage.py create_fake_users --customers 5
python manage.py create_fake_packages
python manage.py create_fake_slots --days 7
python manage.py create_fake_bookings --num 10
python manage.py create_fake_payments --num 10
python manage.py create_fake_notifications --num 10
python manage.py create_fake_analytics_events --num 30
python manage.py create_fake_content
```

### Eliminar datos de prueba

```bash
cd backend
source venv/bin/activate
python manage.py delete_fake_data --confirm
```

> Los superusuarios y emails protegidos (`admin@kore.com`, `admin@example.com`) **no** se eliminan. Usar `--keep-users` para conservar todos los usuarios.

---

## Pruebas

### Backend (pytest)

> **Importante:** Para obtener reportes de coverage, se debe habilitar la instrumentación de `coverage` **antes** de ejecutar las pruebas. Esto se logra con el flag `--cov`.

```bash
cd backend
source venv/bin/activate

# Ejecutar todas las pruebas
pytest

# Ejecutar pruebas con coverage
pytest --cov=core_app --cov-report=term-missing

# Ejecutar pruebas de un módulo específico
pytest core_app/tests/models/
pytest core_app/tests/views/
pytest core_app/tests/serializers/
pytest core_app/tests/commands/
pytest core_app/tests/permissions/

# Ejecutar un archivo de pruebas específico
pytest core_app/tests/models/test_user.py
pytest core_app/tests/views/test_auth_views.py

# Coverage con reporte HTML
pytest --cov=core_app --cov-report=html
# Abrir htmlcov/index.html en el navegador
```

**Estructura de tests del backend:**

```
core_app/tests/
├── models/          # Test de modelos y lógica de dominio
├── serializers/     # Test de serializers DRF
├── views/           # Test de endpoints API
├── commands/        # Test de management commands
└── permissions/     # Test de permisos y acceso
```

### Frontend — Pruebas Unitarias (Jest)

```bash
cd frontend

# Ejecutar todas las pruebas unitarias
npm test

# Ejecutar con watch mode
npm run test:watch

# Ejecutar con reporte de coverage
npm run test:coverage

# Ejecutar un archivo específico
npx jest app/__tests__/stores/authStore.test.ts
npx jest app/__tests__/components/Hero.test.tsx
```

**Estructura de tests unitarios del frontend:**

```
app/__tests__/
├── stores/          # Zustand stores (authStore)
├── services/        # Servicios HTTP (axios)
├── composables/     # Hooks custom (useScrollAnimations)
├── components/      # Componentes UI (Hero, Philosophy, Programs, etc.)
│   └── layouts/     # Layouts (Navbar, Footer, Sidebar)
└── views/           # Páginas/vistas (Home, Login, Dashboard, etc.)
```

### Frontend — Pruebas E2E (Playwright + V8 Coverage)

```bash
cd frontend

# Ejecutar todos los tests E2E
npm run test:e2e

# Ejecutar con UI interactiva
npm run test:e2e:ui

# Ejecutar con reporte de coverage V8
npm run e2e:coverage

# Limpiar artefactos de tests E2E
npm run e2e:clean

# Ejecutar un spec específico
npx playwright test e2e/public/home.spec.ts
npx playwright test e2e/auth/login.spec.ts
```

**Estructura de tests E2E del frontend:**

```
e2e/
├── fixtures.ts      # Fixture con V8 JS coverage automático
├── public/          # Páginas públicas (home, kore-brand, programs)
├── auth/            # Flujos de autenticación (login, logout)
└── app/             # Páginas autenticadas (dashboard, calendar)
```

---

## Comandos de Referencia Rápida

| Comando | Descripción |
|---|---|
| `python manage.py runserver` | Inicia el servidor backend |
| `python manage.py migrate` | Ejecuta migraciones de DB |
| `python manage.py expire_subscriptions` | Ejecuta tarea diaria de expiración de suscripciones |
| `python manage.py create_fake_data` | Crea datos de prueba completos |
| `python manage.py delete_fake_data --confirm` | Elimina datos de prueba |
| `npm run dev` | Inicia el servidor frontend |
| `npm test` | Ejecuta pruebas unitarias (Jest) |
| `npm run test:coverage` | Pruebas unitarias con coverage |
| `npm run test:e2e` | Ejecuta pruebas E2E (Playwright) |
| `npm run e2e:coverage` | Pruebas E2E con V8 coverage |
| `npm run e2e:clean` | Limpia artefactos de E2E |

---

## Automatizaciones

Para expirar suscripciones automáticamente, programa el comando diario en cron:

```bash
0 0 * * * cd /path/to/kore_project/backend && source venv/bin/activate && python manage.py expire_subscriptions
```

## Variables de Entorno

### Backend (`backend/.env`)

| Variable | Descripción | Default |
|---|---|---|
| `DJANGO_SECRET_KEY` | Clave secreta de Django | — |
| `DJANGO_DEBUG` | Modo debug | `true` |
| `DJANGO_ALLOWED_HOSTS` | Hosts permitidos | `localhost,127.0.0.1` |
| `CORS_ALLOWED_ORIGINS` | Orígenes CORS permitidos | `http://localhost:3000` |
| `JWT_ACCESS_TOKEN_LIFETIME_DAYS` | Vigencia del access token | `1` |
| `JWT_REFRESH_TOKEN_LIFETIME_DAYS` | Vigencia del refresh token | `7` |

### Frontend (`frontend/.env.local`)

| Variable | Descripción | Default |
|---|---|---|
| `NEXT_PUBLIC_API_BASE_URL` | URL base de la API | `http://localhost:8000/api` |
| `PLAYWRIGHT_BASE_URL` | URL base para E2E | `http://localhost:3000` |