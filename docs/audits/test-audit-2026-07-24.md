# Test Audit — 2026-07-24

**Scope:** whole corpus (backend + frontend-unit + frontend-e2e), report-only.
**Mode:** `--check` (no `--apply`). No test files, production code, or DB touched.
**Branch:** `july-release` (pre-merge, PR #52 → `master`). Tree clean at audit time.
**Tooling:** `scripts/test_quality_gate.py --semantic-rules strict` per suite +
`scripts/flow_coverage_audit.py`. AST bridge available (`@babel/parser` 7.29.0), so
semantic rules ran fully for the suites that were in scope (see the `.tsx` blind spot below).

---

## 1. Inventory

| Suite | Files | Test cases | Errors | Warnings | Info | Score | Status |
|---|---|---|---|---|---|---|---|
| Backend (`backend/core_app/tests`) | 183 | 2192 | 0 | 39 | 119 | 99 | passed |
| Frontend-unit **(gated subset only)** | ~52 | 541 | 0 | 60 | 5 | 97 | passed |
| Frontend-e2e (`frontend/e2e`) | 103 | 530 | 0 | 342 | 3 | 81 | passed |
| **Total test files** | **489** | — | **0** | **441** | **127** | — | all passed |

**Every suite passes with zero errors.** All 568 findings are warnings/infos —
which is precisely why CI is green while the signal below is real. The gate today
enforces *form*, and form is mostly fine; *behavioral value* is where the debt sits.

### 1a. ⚠️ Coverage blind spot — the unit gate ignores `.tsx`
`frontend/app/__tests__` contains **203 test files: 52 `.test.ts` + 151 `.test.tsx`**.
Jest runs both (`testMatch: **/__tests__/**/*.test.(ts|tsx)`), but
`.testquality.yml → js_unit_suffixes` lists only `.test.js/.spec.js/.test.ts/.spec.ts`
— **no `.tsx`/`.jsx`**. The quality gate therefore analyzed only ~52 files (the `.ts`
subset); **151 React-component unit tests (74% of the unit suite) are never inspected**
for junk, weak assertions, or duplication. The unit "score 97 / 47 duplicates" is
computed over a quarter of the real suite. **This is the highest-leverage fix in this
audit** — a one-line config change unlocks the true unit picture.

### 1b. Flow coverage model is unwired (not regressed)
`flow_coverage_audit.py`:

| Metric | Value |
|---|---|
| Flows declared (`flow-definitions.json`) | 104 |
| covered / partial / junk-only / **missing** | 0 / 0 / 0 / **104** |
| Flows declaring `outcomes` | **0 / 104** |
| E2E tests examined | 525 |
| **Untagged tests** (grant no coverage credit) | **520 / 525** |
| Undeclared-but-tagged flows | 3 (`product`, `report`, `settings`) |
| Modules with only `success` (no error/failure) | 15 / 15 |

Only 5 of 525 E2E tests carry a resolvable `@flow` tag, and those point at flows not
even in `flow-definitions.json`. So the coverage model reports 0% not because tests are
bad but because **tagging + `outcomes` were never populated.** This is the deliverable
of the deferred `e2e-user-flows-check` batch, not a code regression.

> **Two coverage models — do not conflate.** This static `0/104` is **not** the same
> number the memory bank cites. The project's documented coverage-truth is a **runtime**
> artifact (`e2e-results/flow-coverage.json`, CI-only, **104/104** per CI 2026-07-16) —
> the flows *are* exercised when Playwright runs. What this audit measures is the
> **static** model: `flow-definitions.json` was migrated to a v1.12.0 `outcomes` schema
> on 2026-07-17, but the flow entries were never given `outcomes` keys and the specs were
> never `@flow`-tagged. The two models diverge because the static convention is unpopulated,
> **not** because coverage was lost. Closing the gap = populate `outcomes` + tags.

---

## 2. Class breakdown (mapped to gate rule IDs)

| # | Audit class | Rule IDs (count) | Suite |
|---|---|---|---|
| 1 | No interaction | `no_user_interaction` (291) | e2e |
| 2 | Lying tag | `flow_tag_mismatch` (27) | e2e |
| 3 | Weak / absent assertion | `weak_assertion` (10 unit) · `no_data_assertion` (8 e2e) · `no_assertions` (6 e2e) · `vague_assertion` (4 be) | all |
| 4 | Duplicate | `duplicate_coverage` (47) | unit |
| 5 | Tests the mock | `unverified_mock` (2) | backend |
| 6 | Implementation-coupled | `fragile_locator` (10) — no `wrapper.vm.*` found (React) | e2e |
| 7 | No subject | none flagged as such | — |
| — | Determinism (not junk, real risk) | `nondeterministic` / `timezone.now` (28) | be+unit |
| — | Quality nits (info) | `missing_docstring` (97) · `test_too_short` (19) · `too_many_assertions` (11) · `test_too_long` (5) · `inline_payload` (3) | all |

### The critical calibration: class 1 is mostly *not* junk
Of the **291** `no_user_interaction` E2E tests, **284 still make an assertion** — the
overwhelming majority are legitimate **display-class** tests (render a route, assert
visible/content-bearing elements). Per the audit rules, `toBeVisible()` on a
content-bearing locator *is* a data assertion. They read as "junk" only because the
coverage model has **0 `display` outcomes declared**, so no flow can be credited to a
non-interacting test. **Fix = declare `display` outcomes (e2e-user-flows-check), not deletion.**

Only **14 E2E tests are genuinely un-failable** (`no_assertions` or `no_data_assertion`).
Those are the true rewrite-now set.

### Class 4 calibration: don't merge-and-delete
The 47 `duplicate_coverage` hits cluster in store tests (`posturometryStore` 7,
`bookingStore` 6, `anthropometryStore` 5, `checkoutStore` 5, …) around repeated
`sets error on failure` / `returns null and sets error on failure` shapes. Per the
skill's own rule, tests sharing a shape but covering **different actions** are real
coverage — convert to `it.each` tables or rename to be action-specific. Merge-and-delete
only where the action AND values are truly identical.

---

## 3. Triage

Verdicts are recommendations only — nothing applied this session. `f:l — test — reason`.

### Rewrite now (true defects — cannot fail or lie)
| File:line | Test | Verdict | Reason |
|---|---|---|---|
| `e2e/app/customer-nutrition.spec.ts` | "renders the current date as the page heading" | REWRITE | no real data assertion; assert the heading text |
| `e2e/app/subscription-gated-routes.spec.ts` | "…expired subscription redirects to /subscription" (×2) | REWRITE | assert resulting URL, not visibility |
| `e2e/auth/auth-persistence.spec.ts` | "hydrate catches profile API failure…" (×2) | REWRITE | assert cleared auth state / redirect |
| `e2e/auth/auth-token-refresh.spec.ts` | "failed refresh clears auth cookies…" | REWRITE | assert cookie cleared + `/login` |
| `e2e/auth/forced-password-change.spec.ts` | redirect tests (×2) | REWRITE | assert URL outcome |
| `e2e/program/mi-programa-dia.spec.ts` | redirect tests (×2) | REWRITE | assert URL outcome |
| `e2e/customer/session-rating.spec.ts` | "skipping dismisses the card…" | REWRITE | assert card gone |
| (27 tests, various) | `flow_tag_mismatch` | REWRITE | tag claims an action the body never performs |
| `unit/stores/pendingAssessmentsStore.test.ts:154-175` | "marks X as seen…" (4) | REWRITE | weak assertion; assert concrete state/localStorage value |
| `unit/stores/posturometryStore.test.ts:244,272` | "appends photo files to FormData" | REWRITE | weak assertion; assert FormData contents |
| `unit/stores/profileStore.test.ts:87,110,139` | PATCH/POST result tests | REWRITE | weak assertion; assert response/state |
| `unit/stores/trainerTasksStore.test.ts:44` | "reviewCreditTransaction failure…" | REWRITE | weak assertion |
| `be/serializers/test_nutrition_daily_serializers.py:60,195` | unverified mocks | REWRITE | add `assert_called*` + observable effect |
| `be/services/test_email_service.py:180` | vague assertion | REWRITE | assert specific property |
| `e2e` (10 tests) | `fragile_locator` | REWRITE | replace CSS/index locator with role/testid |

### Convert to `test.each` or rename (NOT delete)
| Files | Count | Verdict |
|---|---|---|
| `unit/stores/*.test.ts` (posturometry, booking, anthropometry, checkout, …) | 47 | MERGE-to-`test.each` **only if identical**; else rename per-action. Preserve coverage. |

### Declare outcomes / tag (coverage model, deferred to e2e-user-flows-check)
| Item | Count | Action |
|---|---|---|
| Display-class tests miscredited | 284 | Declare `display` outcomes; tag with `@flow` |
| Flows missing `outcomes` | 104 | Populate `outcomes` in `flow-definitions.json` |
| Untagged E2E tests | 520 | Add `@flow:` tags |
| Undeclared tagged flows | 3 | Add `product`/`report`/`settings` to `flow-definitions.json` or fix the tags |
| Modules with no error/failure flow | 15 | Add error/failure flows where the UX has them |

### Config fix (rules, not tests)
| Item | Action |
|---|---|
| `.testquality.yml → js_unit_suffixes` omits `.tsx`/`.jsx` | Add `.test.tsx`, `.spec.tsx` (and `.jsx`) so the gate covers all 203 unit files; re-run the unit gate. |

### Determinism (real risk, low urgency — tests currently pass)
| Item | Count | Verdict |
|---|---|---|
| `timezone.now()` without freeze | 28 (25 be + 3 unit) | REWRITE with `freezegun`/`jest.setSystemTime` opportunistically |

### Keep / ignore (informational nits)
`missing_docstring` (97), `test_too_short` (19), `too_many_assertions` (11),
`test_too_long` (5), `inline_payload` (3) — style/maintainability signals, not
behavioral defects. Address opportunistically; not a gate to merge.

---

## 4. Coverage before / after framing

- **Static flow coverage is 0/104 today and will remain 0** until the deferred
  `e2e-user-flows-check` batch declares `outcomes` and tags tests. That is expected —
  do not read the 0 as a regression, and do not confuse it with the **runtime 104/104**
  the CI artifact reports (§1b). They are different models; the static one is unpopulated.
- **The frontend-unit gate's real numbers are unknown** until `.tsx` is added to the
  suffix list. Expect duplicate/weak counts to rise materially once 151 more files are
  analyzed. Re-run and re-audit after the config fix.
- Backend and E2E gate scores (99 / 81) are computed over the full file sets and are trustworthy.

---

## 5. Prioritized actions

1. **Add `.tsx`/`.jsx` to `js_unit_suffixes`** and re-run the unit gate — the gate is
   blind to 74% of the unit suite; every other unit number here is provisional.
2. **Rewrite the 14 un-failable E2E tests + 27 flow-tag mismatches** — the only tests
   that today pass without being able to fail or that lie about what they do.
3. **Wire the flow model** (`/e2e-user-flows-check`): declare `outcomes`, tag tests,
   register the 3 undeclared flows — turns 284 display tests from "uncredited" into coverage.
4. **`test.each`/rename the 47 store "duplicates"** — preserve coverage, don't delete.
5. Opportunistic: 28 `timezone.now` freezes; 10 fragile locators; info nits.

**Report-only for the corpus: `--apply` batches, test authoring, and the DB fake-data
refresh remain deferred per the operator's audit-first scope.** The one exception is the
tooling/config fix executed as Batch 1 below (no test-corpus edits).

---

## 6. Batch 1 executed — unit-gate `.tsx` coverage (2026-07-24)

**Approved and applied** (operator-directed). No test-corpus or production-code edits.

**Changes:**
- `.testquality.yml` — `js_unit_suffixes` widened with `.test.tsx`/`.spec.tsx` (+ `.jsx`).
  The gate now analyzes **202 unit files / 1 824 test cases** (was 51 / 541 — **70% was invisible**).
- `frontend/scripts/ast-parser.cjs` — fixed two analyzer bugs the `.tsx` scan exposed:
  (1) curried `it.each(table)(name, fn)` / `test.each` / `describe.each` were misparsed as
  empty/unnamed tests; (2) any `.test()` method call (e.g. `/regex/.test(url)`) was
  misclassified as a Jest `test()`. Now the chain must be rooted at an `it`/`test`/`describe`
  identifier, and the curried `.each` form is resolved to the outer call. Result: **12
  false-positive ERRORS eliminated** (`empty_test` 10→0, `duplicate_name` 2→0); **e2e output
  byte-for-byte unchanged** (0 regression from the shared bridge). ⚠️ This file is fleet-shared
  (canonical in `vps-ops-toolkit`) — **propagate this fix upstream** so a future sync does not
  revert it and other projects benefit.
- `.junk-baseline.json` — **366 → 384** (exactly +18, nothing removed). One-time scope
  correction: these 18 `.tsx` junk findings predate the rules but were never scanned. CI
  (`--junk-severity=error`) now passes: **0 errors, 498 warnings**.

**The 18 grandfathered `.tsx` findings — real debt, clean up in the frontend-unit-coverage batch:**

*`weak_assertion` (10):*
- `components/ProfileIcons.test.tsx` — "MOOD_COLORS has styling for all mood values", "MOOD_MESSAGES has entries for all mood values"
- `components/SubscriptionDashboardToast.test.tsx` — "dismisses billing failed toast via close icon button", "dismisses expiry toast via close icon button"
- `components/admin/AdminSidebar.test.tsx` — "marks the active nav item when pathname matches the dashboard route"
- `components/layouts/Navbar.test.tsx` — "closes mobile menu when mobile login link is clicked"
- `views/AdminDashboardPage.test.tsx` — "links to the subscriptions management page", "links to the users management page"
- `views/AdminSubscriptionsPage.test.tsx` — "links to the create subscription page"
- `views/AdminUsersPage.test.tsx` — "links to the new user enrollment page"

*`duplicate_coverage` (8):*
- `components/admin/Pill.test.tsx` — "sm"
- `components/layouts/TrainerMobileBottomNav.test.tsx` — "clears auth state when Cerrar sesión is clicked"
- `components/shared/TrainerNoteHero.test.tsx` — "renders nothing when the note is only whitespace"
- `components/trainer/PostSessionMessageSheet.test.tsx` — "closes the sheet when the cancel button is clicked", "fills the textarea when a quick suggestion is clicked", "renders the customer name"
- `components/trainer/evals/shared.test.tsx` — "emits the typed value through onChange"
- `views/BookSessionPage.test.tsx` — "renders session details with correct session number"

> These are the *known-new* junk from the `.tsx` unlock. The broader `.tsx` warning surface
> (fragile locators, non-determinism, etc.) is now visible in the gate report but stays as
> warnings; triage it alongside the weak/duplicate cleanup.
