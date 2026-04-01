---
name: frontend-unit-test-coverage
description: "Frontend unit test coverage strategy — analyze Jest coverage reports and implement tests to reach 100% coverage across Zustand stores, composables, lib utilities, and React UI."
---

# Frontend Unit Test Coverage Strategy

## Goal

Conduct a thorough analysis of frontend coverage reports. Reach **100% coverage** in all files.

**Stack (Kore):** Next.js App Router, **Zustand** ([`frontend/lib/stores/`](frontend/lib/stores/)), **Jest** + **React Testing Library**. Tests live under [`frontend/app/__tests__/`](frontend/app/__tests__/) as `*.test.ts` / `*.test.tsx`.

## Quality Standards Reference

Before writing any test, consult: `docs/TESTING_QUALITY_STANDARDS.md`

## Execution Rules

1. **Working directory**: `cd frontend` (scripts are in [`frontend/package.json`](frontend/package.json))
2. **Run only modified test files**: `npm test -- app/__tests__/path/to/file.test.tsx`
3. **Coverage report**: `npm run test:coverage` (then inspect lowest-coverage files)
4. **Maximum per execution**: 20 tests per batch, 3 commands per cycle

## Coverage Prioritization

| Priority | Layer | Rationale |
|----------|-------|-----------|
| 1 | Zustand stores (`lib/stores/`) | Core business logic |
| 2 | Composables (`app/composables/`) + `lib/` (services, utils) | Shared across views and components |
| 3 | Components and views (`app/`) — critical user paths first | User-facing |

## Per-Test Checklist

- Test name describes ONE specific behavior
- No conditionals or loops in test body (use `test.each`)
- Assertions verify observable outcomes (rendered UI, events, store state after actions)
- Prefer React Testing Library: `screen` and accessible queries; use `data-testid` where needed, not CSS classes as primary selectors
- One clear render/setup per test (no shared mutable DOM between unrelated cases)
- Mocks have explicit return values / implementations
- `jest.useFakeTimers()` restored with `jest.useRealTimers()`
- `localStorage` / session storage cleaned in `afterEach` when tests touch them

## Workflow

1. Review the coverage report (`npm run test:coverage` from `frontend/`)
2. Identify lowest-coverage files in priority order
3. Consult quality standards
4. Implement tests (mirror source layout under `app/__tests__/`)
5. Run only new/modified test files
6. Verify tests pass and coverage improves

## Output Format

```
### Layer: Zustand | Composable | Lib | Component | View
### Source: <path under frontend/ e.g. lib/stores/authStore.ts>
### Test: <path e.g. app/__tests__/stores/authStore.test.ts>
**Coverage before:** X% statements, Y% branches
**Coverage after:** X% statements, Y% branches
**Tests added:**
- test_name_1 (happy path)
- test_name_2 (edge case)
**Command executed:** cd frontend && npm test -- <path relative to frontend/>
**Result:** Pass / Fail
```
