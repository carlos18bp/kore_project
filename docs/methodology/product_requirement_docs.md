# Product Requirement Document — KÓRE

## 1. Overview

**KÓRE** is a web platform for a Colombian health & wellness training business (korehealths.com). It enables customers to purchase training packages (programs), book sessions with trainers, and manage subscriptions — while providing trainers and admins with tools to manage availability, track payments, and monitor analytics.

The platform operates with **Colombian Pesos (COP)** as the default currency and integrates with **Wompi** as the primary payment gateway.

---

## 2. Problems It Solves

| Problem | Solution |
|---------|----------|
| Manual session booking via WhatsApp/phone | Self-service booking with calendar-based slot selection |
| No payment tracking | Integrated Wompi payments with automatic subscription creation |
| No recurring billing | Automated recurring charges via Huey periodic tasks |
| No visibility into training schedules | Calendar view for customers; availability management for trainers |
| No centralized content management | Admin-managed FAQ, site settings, contact messages |
| No analytics on user behavior | Event tracking (WhatsApp clicks, package views, bookings, payments) |

---

## 3. Target Users

| Role | Description |
|------|-------------|
| **Customer** | End user who purchases packages, books training sessions, manages subscriptions |
| **Trainer** | Fitness/health professional who manages availability slots and conducts sessions |
| **Admin** | Business owner/manager who manages packages, views analytics, handles contact messages |

---

## 4. Core Features

### 4.1 Authentication & User Management
- Email-based custom user model (no username)
- Three roles: `customer`, `trainer`, `admin`
- JWT authentication (SimpleJWT) with access + refresh tokens
- Pre-registration flow (collects user data before payment, creates account on webhook confirmation)
- Google reCAPTCHA integration for registration/contact forms

### 4.2 Packages (Programs)
- Three categories: Personalizado, Semi-personalizado, Terapéutico
- Configurable: sessions count, session duration, price, validity days, terms & conditions
- Orderable and activatable by admin
- Public listing with pricing table

### 4.3 Subscriptions
- Created automatically when a Wompi payment is confirmed (webhook)
- Tracks: sessions total, sessions used, sessions remaining, validity period
- Statuses: active → expired / canceled
- Recurring billing support via saved Wompi payment sources
- Expiry email reminders (7 days before, non-recurring only)

### 4.4 Booking System
- Customers book sessions against their active subscriptions
- Slot-based: each booking links to an AvailabilitySlot
- Statuses: pending → confirmed / canceled
- Business rules enforced by `booking_rules` service
- ICS calendar file generation for confirmed bookings
- Booking notifications (confirmed, canceled, rescheduled, reminder)

### 4.5 Availability Management
- Trainers have availability slots (start/end datetime windows)
- Slots can be blocked with a reason
- Unique constraint on (starts_at, ends_at) to prevent overlaps
- Management command to bulk-create weekday slots

### 4.6 Payments
- Primary provider: Wompi (Colombian payment gateway)
- Supported methods: Card, Nequi, PSE, Bancolombia
- PaymentIntent flow: intent created → Wompi widget → webhook confirms → Payment + Subscription created
- Integrity signature verification for webhooks
- Statuses: pending → confirmed / failed / canceled / refunded

### 4.7 Notifications
- Email-based notifications via Gmail SMTP
- Types: booking_confirmed, booking_canceled, booking_rescheduled, booking_reminder, payment_confirmed, receipt_email, subscription_activated, subscription_canceled, subscription_expiry_reminder
- Notification model tracks delivery status (pending/sent/failed)

### 4.8 Content Management (CMS-lite)
- **SiteSettings**: singleton with company info, social links, footer text
- **FAQ**: categories + items, orderable, activatable
- **Contact messages**: public form → admin review (new/read/replied/archived)

### 4.9 Analytics
- Event tracking: WhatsApp clicks, package views, bookings created, payments confirmed
- Session-based tracking with optional user association

### 4.10 Diagnostic Engine (Health Assessments)
A comprehensive health evaluation system with 5 assessment modules, each with auto-computed indices on save:

| Module | Model | Key Data | Computed Indices |
|--------|-------|----------|------------------|
| **Anthropometry** | `AnthropometryEvaluation` | Weight, height, waist, hip, perimeters (JSON), skinfolds (JSON) | BMI, waist-hip ratio, waist-height ratio, body fat %, fat/lean mass, asymmetries |
| **Posturometry** | `PosturometryEvaluation` | 4-view observations (anterior, lateral R/L, posterior) as JSON, photos per view | Global/upper/central/lower indices, segment scores, findings |
| **Physical Evaluation** | `PhysicalEvaluation` | Squats, pushups, plank, 6min walk, unipodal balance, mobility (hip/shoulder/ankle) | Strength/endurance/mobility/balance/general indices, cross-module alerts |
| **Nutrition Habits** | `NutritionHabit` | Meals/day, water intake, fruit/vegetable/protein frequency, ultra-processed/sugary drinks frequency, breakfast habit | Habit score (0–10), category, color |
| **PAR-Q+ Assessment** | `ParqAssessment` | 7 general health questions (yes/no) | Yes count, risk classification (green/yellow/red) |

- **Trainer endpoints**: Create and manage evaluations for their assigned clients
- **Client endpoints**: Read-only access to their own evaluations
- **Cooldowns**: Nutrition (1 entry per 7 days), PAR-Q (1 entry per 90 days)
- **Cross-module integration**: Physical evaluation pulls context from latest anthropometry and posturometry
- **Recommendations**: Auto-generated per index, editable by trainers
- **Scientific basis**: Each calculator references peer-reviewed literature (ACSM, WHO, CSEP, Kendall, etc.)

