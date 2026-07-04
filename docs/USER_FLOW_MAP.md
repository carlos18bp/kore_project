# User Flow Map

Version: 1.8
Last Updated: 2026-07-04
Description: End-to-end user flows for the Kore frontend, grouped by role with branches for form variants and alternate outcomes.
Sources: frontend/e2e/flow-definitions.json, frontend/e2e/helpers/flow-tags.ts, frontend/e2e specs, frontend/app routes. Canonical customer subscription URL is `/subscription` (flow IDs `my-programs-*` are historical).

## System Roles
- Guest: Unauthenticated visitor.
- User: Authenticated customer.
- Trainer: Fitness/health professional who manages clients and assessments.
- Admin: Platform administrator. Operates the `admin-platform/` route group (users, subscriptions, plans) under its own layout guard (`app/admin-platform/layout.tsx`).

## Shared Flows (Public or Guest + User)

### public-programs: Program Catalog
- Module: programs
- Priority: P2
- Route: /programs
- Roles: guest, user
- Description: Browse program categories and package cards.
- E2E Coverage: Covered (frontend/e2e/public/programs.spec.ts)

**Steps**
1. Open /programs.
2. Review program categories and package cards.
3. Select a package and click Reserve.

**Branches / Variations**
- Guest reserve redirects to /register?package=ID.
- Authenticated reserve redirects to /checkout?package=ID.
- Category tabs switch between personalized, semi-personalized, and therapeutic.
- Package API error shows empty plans state.

### checkout-flow: Checkout
- Module: checkout
- Priority: P1
- Route: /checkout?package=ID
- Roles: guest, user
- Description: Purchase a subscription via inline payment forms (Card, Nequi, PSE, Bancolombia) processed through Wompi.
- E2E Coverage: Covered (frontend/e2e/public/checkout.spec.ts)

**Steps**
1. Open /checkout with a package id.
2. Package summary loads and payment method selector renders.
3. Select a payment method (Card, Nequi, PSE, or Bancolombia).
4. Fill in the method-specific form and submit payment.
5. Backend creates a PaymentIntent and initiates the Wompi transaction.
6. The app polls intent status until approved or failed.
7. Success or failure screen is shown.

**Payment Methods**
- Card: Inline form (number, expiry, CVV, card holder) → Wompi tokenization API → POST /subscriptions/purchase/ → poll. Supports auto-renewal.
- Nequi: Phone number form → POST /subscriptions/purchase-alternative/ (NEQUI) → poll.
- PSE: Bank selector + document type/number + name + phone → POST /subscriptions/purchase-alternative/ (PSE) → redirect to external bank URL → poll.
- Bancolombia: Confirmation checkbox → POST /subscriptions/purchase-alternative/ (BANCOLOMBIA_TRANSFER) → redirect to Bancolombia URL → poll.

**Branches / Variations**
- Guest with a registration token in sessionStorage can access checkout.
- Guest without a registration token is redirected (see checkout-guest-redirect).
- Missing package id or not found package shows a not found state.
- Package fetch error shows a load error message.
- Wompi config missing public_key shows a payment config error.
- Card validation errors (invalid number, expired card, short CVV, short holder name) prevent submission.
- Card tokenization failure shows an error and re-enables the form.
- Nequi phone validation requires 10 digits starting with 3.
- PSE bank list loading shows a spinner; fetch failure shows reload message.
- PSE form validates bank selection, document, name, and phone.
- PSE and Bancolombia payments may redirect to an external URL for completion.
- Bancolombia requires a confirmation checkbox before submission.
- Payment method selector shows "Auto" badge on Card (recurring) and "manual renewal" note on others.
- Approved intent shows success screen with program details and link to /dashboard; may apply auto-login cookies for guests.
- Failed intent shows a rejection message.
- Polling state shows a processing indicator before final status.
- Wompi Widget checkout path is retained as fallback code but currently inactive.

### checkout-coverage-gaps: Checkout Edge Cases
- Module: checkout
- Priority: P3
- Route: /checkout?package=ID
- Roles: guest, user
- Description: Edge-case branches not covered by the primary checkout flow.
- E2E Coverage: Covered (frontend/e2e/public/checkout-coverage-gaps.spec.ts)

**Steps**
1. Open checkout with a package id.
2. Trigger edge-case paths through mocked responses.

**Branches / Variations**
- prepareCheckout failure shows an error and re-enables Pay.
- Widget script onerror shows a reload message.
- Widget callback without transaction id shows a payment error.
- Polling failure shows verifying payment then rejection message.
- Authenticated user with stale registration token still has access.
- Guest with valid registration token has access.
- Card tokenization API returns validation errors (field-level messages).
- Nequi purchase-alternative API failure shows Nequi-specific error.
- PSE bank list fetch failure shows reload page message.
- PSE purchase-alternative API failure shows PSE-specific error.
- Bancolombia purchase-alternative API failure shows Bancolombia-specific error.
- purchase-alternative 502 (Wompi gateway failure) shows generic payment error.

### checkout-payment-status-polling: Checkout Payment Status Polling
- Module: checkout
- Priority: P2
- Route: /checkout?package=ID
- Roles: user
- Description: Exercise the post-submit payment intent polling cycle until approved or failed (mocked APIs).
- E2E Coverage: Covered (frontend/e2e/public/checkout-payment-status-polling.spec.ts)

**Steps**
1. Open checkout as an authenticated user with a valid package id.
2. Select card payment and submit the inline card form (mock tokenization and purchase APIs).
3. Observe processing state while the app polls intent status.
4. Landing state shows success after status becomes approved, or failure messaging when the intent fails.

**Branches / Variations**
- Polling transitions from pending to approved show the success screen.
- Failed intent shows rejection feedback without leaving the user stuck in processing.
- Uses mocked Wompi config, package fetch, and intent endpoints (no live gateway).

### booking-session-page: Book Session Page Access
- Module: booking
- Priority: P1
- Route: /book-session
- Roles: guest, user
- Description: Entry point to scheduling with auth guard.
- E2E Coverage: Covered (frontend/e2e/app/book-session.spec.ts)

**Steps**
1. Open /book-session.
2. Calendar, step indicator, and placeholders render.

**Branches / Variations**
- Guest access redirects to /login.
- Sidebar navigation link opens /book-session.
- Step indicator shows schedule and confirm steps.

### booking-calendar-redirect: Calendar Redirect
- Module: booking
- Priority: P2
- Route: /calendar
- Roles: guest, user
- Description: Legacy calendar route redirects based on auth state.
- E2E Coverage: Covered (frontend/e2e/app/calendar.spec.ts)

**Steps**
1. Open /calendar.
2. App redirects based on authentication.

**Branches / Variations**
- Guest redirects to /login.
- Authenticated user redirects to /book-session.

### my-programs-list: My Programs List
- Module: programs
- Priority: P1
- Route: /subscription
- Roles: guest, user
- Description: List subscriptions and entry to in-page program detail (session lists, modals).
- E2E Coverage: Covered (frontend/e2e/app/my-sessions.spec.ts; frontend/e2e/app/coverage-gaps.spec.ts)

**Steps**
1. Open /subscription.
2. View subscription cards or empty state.
3. Navigate via the sidebar link (“Mi Suscripción”).

**Branches / Variations**
- Guest access redirects to /login.
- Empty list shows the no programs state.
- Status badges show active, expired, and canceled variants.
- Unknown status uses the fallback badge.

## Guest Flows

### auth-login: Login
- Module: auth
- Priority: P1
- Route: /login
- Roles: guest
- Description: Authenticate with valid credentials and handle login errors.
- E2E Coverage: Covered (frontend/e2e/auth/login.spec.ts)

**Steps**
1. Open /login.
2. Enter email and password.
3. Submit credentials to sign in.
4. Redirect to the app home (/dashboard).

**Branches / Variations**
- Invalid credentials show an error message.
- Disabled account shows a blocked login message.
- Password visibility toggle switches between masked and plain text.
- Already-authenticated visitors are redirected to /dashboard.
- Successful login as **trainer** redirects to `/trainer/dashboard` ([login/page.tsx](frontend/app/(public)/login/page.tsx)); covered in [frontend/e2e/auth/login.spec.ts](frontend/e2e/auth/login.spec.ts).

### auth-register: Register
- Module: auth
- Priority: P1
- Route: /register
- Roles: guest
- Description: Pre-register a new account via reCAPTCHA-protected form; the actual user account is created only after payment approval.
- E2E Coverage: Covered (frontend/e2e/public/register.spec.ts)

**Steps**
1. Open /register (optionally with ?package=ID).
2. Fill out required profile fields (name, email, phone, password, confirm password).
3. Complete reCAPTCHA verification (when site key is available).
4. Submit the form to POST /auth/pre-register/.
5. On success, store registration token + package in sessionStorage.
6. Redirect to /checkout?package=ID.

**Branches / Variations**
- Client-side validation: passwords must match, minimum 8 characters.
- reCAPTCHA required when site key is loaded; missing captcha shows error.
- No package query param shows error and redirects to /programs.
- Server pre-register errors surface form error messages.
- Duplicate email shows "Ya existe una cuenta" message and auto-redirects to /login after 1 second.
- Password visibility toggle updates input masking for both password fields.
- Authenticated users are redirected to /dashboard (or /checkout?package=ID if package param present).
- Package query string is preserved on redirect to /checkout.
- reCAPTCHA resets after a failed submission attempt.

### auth-forgot-password: Forgot Password
- Module: auth
- Priority: P1
- Route: /forgot-password
- Roles: guest
- Description: 3-step password reset: request code by email, verify 6-digit code, set new password.
- E2E Coverage: Covered (frontend/e2e/public/forgot-password.spec.ts)

**Steps**
1. Open /forgot-password.
2. Enter email address and submit to request a reset code.
3. Check email for 6-digit verification code.
4. Enter the code and verify.
5. Set a new password (minimum 8 characters) and confirm.
6. On success, redirect to /login after 2 seconds.

