# Vulnerability Audit Report — `kore_project`

- **Branch**: `double-check-30042026`
- **Base**: `origin/master` (`020f93d`)
- **Date**: 2026-04-30
- **Scope**: patch + minor updates only (no major bumps, no `npm audit fix --force`).

## Summary CVEs

### Frontend (npm) — 9 advisories

| Severity | Count |
|---|---|
| high | 2 |
| moderate | 6 |
| low | 1 |
| **total** | **9** |

### Backend (pip-audit) — 2 advisories

| Severity | Count |
|---|---|
| medium (DoS / OOB write) | 2 |
| **total** | **2** |

## Frontend outdated table (pre-update)

| Package | Current | Wanted (minor) | Latest | Update applied |
|---|---|---|---|---|
| @playwright/test | 1.58.1 | 1.59.1 | 1.59.1 | yes (minor) |
| @tailwindcss/postcss | 4.1.18 | 4.2.4 | 4.2.4 | yes (minor) |
| @types/node | 22.19.15 | 22.19.17 | 25.6.0 | yes (patch) |
| @types/react | 19.2.10 | 19.2.14 | 19.2.14 | yes (patch) |
| axios | 1.13.6 | 1.15.2 | 1.15.2 | yes (minor) |
| eslint | 9.39.2 | 9.39.4 | 10.2.1 | yes (patch) |
| eslint-config-next | 16.1.7 | 16.1.7 | 16.2.4 | yes (minor via ncu) |
| framer-motion | 12.34.3 | 12.38.0 | 12.38.0 | yes (minor) |
| gsap | 3.14.2 | 3.15.0 | 3.15.0 | yes (minor) |
| lucide-react | 0.564.0 | 0.564.0 | 1.14.0 | **skipped (major 0.x → 1.x)** |
| monocart-reporter | 2.10.0 | 2.10.1 | 2.10.1 | yes (patch) |
| next | 16.1.7 | 16.1.7 | 16.2.4 | yes (minor) |
| next-intl | 4.8.2 | 4.11.0 | 4.11.0 | yes (minor) |
| react | 19.2.3 | 19.2.3 | 19.2.5 | yes (patch) |
| react-dom | 19.2.3 | 19.2.3 | 19.2.5 | yes (patch) |
| swiper | 12.1.2 | 12.1.4 | 12.1.4 | yes (patch) |
| tailwindcss | 4.1.18 | 4.2.4 | 4.2.4 | yes (minor) |
| typescript | 5.9.3 | 5.9.3 | 6.0.3 | **skipped (major 5 → 6)** |
| zustand | 5.0.11 | 5.0.12 | 5.0.12 | yes (patch) |

## Backend outdated table (pre-update)

| Package | Current | Latest | Update applied |
|---|---|---|---|
| django-dbbackup | 4.3.0 | 5.3.0 | **skipped (major 4 → 5)** |
| gunicorn | 23.0.0 | 25.3.0 | **skipped (major 23 → 25)** |
| huey | 2.6.0 | 3.0.0 | **skipped (major 2 → 3)** |
| pillow | 11.3.0 | 12.2.0 | **skipped (major 11 → 12)** |

All backend pins are already at the latest patch+minor within their declared `>=X,<Y` ranges. No backend version bumps applied to `requirements.txt`.

## CVE Details

### Frontend

