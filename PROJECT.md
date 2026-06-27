# POS System - Project Checklist

## Priority Legend
- **P0** — Critical, must have for MVP
- **P1** — Important, should have
- **P2** — Nice to have

---

## P0: Windows Build Only

### Already Done
- [x] `electron-builder` installed with Windows config in `package.json`
- [x] `better-sqlite3` rebuild on postinstall via `@electron/rebuild`
- [x] `asarUnpack` for the native SQLite module
- [x] GitHub Actions CI building Windows `.exe` on push/tag

### Still Needed
- [ ] **P0** Verify `postinstall` script works on Windows
- [ ] **P1** Build and test `.exe` installer on clean Windows machine

### Known Constraints
- Cannot build `.exe` from macOS without Wine or a CI runner
- GitHub Actions CI handles Windows builds automatically

---

## P0: Auto-Update

### Packages
- [ ] **P0** Install `electron-updater` (`npm install electron-updater`)

### Release Backend
- [ ] **P0** Configure `electron-builder` `publish` section in `package.json`
  - [ ] Option A: **GitHub Releases** (free, public repo)
  - [ ] Option B: **S3 bucket** (paid, private)
  - [ ] Option C: **Generic HTTPS server** (self-hosted)
- [ ] **P0** Set `GH_TOKEN` (GitHub personal access token) for uploads
- [ ] **P1** Create first release manually to test the update flow

### Code Signing (required for auto-update on Mac & Windows)
- [ ] **P0** **macOS**: Apple Developer Program enrollment ($99/year)
- [ ] **P0** **macOS**: Generate Developer ID Application certificate
- [ ] **P0** **macOS**: Configure notarization in `electron-builder`
- [ ] **P1** **Windows**: Purchase code signing certificate ($100–300/year)
- [ ] **P1** **Windows**: Configure certificate in `electron-builder`

### Update Logic in `electron/main.js`

- [ ] **P0** Import `autoUpdater` from `electron-updater`
- [ ] **P0** Configure update feed URL (matches publish config)
- [ ] **P0** Check for updates on app startup
- [ ] **P0** Periodic update check (e.g., every 60 minutes)
- [ ] **P1** Main process IPC handler to expose update status to renderer
- [ ] **P1** Renderer UI:
  - [ ] **P1** Show "Update available" banner
  - [ ] **P1** Download progress bar
  - [ ] **P1** "Restart to install" button after download
  - [ ] **P2** Silent background download option
- [ ] **P1** Handle update errors gracefully (network failure, no update server)
- [ ] **P2** Delta/block-level updates for smaller downloads

### CI Pipeline (recommended)
- [ ] **P1** Create `.github/workflows/release.yml`
- [ ] **P1** Build for macOS and Windows on push to `main` or tag
- [ ] **P1** Upload artifacts to GitHub Releases
- [ ] **P2** Draft release notes automatically from commits

---

## P0: Audit Log Consistency

- [ ] **P0** Wire `audit:log` IPC call into every create/update/delete operation
  - [ ] Products (create / update / delete)
  - [ ] Accounts (create / update / delete)
  - [ ] Invoices (create / cancel)
  - [ ] Journal entries (create / delete)
  - [ ] Customers (create / update / delete)
  - [ ] Suppliers (create / update / delete)
  - [ ] Expenses (create / update / delete)
- [ ] **P1** Add `reason` / `description` field to create dialogs for audit trail
- [ ] **P1** Add redo support in Activity tab UI (IPC handler already exists)

---

## P1: Reports Improvements

- [ ] **P1** Seed sample invoices so Daily / Sales / Profit tabs show real data
- [ ] **P1** Add redo button in Activity tab (IPC `audit:redo` already exists)
- [ ] **P1** Show user ID / name in Activity feed (requires user system)
- [ ] **P2** Export reports to PDF / CSV / Excel

---

## P1: Testing

- [ ] **P1** Update e2e tests for:
  - [ ] Chart of Accounts CRUD
  - [ ] Opening balance with debit/credit
  - [ ] Activity tab with undo/redo
- [ ] **P1** Test installers work on clean Windows / macOS machines
- [ ] **P1** Test auto-update end-to-end with a staging release

---

## P2: Polish

- [ ] **P2** Chunk size warning in Vite build (dynamic imports for code splitting)
- [ ] **P2** Dark mode testing across all pages
- [ ] **P2** Keyboard shortcuts for common actions
- [ ] **P2** Accessibility audit (ARIA labels, contrast, screen reader support)
- [ ] **P2** Performance optimization for large datasets (virtual scrolling)
