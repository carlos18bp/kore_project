# User Flow Map

Version: 1.0
Last Updated: 2026-02-23
Description: End-to-end user flows for the Kore frontend, grouped by role with branches for form variants and alternate outcomes.
Sources: frontend/e2e/flow-definitions.json, frontend/e2e/helpers/flow-tags.ts, frontend/e2e specs, frontend/app routes.

## System Roles
- Guest: Unauthenticated visitor.
- User: Authenticated customer.
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
- Description: Purchase a subscription via the Wompi checkout widget.
- E2E Coverage: Covered (frontend/e2e/public/checkout.spec.ts)

**Steps**
1. Open /checkout with a package id.
2. Package summary and payment configuration load.
3. Click Pay to open the Wompi widget.
4. Widget returns a transaction id and the purchase intent is created.
5. The app polls intent status until approved or failed.
6. Success or failure screen is shown.

**Branches / Variations**
- Guest with a registration token in sessionStorage can access checkout.
- Guest without a registration token is redirected (see checkout-guest-redirect).
- Missing package id or not found package shows a not found state.
- Package fetch error shows a load error message.
- Wompi config missing public_key shows a payment config error.
- Widget script already loaded path keeps the Pay button enabled.
- Widget callback without transaction id shows a payment error and returns to idle.
- Approved intent shows success and may apply auto-login cookies for guests.
- Failed intent shows a rejection message.
- Polling state shows a verifying payment message before final status.

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
- Description: Register a new account and handle registration errors.
- E2E Coverage: Covered (frontend/e2e/public/register.spec.ts)

**Steps**
1. Open /register (optionally with ?package=ID).
2. Fill out required profile and password fields.
3. Submit the registration form.
4. Redirect to checkout on success.

**Branches / Variations**
- Client-side validation highlights missing or invalid fields.
- Server pre-register errors surface form error messages.
- Password visibility toggle updates input masking.
- Authenticated users are redirected to /dashboard.
- Package query string is preserved on redirect to /checkout.

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
- Description: Navigate public pages from the top navigation.
- E2E Coverage: Covered (frontend/e2e/public/navbar.spec.ts)

**Steps**
1. Open /.
2. Use the navbar to open the programs page.

**Branches / Variations**
- Navigation works across desktop and mobile breakpoints.

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

### checkout-guest-redirect: Checkout Guest Redirect
- Module: checkout
- Priority: P2
- Route: /checkout?package=ID
- Roles: guest
- Description: Redirect guest checkout when registration is required.
- E2E Coverage: Covered (frontend/e2e/public/checkout-widget-errors.spec.ts)

**Steps**
1. Guest opens /checkout with a package id.
2. App validates that a registration token exists.
3. Redirect to /register when the token is missing.

**Branches / Variations**
- Package query string is preserved in the redirect URL.
- Guests with a valid registration token continue to checkout.

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

## Admin Flows
- No admin-specific frontend flows mapped in the current codebase or E2E suite.

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
| booking-session-page | guest, user | P1 | Covered | frontend/e2e/app/book-session.spec.ts |
| booking-session-flow | user | P1 | Covered | frontend/e2e/app/book-session-flow.spec.ts |
| booking-complete-flow | user | P1 | Covered | frontend/e2e/app/booking-complete-flow.spec.ts |
| booking-error-paths | user | P2 | Covered | frontend/e2e/app/booking-error-paths.spec.ts |
| booking-reschedule | user | P2 | Covered | frontend/e2e/app/booking-reschedule.spec.ts |
| booking-calendar-redirect | guest, user | P2 | Covered | frontend/e2e/app/calendar.spec.ts |
| booking-calendar-edge-cases | user | P3 | Covered | frontend/e2e/app/calendar-edge-cases.spec.ts |
| booking-no-sessions | user | P2 | Covered | frontend/e2e/app/no-sessions-modal.spec.ts |
| booking-session-detail | user | P2 | Covered | frontend/e2e/app/session-detail.spec.ts |
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
| checkout-flow | guest, user | P1 | Covered | frontend/e2e/public/checkout.spec.ts |
| checkout-guest-redirect | guest | P2 | Covered | frontend/e2e/public/checkout-widget-errors.spec.ts |
| checkout-coverage-gaps | guest, user | P3 | Covered | frontend/e2e/public/checkout-coverage-gaps.spec.ts |
| public-home | guest | P2 | Covered | frontend/e2e/public/home.spec.ts |
| public-navbar | guest | P3 | Covered | frontend/e2e/public/navbar.spec.ts |
| public-brand | guest | P3 | Covered | frontend/e2e/public/kore-brand.spec.ts |
| public-programs | guest, user | P2 | Covered | frontend/e2e/public/programs.spec.ts |
| public-contact | guest | P3 | Covered | frontend/e2e/public/contact.spec.ts |
| public-faq | guest | P3 | Covered | frontend/e2e/public/faq.spec.ts |
| public-faq-errors | guest | P3 | Covered | frontend/e2e/public/faq-error-states.spec.ts |
