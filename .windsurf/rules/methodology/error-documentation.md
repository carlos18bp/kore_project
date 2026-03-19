---
trigger: model_decision
description: Error documentation and known issues tracking. Reference when debugging, fixing bugs, or encountering recurring issues.
---

# Error Documentation — KoreProject

This file tracks known errors, their context, and resolutions. When a reusable fix or correction is found during development, document it here to avoid repeating the same mistake.

---

## Format

```
### [ERROR-NNN] Short description
- **Date**: YYYY-MM-DD
- **Context**: Where/when this error occurs
- **Root Cause**: Why it happens
- **Resolution**: How to fix it
- **Files Affected**: List of files
```

---

## Known Issues

### [ERROR-001] CheckoutClient reset() race condition with auto_login
- **Date**: 2025-03-19
- **Context**: Guest checkout flow — `applyAutoLoginSession` sets `isAuthenticated=true` after approved polling
- **Root Cause**: The useEffect at line 126 of `CheckoutClient.tsx` has `isAuthenticated` in its dependency array. When auto_login changes `isAuthenticated` from false→true, the effect re-fires and calls `reset()`, wiping `paymentStatus: 'success'` before the success screen renders.
- **Resolution**: Guard `reset()` with a payment status check: `if (ps !== 'processing' && ps !== 'polling' && ps !== 'success') { reset(); }`
- **Files Affected**: `frontend/app/(public)/checkout/CheckoutClient.tsx`

### [ERROR-002] Playwright strict mode violations in assessment/dashboard pages
- **Date**: 2025-03-19
- **Context**: E2E tests using `getByText('...')` match multiple elements (hero cards + history cards, sidebar links + stat labels)
- **Root Cause**: Components render the same text in multiple locations (e.g., `habit_category` in ScoreCard AND HistoryCard). Playwright strict mode requires exactly one match.
- **Resolution**: Use `.first()` to target the first (hero/primary) instance, or `{ exact: true }` when substring matching causes ambiguity.
- **Files Affected**: Multiple E2E spec files across customer assessments and trainer modules

### [ERROR-003] setupDefaultApiMocks LIFO conflicts with test-specific mocks
- **Date**: 2025-03-19
- **Context**: Tests that override default API mocks for endpoints like `my-nutrition`, `my-parq`, `my-pending-assessments`
- **Root Cause**: Playwright route handlers follow LIFO order. If `setupDefaultApiMocks` registers a handler AFTER the test's custom handler, the default handler wins. Additionally, the `my-pending-assessments` mock had the wrong response shape (flat fields vs. nested `kore_index` wrapper).
- **Resolution**: Added `exclude: string[]` parameter to `setupDefaultApiMocks` to skip default handlers for endpoints the test overrides. Fixed mock response shape to match store expectations (`data.kore_index`).
- **Files Affected**: `frontend/e2e/fixtures.ts`, all customer assessment spec files

---

## Resolved Issues

### [ERROR-001] jest.clearAllMocks does NOT clear mockResolvedValueOnce queue
- **Date**: 2026-03-18
- **Context**: `bookingStore.test.ts` — 11 tests failing after tests calling non-existent `fetchMonthSlots()` left unconsumed mock values in `api.get` queue
- **Root Cause**: `jest.clearAllMocks()` calls `mockClear()` which resets call counts but does NOT clear the `mockResolvedValueOnce`/`mockReturnValueOnce` implementation queue. Only `jest.resetAllMocks()` (which calls `mockReset()`) clears queued implementations.
- **Resolution**: Changed `jest.clearAllMocks()` → `jest.resetAllMocks()` in `beforeEach`. Removed 2 stale tests referencing non-existent store method `fetchMonthSlots`.
- **Files Affected**: `frontend/app/__tests__/stores/bookingStore.test.ts`

### [ERROR-002] DashboardPage test missing store mocks after component refactor
- **Date**: 2026-03-18
- **Context**: `DashboardPage.test.tsx` — 2 tests failing after Dashboard component was refactored to import 8 additional stores
- **Root Cause**: Component now imports `useSubscriptionStore`, `useProfileStore`, `useAnthropometryStore`, `usePosturometryStore`, `usePhysicalEvaluationStore`, `useNutritionStore`, `useParqStore`, `usePendingAssessmentsStore`. Tests only mocked `bookingStore` and `http`.
- **Resolution**: Added jest.mock() for all missing stores and child components (`UpcomingSessionReminder`, `SubscriptionExpiryReminder`, `SubscriptionDashboardToast`). Updated 3 stale assertions to match current component structure.
- **Files Affected**: `frontend/app/__tests__/views/DashboardPage.test.tsx`
