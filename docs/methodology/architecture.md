# Architecture Documentation — KÓRE

## 1. System Overview

```mermaid
flowchart TB
    subgraph Client["Browser (Client)"]
        NextJS["Next.js Static Pages"]
        Zustand["Zustand Stores"]
        Axios["Axios HTTP Client"]
    end

    subgraph Server["Production Server"]
        Nginx["Nginx (SSL + Static)"]
        Gunicorn["Gunicorn (WSGI)"]
        Django["Django (core_project)"]
        DRF["Django REST Framework"]
        Huey["Huey Task Queue"]
        Redis["Redis"]
    end

    subgraph External["External Services"]
        Wompi["Wompi Payment Gateway"]
        Gmail["Gmail SMTP"]
        ReCAPTCHA["Google reCAPTCHA"]
    end

    subgraph Storage["Data"]
        MySQL["MySQL 8+ (prod)"]
        SQLite["SQLite (dev)"]
    end

    Client -->|HTTPS| Nginx
    Nginx -->|Unix Socket| Gunicorn
    Gunicorn --> Django
    Django --> DRF
    Django --> Huey
    Huey --> Redis
    DRF --> MySQL
    DRF --> Wompi
    DRF --> Gmail
    DRF --> ReCAPTCHA
    Wompi -->|Webhook| DRF
```

---

## 2. Development Architecture

```mermaid
flowchart LR
    subgraph Dev["Development"]
        FrontendDev["Next.js Dev Server\n:3000"]
        BackendDev["Django runserver\n:8000"]
    end

    FrontendDev -->|"/api/* proxy\n(next.config.ts rewrites)"| BackendDev
    BackendDev --> SQLite3["SQLite"]
    BackendDev --> RedisLocal["Redis (local)"]
```

In development:
- Next.js runs on port 3000 with API proxy to Django on port 8000
- SQLite database, no MySQL required
- Huey can run in immediate mode (`HUEY_IMMEDIATE=true`) for synchronous task execution

---

## 3. Request Flow

### 3.1 API Request

```mermaid
sequenceDiagram
    participant B as Browser
    participant N as Nginx
    participant G as Gunicorn
    participant D as Django
    participant MW as Middleware
    participant JWT as SimpleJWT
    participant V as DRF ViewSet
    participant S as Serializer
    participant DB as Database

    B->>N: HTTPS Request
    N->>G: Unix Socket
    G->>D: WSGI
    D->>MW: Security → Session → CORS → CSRF → Auth
    MW->>JWT: Validate Access Token
    JWT-->>MW: User object
    MW->>V: Routed ViewSet action
    V->>S: Validate/Serialize
    S->>DB: ORM Query
    DB-->>S: QuerySet
    S-->>V: Validated data
    V-->>B: JSON Response
```

### 3.2 Payment Flow (Wompi)

```mermaid
sequenceDiagram
    participant C as Customer
    participant FE as Frontend
    participant BE as Backend API
    participant W as Wompi

    C->>FE: Select package → Checkout
    FE->>BE: POST /api/wompi/generate-signature/
    BE-->>FE: {reference, signature, amount_in_cents}
    FE->>W: Wompi Widget (card/nequi/PSE/bancolombia)
    W-->>FE: Transaction created
    Note over W,BE: Async webhook
    W->>BE: POST /api/wompi/webhook/
    BE->>BE: Verify event signature
    BE->>BE: Create/find User (pre-registration)
    BE->>BE: Create Payment (confirmed)
    BE->>BE: Create Subscription (active)
    BE->>BE: Send receipt email
    BE-->>W: 200 OK
```

### 3.3 Booking Flow

```mermaid
sequenceDiagram
    participant C as Customer
    participant FE as Frontend (bookingStore)
    participant BE as Backend API
    participant Rules as booking_rules service

    C->>FE: Select slot + package
    FE->>BE: POST /api/bookings/
    BE->>Rules: validate_booking()
    Rules->>Rules: Check subscription active
    Rules->>Rules: Check sessions remaining > 0
    Rules->>Rules: Check slot not already booked
    Rules-->>BE: Valid
    BE->>BE: Create Booking
    BE->>BE: Increment subscription.sessions_used
    BE->>BE: Create confirmation Notification
    BE->>BE: Send email + ICS attachment
    BE-->>FE: 201 Created {booking}
```

---

## 4. Entity Relationship Diagram

