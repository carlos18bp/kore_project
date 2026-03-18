# User Flow Map

Version: 1.2
Last Updated: 2026-03-18
Description: End-to-end user flows for the Kore frontend, grouped by role with branches for form variants and alternate outcomes.
Sources: frontend/e2e/flow-definitions.json, frontend/e2e/helpers/flow-tags.ts, frontend/e2e specs, frontend/app routes.

## System Roles
- Guest: Unauthenticated visitor.
- User: Authenticated customer.
- Trainer: Fitness/health professional who manages clients and assessments.
- Admin: No dedicated frontend flows found in the current app or E2E suite.

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
- Route: /my-programs
- Roles: guest, user
- Description: List subscriptions and entry to program detail pages.
- E2E Coverage: Covered (frontend/e2e/app/my-sessions.spec.ts; frontend/e2e/app/coverage-gaps.spec.ts)

**Steps**
1. Open /my-programs.
2. View subscription cards or empty state.
3. Navigate via the sidebar link.

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
- E2E Coverage: None

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
- Missing subscription_id_display sends users to /my-programs.
- Sessions beyond 48 hours do not trigger the modal.
- Null API response keeps reminder hidden.

### my-programs-detail: Program Detail & Sessions
- Module: programs
- Priority: P2
- Route: /my-programs/program/:subscriptionId
- Roles: user
- Description: Review subscription detail, session history, and open session detail modal.
- E2E Coverage: Covered (frontend/e2e/app/my-sessions-flow.spec.ts)

**Steps**
1. Navigate from My Programs to a subscription detail page.
2. Review subscription header details and tabs.
3. Switch between upcoming and past sessions.
4. Open a session detail modal from the list.

**Branches / Variations**
- Empty upcoming or past sessions show placeholders.
- Breadcrumb navigation returns to /my-programs.
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
- Cancel action is disabled and does not surface errors.

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
- Route: /book-session, /my-programs/program/:id
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
- Route: /my-programs/program/:id
- Roles: user
- Description: Reschedule existing bookings while enforcing time limits.
- E2E Coverage: Covered (frontend/e2e/app/booking-reschedule.spec.ts)

**Steps**
1. Open a program detail page.
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
- Route: /my-programs/program/:id
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

### app-coverage-gaps: App Coverage Gaps
- Module: app
- Priority: P3
- Route: multiple (dashboard, subscription, book-session, my-programs)
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
- Route: /dashboard, /my-programs/program/:id
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
- E2E Coverage: None

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
- E2E Coverage: None

**Steps**
1. Scroll to the Security card on /profile.
2. Click "Cambiar contraseña" to request a reset code via email.
3. Password reset modal opens on success.
4. Enter code + new password in the modal to complete the change.

**Branches / Variations**
- Request code API failure shows inline error message.
- Loading state disables button and shows "Enviando código..." spinner.
- Modal close returns to profile without completing reset.

## Assessment Flows

### customer-diagnosis: Customer Diagnosis
- Module: assessments
- Priority: P2
- Route: /my-diagnosis
- Roles: user
- Description: View anthropometry/body composition diagnosis with educational indicators and progress timeline.
- E2E Coverage: None

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
- E2E Coverage: None

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
- E2E Coverage: None

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
- E2E Coverage: None

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
- E2E Coverage: None

**Steps**
1. Open /my-posturometry after login.
2. View global posture score and regional breakdowns (head, shoulders, spine, pelvis, lower limbs).
3. Expand region cards for educational content and recommendations.
4. View progress timeline if multiple evaluations exist.

**Branches / Variations**
- No evaluations shows empty state.
- Color-coded indicators include orange in addition to green/yellow/red.
- Regional cards with GSAP accordion animations.
- Trainer recommendations override defaults when available.

### customer-pending-assessments: Pending Assessments
- Module: assessments
- Priority: P3
- Route: /dashboard
- Roles: user
- Description: View KORE score and pending assessment modules on the dashboard.
- E2E Coverage: None

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
- E2E Coverage: None

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
- E2E Coverage: None

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
- E2E Coverage: None

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
- E2E Coverage: None

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
- E2E Coverage: None

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
- E2E Coverage: None

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
- E2E Coverage: None

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
- E2E Coverage: None

**Steps**
1. Navigate to /trainer/clients/client/posturometry?id=X.
2. View existing evaluation history.
3. Create a new evaluation with postural observations per region.
4. View regional scores and global assessment.

**Branches / Variations**
- No evaluations shows empty state with create button.
- Form covers multiple body regions (head, shoulders, spine, pelvis, lower limbs).
- API failure shows error message.

## Admin Flows
- No admin-specific frontend flows mapped in the current codebase or E2E suite.

## Global UX Elements

These elements are present across multiple routes and affect the user experience globally.

- **WhatsApp Floating Button**: A fixed green button in the bottom-right corner of all public pages. Opens an external WhatsApp conversation link. Present on all (public) layout pages.
- **ConditionalFooter**: The public Footer is hidden on /login, /register, and /checkout routes. On all other public pages, the Footer renders with navigation links (including /terms) and social links.
- **Navbar Checkout Funnel**: The public Navbar is hidden when the user is on /register or /checkout with a ?package= query parameter, providing a distraction-free checkout experience.

## Legend / Conventions

- Priority: P1 (critical), P2 (important), P3 (nice-to-have).
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
| auth-forgot-password | guest | P1 | None | — |
| profile-management | user | P1 | None | — |
| profile-password-change | user | P2 | None | — |
| customer-diagnosis | user | P2 | None | — |
| customer-nutrition | user | P2 | None | — |
| customer-parq | user | P2 | None | — |
| customer-physical-evaluation | user | P2 | None | — |
| customer-posturometry | user | P2 | None | — |
| customer-pending-assessments | user | P3 | None | — |
| trainer-dashboard | trainer | P1 | None | — |
| trainer-clients-list | trainer | P1 | None | — |
| trainer-client-detail | trainer | P1 | None | — |
| trainer-client-anthropometry | trainer | P2 | None | — |
| trainer-client-nutrition | trainer | P2 | None | — |
| trainer-client-parq | trainer | P2 | None | — |
| trainer-client-physical-eval | trainer | P2 | None | — |
| trainer-client-posturometry | trainer | P2 | None | — |
