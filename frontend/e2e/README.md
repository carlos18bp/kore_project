# Frontend E2E (Playwright)

This directory contains Playwright E2E specs organized by module (e.g., `auth/`, `app/`, `public/`).
Flow coverage is driven by `flow-definitions.json` and `@flow:`/`@module:` tags.

## Common commands

```bash
# Run all E2E tests (all viewports)
npm run test:e2e

# Run with interactive UI
npm run test:e2e:ui

# Run with coverage report (all viewports)
npm run e2e:coverage

# Clean E2E artifacts
npm run e2e:clean
```

## Module-scoped runs

```bash
# List available modules from flow-definitions.json
npm run e2e:modules

# Run a single module
npm run e2e:module -- auth

# Module-scoped coverage (manual grep)
clear && npm run e2e:clean && npm run e2e:coverage -- --grep @module:auth

# Helper alias for module-scoped coverage
npm run e2e:coverage:module -- auth
```

> `--grep @module:<name>` only runs tests tagged with that module. The flow coverage report will still list other modules as missing because the subset was not executed.

> `npm run e2e:module` and `npm run e2e:coverage:module` validate module names using `flow-definitions.json`.

## Tagging reminders

- Use `@flow:<flow-id>` tags to map tests to `flow-definitions.json` entries.
- Use `@module:<name>` tags to filter by module via Playwright `--grep`.

## Coverage artifacts

The flow coverage report is written to `e2e-results/flow-coverage.json` after each run.