```mermaid
erDiagram
    User ||--o| TrainerProfile : "1:1 (role=trainer)"
    User ||--o{ Subscription : "has many"
    User ||--o{ Booking : "has many (as customer)"
    User ||--o{ Payment : "has many"
    User ||--o{ PaymentIntent : "has many"
    User ||--o{ AnalyticsEvent : "has many (optional)"

    Package ||--o{ Subscription : "has many"
    Package ||--o{ Booking : "has many"
    Package ||--o{ PaymentIntent : "has many"

    Subscription ||--o{ Booking : "has many"
    Subscription ||--o{ Payment : "has many"

    TrainerProfile ||--o{ AvailabilitySlot : "has many"
    TrainerProfile ||--o{ Booking : "has many"

    AvailabilitySlot ||--o{ Booking : "has many"

    Booking ||--o{ Payment : "has many"
    Booking ||--o{ Notification : "has many"

    Payment ||--o{ Notification : "has many"

    FAQCategory ||--o{ FAQItem : "has many"

    User {
        int id PK
        string email UK
        string first_name
        string last_name
        string phone
        enum role "customer|trainer|admin"
        bool is_active
        bool is_staff
        datetime date_joined
    }

    TrainerProfile {
        int id PK
        int user_id FK
        string specialty
        text bio
        string location
        int session_duration_minutes
    }

    Package {
        int id PK
        string title
        string short_description
        text description
        enum category "personalizado|semi_personalizado|terapeutico"
        int sessions_count
        int session_duration_minutes
        decimal price
        string currency
        int validity_days
        text terms_and_conditions
        bool is_active
        int order
    }

    Subscription {
        int id PK
        int customer_id FK
        int package_id FK
        int sessions_total
        int sessions_used
        enum status "active|expired|canceled"
        datetime starts_at
        datetime expires_at
        string payment_source_id
        string payment_method_type
        bool is_recurring
        string wompi_transaction_id
        date next_billing_date
        datetime expiry_email_sent_at
        datetime expiry_ui_sent_at
    }

    AvailabilitySlot {
        int id PK
        int trainer_id FK
        datetime starts_at
        datetime ends_at
        bool is_active
        bool is_blocked
        string blocked_reason
    }

    Booking {
        int id PK
        int customer_id FK
        int package_id FK
        int slot_id FK
        int trainer_id FK
        int subscription_id FK
        enum status "pending|confirmed|canceled"
        text notes
        string canceled_reason
    }

    Payment {
        int id PK
        int booking_id FK
        int subscription_id FK
        int customer_id FK
        enum status "pending|confirmed|failed|canceled|refunded"
        decimal amount
        string currency
        enum provider "wompi|payu|epayco|paypal"
        string provider_reference
        json metadata
        datetime confirmed_at
    }

    PaymentIntent {
        int id PK
        int customer_id FK
        int package_id FK
        string reference UK
        string wompi_transaction_id
        string payment_source_id
        decimal amount
        string currency
        string pending_email
        string pending_first_name
        string pending_last_name
        string pending_phone
        string pending_password_hash
        string public_access_token
        enum status "pending|approved|failed"
    }

    Notification {
        int id PK
        int booking_id FK
        int payment_id FK
        enum notification_type
        enum status "pending|sent|failed"
        string sent_to
        string provider_message_id
        json payload
        text error_message
    }

    AnalyticsEvent {
        int id PK
        int user_id FK
        string event_type
        string session_id
        string path
        string referrer
        json metadata
    }

    SiteSettings {
        int id PK
        string company_name
        string email
        string phone
        string whatsapp
        string address
        string city
        string business_hours
        string instagram_url
        string facebook_url
        string footer_text
    }

    FAQCategory {
        int id PK
        string name
        string slug UK
        int order
        bool is_active
    }

    FAQItem {
        int id PK
        int category_id FK
        string question
        text answer
        bool is_active
        int order
    }

    ContactMessage {
        int id PK
        string name
        string email
        string phone
        text message
        enum status "new|read|replied|archived"
    }
```

---

## 5. Model Details

| Model | File | Fields | FKs | Key Constraints |
|-------|------|--------|-----|-----------------|
| User | `models/user.py` | 8 | — | email unique, custom AbstractBaseUser |
| TrainerProfile | `models/trainer_profile.py` | 5 | User (1:1) | limit_choices_to role=trainer |
| Package | `models/package.py` | 12 | — | ordering by (order, id) |
| Subscription | `models/subscription.py` | 14 | User, Package | — |
| AvailabilitySlot | `models/availability.py` | 6 | TrainerProfile | ends_at > starts_at check, unique (starts_at, ends_at) |
| Booking | `models/booking.py` | 8 | User, Package, AvailabilitySlot, TrainerProfile, Subscription | — |
| Payment | `models/payment.py` | 10 | Booking, Subscription, User | — |
| PaymentIntent | `models/payment_intent.py` | 14 | User, Package | reference unique |
| Notification | `models/notification.py` | 8 | Booking, Payment | — |
| AnalyticsEvent | `models/analytics.py` | 6 | User (nullable) | — |
| SiteSettings | `models/content.py` | 10 | — | SingletonModel (pk=1) |
| FAQCategory | `models/content.py` | 4 | — | slug unique |
| FAQItem | `models/content.py` | 5 | FAQCategory | — |
| ContactMessage | `models/content.py` | 5 | — | — |

