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

_None currently open._

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
