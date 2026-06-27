# POS System - Playwright Tests

## Setup

No browser download needed — tests use Electron directly.

## Prerequisites

1. MySQL must be running locally (docker-compose.yml)
2. Vite dev server must be running: `npm run dev`
3. Or build first: `npm run build`

## Run Tests

```bash
# In terminal 1: start the app
npm run dev

# In terminal 2: run tests
npm test

# Run specific phase
npx playwright test tests/phase1/

# Run a single test file
npx playwright test tests/smoke.spec.js
```

## Test Structure

```
tests/
├── playwright.config.js    # Playwright config
├── fixtures/
│   └── electronApp.js      # Electron app fixture
├── helpers/
│   └── posApp.js           # POS app helper methods
├── smoke.spec.js           # Basic smoke tests
├── README.md
└── phase1/                 # Phase 1 tests (TDD)
    ├── supplierPayments.spec.js
    ├── customerPayments.spec.js
    ├── dailyExpenses.spec.js
    ├── workerWages.spec.js
    ├── exchanges.spec.js
    ├── invoiceStates.spec.js
    └── statements.spec.js
```

## TDD Workflow

1. Write the test first (it will fail)
2. Implement the feature
3. Run the test until it passes
4. Move to next feature

Each Phase folder contains test files matching the TASKS.md items.