**Total: 14 models** across 12 files (content.py has 4 models).

---

## 6. Service Layer

| Service | File | Responsibility |
|---------|------|---------------|
| `booking_rules` | `services/booking_rules.py` | Validates booking constraints (subscription active, sessions remaining, slot available) |
| `email_service` | `services/email_service.py` | Sends transactional emails (receipts, reminders, booking confirmations) |
| `ics_generator` | `services/ics_generator.py` | Generates ICS calendar files for confirmed bookings |
| `subscription_cleanup` | `services/subscription_cleanup.py` | Expires overdue subscriptions |
| `wompi_service` | `services/wompi_service.py` | Wompi API client (create transactions, generate references, verify signatures) |

---

## 7. Frontend Page Routing

| Route Group | Path | Page | Auth Required |
|-------------|------|------|---------------|
| `(public)` | `/` | Home (landing page) | No |
| `(public)` | `/programs` | Programs listing | No |
| `(public)` | `/checkout` | Payment checkout | No |
| `(public)` | `/login` | Login form | No |
| `(public)` | `/register` | Registration form | No |
| `(public)` | `/faq` | FAQ page | No |
| `(public)` | `/contact` | Contact form | No |
| `(public)` | `/kore-brand` | Brand/about page | No |
| `(public)` | `/terms` | Terms & conditions | No |
| `(app)` | `/dashboard` | Customer dashboard | Yes |
| `(app)` | `/calendar` | Session calendar view | Yes |
| `(app)` | `/book-session` | Book a new session | Yes |
| `(app)` | `/my-programs` | My programs/subscriptions | Yes |
| `(app)` | `/my-programs/program` | Single program detail | Yes |
| `(app)` | `/subscription` | Subscription management | Yes |

**Total: 15 pages** (9 public + 6 authenticated).

---

## 8. Store Architecture (Zustand)

| Store | File | State & Actions |
|-------|------|-----------------|
| `authStore` | `lib/stores/authStore.ts` | User state, login/logout, token management, profile fetch |
| `bookingStore` | `lib/stores/bookingStore.ts` | Slots, bookings CRUD, calendar data, booking creation/cancellation |
| `checkoutStore` | `lib/stores/checkoutStore.ts` | Checkout flow, Wompi config, payment intent creation, signature generation |
| `subscriptionStore` | `lib/stores/subscriptionStore.ts` | Subscriptions list, active subscription, session tracking, expiry reminders |

---

## 9. Async Tasks (Huey)

| Task | Schedule | Description |
|------|----------|-------------|
| `process_recurring_billing` | Daily 08:00 UTC | Charges subscriptions due today via Wompi saved payment sources |
| `send_expiring_subscription_reminders` | Daily 08:00 UTC | Emails reminders for non-recurring subscriptions expiring within 7 days |

---

## 10. Deployment Architecture

```mermaid
flowchart TB
    Internet["Internet"]
    Internet -->|HTTPS :443| Nginx

    subgraph Server["Ubuntu Server"]
        Nginx["Nginx\n(SSL termination)"]
        
        subgraph Django["Django Application"]
            Gunicorn["Gunicorn\n(2 workers)"]
            API["DRF API\n/api/*"]
            Admin["Django Admin\n/admin/*"]
            NextPages["Next.js Static\n/* (catch-all)"]
        end

        subgraph Background["Background"]
            HueyWorker["Huey Consumer"]
            RedisServer["Redis"]
        end

        subgraph Data["Data"]
            MySQLDB["MySQL 8+"]
            Backups["Compressed SQL Backups"]
        end

        Nginx -->|Unix Socket| Gunicorn
        Gunicorn --> API
        Gunicorn --> Admin
        Gunicorn --> NextPages
        HueyWorker --> RedisServer
        API --> MySQLDB
        HueyWorker --> MySQLDB
    end

    subgraph External["External"]
        WompiGW["Wompi"]
        GmailSMTP["Gmail SMTP"]
        Captcha["Google reCAPTCHA"]
    end

    API --> WompiGW
    API --> GmailSMTP
    API --> Captcha
    WompiGW -->|Webhook| API
```

### Systemd Services
- `kore_project.service` — Gunicorn WSGI server
- `kore_project.socket` — Unix socket activation
- `kore-huey.service` — Huey task consumer

### Build Process
1. `cd frontend && npm run build` → generates static export in `out/`
2. Build script moves `out/` → `backend/templates/`
3. Django serves static HTML via `serve_nextjs_page` catch-all view
4. `_next/` assets served by Nginx directly (1-year cache)