**Branches / Variations**
- Invalid or non-existent email still shows success message (security: no email enumeration).
- Request code API failure shows an error message.
- Invalid or expired code shows error and allows retry.
- "Volver a enviar código" resets to email step for re-sending.
- Passwords must match; mismatch shows validation error.
- Password under 8 characters shows validation error.
- Reset API failure shows server error detail or generic message.
- Step indicator shows progress (1→2→3) with visual state.
- "Volver a iniciar sesión" link returns to /login.

### public-home: Public Home
- Module: public
- Priority: P2
- Route: /
- Roles: guest
- Description: Land on the marketing home page and jump to programs.
- E2E Coverage: Covered (frontend/e2e/public/home.spec.ts)

**Steps**
1. Open /.
2. Review hero section content.
3. Use the hero CTA to jump to the programs section.

**Branches / Variations**
- CTA navigates to the #programs anchor.

### public-navbar: Public Navigation
- Module: public
- Priority: P3
- Route: /
- Roles: guest
- Description: Navigate public pages from the top navigation; navbar hides on checkout funnel pages.
- E2E Coverage: Covered (frontend/e2e/public/navbar.spec.ts)

**Steps**
1. Open /.
2. Use the navbar to open the programs page.

**Branches / Variations**
- Navigation works across desktop and mobile breakpoints.
- Navbar is hidden on /register and /checkout when a ?package= query param is present (checkout funnel).
- CTA button shows "Iniciar sesión" for guests and "Mi sesión" for authenticated users.

### public-brand: Brand Experience
- Module: public
- Priority: P3
- Route: /kore-brand
- Roles: guest
- Description: Explore the brand page and navigate to programs.
- E2E Coverage: Covered (frontend/e2e/public/kore-brand.spec.ts)

**Steps**
1. Open /kore-brand.
2. Review brand content.
3. Use the CTA to navigate to /programs.

**Branches / Variations**
- CTA always routes to the programs catalog.

### public-contact: Contact Form
- Module: public
- Priority: P3
- Route: /contact
- Roles: guest
- Description: Submit a contact message and handle validation errors.
- E2E Coverage: Covered (frontend/e2e/public/contact.spec.ts)

**Steps**
1. Open /contact.
2. Review contact details loaded from site settings.
3. Fill in required fields and submit the message.
4. Confirm success feedback.

**Branches / Variations**
- Missing required fields focus the first invalid input.
- Submission failures show an error toast/message.
- Phone number remains optional.

### public-faq: FAQ Page
- Module: public
- Priority: P3
- Route: /faq
- Roles: guest
- Description: Browse FAQs and navigate to contact.
- E2E Coverage: Covered (frontend/e2e/public/faq.spec.ts)

**Steps**
1. Open /faq.
2. Expand an FAQ accordion item.
3. Use the CTA to navigate to /contact.

**Branches / Variations**
- Accordion toggles update the expanded state per question.

### public-faq-errors: FAQ Error States
- Module: public
- Priority: P3
- Route: /faq
- Roles: guest
- Description: Handle empty and error states for FAQ content.
- E2E Coverage: Covered (frontend/e2e/public/faq-error-states.spec.ts)

**Steps**
1. Open /faq.
2. Observe empty state or error messaging as data loads.

**Branches / Variations**
- Empty FAQ list shows a no-content message.
- API failure shows an error message.
- Retry button appears after failures.

### public-terms: Terms & Conditions
- Module: public
- Priority: P3
- Route: /terms
- Roles: guest
- Description: Static legal page displaying the service terms and conditions; linked from the Footer and checkout context.
- E2E Coverage: Covered (frontend/e2e/public/terms.spec.ts)

**Steps**
1. Open /terms (via Footer link or direct navigation).
2. Review the contract clauses (object, definitions, duration, payment, obligations, etc.).
3. Use the back link to return to /programs.

**Branches / Variations**
- Footer link navigates to /terms from any public page.
- Footer note text ("Al reservar cualquier programa, aceptas nuestros Términos y Condiciones") links to /terms.
- Back link ("Volver a Programas") navigates to /programs.

### public-whatsapp-cta: Public WhatsApp Floating CTA
- Module: public
- Priority: P4
- Route: / (and other routes where `ConditionalWhatsApp` renders: /kore-brand, /programs, /faq, /contact)
- Roles: guest
- Description: Floating WhatsApp button visible on selected public pages; link opens the configured WhatsApp URL.
- E2E Coverage: Covered (frontend/e2e/public/whatsapp-cta.spec.ts)

**Steps**
1. Open a public route that shows the floating button (e.g. `/`).
2. Locate the WhatsApp control (link with accessible name).
3. Assert href targets the WhatsApp API URL.

**Branches / Variations**
- Button is not shown on /login, /dashboard, /checkout, etc. (see `ROUTES_WITH_WHATSAPP` in the app).

### checkout-guest-redirect: Checkout Guest Redirect
- Module: checkout
- Priority: P2
- Route: /checkout?package=ID
- Roles: guest
- Description: Redirect guest checkout when registration is required; validation happens in CheckoutClient after auth hydration.
- E2E Coverage: Covered (frontend/e2e/public/checkout-widget-errors.spec.ts)

**Steps**
1. Guest opens /checkout with a package id.
2. Auth store hydrates; app checks isAuthenticated and sessionStorage for registration token.
3. If no valid token exists, redirect to /register?package=ID.

**Branches / Variations**
- Package query string is preserved in the redirect URL (/register?package=ID).
- Guests with a valid registration token (matching the current package) continue to checkout.
- Authenticated users skip the token check entirely.
- Registration token is cleared from sessionStorage after payment success or failure.

## User Flows

### auth-logout: Logout
- Module: auth
- Priority: P2
- Route: /dashboard (logout action in sidebar)
- Roles: user
- Description: Sign out from the app and return to a public page.
- E2E Coverage: Covered (frontend/e2e/auth/logout.spec.ts)

**Steps**
1. Open any authenticated page (dashboard).
2. Use the sidebar logout action.
3. Session cookies are cleared and the user is redirected to a public page.

**Branches / Variations**
- Redirect lands on the home or login page depending on the last location.

### auth-session-persistence: Session Persistence
- Module: auth
- Priority: P2
- Route: /dashboard (hydrate on load)
- Roles: user
- Description: Persist authenticated sessions across reloads and handle cookie errors.
- E2E Coverage: Covered (frontend/e2e/auth/auth-persistence.spec.ts)

**Steps**
1. Log in to set kore_token and kore_user cookies.
2. Reload the page and hydrate the session from cookies.
3. Continue to authenticated pages without re-authentication.

**Branches / Variations**
- Unauthenticated access to /dashboard redirects to /login.
- Corrupted kore_user cookie clears auth state and redirects to /login.
- Profile API failure clears auth state and redirects to /login.
- Loading state appears during login submission.
- mapUser falls back to email when user name is missing.

### auth-token-refresh: Token Refresh on Expiry
- Module: auth
- Priority: P2
- Route: any `(app)` route making an authenticated API call
- Roles: user
- Description: When an API call returns 401 because the access token expired, transparently refresh it via /api/auth/token/refresh/ and retry the original request so the user is never bounced mid-session; if refresh is impossible, fall back to clearing auth cookies and routing to /login.
- E2E Coverage: Covered (frontend/e2e/auth/auth-token-refresh.spec.ts)

**Steps**
1. Be logged in with a valid kore_refresh cookie but an expired kore_token.
2. Trigger any authenticated API call (e.g. load /dashboard data); the call returns 401.
3. The HTTP layer calls POST /api/auth/token/refresh/, stores the new kore_token, and replays the original request, which now succeeds — the user sees their data without re-logging in.

**Branches / Variations**
- Concurrent 401s share a single in-flight refresh (single-flight) and all retry once it resolves.
- The refresh and login requests themselves are never retried (no refresh-of-the-refresh loop).
- Missing kore_refresh cookie or a failed refresh clears kore_token/kore_refresh/kore_user and lets the next hydrate route to /login.

### auth-protected-routes: Auth Protected Routes
- Module: auth
- Priority: P2
- Route: all `(app)` customer and trainer routes; /checkout (guest edge case)
- Roles: guest
- Description: Ensure authenticated app routes redirect anonymous users to login (or acceptable checkout funnel routes).
- E2E Coverage: Covered (frontend/e2e/auth/auth-protected-routes.spec.ts)

**Steps**
1. Clear or omit auth cookies.
2. Navigate directly to each protected route.
3. App redirects to /login (or allowed checkout/register/programs pattern for bare /checkout).

