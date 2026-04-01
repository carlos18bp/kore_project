---
name: frontend-e2e-test-coverage
description: "E2E test coverage strategy — analyze Playwright flow coverage and implement tests for untested user flows, focusing on the contract between frontend and backend."
---

# E2E Test Coverage Strategy

## Goal

Review E2E coverage and identify all untested user flows. Reach **100% flow coverage** focusing on the **contract between Frontend and Backend**.

## Monorepo paths (Kore)

All Playwright commands run with **working directory** [`frontend/`](frontend/) (`testDir` is `./e2e` in [`frontend/playwright.config.ts`](frontend/playwright.config.ts)).

| Artifact | Path |
|----------|------|
| Flow definitions | [`frontend/e2e/flow-definitions.json`](frontend/e2e/flow-definitions.json) |
| Flow coverage JSON (generated) | [`frontend/e2e-results/flow-coverage.json`](frontend/e2e-results/flow-coverage.json) |

The custom reporter writes `flow-coverage.json` when the Playwright run ends; there is **no** separate `generate-coverage.js` script.

## Core Principle: Real User Interactions

Every test must exercise the full UI flow — from the user's perspective — without shortcuts.

| Real user interaction | NOT a real user interaction |
|----------------------|---------------------------|
| Clicking buttons, links, menus | Calling backend API directly |
| Filling and submitting forms | Setting store values programmatically |
| Navigating between pages via UI | Using `page.goto()` to skip steps |
| Uploading files through inputs | Injecting data into DB directly |

## Quality Standards Reference

Before writing any E2E test, consult:
- `docs/USER_FLOW_MAP.md`
- `docs/TESTING_QUALITY_STANDARDS.md`

## Execution Rules

1. **Run only modified test files** (from repo root): `cd frontend && npx playwright test e2e/path/to/spec.spec.ts`
2. Use `E2E_REUSE_SERVER=1` when dev server is already running
3. **Maximum per execution**: 20 tests per batch, 3 commands per cycle

## Coverage Prioritization

| Priority | Criteria |
|----------|----------|
| 1 | Core user journeys (auth, checkout) |
| 2 | Critical CRUD flows (documents, dashboard) |
| 3 | Integration points (API contracts) |
| 4 | Error states |
| 5 | Edge cases |

## Per-Test Checklist

- Test has `@flow:<flow-id>` tag matching `frontend/e2e/flow-definitions.json`
- Selectors: `getByRole` > `getByTestId` > `locator`
- No `page.waitForTimeout()` — use condition-based waits
- No hardcoded test data — use fixtures
- Assertions verify user-observable outcomes
- Test simulates real user interaction through UI

## Workflow

1. Read `frontend/e2e/flow-definitions.json` and `frontend/e2e-results/flow-coverage.json` (run Playwright once if the JSON is missing or stale)
2. Identify untested/partial flows by priority
3. Look up target flow in `docs/USER_FLOW_MAP.md`
4. Consult quality standards
5. Implement tests under `frontend/e2e/`
6. Run only new/modified tests: `cd frontend && npx playwright test e2e/...`
7. Validate quality (from repo root): `python scripts/test_quality_gate.py --suite frontend-e2e --include-file frontend/e2e/path/to/spec.spec.ts` (repeat `--include-file` for multiple files)
8. Regenerate flow coverage: run Playwright again (step 6 or a broader run); the reporter updates `frontend/e2e-results/flow-coverage.json` automatically

## Output Format

```
### Spec: frontend/e2e/<path>.spec.ts
- Flow tags: @flow:<id> (count)
- Status: missing → covered | partial → covered
- Command: cd frontend && npx playwright test e2e/... -v
- Quality gate: python scripts/test_quality_gate.py --suite frontend-e2e --include-file frontend/e2e/...
```