### 4.11 KORE General Index
- Composite health score (0–100) aggregating all diagnostic modules
- Weighted contributions: Anthropometry 20%, Metabolic risk 15%, Posture 20%, Physical condition 20%, Wellbeing 10%, Nutrition 15%
- Classification: Critical (0–39), Needs intervention (40–59), In progress (60–74), Good (75–89), Optimal (90–100)
- Exposed via the pending assessments endpoint

### 4.12 Customer Profile
- 1-to-1 with User (role=customer) via `CustomerProfile`
- Personal data: sex, date of birth, EPS, ID type/number, address, city
- Fitness goal selection (fat loss, muscle gain, rehab, general health, sports performance)
- Avatar upload, profile completion tracking
- Auto-computed `profile_completed` flag based on key fields

### 4.13 Trainer Client Management
- Trainers can view all their assigned clients (clients with bookings)
- Client detail: profile info, subscription status, session history
- Trainer dashboard stats: total clients, active subscriptions, sessions this month
- Per-client assessment management (anthropometry, posturometry, physical eval, nutrition, PAR-Q)

### 4.14 Mood & Weight Tracking
- **MoodEntry**: Daily mood log (1–10 scale) with optional notes, one per user per day
- **WeightEntry**: Daily weight log (kg), one per user per day
- Full history persisted for trainer review and progress analytics

### 4.15 Password Reset
- 6-digit verification code sent via email
- Codes expire after 10 minutes, single-use
- Previous codes invalidated on new request
- Forgot password page on frontend

### 4.16 Terms & Conditions Acceptance
- Versioned terms acceptance tracking
- Records IP address, user-agent, and timestamp as legal evidence
- New acceptance required when terms version changes
- Unique constraint on (user, terms_version)

### 4.17 Admin Panel
- Full Django admin with 23 Admin classes (22 ModelAdmin + 1 Form) for all 24 models
- Autocomplete fields, filters, search, readonly fields

---

## 5. Non-Functional Requirements

| Requirement | Implementation |
|-------------|---------------|
| **Security** | JWT auth, CSRF protection, reCAPTCHA, Wompi webhook signature verification |
| **Performance** | Database indexes on all status/date fields, select_related in querysets |
| **Scalability** | Huey task queue for async processing (recurring billing, email reminders) |
| **SEO** | Next.js static export with OpenGraph image generation, sitemap.xml, robots.txt |
| **Deployment** | Gunicorn + Nginx + systemd on Ubuntu, MySQL production DB, Redis for Huey |
| **Backups** | django-dbbackup with compressed SQL dumps, configurable retention |
| **Monitoring** | Optional Silk profiling (query analysis, slow query detection) |
| **Testing** | pytest (backend), Jest (frontend unit), Playwright (E2E) |

---

## 6. Business Rules

1. A customer must have an **active subscription with remaining sessions** to book
2. **One booking per slot** — no overlapping active bookings on the same slot
3. Subscriptions are created **only on confirmed Wompi webhook** (not on intent creation)
4. Recurring billing charges the **saved payment source** on `next_billing_date`
5. Subscription expiry reminders sent **7 days before** expiration (non-recurring only, once)
6. Packages have **validity_days** — subscriptions expire after this period
7. Session counters reset on successful recurring billing cycle
8. Pre-registered users (pending payment) are created with hashed password stored in PaymentIntent
9. Trainers are linked 1-to-1 with User (role=trainer) via TrainerProfile
10. Contact messages are read-only in admin (name, email, phone, message cannot be edited)
11. Customers are linked 1-to-1 with User (role=customer) via CustomerProfile
12. **Diagnostic assessment cooldowns**: Nutrition entries max 1 per 7 days; PAR-Q entries max 1 per 90 days
13. **Trainer–client relationship** derived from bookings — a client is any customer with at least one booking with the trainer
14. All diagnostic indices are **auto-computed on model save** — never set manually by the client
15. **Password reset codes** expire after 10 minutes and are single-use; previous codes invalidated on new request
16. **Terms acceptance** is versioned — new acceptance required when `CURRENT_TERMS_VERSION` changes
17. **Mood and weight entries** enforce one entry per user per day (unique_together constraint)

---

## 7. Domain Glossary

| Term | Definition |
|------|------------|
| **Package** | A training program (e.g., "Personalizado 8 sesiones") with price, session count, and validity |
| **Subscription** | A customer's purchased instance of a package, tracking sessions and expiry |
| **Booking** | A scheduled training session linking customer ↔ slot ↔ package ↔ trainer ↔ subscription |
| **AvailabilitySlot** | A time window when a trainer is available for booking |
| **PaymentIntent** | A pending Wompi payment attempt, resolved on webhook confirmation |
| **Payment** | A confirmed financial transaction linked to a booking or subscription |
| **Notification** | An email notification record with type, status, and delivery metadata |
| **CustomerProfile** | Extended profile for customers (personal data, fitness goal, ID, avatar) |
| **AnthropometryEvaluation** | Body measurement record with auto-computed composition indices |
| **PosturometryEvaluation** | Postural observation record across 4 views with computed regional indices |
| **PhysicalEvaluation** | Functional fitness test results with computed strength/endurance/mobility indices |
| **NutritionHabit** | Self-reported dietary habit entry with computed habit score |
| **ParqAssessment** | PAR-Q+ health screening questionnaire with risk classification |
| **MoodEntry** | Daily mood log (1–10 scale) for wellbeing tracking |
| **WeightEntry** | Daily weight log for progress tracking |
| **PasswordResetCode** | Time-limited 6-digit verification code for password reset |
| **TermsAcceptance** | Versioned record of user consent to terms & conditions |
| **KORE Index** | Composite health score (0–100) computed from all diagnostic modules |