**Branches / Variations**
- Customer routes under `(app)` (e.g. /dashboard, /book-session, /subscription, /profile, assessments, /calendar) and trainer routes under /trainer/* each land on /login when unauthenticated.
- /checkout without package may redirect to login, register, subscription, or programs per current guards.

### dashboard-overview: Dashboard Overview
- Module: dashboard
- Priority: P1
- Route: /dashboard
- Roles: user
- Description: Render the main dashboard sections and quick actions.
- E2E Coverage: Covered (frontend/e2e/app/dashboard.spec.ts)

**Steps**
1. Open /dashboard after login.
2. Review greeting, program card, sessions remaining, next session, and recent activity.
3. Use quick actions to navigate to booking, subscription, or programs.

**Branches / Variations**
- Active subscription shows program name and sessions remaining.
- Upcoming session card shows scheduled session when available.
- Recent activity displays confirmed, canceled, and pending states.
- Sidebar navigation links remain visible.

### dashboard-reminder: Upcoming Session Reminder
- Module: dashboard
- Priority: P2
- Route: /dashboard
- Roles: user
- Description: Show a modal reminder for upcoming sessions within 48 hours.
- E2E Coverage: Covered (frontend/e2e/app/dashboard-reminder.spec.ts)

**Steps**
1. Load /dashboard.
2. App calls the upcoming reminder endpoint.
3. Reminder modal shows when a booking is within 48 hours.

**Branches / Variations**
- Dismissal hides the modal and persists for the session.
- "Ver detalle" navigates to the program detail page when subscription_id_display exists.
- Missing subscription_id_display sends users to /subscription.
- Sessions beyond 48 hours do not trigger the modal.
- Null API response keeps reminder hidden.

### my-programs-detail: Program Detail & Sessions
- Module: programs
- Priority: P2
- Route: /subscription (detail is in-page: select subscription, tabs, session rows)
- Roles: user
- Description: Review subscription detail, session history, and open session detail modal on the subscription page.
- E2E Coverage: Covered (frontend/e2e/app/my-sessions-flow.spec.ts)

**Steps**
1. Open /subscription and select a subscription (card / detail panel).
2. Review subscription header details and tabs.
3. Switch between upcoming and past sessions.
4. Open a session detail modal from the list.

**Branches / Variations**
- Empty upcoming or past sessions show placeholders.
- Navigation back to the list uses in-page UI (same route).
- Session rows open the detail modal for the selected booking.

### subscription-page: Subscription Page
- Module: subscription
- Priority: P1
- Route: /subscription
- Roles: user
- Description: View subscription details, status, and payment history.
- E2E Coverage: Covered (frontend/e2e/app/subscription.spec.ts)

**Steps**
1. Open /subscription after login.
2. Load subscription list and select a subscription (if multiple).
3. Review details and payment history.

**Branches / Variations**
- No active subscription shows an empty state with link to programs.
- Active subscription shows status, usage, and payment history.
- Expired subscription shows inactive messaging.
- Empty payment history shows a placeholder.
- Payment history API failure shows an error message.
- Selecting a different subscription updates the detail card.
- Cancel subscription UX is covered in subscription-cancel-flow (active: button + confirmation dialog; expired/canceled: no cancel action).

### subscription-expiry-reminder: Subscription Expiry Reminder
- Module: subscription
- Priority: P2
- Route: /dashboard (modal on load)
- Roles: user
- Description: Prompt users about expiring subscriptions and acknowledge reminders.
- E2E Coverage: Covered (frontend/e2e/app/subscription-expiry-reminder.spec.ts)

**Steps**
1. App checks expiry reminder endpoint on load.
2. Reminder modal displays when a subscription is near expiration.
3. User dismisses the reminder or navigates to renew.

**Branches / Variations**
- Dismissal triggers acknowledgement API call.
- "Renovar ahora" navigates to /checkout?package=ID and acknowledges.
- 204 response hides the reminder.
- API failure keeps reminder hidden but exercises error handling.
- Ack API failure logs the attempt without blocking dismissal.

### subscription-cancel-flow: Subscription Cancel Flow
- Module: subscription
- Priority: P2
- Route: /subscription
- Roles: user
- Description: Cancel subscription affordances on the subscription page (mocked APIs).
- E2E Coverage: Covered (frontend/e2e/app/subscription-cancel-flow.spec.ts)

**Steps**
1. Open /subscription with an active subscription (mocked list/detail).
2. Locate "Cancelar suscripción" and verify visibility/state for the subscription status.
3. Open the confirmation dialog when cancel is available.
4. Confirm with "Sí, cancelar" to complete cancellation (mocked POST); UI shows canceled state and hides cancel.

**Branches / Variations**
- Active subscription: cancel button is visible and enabled; click opens "¿Seguro que deseas cancelar?".
- Confirming cancellation: subscription updates to canceled; "Cancelada" visible; cancel button hidden.
- Expired subscription: shows expired state and renew link; cancel button is not shown.
- Canceled subscription: shows canceled badge; cancel button is not shown.

### subscription-billing-failed-recovery: Subscription Billing Failed Recovery
- Module: subscription
- Priority: P2
- Route: /dashboard (toast on load)
- Roles: user
- Description: Recover from a failed recurring billing attempt by updating the payment method via the dashboard toast.
- E2E Coverage: Covered (frontend/e2e/app/subscription-billing-failed-recovery.spec.ts)

### subscription-gated-routes: Subscription Gated Routes
- Module: subscription
- Priority: P2
- Route: any gated `(app)` route (e.g. /book-session, /my-diagnosis)
- Roles: user
- Description: Access control enforced by `(app)/layout.tsx`: customers whose subscription list is non-empty and has no active subscription are redirected to /subscription. Only /subscription and /profile remain accessible without an active subscription.
- E2E Coverage: Covered (frontend/e2e/app/subscription-gated-routes.spec.ts)

**Steps**
1. Authenticated customer whose subscriptions are all expired/canceled navigates to a gated route (e.g. /book-session).
2. `(app)/layout.tsx` detects `subscriptions.length > 0 && !hasActiveSubscription && !ALLOWED_WITHOUT_SUBSCRIPTION.includes(pathname)`.
3. `router.replace('/subscription')` fires and the page redirects.
4. Subscription page renders with the expired subscription details.

**Branches / Variations**
- /subscription is accessible — no redirect.
- /profile is accessible — no redirect.
- User with **no subscriptions at all** (`subscriptions.length === 0`): layout skips the gating check entirely, allowing access to all routes (new users before their first purchase).
- User with an **active** subscription: `hasActiveSubscription = true`, no redirect.
- Once the customer purchases or renews a subscription (`status === 'active'`), the gating resolves on the next layout effect cycle.

**Steps**
1. Backend recurring billing fails for an active subscription; backend marks the subscription as `pending_payment_update`.
2. User opens /dashboard.
3. SubscriptionDashboardToast renders the failed-billing variant with a CTA to update payment.
4. User clicks "Actualizar pago" → app navigates to /checkout with the package and an `update=1` flag.
5. After completing a new payment method, backend clears the flag and the toast no longer appears on subsequent /dashboard loads.

**Branches / Variations**
- User dismisses the toast manually; dismiss persists in sessionStorage and the toast does not reappear within the same session.
- New payment also fails: toast reappears on next /dashboard load.
- Subscription without `pending_payment_update`: toast is not rendered.
- Loading state suppresses the toast while the subscription list is fetching.

### booking-session-flow: Book Session Flow
- Module: booking
- Priority: P1
- Route: /book-session
- Roles: user
- Description: Select a date and slot to proceed through the booking flow.
- E2E Coverage: Covered (frontend/e2e/app/book-session-flow.spec.ts)

**Steps**
1. Open /book-session with an active subscription.
2. Select an available date and time slot.
3. Review the confirmation step.
4. Confirm to proceed toward booking creation.

**Branches / Variations**
- Calendar navigation updates month availability.
- Slots can be toggled between 12h/24h time formats.
- No availability shows a message for reschedule or empty slots.
- Returning to step one retains selections.

### booking-complete-flow: Complete Booking Flow
- Module: booking
- Priority: P1
- Route: /book-session
- Roles: user
- Description: Complete booking creation end-to-end with confirmation.
- E2E Coverage: Covered (frontend/e2e/app/booking-complete-flow.spec.ts)

**Steps**
1. Select a date and slot.
2. Confirm the booking creation step.
3. View the success confirmation modal.
4. Return to booking or dashboard as needed.

**Branches / Variations**
- Back button returns to slot selection.
- Success modal can be closed to return to booking page.
- 12h/24h format toggle updates time labels.
- Null trainer details fall back to placeholder values.

### booking-error-paths: Booking Error Paths
- Module: booking
- Priority: P2
- Route: /book-session, /subscription
- Roles: user
- Description: Display booking-related API failures and error states.
- E2E Coverage: Covered (frontend/e2e/app/booking-error-paths.spec.ts)

**Steps**
1. Open booking pages that depend on trainers, subscriptions, or bookings.
2. Surface error messaging when API failures occur.

**Branches / Variations**
- Trainer fetch failure shows an error banner.
- Subscription fetch failure shows an error banner.
- Booking list failure shows error messaging.
- Cancel booking failure surfaces a cancel error.
- Create booking errors show specific error variants.

### booking-reschedule: Booking Reschedule
- Module: booking
- Priority: P2
- Route: /subscription
- Roles: user
- Description: Reschedule existing bookings while enforcing time limits.
- E2E Coverage: Covered (frontend/e2e/app/booking-reschedule.spec.ts)

**Steps**
1. Open /subscription and select a subscription with sessions.
2. Open a confirmed session detail modal.
3. Click Reprogramar to navigate to /book-session.

**Branches / Variations**
- Reschedule button disabled when session starts within 24 hours.
- Modal shows trainer and location details.

### booking-calendar-edge-cases: Calendar Edge Cases
- Module: booking
- Priority: P3
- Route: /book-session
- Roles: user
- Description: Handle disabled days and empty availability in the calendar.
- E2E Coverage: Covered (frontend/e2e/app/calendar-edge-cases.spec.ts)

**Steps**
1. Load the booking calendar.
2. Inspect disabled days and empty availability states.

**Branches / Variations**
- Past days are disabled and non-interactive.
- Days without slots show "no slots" messaging.
- Selecting a day highlights the active date.

### booking-no-sessions: No Sessions Modal
- Module: booking
- Priority: P2
- Route: /book-session
- Roles: user
- Description: Show the no sessions modal when subscriptions are exhausted.
- E2E Coverage: Covered (frontend/e2e/app/no-sessions-modal.spec.ts)

**Steps**
1. Load /book-session with a subscription that has no sessions remaining.
2. Display the no sessions modal.

**Branches / Variations**
- Active sessions hide the modal.
- Reschedule flow can still open when enabled.

### booking-session-detail: Session Detail Modal
- Module: booking
- Priority: P2
- Route: /subscription
- Roles: user
- Description: View and manage session detail modal states.
- E2E Coverage: Covered (frontend/e2e/app/session-detail.spec.ts)

**Steps**
1. Open a session row from program detail.
2. Review trainer, time, and status details.
3. Cancel or reschedule if allowed.

**Branches / Variations**
- Cancel flow requires a reason before confirming.
- Cancel action hidden for sessions too close to start time.
- Pending, confirmed, and canceled states change available actions.
- Modal can be closed via overlay or close button.

### booking-cancel-flow: Booking Cancel Flow
- Module: booking
- Priority: P1
- Route: /subscription
- Roles: user
- Description: Full cancel journey from program detail through session detail modal (mocked bookings API).
- E2E Coverage: Covered (frontend/e2e/app/booking-cancel-flow.spec.ts)

**Steps**
1. Open program detail with upcoming confirmed sessions (mocked).
2. Open session detail from a confirmed row ("Confirmada").
3. Start cancel, optionally enter a reason, and confirm cancellation.
4. Modal closes after successful cancel; booking list reflects canceled state in mocks.

**Branches / Variations**
- Happy path: reason field optional; confirm sends cancel API and closes dialog.
- Cancel API error (e.g. 500): dialog remains open for user retry or dismissal.

### app-sidebar-navigation: Sidebar Navigation
- Module: navigation
- Priority: P3
- Route: /dashboard
- Roles: user
- Description: Navigate the app via sidebar and mobile menu.
- E2E Coverage: Covered (frontend/e2e/app/sidebar-navigation.spec.ts)

**Steps**
1. Open /dashboard.
2. Use sidebar links to navigate between sections.
3. Toggle sidebar visibility on mobile.

**Branches / Variations**
- Active link highlights reflect current route.
- Mobile toggle opens and closes the navigation drawer.

### mobile-bottom-nav: Mobile Bottom Navigation (Customer)
- Module: navigation
- Priority: P2
- Route: any authenticated customer route on mobile viewport
- Roles: user
- Description: Navigate the customer mobile bottom bar (Inicio, Agendar, Más sheet, Logout) on small viewports.
- E2E Coverage: Covered (frontend/e2e/app/mobile-bottom-nav.spec.ts)

**Steps**
1. Open /dashboard on a mobile viewport (≤640px width).
2. MobileBottomNav renders fixed at the bottom of the screen with navigation tabs.
3. Tap "Inicio" → /dashboard with active state highlight.
4. Tap "Agendar" → /book-session.
5. Tap "Más" → bottom sheet opens with extra options (Mi Suscripción, Evaluaciones list, Cerrar sesión).
6. Tap "Cerrar sesión" → store logout → redirect to /.

**Branches / Variations**
- Active state matches current pathname.
- Pending assessments badge appears when there are uncompleted modules.
- Tapping the backdrop or close button closes the "Más" sheet without navigation.
- Sheet items navigate to subscription or assessment routes.
- On desktop viewports, MobileBottomNav is hidden.

### trainer-mobile-bottom-nav: Mobile Bottom Navigation (Trainer)
- Module: navigation
- Priority: P3
- Route: any authenticated trainer route on mobile viewport
- Roles: trainer
- Description: Navigate the trainer mobile bottom bar (Inicio, Clientes, Más sheet) on small viewports.
- E2E Coverage: Covered (frontend/e2e/trainer/trainer-mobile-bottom-nav.spec.ts)

**Steps**
1. Trainer opens /trainer/dashboard on a mobile viewport.
2. TrainerMobileBottomNav renders fixed at the bottom with the trainer-specific tabs.
3. Tap "Inicio" → /trainer/dashboard with active highlight.
4. Tap "Clientes" → /trainer/clients.
5. Tap "Más" → sheet opens with secondary options including Cerrar sesión.
6. Tap "Cerrar sesión" → logout → redirect to /.

**Branches / Variations**
- Active state highlight reflects the current trainer route.
- Trainer nav lacks the customer "Evaluaciones" sheet entry.
- Sheet close via backdrop or close button.
- On desktop viewports, the trainer mobile nav is hidden in favor of the sidebar.

### app-coverage-gaps: App Coverage Gaps
- Module: app
- Priority: P3
- Route: multiple (dashboard, subscription, book-session)
- Roles: user
- Description: Exercise UI states that are underserved by existing coverage.
- E2E Coverage: Covered (frontend/e2e/app/coverage-gaps.spec.ts)

**Steps**
1. Navigate to target pages with mocked responses.
2. Observe placeholder or fallback UI states.

**Branches / Variations**
- Subscription cards show active, expired, canceled, and unknown states.
- Empty availability shows "no slots" message.
- Payment history failures show error states.
- Subscription history failures show error states.
- Time format toggle switches labels.

### app-edge-case-branches: App Edge Case Branches
- Module: app
- Priority: P3
- Route: /book-session, /login
- Roles: user
- Description: Cover edge case UI branches in booking and auth flows.
- E2E Coverage: Covered (frontend/e2e/app/edge-case-branches.spec.ts)

**Steps**
1. Trigger edge-case scenarios for booking and auth flows.
2. Observe fallback UI branches.

**Branches / Variations**
- Booking success with null trainer shows fallback text.
- Malformed auth cookies redirect to login.
- Null or missing data falls back to placeholders.

### app-store-error-paths: Store Error Paths
- Module: app
- Priority: P3
- Route: /dashboard, /subscription
- Roles: user
- Description: Handle store hydration and API error branches.
- E2E Coverage: Covered (frontend/e2e/app/store-error-paths.spec.ts)

**Steps**
1. Load authenticated pages that hydrate stores.
2. Surface error messaging when API failures occur.

**Branches / Variations**
- Corrupted auth cookies clear auth state and redirect to login.
- Reschedule API error shows an error message on the booking modal.

## Profile Flows

### profile-management: Profile Management
- Module: profile
- Priority: P1
- Route: /profile
- Roles: user
- Description: View and edit personal information, upload avatar, select primary goal, and view mood check-in.
- E2E Coverage: Covered (frontend/e2e/app/profile.spec.ts)

**Steps**
1. Open /profile after login.
2. View avatar, name, email, and member-since date in the sidebar card.
3. Edit personal fields (name, last name, phone, sex, address, city, DOB, EPS, ID type/number/expedition date).
4. Fields auto-save after 1.2s debounce; toast shows "Guardando..." then "Guardado".
5. Select a primary goal from the goal cards.
6. View mood check-in status (today's score or prompt).
7. View quick stats summary card.

**Branches / Variations**
- Avatar click opens file picker; upload replaces avatar preview immediately.
- Invalid file types or upload failure show error state.
- Field save failure hides the toast and shows error via store.
- Empty profile shows "Completa tu perfil para ver tu resumen" placeholder.
- Goal selection triggers immediate save (no debounce).
- Mood already set shows score with color-coded badge (green/amber/red).
- Loading state shows spinner while profile fetches.

### profile-password-change: Profile Password Change
- Module: profile
- Priority: P2
- Route: /profile
- Roles: user
- Description: Request verification code and change password from the profile security section.
- E2E Coverage: Covered (frontend/e2e/app/profile-password-change.spec.ts)

**Steps**
1. Scroll to the Security card on /profile.
2. Click "Cambiar contraseña" to request a reset code via email.
3. Password reset modal opens on success.
4. Enter code + new password in the modal to complete the change.

**Branches / Variations**
- Request code API failure shows inline error message.
- Loading state disables button and shows "Enviando código..." spinner.
- Modal close returns to profile without completing reset.

### profile-mood-entry: Profile Mood Entry
- Module: profile
- Priority: P3
- Route: /profile (modal overlay)
- Roles: user
- Description: Record a daily mood (1-10) entry from the MoodCheckIn modal that auto-opens on the profile page when no mood has been logged today.
- E2E Coverage: Covered (frontend/e2e/app/profile-mood-entry.spec.ts)

### profile-completion-cta: Profile Completion CTA
- Module: profile
- Priority: P2
- Route: any `(app)` authenticated route (typically /dashboard on first login)
- Roles: user
- Description: Onboarding modal that auto-appears for customers with `profile_completed = false`. Lists missing fields and prompts the user to navigate to /profile.
- E2E Coverage: Covered (frontend/e2e/app/profile-completion-cta.spec.ts)

**Steps**
1. Customer with incomplete profile opens any authenticated page (e.g. /dashboard).
2. `ProfileCompletionCTA` component detects `profile.customer_profile.profile_completed === false`.
3. Modal appears with heading "Queremos conocerte mejor" and a list of missing fields.
4. Customer clicks "Completar mi perfil" → navigates to /profile.
5. Modal auto-hides when pathname changes to /profile.

**Branches / Variations**
- "Ahora no" button dismisses the modal without navigation; the modal does not re-appear in the same page lifecycle (shownRef prevents re-trigger).
- Clicking the backdrop also dismisses the modal.
- Modal does not appear on /profile even when profile is incomplete (suppress logic in component).
- Modal is not rendered for trainer users (conditional in `(app)/layout.tsx`).
- Once `profile_completed = true`, the modal never appears regardless of route.

**Steps**
1. Authenticated user with `profile_completed=true` and no mood registered today opens /profile.
2. MoodCheckIn modal opens automatically as an overlay.
3. User picks a score 1-10 (default 7), optionally writes a note.
4. User clicks the submit button → POST /api/auth/mood/ → store updates `todayMood`.
5. Confirmation view appears for ~2 seconds, then the modal closes.

**Branches / Variations**
- Today's mood already exists: modal does NOT open.
- User dismisses via backdrop click or X: sessionStorage `kore_mood_dismissed` is set so the modal stays hidden for the rest of the session.
- User without `profile_completed=true`: modal does NOT open (the profile completion CTA takes precedence).
- Weight tracking is currently NOT exposed in the profile UI; the `/auth/weight/` endpoint and `submitWeight` store action exist but no component invokes them. Tracked as future work.

## Assessment Flows

### customer-diagnosis: Customer Diagnosis
- Module: assessments
- Priority: P2
- Route: /my-diagnosis
- Roles: user
- Description: View anthropometry/body composition diagnosis with educational indicators and progress timeline.
- E2E Coverage: Covered (frontend/e2e/app/customer-diagnosis.spec.ts)

**Steps**
1. Open /my-diagnosis after login.
2. View hero summary cards (weight, body fat %, lean mass) with animated count-up numbers.
3. View trainer notes if available.
4. Expand index cards (body fat, mass composition, BMI, waist, waist-hip ratio) for educational content.
5. View progress timeline comparing evaluations over time.

**Branches / Variations**
- No evaluations shows "Tu diagnóstico está en camino" empty state.
- Diff badges show improvement/regression vs previous and first evaluations.
- Accordion cards toggle with GSAP animation.
- Each index card shows: what it means, your result (color-coded), what you can do, and scientific formula.
- Custom trainer recommendations override default text when available.

### customer-nutrition: Customer Nutrition Assessment
- Module: assessments
- Priority: P2
- Route: /my-nutrition
- Roles: user
- Description: Complete and view nutrition assessment form with habit tracking and scoring.
- E2E Coverage: Covered (frontend/e2e/app/customer-nutrition.spec.ts)

**Steps**
1. Open /my-nutrition after login.
2. Complete nutrition habit questionnaire (protein, hydration, etc.).
3. Submit the form.
4. View scoring results with color-coded indicators.

**Branches / Variations**
- No previous assessment shows the form for first-time completion.
- Existing assessment shows results with option to update.
- Color-coded scores (red/yellow/green) indicate habit quality.

### customer-parq: Customer PAR-Q
- Module: assessments
- Priority: P2
- Route: /my-parq
- Roles: user
- Description: Complete and view PAR-Q physical activity readiness questionnaire.
- E2E Coverage: Covered (frontend/e2e/app/customer-parq.spec.ts)

**Steps**
1. Open /my-parq after login.
2. Answer 7 standard PAR-Q health screening questions (yes/no).
3. Optionally add additional notes.
4. Submit the questionnaire.
5. View risk assessment results.

**Branches / Variations**
- No previous PAR-Q shows the questionnaire form.
- Existing PAR-Q shows results with color-coded risk indicator.
- Any "yes" answer raises the risk flag; details explain each question.
- Loading and error states handled.

### customer-physical-evaluation: Customer Physical Evaluation
- Module: assessments
- Priority: P2
- Route: /my-physical-evaluation
- Roles: user
- Description: View physical evaluation results with fitness indicators and progress tracking.
- E2E Coverage: Covered (frontend/e2e/app/customer-physical-evaluation.spec.ts)

**Steps**
1. Open /my-physical-evaluation after login.
2. View latest evaluation results with fitness index cards.
3. Expand cards for educational content (what it means, your result, recommendations).
4. View progress timeline if multiple evaluations exist.

**Branches / Variations**
- No evaluations shows empty state with pending message.
- Index cards use GSAP accordion animations.
- Color-coded indicators (green/yellow/red) per fitness metric.
- Diff badges show changes from previous evaluation.

### customer-posturometry: Customer Posturometry
- Module: assessments
- Priority: P2
- Route: /my-posturometry
- Roles: user
- Description: View posturometry evaluation results with regional indicators and recommendations.
- E2E Coverage: Covered (frontend/e2e/app/customer-posturometry.spec.ts)

**Steps**
1. Open /my-posturometry after login.
2. View global posture score and regional breakdowns (head, shoulders, spine, pelvis, lower limbs).
3. Expand region cards for educational content and recommendations.
4. View progress timeline if multiple evaluations exist.
5. Open the photo compare lightbox via the "Comparar fotos en grande" button or the expand icon on any photo; tap a photo to zoom in/out; close with Escape, the close button, or the backdrop.

**Branches / Variations**
- No evaluations shows empty state.
- Color-coded indicators include orange in addition to green/yellow/red.
- Regional cards with GSAP accordion animations.
- Trainer recommendations override defaults when available.
- With a single photo the compare button reads "Ver foto en grande" and the lightbox shows one pane.
- Photo labels (Inicial/Última) render at the bottom edge of each frame so they never cover the subject's face.

### customer-pending-assessments: Pending Assessments
- Module: assessments
- Priority: P3
- Route: /dashboard
- Roles: user
- Description: View KORE score and pending assessment modules on the dashboard.
- E2E Coverage: Covered (frontend/e2e/app/customer-pending-assessments.spec.ts)

**Steps**
1. Load /dashboard.
2. Pending assessments widget shows KORE score, color, and category.
3. View module availability count (e.g., 3/6 modules completed).

**Branches / Variations**
- Null KORE score shows default/empty state.
- Modules available count reflects completed vs total assessments.

## Trainer Flows

### trainer-dashboard: Trainer Dashboard
- Module: trainer
- Priority: P1
- Route: /trainer/dashboard
- Roles: trainer
- Description: View trainer stats (total clients, today sessions) and upcoming session list.
- E2E Coverage: Covered (frontend/e2e/trainer/trainer-dashboard.spec.ts)

**Steps**
1. Open /trainer/dashboard after login as trainer.
2. View greeting with trainer name and time-of-day context.
3. View stats cards: total active clients, today's scheduled sessions.
4. Quick action card links to /trainer/clients.
5. View upcoming sessions list with client name, package, date/time.

**Branches / Variations**
- Loading state shows dashes for stats and spinner for session list.
- Empty upcoming sessions shows calendar placeholder and "No hay sesiones próximas".
- Session rows link to client detail page.
- Greeting changes based on hour (Buenos días/tardes/noches).

### trainer-clients-list: Trainer Client List
- Module: trainer
- Priority: P1
- Route: /trainer/clients
- Roles: trainer
- Description: Search and browse assigned client list with stats and quick action links.
- E2E Coverage: Covered (frontend/e2e/trainer/trainer-clients.spec.ts)

**Steps**
1. Open /trainer/clients after login as trainer.
2. View client cards in a responsive grid.
3. Use search input to filter by name or email.
4. View client stats: active package, completed sessions, sessions remaining.
5. Use quick actions to navigate to client detail or anthropometry pages.

**Branches / Variations**
- Loading state shows spinner.
- Empty client list shows "Aún no tienes clientes asignados." placeholder.
- Search with no results shows "No se encontraron clientes con esa búsqueda."
- Client avatar shows image or first-letter initial fallback.
- Goal labels map to Spanish display text.

### trainer-client-detail: Trainer Client Detail
- Module: trainer
- Priority: P1
- Route: /trainer/clients/client?id=X
- Roles: trainer
- Description: View individual client profile, session history, and access assessment module links.
- E2E Coverage: Covered (frontend/e2e/trainer/trainer-client-detail.spec.ts)

**Steps**
1. Navigate from client list to /trainer/clients/client?id=X.
2. View client profile card (avatar, name, email, phone, goal, DOB, city, EPS, member since).
3. View session history with status badges.
4. Access assessment module links (anthropometry, posturometry, physical evaluation, nutrition, PAR-Q).

**Branches / Variations**
- Loading state shows spinner.
- Client not found shows error state.
- Missing profile fields show fallback values.
- Session history shows confirmed/canceled/pending status badges.

### trainer-client-anthropometry: Trainer Client Anthropometry
- Module: trainer
- Priority: P2
- Route: /trainer/clients/client/anthropometry?id=X
- Roles: trainer
- Description: Create and view client anthropometry evaluations with body composition data.
- E2E Coverage: Covered (frontend/e2e/trainer/trainer-client-anthropometry.spec.ts)

**Steps**
1. Navigate to /trainer/clients/client/anthropometry?id=X.
2. View existing evaluation history.
3. Create a new evaluation with body composition measurements.
4. View calculated indices (BMI, body fat %, waist-hip ratio, etc.).

**Branches / Variations**
- No evaluations shows empty state with create button.
- Form validates required fields before submission.
- Calculated fields update based on input measurements.
- API failure shows error message.

### trainer-client-nutrition: Trainer Client Nutrition
- Module: trainer
- Priority: P2
- Route: /trainer/clients/client/nutrition?id=X
- Roles: trainer
- Description: View client nutrition assessment results and history.
- E2E Coverage: Covered (frontend/e2e/trainer/trainer-client-nutrition.spec.ts)

**Steps**
1. Navigate to /trainer/clients/client/nutrition?id=X.
2. View client's nutrition assessment results.
3. Review habit scores and recommendations.

**Branches / Variations**
- No assessments shows empty state.
- Color-coded scores per habit category.

### trainer-client-parq: Trainer Client PAR-Q
- Module: trainer
- Priority: P2
- Route: /trainer/clients/client/parq?id=X
- Roles: trainer
- Description: View client PAR-Q assessment results and risk indicators.
- E2E Coverage: Covered (frontend/e2e/trainer/trainer-client-parq.spec.ts)

**Steps**
1. Navigate to /trainer/clients/client/parq?id=X.
2. View client's PAR-Q responses and risk assessment.
3. Review flagged questions and additional notes.

**Branches / Variations**
- No assessments shows empty state.
- Flagged questions highlighted with risk indicator.

### trainer-client-physical-eval: Trainer Client Physical Eval
- Module: trainer
- Priority: P2
- Route: /trainer/clients/client/physical-evaluation?id=X
- Roles: trainer
- Description: Create and view client physical evaluation results with fitness indicators.
- E2E Coverage: Covered (frontend/e2e/trainer/trainer-client-physical-eval.spec.ts)

**Steps**
1. Navigate to /trainer/clients/client/physical-evaluation?id=X.
2. View existing evaluation history.
3. Create a new evaluation with fitness test measurements.
4. View calculated fitness indicators.

**Branches / Variations**
- No evaluations shows empty state with create button.
- Form validates required fields before submission.
- API failure shows error message.

### trainer-client-posturometry: Trainer Client Posturometry
- Module: trainer
- Priority: P2
- Route: /trainer/clients/client/posturometry?id=X
- Roles: trainer
- Description: Create and view client posturometry evaluations with regional analysis.
- E2E Coverage: Covered (frontend/e2e/trainer/trainer-client-posturometry.spec.ts)

**Steps**
1. Navigate to /trainer/clients/client/posturometry?id=X.
2. View existing evaluation history.
3. Create a new evaluation with postural observations per region.
4. View regional scores and global assessment.

**Branches / Variations**
- No evaluations shows empty state with create button.
- Form covers multiple body regions (head, shoulders, spine, pelvis, lower limbs).
- API failure shows error message.

### trainer-client-notes: Trainer Client Notes Tab
- Module: trainer
- Priority: P2
- Route: /trainer/clients/client?id=X (pestaña "Notas")
- Roles: trainer
- Description: Desde la pestaña Notas del detalle del cliente, el entrenador deja notas semanales por ciclo de 28 días en los subtabs Programa y Nutrición, con desbloqueo progresivo.
- E2E Coverage: Covered (frontend/e2e/trainer/trainer-client-week-notes.spec.ts)

**Steps**
1. Navegar a /trainer/clients/client?id=X y abrir la pestaña "Notas".
2. En el subtab "Programa", seleccionar un ciclo de 28 días.
3. Escribir la nota de la semana 1 y guardar; se desbloquea la semana 2.
4. Repetir para las semanas 2–4; las semanas guardadas se apilan como historial.
5. En el subtab "Nutrición", repetir el flujo por ciclo de nutrición, usando "Nuevo ciclo" para iniciar otro.

**Branches / Variations**
- Las semanas futuras aparecen bloqueadas hasta guardar la semana anterior.
- Una semana ya guardada se puede reabrir y editar.
- El cliente ve la nota de la semana vigente en /mi-programa y en la vista de nutrición.

## Route inventory note (2026-04-01)

Customer subscription and session management live at **`/subscription`** (`frontend/app/(app)/subscription/page.tsx`). Legacy paths such as `/my-programs` may still appear in `robots.txt` or old links; the SPA route used by E2E and the sidebar is `/subscription`.

## Admin Flows

Admin operates the `admin-platform/` route group, which has its own layout guard
(`app/admin-platform/layout.tsx`: `role==='admin'` else redirect to `/dashboard`)
and its own bottom nav (`AdminMobileBottomNav`). Detail pages are addressed by
`?id=` query param (no `[id]` segments, consistent with static export). Registered
2026-07-04 after the E2E user-flows audit found the whole group unmapped.

### admin-dashboard: Admin Platform Dashboard
- Module: admin
- Priority: P2
- Route: /admin-platform/dashboard
- Roles: admin
- Coverage: **Missing**
- Description: Landing overview for admins: aggregate subscription stat tiles (total, active, expired, canceled).

**Steps**
1. Admin logs in; `(app)/layout.tsx` redirects `role==='admin'` to /admin-platform/dashboard.
2. Stat tiles load from the subscriptions list.
3. Admin reads the totals and navigates into a section via the bottom nav.

**Branches / Variations**
- Non-admin hitting /admin-platform/* is redirected to /dashboard.

### admin-users-list: Admin Users List
- Module: admin
- Priority: P1
- Route: /admin-platform/users
- Roles: admin
- Coverage: **Missing**
- Description: Browse and manage the platform user roster.

**Steps**
1. Navigate to /admin-platform/users.
2. User list loads (paginated).
3. Admin searches by name/email and filters by role chips.
4. Admin clicks "＋ Inscribir usuario" → /admin-platform/users/new, or a row → user detail.

**Branches / Variations**
- Empty search result: empty state.
- Role filter narrows the list (customer / trainer / admin).

### admin-user-create: Admin Create User
- Module: admin
- Priority: P1
- Route: /admin-platform/users/new
- Roles: admin
- Coverage: **Missing**
- Description: Enroll a new user (customer or trainer) from the admin panel.

**Steps**
1. Navigate to /admin-platform/users/new.
2. Fill email, first/last name, phone.
3. Select role (customer/trainer).
4. Submit → POST /api/admin/users/ → back to list.

**Branches / Variations**
- Validation error (duplicate email / missing field): inline error.
- Cancel returns to the list without creating.

### admin-user-detail: Admin User Detail
- Module: admin
- Priority: P1
- Route: /admin-platform/users/detail?id=[userId]
- Roles: admin
- Coverage: **Missing**
- Description: Manage a single user: role, active state, password reset, trainer assignment, assigned clients.

**Steps**
1. Open a user from the list.
2. Edit role via role buttons; Save/Discard.
3. Toggle active/inactive (POST /api/admin/users/{id}/toggle-active/).
4. Reset password (POST /api/admin/users/{id}/reset-password/).
5. Assign a trainer via the select; manage assigned clients (Quitar).

**Branches / Variations**
- Deactivating an active user; reactivating an inactive one.
- Reassigning a client from one trainer to another.

### admin-subscriptions-list: Admin Subscriptions List
- Module: admin
- Priority: P2
- Route: /admin-platform/subscriptions
- Roles: admin
- Coverage: **Missing**
- Description: Browse all subscriptions across customers.

**Steps**
1. Navigate to /admin-platform/subscriptions.
2. List loads (page size 10).
3. Admin searches, filters by status, switches category tabs.
4. Row → subscription detail; "new" CTA → create wizard.

**Branches / Variations**
- Status filter: all / active / expired / canceled.

### admin-subscription-create: Admin Create Subscription
- Module: admin
- Priority: P1
- Route: /admin-platform/subscriptions/new
- Roles: admin
- Coverage: **Missing**
- Description: Create or evolve a subscription for a customer via a multi-step wizard.

**Steps**
1. Navigate to /admin-platform/subscriptions/new.
2. Search and select a customer.
3. Select a package.
4. Select payment method; add manual notes.
5. Confirm → POST /api/subscriptions/admin-create/.

**Branches / Variations**
- Customer already has an active sub → mode auto-switches to "evolve".

### admin-subscription-detail: Admin Subscription Detail
- Module: admin
- Priority: P1
- Route: /admin-platform/subscriptions/detail?id=[subId]
- Roles: admin
- Coverage: **Missing**
- Description: Manage one subscription: change status, renew, or delete.

**Steps**
1. Open a subscription from the list.
2. Change status via status buttons; Save/Discard.
3. Renew (modal) for expired/canceled subs → POST /api/subscriptions/{id}/admin-renew/.
4. Delete (modal) → DELETE /api/subscriptions/{id}/admin-delete/.

**Branches / Variations**
- Renew is only offered for expired/canceled subscriptions.
- Delete requires modal confirmation.

### admin-plans: Admin Plans CRUD
- Module: admin
- Priority: P1
- Route: /admin-platform/plans
- Roles: admin
- Coverage: **Missing**
- Description: Manage the package/plan catalog.

**Steps**
1. Navigate to /admin-platform/plans.
2. Click "Create" → modal form (category picker, price, sessions, validity).
3. Submit → POST /api/packages/; or edit an existing plan → PATCH /api/packages/{id}/.
4. Close/overlay dismiss cancels.

**Branches / Variations**
- Create vs edit share the same modal.
- Category picker: personalizado / semi_personalizado / terapeutico.

## Global UX Elements

These elements are present across multiple routes and affect the user experience globally.

- **WhatsApp Floating Button**: A fixed green button in the bottom-right corner of allowed public routes (`/`, `/kore-brand`, `/programs`, `/faq`, `/contact`). Opens an external WhatsApp conversation link. E2E flow: `public-whatsapp-cta` (see flow-definitions.json).
- **ConditionalFooter**: The public Footer is hidden on /login, /register, and /checkout routes. On all other public pages, the Footer renders with navigation links (including /terms) and social links.
- **Navbar Checkout Funnel**: The public Navbar is hidden when the user is on /register or /checkout with a ?package= query parameter, providing a distraction-free checkout experience.

## Legend / Conventions

- Priority: P1 (critical), P2 (important), P3 (nice-to-have), P4 (micro-UX / global elements; tracked in flow definitions but omitted from “missing P1–P3” noise in the flow coverage reporter).
- Coverage Status:
  - Covered: Explicit E2E spec exists for the flow.
  - Partial: Some branches are covered; flow needs additional coverage.
  - None: No automated E2E coverage found.
- Route: Primary entry route (may include query params or dynamic segments).
- Branches / Variations: Alternative user paths, edge cases, and form options.

## Coverage Summary

| Flow ID | Roles | Priority | Coverage | E2E Spec |
| --- | --- | --- | --- | --- |
| auth-login | guest | P1 | Covered | frontend/e2e/auth/login.spec.ts |
| auth-logout | user | P2 | Covered | frontend/e2e/auth/logout.spec.ts |
| auth-session-persistence | user | P2 | Covered | frontend/e2e/auth/auth-persistence.spec.ts |
| auth-register | guest | P1 | Covered | frontend/e2e/public/register.spec.ts |
| auth-protected-routes | guest | P2 | Covered | frontend/e2e/auth/auth-protected-routes.spec.ts |
| booking-session-page | guest, user | P1 | Covered | frontend/e2e/app/book-session.spec.ts |
| booking-session-flow | user | P1 | Covered | frontend/e2e/app/book-session-flow.spec.ts |
| booking-complete-flow | user | P1 | Covered | frontend/e2e/app/booking-complete-flow.spec.ts |
| booking-error-paths | user | P2 | Covered | frontend/e2e/app/booking-error-paths.spec.ts |
| booking-reschedule | user | P2 | Covered | frontend/e2e/app/booking-reschedule.spec.ts |
| booking-calendar-redirect | guest, user | P2 | Covered | frontend/e2e/app/calendar.spec.ts |
| booking-calendar-edge-cases | user | P3 | Covered | frontend/e2e/app/calendar-edge-cases.spec.ts |
| booking-no-sessions | user | P2 | Covered | frontend/e2e/app/no-sessions-modal.spec.ts |
| booking-session-detail | user | P2 | Covered | frontend/e2e/app/session-detail.spec.ts |
| booking-cancel-flow | user | P1 | Covered | frontend/e2e/app/booking-cancel-flow.spec.ts |
| app-coverage-gaps | user | P3 | Covered | frontend/e2e/app/coverage-gaps.spec.ts |
| app-edge-case-branches | user | P3 | Covered | frontend/e2e/app/edge-case-branches.spec.ts |
| app-store-error-paths | user | P3 | Covered | frontend/e2e/app/store-error-paths.spec.ts |
| app-sidebar-navigation | user | P3 | Covered | frontend/e2e/app/sidebar-navigation.spec.ts |
| dashboard-overview | user | P1 | Covered | frontend/e2e/app/dashboard.spec.ts |
| dashboard-reminder | user | P2 | Covered | frontend/e2e/app/dashboard-reminder.spec.ts |
| my-programs-list | guest, user | P1 | Covered | frontend/e2e/app/my-sessions.spec.ts |
| my-programs-detail | user | P2 | Covered | frontend/e2e/app/my-sessions-flow.spec.ts |
| subscription-page | user | P1 | Covered | frontend/e2e/app/subscription.spec.ts |
| subscription-expiry-reminder | user | P2 | Covered | frontend/e2e/app/subscription-expiry-reminder.spec.ts |
| subscription-cancel-flow | user | P2 | Covered | frontend/e2e/app/subscription-cancel-flow.spec.ts |
| checkout-flow | guest, user | P1 | Covered | frontend/e2e/public/checkout.spec.ts |
| checkout-guest-redirect | guest | P2 | Covered | frontend/e2e/public/checkout-widget-errors.spec.ts |
| checkout-coverage-gaps | guest, user | P3 | Covered | frontend/e2e/public/checkout-coverage-gaps.spec.ts |
| checkout-payment-status-polling | user | P2 | Covered | frontend/e2e/public/checkout-payment-status-polling.spec.ts |
| public-home | guest | P2 | Covered | frontend/e2e/public/home.spec.ts |
| public-navbar | guest | P3 | Covered | frontend/e2e/public/navbar.spec.ts |
| public-brand | guest | P3 | Covered | frontend/e2e/public/kore-brand.spec.ts |
| public-programs | guest, user | P2 | Covered | frontend/e2e/public/programs.spec.ts |
| public-contact | guest | P3 | Covered | frontend/e2e/public/contact.spec.ts |
| public-faq | guest | P3 | Covered | frontend/e2e/public/faq.spec.ts |
| public-faq-errors | guest | P3 | Covered | frontend/e2e/public/faq-error-states.spec.ts |
| public-terms | guest | P3 | Covered | frontend/e2e/public/terms.spec.ts |
| public-whatsapp-cta | guest | P4 | Covered | frontend/e2e/public/whatsapp-cta.spec.ts |
| auth-forgot-password | guest | P1 | Covered | frontend/e2e/public/forgot-password.spec.ts |
| profile-management | user | P1 | Covered | frontend/e2e/app/profile.spec.ts |
| profile-password-change | user | P2 | Covered | frontend/e2e/app/profile-password-change.spec.ts |
| customer-diagnosis | user | P2 | Covered | frontend/e2e/app/customer-diagnosis.spec.ts |
| customer-nutrition | user | P2 | Covered | frontend/e2e/app/customer-nutrition.spec.ts |
| customer-parq | user | P2 | Covered | frontend/e2e/app/customer-parq.spec.ts |
| customer-physical-evaluation | user | P2 | Covered | frontend/e2e/app/customer-physical-evaluation.spec.ts |
| customer-posturometry | user | P2 | Covered | frontend/e2e/app/customer-posturometry.spec.ts |
| customer-pending-assessments | user | P3 | Covered | frontend/e2e/app/customer-pending-assessments.spec.ts |
| trainer-dashboard | trainer | P1 | Covered | frontend/e2e/trainer/trainer-dashboard.spec.ts |
| trainer-clients-list | trainer | P1 | Covered | frontend/e2e/trainer/trainer-clients.spec.ts |
| trainer-client-detail | trainer | P1 | Covered | frontend/e2e/trainer/trainer-client-detail.spec.ts |
| trainer-client-anthropometry | trainer | P2 | Covered | frontend/e2e/trainer/trainer-client-anthropometry.spec.ts |
| trainer-client-nutrition | trainer | P2 | Covered | frontend/e2e/trainer/trainer-client-nutrition.spec.ts |
| trainer-client-parq | trainer | P2 | Covered | frontend/e2e/trainer/trainer-client-parq.spec.ts |
| trainer-client-physical-eval | trainer | P2 | Covered | frontend/e2e/trainer/trainer-client-physical-eval.spec.ts |
| trainer-client-posturometry | trainer | P2 | Covered | frontend/e2e/trainer/trainer-client-posturometry.spec.ts |
| trainer-client-notes | trainer | P2 | Covered | frontend/e2e/trainer/trainer-client-week-notes.spec.ts |
| profile-completion-cta | user | P2 | Covered | frontend/e2e/app/profile-completion-cta.spec.ts |
| subscription-gated-routes | user | P2 | Covered | frontend/e2e/app/subscription-gated-routes.spec.ts |
| customer-mi-programa | user | P1 | Covered | frontend/e2e/program/mi-programa.spec.ts |
| customer-mi-programa-rutina | user | P1 | Covered | frontend/e2e/program/mi-programa-rutina.spec.ts |
| customer-mi-programa-progreso | user | P2 | Covered | frontend/e2e/program/mi-programa-progreso.spec.ts |
| customer-mi-programa-resumen | user | P2 | Covered | frontend/e2e/program/mi-programa-resumen.spec.ts |
| customer-mi-programa-dia | user | P2 | Covered | frontend/e2e/program/mi-programa-dia.spec.ts |
| trainer-alerts | trainer | P1 | Covered | frontend/e2e/trainer/trainer-alerts.spec.ts |
| trainer-client-program | trainer | P2 | Covered | frontend/e2e/trainer/trainer-client-program.spec.ts |
| trainer-nutrition-catalog | trainer | P2 | Covered | frontend/e2e/trainer/trainer-nutrition-catalog.spec.ts |
| auth-accept-invite | guest, user | P2 | Covered | frontend/e2e/auth/accept-invite.spec.ts |
| auth-forced-password-change | user | P2 | Covered | frontend/e2e/auth/forced-password-change.spec.ts |
| trainer-metrics | trainer | P3 | Covered | frontend/e2e/trainer/trainer-metrics.spec.ts |
| auth-token-refresh | user | P2 | Covered | frontend/e2e/auth/auth-token-refresh.spec.ts |
| subscription-billing-failed-recovery | user | P2 | Covered | frontend/e2e/app/subscription-billing-failed-recovery.spec.ts |
| mobile-bottom-nav | user | P2 | Covered | frontend/e2e/app/mobile-bottom-nav.spec.ts |
| trainer-mobile-bottom-nav | trainer | P3 | Covered | frontend/e2e/trainer/trainer-mobile-bottom-nav.spec.ts |
| profile-mood-entry | user | P3 | Covered | frontend/e2e/app/profile-mood-entry.spec.ts |
| admin-dashboard | admin | P2 | **Missing** | frontend/e2e/admin/admin-dashboard.spec.ts |
| admin-users-list | admin | P1 | **Missing** | frontend/e2e/admin/admin-users-list.spec.ts |
| admin-user-create | admin | P1 | **Missing** | frontend/e2e/admin/admin-user-create.spec.ts |
| admin-user-detail | admin | P1 | **Missing** | frontend/e2e/admin/admin-user-detail.spec.ts |
| admin-subscriptions-list | admin | P2 | **Missing** | frontend/e2e/admin/admin-subscriptions-list.spec.ts |
| admin-subscription-create | admin | P1 | **Missing** | frontend/e2e/admin/admin-subscription-create.spec.ts |
| admin-subscription-detail | admin | P1 | **Missing** | frontend/e2e/admin/admin-subscription-detail.spec.ts |
| admin-plans | admin | P1 | **Missing** | frontend/e2e/admin/admin-plans.spec.ts |
| customer-nutrition-daily | user | P2 | **Missing** | frontend/e2e/app/customer-nutrition-daily.spec.ts |
| customer-nutrition-plan | user | P2 | **Missing** | frontend/e2e/app/customer-nutrition-plan.spec.ts |
| subscription-duo-invite | user | P2 | **Missing** | frontend/e2e/app/subscription-duo-invite.spec.ts |
| trainer-client-nutrition-plan | trainer | P2 | **Missing** | frontend/e2e/trainer/trainer-client-nutrition-plan.spec.ts |
| trainer-client-booking | trainer | P2 | **Missing** | frontend/e2e/trainer/trainer-client-booking.spec.ts |
| trainer-client-messaging | trainer | P2 | **Missing** | frontend/e2e/trainer/trainer-client-messaging.spec.ts |
| customer-trainer-message | user | P3 | **Missing** | frontend/e2e/app/customer-trainer-message.spec.ts |

---

## Missing Flows — Registered 2026-05-11

### customer-mi-programa: Mi Programa Overview
- Module: program
- Priority: P1
- Route: /mi-programa
- Roles: user
- Coverage: Covered
- Description: Customer views their monthly training program: calendar heatmap with adherence dots, fitness level card, quick-access tabs (Rutina, Progreso, Resumen).

**Steps**
1. Navigate to /mi-programa.
2. Calendar heatmap loads showing program days with color-coded adherence.
3. Fitness level card shows current level (1–5) and label.
4. Tabs link to sub-routes: Rutina, Progreso, Resumen.

**Branches / Variations**
- No active program: shows empty state with CTA.
- Program loading error: shows error card.

---

### customer-mi-programa-rutina: Mi Programa — Rutina del Día
- Module: program
- Priority: P1
- Route: /mi-programa/rutina
- Roles: user
- Coverage: Covered
- Description: Customer sees today's workout routine, completes/skips individual exercises, and logs mood/notes.

**Steps**
1. Navigate to /mi-programa/rutina (or /mi-programa/hoy which redirects here).
2. Exercise list for today's program day is displayed.
3. Customer marks each exercise as completed or skipped.
4. Customer may log mood (1–10) and notes for the day.
5. Day adherence percentage updates.

**Branches / Variations**
- Rest day: shows rest day card instead of exercise list.
- All exercises completed: adherence = 100%, celebration state.
- No DailyLog exists yet: auto-creates on first interaction.

---

### customer-mi-programa-progreso: Mi Programa — Progreso
- Module: program
- Priority: P2
- Route: /mi-programa/progreso
- Roles: user
- Coverage: Covered
- Description: Customer views program-wide adherence charts, streak, and training/nutrition breakdown.

**Steps**
1. Navigate to /mi-programa/progreso.
2. Adherence chart displays per-day combined adherence over the program.
3. Streak card shows current and longest streak.
4. Training vs nutrition breakdown bar chart.

---

### customer-mi-programa-resumen: Mi Programa — Resumen
- Module: program
- Priority: P2
- Route: /mi-programa/resumen
- Roles: user
- Coverage: Covered
- Description: Customer views program summary: goal, fitness level, start/end dates, completion %, and projected outcome.

---

### customer-mi-programa-dia: Mi Programa — Día Específico
- Module: program
- Priority: P2
- Route: /mi-programa/dia/[date]
- Roles: user
- Coverage: Covered
- Description: Customer navigates to a specific program day via calendar tap or direct URL. Views exercises, completion state, trainer notes.

**Branches / Variations**
- Past day: shows completed/skipped status, read-only.
- Future day: shows planned exercises, no log yet.
- Date outside program range: shows not found state.

---

### trainer-alerts: Trainer Alerts Center
- Module: trainer
- Priority: P1
- Route: /trainer/alerts
- Roles: trainer
- Coverage: Covered
- Description: Trainer views all behavioral and clinical risk alerts across their client roster, filters by severity, and resolves alerts.

**Steps**
1. Navigate to /trainer/alerts.
2. Alert list renders with cards grouped by severity (alto/medio/bajo).
3. Trainer filters by severity level using filter pills.
4. Trainer clicks "Resolver" on an alert.
5. Resolution confirmation modal opens; trainer submits note.
6. Alert moves to resolved state and badge count decrements.

**Branches / Variations**
- No alerts: empty state shown.
- Behavioral signal (inactivity, low adherence) vs clinical signal (expired eval, anthropometry critical).
- Filter = "alto" shows only high-severity alerts.

---

### trainer-client-program: Trainer Client Program Tab
- Module: trainer
- Priority: P2
- Route: /trainer/clients/client/programa?id=[clientId]
- Roles: trainer
- Coverage: Covered
- Description: Trainer views and manages a client's monthly program from the trainer-side tab.

**Steps**
1. Open client detail → navigate to Programa tab.
2. Program overview shows status (draft/published/completed), days, and adherence.
3. Trainer generates a new program if none exists.
4. Trainer publishes a draft program.
5. Trainer views individual day cards with exercises.

---

### trainer-nutrition-catalog: Trainer Nutrition Catalog
- Module: trainer
- Priority: P2
- Route: /trainer/nutrition-catalog
- Roles: trainer
- Coverage: Covered
- Description: Trainer browses and searches the global meal suggestion catalog; adds new meal suggestions.

**Steps**
1. Navigate to /trainer/nutrition-catalog.
2. Catalog table loads with search + block filter.
3. Trainer searches by name or filters by meal block.
4. Trainer fills the "Nueva Sugerencia" form (title, block, calories, NOVA, fitness level, goals).
5. New suggestion appears at top of table after creation.

---

### auth-accept-invite: Accept Duo Invitation
- Module: auth
- Priority: P2
- Route: /accept-invite?token=[token]
- Roles: guest, user
- Coverage: Covered
- Description: Accept a duo-plan subscription invite via token.

**Branches / Variations**
- Logged-in matching user: POST /subscriptions/accept-invite/ → success screen with program/partner info.
- Logged-in wrong account: shows "invite is for [email], log in with that account" with login link.
- Guest: shows "create account with [email]" with register link pre-filling invite_token.
- Invalid/expired token: error state.

---

### auth-forced-password-change: Forced Password Change
- Module: auth
- Priority: P2
- Route: /change-password-required
- Roles: user
- Coverage: Covered
- Description: When `must_change_password=true` on the user object, the app redirects to this page and enforces a password change before allowing access to any other route.

**Steps**
1. User logs in with a temporary password (must_change_password=true).
2. App redirects to /change-password-required.
3. User enters current password + new password + confirm.
4. On success, redirect to role-appropriate dashboard.
5. Attempting to navigate away before completing returns to this page.

**Branches / Variations**
- Current password incorrect: shows error.
- New password < 8 chars: inline validation error.
- Passwords don't match: inline validation error.

---

### trainer-metrics: Trainer Metrics
- Module: trainer
- Priority: P3
- Route: /trainer/metrics
- Roles: trainer
- Coverage: Covered
- Description: Trainer views comparative metrics across all clients: adherence trends, evaluation expiry summary, risk distribution ring chart, global KORE score average.

---

## Missing Flows — Registered 2026-07-04

Non-admin flows surfaced by the E2E user-flows audit. Each maps to a real user
action whose existing spec (if any) did not exercise it. Admin flows are in the
`## Admin Flows` section above.

### customer-nutrition-daily: Daily Nutrition Tracking
- Module: nutrition
- Priority: P2
- Route: /my-nutrition
- Roles: user
- Coverage: **Missing**
- Description: The write side of /my-nutrition. The existing `customer-nutrition` spec is render-only; this flow covers the daily tracker interactions.

**Steps**
1. Navigate to /my-nutrition.
2. Mark an individual meal as done (PATCH /api/my-nutrition-daily/{log}/meals/{meal}/).
3. Upload a meal photo via CameraCapture (POST .../meals/{meal}/photo/).
4. Log water glasses (POST .../{log}/water-glasses/).
5. Review the daily history.

**Branches / Variations**
- No active program: "Sin plan activo" hero, tracker hidden.
- Water goal reached vs below goal.

### customer-nutrition-plan: Customer Nutrition Plan
- Module: nutrition
- Priority: P2
- Route: /my-nutrition
- Roles: user
- Coverage: **Missing**
- Description: Customer views the trainer-authored weekly nutrition plan on /my-nutrition — the collapsible coach-note strip on the daily hero, sourced from GET /api/my-nutrition-plans/. (There is no separate customer plan page; the per-day meals come from the daily `today/` endpoint.)

**Steps**
1. Navigate to /my-nutrition.
2. Expand the "Nota de tu coach" strip to see the weekly plan range + note.
3. Review the plan-derived meal for the day.

**Branches / Variations**
- No plan authored yet: "Sin plan activo" empty state.

### subscription-duo-invite: Subscription DUO Guest Invite
- Module: subscription
- Priority: P2
- Route: /subscription
- Roles: user
- Coverage: **Missing**
- Description: The plan owner manages a DUO guest from the subscription page (distinct from `auth-accept-invite`, which is the invitee redeeming a token).

**Steps**
1. Navigate to /subscription with a DUO-eligible plan.
2. Invite a guest by email (POST /api/subscriptions/{id}/invite-guest/).
3. Revoke a guest (POST /api/subscriptions/{id}/revoke-guest/).
4. Accept a pending invitation, if present (GET /api/subscriptions/pending-invitation/).

**Branches / Variations**
- Guest already invited: shows guest card, invite disabled.
- Guest is read-only on their own subscription view.

### trainer-client-nutrition-plan: Trainer Client Nutrition Plan
- Module: trainer
- Priority: P2
- Route: /trainer/clients/client?id=[clientId] (Nutrición tab / ClientNutritionTab)
- Roles: trainer
- Coverage: **Missing**
- Description: Trainer authors a client's weekly nutrition plan. Distinct from the read-only `trainer-client-nutrition` (habits viewer) and from `trainer-nutrition-catalog` (food browser).

**Steps**
1. Open client detail → Nutrición tab.
2. Generate a plan (POST /api/nutrition-plans/generate/).
3. Edit meals per day (PATCH .../days/{day}/meals/{meal}/).
4. Publish/approve (POST /api/nutrition-plans/{id}/approve/).

**Branches / Variations**
- Regenerate replaces a draft; delete removes it.

### trainer-client-booking: Trainer Books For Client
- Module: trainer
- Priority: P2
- Route: /trainer/clients + /trainer/clients/client?id=[clientId] (TrainerBookingDialog)
- Roles: trainer
- Coverage: **Missing**
- Description: Trainer books or reschedules a session on behalf of an assigned client.

**Steps**
1. From the client list or client detail, open the TrainerBookingDialog.
2. Pick date + slot (2-step).
3. Confirm → createBooking, or reschedule an existing one.

**Branches / Variations**
- No sessions remaining on the client's plan.
- Reschedule vs new booking.

### trainer-client-messaging: Trainer Post-Session Message
- Module: trainer
- Priority: P2
- Route: /trainer/clients/client?id=[clientId] (Notas → Sesiones message composer)
- Roles: trainer
- Coverage: **Missing**
- Description: Trainer sends a message to a client via the client-detail Notas → Sesiones composer (POST /api/trainer/messages/). Note: the `PostSessionMessageSheet` component exists but has no wired trigger on the current client-detail page (its `onMessage` is never passed to `SessionRow`); the reachable surface is `MessageComposerCard`.

**Steps**
1. Open client detail.
2. Switch to the Notas tab → Sesiones.
3. Compose a message in the MessageComposerCard; send.

**Branches / Variations**
- `PostSessionMessageSheet` is currently unreachable (dead trigger) — candidate cleanup or wiring.

### customer-trainer-message: Customer Trainer Message
- Module: dashboard
- Priority: P3
- Route: (app) shell overlay — TrainerMessageModal
- Roles: user
- Coverage: **Missing**
- Description: The customer-side counterpart of `trainer-client-messaging`: receive and dismiss a trainer message (GET /api/my-trainer-messages/, dismiss).

**Steps**
1. Customer loads any (app) route with a pending trainer message.
2. TrainerMessageModal overlay appears.
3. Customer reads and dismisses/acknowledges it (POST /api/my-trainer-messages/{id}/dismiss/).

**Branches / Variations**
- No pending messages: overlay does not appear.

---

## Future / Not-Built Flows

Flows that have been discussed or referenced but have **no implementation yet**:
no route under `frontend/app/(app)/trainer/`, no page component, and no E2E
spec. They are intentionally **omitted from `frontend/e2e/flow-definitions.json`**
(the registry tracks only defined/taggable flows; the schema's `coverage` enum
has no "not-built"/"deferred" value). Do not add specs or coverage flags for
these until the corresponding page ships.

### trainer-evidence: Trainer Evidence (Future / not-built)
- Module: trainer
- Priority: TBD
- Route: (proposed) /trainer/evidence — **not implemented**
- Roles: trainer
- Coverage: **Not built** — no page, no component, no spec, not in registry.
- Description: Proposed trainer-facing view to review client-submitted evidence
  (photos/media) attached to program days or evaluations. No `trainer/evidence`
  route exists in the app router (current trainer routes: `alerts`, `clients`,
  `dashboard`, `metrics`, `nutrition-catalog`). Registered here only to record
  the gap; excluded from the Coverage Summary table and flow-definitions.json
  until the page is built.
