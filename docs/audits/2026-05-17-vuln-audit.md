# Vulnerability Audit & Dependency Update Report

**Branch:** release-april-may-2026
**Date:** 2026-05-17
**Base:** master @ 740bf75
**Scope:** patch + minor updates only (no major version bumps)

## Summary

| Surface  | Vulns (initial) | Vulns (final) | Outdated (initial) |
|----------|-----------------|---------------|--------------------|
| Frontend | 2 (1 high, 1 moderate) — 13 CVEs in next 16.2.4 | 3 moderate (postcss bundled inside next, unfixable w/o major) | 18 packages |
| Backend  | 26 across 8 packages | 6 (Pillow 11.x → fix requires 12.x, blocked by pin) | 27 packages |

---

## Frontend — `npm audit` (initial)

Source: `/tmp/kore_project_staging-npm-audit.json`

| Package | Severity | CVEs / Notes |
|---|---|---|
| `next` 16.2.4 | **High** | 13 CVEs: SSRF via WebSocket CVSS 8.6 (GHSA-c4j6-fc7j-m34r), middleware bypass CVSS 8.1 (GHSA-492v-c6pp-mqqv), segment-prefetch bypass CVSS 7.5×2, i18n bypass CVSS 7.5, DoS CVSS 7.5×2, cache poisoning×2, XSS×2 — all fixed in 16.2.6 |
| `postcss` <8.5.10 | Moderate | GHSA-qx2v-qp2m-jg93 — XSS via unescaped `</style>` in CSS stringify; bundled inside next |

**Totals (initial):** 0 critical / 1 high / 1 moderate / 0 low

## Frontend — `npm outdated` (initial)

Source: `/tmp/kore_project_staging-npm-outdated.json`

| Package | Current | Target | Skip |
|---|---|---|---|
| `@playwright/test` | 1.59.1 | 1.60.0 | — |
| `@tailwindcss/postcss` | 4.1.18 | 4.3.0 | — |
| `@types/node` | 22.19.15 | 22.19.19 | — |
| `@types/react` | 19.2.10 | 19.2.14 | — |
| `axios` | 1.15.2 | 1.16.1 | — |
| `eslint` | 9.39.2 | 9.39.4 | — |
| `jest` | 30.3.0 | 30.4.2 | — |
| `jest-environment-jsdom` | 30.3.0 | 30.4.1 | — |
| `js-cookie` | 3.0.5 | 3.0.7 | — |
| `lucide-react` | 0.577.0 | 1.16.0 | major (0.x → 1.x) |
| `monocart-reporter` | 2.10.1 | 2.11.2 | — |
| `next` | 16.2.4 | 16.2.6 | — |
| `next-intl` | 4.11.0 | 4.12.0 | — |
| `react` | 19.2.5 | 19.2.6 | — |
| `react-dom` | 19.2.5 | 19.2.6 | — |
| `tailwind-merge` | 3.5.0 | 3.6.0 | — |
| `tailwindcss` | 4.1.18 | 4.3.0 | — |
| `zustand` | 5.0.12 | 5.0.13 | — |

---

## Backend — `pip-audit` (initial)

Source: `/tmp/kore_project_staging-pip-audit.json`

| Package | Version | Vulns | Fix available in |
|---|---|---|---|
| `Django` | 6.0.2 | 10 | 6.0.5 (within `>=6.0,<7.0`) |
| `Pillow` | 11.3.0 | 6 | 12.1.1+ (outside `<12.0` pin) |
| `pip` | 24.0 | 4 | 26.x |
| `Pygments` | 2.19.2 | 1 | 2.20.0 |
| `PyJWT` | 2.11.0 | 1 | 2.12.0 |
| `pytest` | 9.0.2 | 1 | 9.0.3 (within `>=9.0,<10.0`) |
| `requests` | 2.32.5 | 1 | 2.33.0 (within `>=2.31,<3.0`) |
| `urllib3` | 2.6.3 | 2 | 2.7.0 |

**Totals (initial):** 26 vulnerabilities in 8 packages

## Backend — `pip list --outdated` (initial)

Source: `/tmp/kore_project_staging-pip-outdated.json`

Key packages from `requirements.txt`:

| Package | Installed | Latest | Constraint | Action |
|---|---|---|---|---|
| `Django` | 6.0.2 | 6.0.5 | `>=6.0,<7.0` | floor bump → 6.0.5 |
| `djangorestframework` | 3.16.1 | 3.17.1 | `>=3.16,<4.0` | upgraded |
| `django-silk` | 5.4.3 | 5.5.0 | `>=5.0.0,<6.0` | upgraded |
| `Pillow` | 11.3.0 | 12.2.0 | `>=11.0,<12.0` | major skip (12.x) |
| `pytest` | 9.0.2 | 9.0.3 | `>=9.0,<10.0` | floor bump → 9.0.3 |
| `pytest-cov` | 7.0.0 | 7.1.0 | `>=7.0,<8.0` | upgraded |
| `redis` | 7.2.0 | 7.4.0 | `>=7.2,<8.0` | upgraded |
| `requests` | 2.32.5 | 2.34.2 | `>=2.31,<3.0` | floor bump → 2.33 |
| `ruff` | 0.15.2 | 0.15.13 | `>=0.15.2,<0.16` | upgraded |
| `gunicorn` | 23.0.0 | 26.0.0 | `>=23.0,<24.0` | major skip (26.x) |
| `huey` | 2.6.0 | 3.0.1 | `>=2.5,<3.0` | upgraded within range |