| ID | Package | Severity | Title | Fixed by |
|---|---|---|---|---|
| GHSA-3p68-rc4w-qgx5 | axios `<1.15.0` | moderate | NO_PROXY hostname normalization bypass / SSRF | axios `1.15.2` |
| GHSA-fvcv-3m26-pcqx | axios `<1.15.0` | moderate | Unrestricted cloud metadata exfiltration via header injection | axios `1.15.2` |
| GHSA-f886-m6hf-6m8v | brace-expansion `<1.1.13` / `<2.0.3` | moderate | Zero-step sequence DoS / memory exhaustion | transitive bump via `npm audit fix` |
| GHSA-r4q5-vmmm-2653 | follow-redirects `<=1.15.11` | moderate | Auth-header leak on cross-domain redirect | transitive bump via `npm audit fix` |
| GHSA-q4gf-8mx6-v5v3 | next `<16.2.3` | high | DoS with Server Components | next `16.2.4` (minor) |
| GHSA-8f24-v5vv-gm5j | next-intl `<4.9.1` | moderate | Open redirect | next-intl `4.11.0` (minor) |
| GHSA-c7w3-x93f-qmm8 | nodemailer `<8.0.4` | low | SMTP command injection (envelope.size) | transitive (devDep, monocart-reporter) |
| GHSA-vvjj-xcjg-gr5g | nodemailer `<=8.0.4` | moderate | SMTP injection via CRLF in transport name | transitive (devDep) |
| GHSA-3v7f-55p6-f55p | picomatch `<2.3.2` / `<4.0.4` | moderate | Glob method-injection in POSIX classes | transitive bump |
| GHSA-c2c7-rcm5-vvqj | picomatch `<2.3.2` / `<4.0.4` | high | ReDoS via extglob quantifiers | transitive bump |
| GHSA-qx2v-qp2m-jg93 | postcss `<8.5.10` | moderate | XSS via unescaped `</style>` | next `16.2.4` (minor) |

### Backend

| ID | Package | Severity | Title | Fix |
|---|---|---|---|---|
| CVE-2026-25990 / GHSA-cfh3-3jmp-rvhc | pillow `>=10.3.0` | medium | Out-of-bounds write loading crafted PSD | `12.1.1` (major bump — **skipped**) |
| CVE-2026-40192 / GHSA-whj4-6x5x-4v2j | pillow `>=10.3.0,<12.2.0` | medium | FITS GZIP decompression-bomb DoS | `12.2.0` (major bump — **skipped**) |

## Reproducibility

```bash
# Frontend
cd frontend
npm install
npm audit --json > /tmp/kore_project-npm-audit.json
npm outdated --json > /tmp/kore_project-npm-outdated.json

# Backend (audit venv)
cd backend
python3 -m venv .venv-audit
.venv-audit/bin/pip install --upgrade pip pip-audit
.venv-audit/bin/pip install -r requirements.txt
.venv-audit/bin/pip-audit -r requirements.txt --format json > /tmp/kore_project-pip-audit.json
.venv-audit/bin/pip list --outdated --format json > /tmp/kore_project-pip-outdated.json
```

Raw outputs are kept under `/tmp/kore_project-*` during the run. Re-run any of the commands above to reproduce.

## Majors skipped

| Ecosystem | Package | Current | Latest | Reason |
|---|---|---|---|---|
| frontend | lucide-react | 0.564.0 | 1.14.0 | Major (0.x → 1.x) — ncu `--target minor` skipped it. |
| frontend | typescript | 5.9.3 | 6.0.3 | Major (5 → 6). |
| frontend | eslint (latest) | 9.39.4 | 10.2.1 | 10.x major; stayed on 9.x patch. |
| frontend | @types/node (latest) | 22.19.17 | 25.6.0 | Stayed on the matching Node 22 LTS line. |
| backend | Pillow | 11.3.0 | 12.2.0 | Range pin is `>=11.0,<12.0`. **Both Pillow CVEs require Pillow 12.x.** Recommend a follow-up PR to bump the constraint to `<13.0` after testing image-handling code paths. |
| backend | django-dbbackup | 4.3.0 | 5.3.0 | Range pin is `>=4.0.0,<5.0`. |
| backend | gunicorn | 23.0.0 | 25.3.0 | Range pin is `>=23.0,<24.0`. |
| backend | huey | 2.6.0 | 3.0.0 | Range pin is `>=2.5,<3.0`. |

## Update plan & results

This file is updated in two passes:
1. Initial scan commit (this section will be augmented with results after Step D/E).
2. Final commit will record packages updated, build/test results, and any rollbacks.

## Updates applied (post-step D/E)

_Filled in after running `npm audit fix` + `ncu -u --target minor`, build, and lint._

## Rollbacks

_None recorded yet._