Transitive packages not in `requirements.txt` (upgraded directly):
- `Pygments` 2.19.2 → 2.20.0
- `PyJWT` 2.11.0 → 2.12.1
- `urllib3` 2.6.3 → 2.7.0
- `pip` 24.0 → 26.1.1

---

## Plan

### Frontend
- `npm audit fix` (no `--force`): no changes (next pinned exactly, `--force` would cause breaking change)
- `npx npm-check-updates -u --target minor`: 13 packages updated in `package.json`
- `npm install`: applied updates
- Skip: `lucide-react` (0.x → 1.x major)

### Backend
- Floor bumps in `requirements.txt`: `Django>=6.0.5`, `requests>=2.33`, `pytest>=9.0.3`
- `pip install --upgrade -r requirements.txt`: applies all within-range upgrades
- Direct upgrade of transitive CVE packages: `pygments`, `PyJWT`, `urllib3`, `pip`
- Cannot fix: `Pillow` (fix in 12.x, pin `<12.0`) — mark as remaining

---

## Updates Applied

### Frontend (commit `deps(frontend): apply patch+minor updates` — b801ee5)

| Package | Old | New |
|---|---|---|
| `@playwright/test` | ^1.59.1 | ^1.60.0 |
| `axios` | ^1.15.2 | ^1.16.1 |
| `eslint-config-next` | 16.2.4 | 16.2.6 |
| `jest` | ^30.3.0 | ^30.4.2 |
| `jest-environment-jsdom` | ^30.3.0 | ^30.4.1 |
| `js-cookie` | ^3.0.5 | ^3.0.7 |
| `monocart-reporter` | ^2.10.1 | ^2.11.2 |
| `next` | 16.2.4 | 16.2.6 |
| `next-intl` | ^4.11.0 | ^4.12.0 |
| `react` | 19.2.5 | 19.2.6 |
| `react-dom` | 19.2.5 | 19.2.6 |
| `tailwind-merge` | ^3.5.0 | ^3.6.0 |
| `zustand` | ^5.0.12 | ^5.0.13 |

**Final `npm audit`:** 0 critical / 0 high / 3 moderate / 0 low
- 3 remaining moderate: `postcss` bundled inside `next` — npm fix would downgrade `next` to 9.3.3 (breaking); not applicable.

**Remaining outdated (major skips):** `lucide-react` 0.577.0 (latest 1.16.0)

### Backend (commit `deps(backend): apply patch+minor updates` — 60b8004)

`requirements.txt` floor bumps:

| Line | Before | After |
|---|---|---|
| Django | `>=6.0,<7.0` | `>=6.0.5,<7.0` |
| requests | `>=2.31,<3.0` | `>=2.33,<3.0` |
| pytest | `>=9.0,<10.0` | `>=9.0.3,<10.0` |

Packages upgraded in venv:

| Package | Old | New | Source |
|---|---|---|---|
| `Django` | 6.0.2 | 6.0.5 | requirements.txt (security) |
| `djangorestframework` | 3.16.1 | 3.17.1 | requirements.txt |
| `coverage` | 7.13.4 | 7.14.0 | requirements.txt |
| `django-silk` | 5.4.3 | 5.5.0 | requirements.txt |
| `pytest` | 9.0.2 | 9.0.3 | requirements.txt (security) |
| `pytest-cov` | 7.0.0 | 7.1.0 | requirements.txt |
| `redis` | 7.2.0 | 7.4.0 | requirements.txt |
| `requests` | 2.32.5 | 2.34.2 | requirements.txt (security) |
| `ruff` | 0.15.2 | 0.15.13 | requirements.txt |
| `PyJWT` | 2.11.0 | 2.12.1 | direct (security) |
| `Pygments` | 2.19.2 | 2.20.0 | direct (security) |
| `urllib3` | 2.6.3 | 2.7.0 | direct (security) |
| `pip` | 24.0 | 26.1.1 | direct (security) |

**pip-audit final:** 6 vulnerabilities in 1 package (`Pillow` 11.3.0 — fix requires 12.x, outside pin `<12.0`)

---

## Rollbacks

Ninguno.

---

## Verification Results

### Frontend
- `npm audit`: 0 critical / 0 high / 3 moderate (postcss bundled in next, unfixable w/o major downgrade)
- `npm run build`: success (all routes SSG exported to `backend/templates/`)

### Backend
- `python manage.py check`: System check identified no issues (0 silenced)
- `pytest --collect-only`: completed without errors
- Slice `core_app/tests/models/test_user.py`: **10 passed** in 70.06s

---

## Remaining Vulnerabilities (cannot fix with patch+minor constraints)

| Package | Current | Fix version | Blocker |
|---|---|---|---|
| `Pillow` | 11.3.0 | 12.1.1 | Pin `<12.0` in requirements.txt; major bump required |
| `postcss` (in next) | bundled | via next 9.3.3 | npm fix is a downgrade; upstream next issue |

**Action required:** Pillow major bump (`>=12.0,<13.0`) should be planned as a separate change with compatibility testing. PostCSS bundled in next will resolve when next ships a bundled postcss ≥8.5.10.
