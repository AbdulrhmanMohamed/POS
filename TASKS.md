# POS System - Complete Requirements

## ✅ Completed Features

### Database & Core
- MySQL Database (Docker container `pos-mysql`) with all tables
- Electron desktop app (`mainWindow.loadURL('http://localhost:3000')`)
- Arabic/English language support with RTL (Arabic is default primary, English is secondary)
- Light/Dark theme
- Basic CRUD for all entities
- Auto-migration system (`src/database/migrations.js`) creates missing tables on startup
- MySQL `pool.execute()` → `pool.query()` fix (LIMIT clause compatibility)
- DevTools auto-open disabled in test mode (`process.env.NODE_ENV !== 'test'`)
- 6 critical bugs fixed: broken services import, profit calculation, duplicate i18n keys, electron event typo, schema field mismatch, SQL injection in LIMIT clause

### POS Screen
- Product grid with search/barcode
- Cart management
- Customer selection at checkout
- Discount support (percentage/fixed)
- Credit limit checking
- Auto journal entries for sales

### Accounting System (Double Entry)
- Chart of Accounts (Assets, Liabilities, Equity, Revenue, Expense)
- Journal Entries (manual + auto-generated)
- Account Ledger with transaction history
- Auto entries from Sales and Purchase Orders

### Additional Pages
- Products (with stock management)
- Customers (with credit limit, payment tracking, statement)
- Suppliers (with credit limit, payment tracking, statement)
- Inventory (add/remove stock)
- Purchase Orders (create, receive, update supplier balance)
- Invoices (list, search, filter, state management)
- Returns (process returns, exchanges, restore stock)
- Expenses (add/edit/delete, date range filter, category totals)
- Workers (add/edit/delete, pay salary, payment history)
- Reports
- Settings
- Audit Logs

### Testing
- Playwright test suite with Electron fixture
- 15 Phase 1 tests (all passing)
- 3 smoke tests (all passing)
- Test command: `npm test` (alias: `playwright test`)

---

## ❌ Still Needed - By Priority

### Phase 1: Core Financial Features ✅ COMPLETE

#### 1. Supplier Payment Tracking ✅
- [x] Record payments for suppliers with amount, date, method, notes
- [x] Payment history modal per supplier
- [x] Track with date, amount, payment method

#### 2. Customer Payment Tracking ✅
- [x] Record payments for customers with amount, date, method, notes
- [x] Payment history modal per customer
- [x] Balance auto-updates on payment

#### 3. Daily Expenses ✅
- [x] Expense categories (rent, electricity, water, internet, maintenance, other)
- [x] Add / Edit / Delete expenses
- [x] Date range filter with generate + reset
- [x] Category totals + total summary

#### 4. Worker Wages ✅
- [x] Add / Edit / Delete workers (soft delete via `is_active = FALSE`)
- [x] Pay salary per month with amount + notes
- [x] Payment history modal per worker
- [x] Worker count + total monthly salaries stats

#### 5. Exchanges (تبديل) ✅
- [x] Exchange tab on Returns page with dedicated modal
- [x] Select invoice → pick returned items → pick replacement items
- [x] Auto-calculate price difference
- [x] Stock adjusts: returned items +stock, replacement items -stock
- [x] `exchanges` + `exchange_items` tables in migration

#### 6. Invoice States ✅
- [x] Track states: Paid, Partial, Credit, Cancelled, Returned
- [x] Color-coded status badges
- [x] Change status modal with partial payment input
- [x] Paid amount + Due amount columns in table

#### 7. Full Customer Statement (كشف حساب العميل) ✅
- [x] Running balance with chronological entries
- [x] Shows: invoices (+), payments (-), returns (-)
- [x] Statement button on Customers page

#### 8. Full Supplier Statement (كشف حساب المورد) ✅
- [x] Running balance with chronological entries
- [x] Shows: purchase orders (+), payments (-)
- [x] Statement button on Suppliers page

### Phase 2: Reports & Analytics

#### 9. Complete Reports

##### Daily Report:
- [ ] Total sales (cash + credit)
- [ ] Total returns
- [ ] Total expenses
- [ ] Worker wages paid
- [ ] Supplier payments
- [ ] Net profit/loss

##### Weekly/Monthly Reports:
- [ ] Sales summary
- [ ] Profit analysis
- [ ] Top selling products
- [ ] Least selling products
- [ ] Inventory value
- [ ] Customer debts summary
- [ ] Supplier debts summary

##### Custom Date Range Reports:
- [ ] Report from any date to any date
- [ ] Filter by type (sales, expenses, payments)

#### 10. Performance Reports
- [ ] Week-over-week sales comparison
- [ ] Month-over-month profit comparison
- [ ] Year-over-year performance
- [ ] Best performing days/hours
- [ ] Product performance trends

#### 11. Analytics Dashboard
- [ ] Filters: date range, product, category, customer
- [ ] KPIs: total sales, net profit, invoice count, average invoice value
- [ ] Charts:
  - [ ] Sales over time (line chart)
  - [ ] Top selling products (bar chart)
  - [ ] Profit trend (line chart)
- [ ] Best/worst performing periods
- [ ] Stagnant (non-moving) products
- [ ] Customer purchase frequency
- [ ] Return rate percentage

### Phase 3: Inventory & Products

#### 12. Complete Inventory
- [ ] Total inventory value (cost × quantity)
- [ ] Complete inventory count at any time
- [ ] Inventory by category
- [ ] Inventory by supplier
- [ ] Low stock alerts dashboard

#### 13. Stock Movements Log (حركة المخزون)
- [ ] Record every stock movement with:
  - [ ] Movement type (sale, purchase, return, audit, manual, damage, warehouse transfer)
  - [ ] Product, quantity
  - [ ] User who performed the action
  - [ ] Date / time
- [ ] View full stock movement log per product
- [ ] View full stock movement log across all products
- [ ] Export movement log for auditing

#### 14. Inventory Reconciliation (تسوية الجرد)
- [ ] Full inventory count mode (enter actual physical count per product)
- [ ] Compare actual count vs system count
- [ ] Show surplus / deficit per product
- [ ] Settle discrepancies (auto-update stock + record movement)
- [ ] Print / export reconciliation report

#### 15. Product Types/Models/Categories
- [ ] Enhanced product categorization (tree / multi-level)
- [ ] Barcode generation (JsBarcode) for products without one
- [ ] Supplier product grouping:
  - [ ] Each supplier owns their products
  - [ ] View products filtered by supplier
  - [ ] Inventory report per supplier

#### 16. Product Variants (Multiple Models per Product)
- [ ] Support colors, sizes, or other attributes per product
- [ ] Each variant has its own barcode, stock, price (optional)
- [ ] Variant selection during POS sale
- [ ] Variant display in product grid

#### 17. Product Status System (حالة المنتج)
- [ ] Three product statuses:
  - [ ] Normal / سليم
  - [ ] Damaged / Defective / ديفوه - معيوب
  - [ ] Returned / مرتجع
- [ ] Filter products by status
- [ ] Track quantities per status separately
- [ ] Damaged/Returned products isolated from sellable stock

#### 18. Damaged/Defective Products
- [ ] Mark products as damaged / defective
- [ ] Track damaged goods quantity separately (isolated from sellable stock)
- [ ] Record cause and date of damage
- [ ] Add to journal entries
- [ ] Report on damaged products

#### 19. Cash Register (الصندوق)
- [ ] Opening balance at start of shift
- [ ] Record total sales (cash)
- [ ] Record total expenses paid from register
- [ ] Deposits and withdrawals
- [ ] Closing balance / end-of-day reconciliation
- [ ] Difference report (expected vs actual)

### Phase 4: Hardware Integration

#### 20. Printing System
- [ ] Printer Adapter Layer (not device-specific)
  - [ ] `PrinterAdapter` base class
  - [ ] `WindowsPrinter` (HTML/PDF via `window.print()` / `webContents.print()`)
  - [ ] `EscPosPrinter` (thermal printers: Epson, XPrinter, Bixolon)
- [ ] Print via Electron IPC (`ipcMain.handle("print-invoice")`)
- [ ] Receipt template with company info
- [ ] Thermal printer support (80mm, ESC/POS protocol)
- [ ] Barcode on receipts
- [ ] QR code for verification

#### 21. Barcode Scanner Optimization
- [ ] Keyboard HID detection (buffer + timeout pattern to distinguish scanner from manual typing)
- [ ] Auto-detect scan vs keyboard input
- [ ] Auto-add product to cart on scan
- [ ] Handle partial/fast scans

### Phase 5: Payments & Security

#### 22. Payment Types Enhancement
- [ ] Support additional payment methods:
  - [ ] Cash (كاش)
  - [ ] Credit (آجل)
  - [ ] Partial payment (دفع جزئي)
  - [ ] Bank transfer (تحويل بنكي)
  - [ ] E-wallet (محفظة إلكترونية - optional)
- [ ] Multiple payments per invoice
- [ ] Record payment method per transaction

#### 23. Role-Based Access Control
- [ ] Define clear permission mapping per feature:
  - [ ] Sales (البيع)
  - [ ] Returns (المرتجع)
  - [ ] Edit prices (تعديل الأسعار)
  - [ ] Delete invoices (حذف الفواتير)
  - [ ] View profits (رؤية الأرباح)
  - [ ] Inventory management (الجرد)
  - [ ] User management (إدارة المستخدمين)
- [ ] Four roles with pre-configured permissions:
  - [ ] **Admin** — all permissions
  - [ ] **Manager** — reports, inventory, sales, returns, view profits (no settings/user mgmt)
  - [ ] **Cashier** — POS screen only (sell, returns, basic invoice view)
  - [ ] **Inventory Employee** — inventory management only (add/remove stock, audit)
- [ ] Login / logout system with username + password
- [ ] Session management
- [ ] UI hides inaccessible features based on role

#### 24. Expense Entry Audit (User Tracking)
- [ ] Record which user entered each expense
- [ ] Show user name in expense list and reports
- [ ] Filter expenses by user

#### 25. CI/CD & Cross-Platform Builds
- [ ] GitHub Actions workflow for automated builds
- [ ] Windows EXE build (NSIS)
- [ ] macOS DMG build
- [ ] Linux AppImage build
- [ ] Auto-update mechanism

---

## 📊 Report Summary Structure

### Daily Report Template:
```
التقرير اليومي - [Date]
===================================
المبيعات: XXX
المرتجعات: XXX
المصروفات: XXX
رواتب العمال: XXX
دفعات الموردين: XXX
صافي الربح/الخسارة: XXX

العملاء الجدد: X
أوامر الشراء الجديدة: X
```

### Financial Summary:
```
الرصيد الحالي:
- ذمم العملاء: XXX
- ذمم الموردين: XXX
- قيمة المخزون: XXX
- النقد في الصندوق: XXX
```

---

## Next Steps - Priority Order:

### Phase 2: Reports & Analytics (Next Up)
9. Complete daily/weekly/monthly reports
10. Performance reports (week/month/year comparison)
11. Analytics Dashboard with charts & KPIs

### Phase 3: Inventory & Products
12. Inventory value dashboard + low stock alerts
13. Stock Movements Log (حركة المخزون)
14. Inventory Reconciliation (تسوية الجرد)
15. Enhanced product categories + barcode generation
16. Product Variants (colors, sizes)
17. Product Status System (normal / damaged / returned)
18. Damaged/Defective Products
19. Cash Register module

### Phase 4: Hardware Integration
20. Printing system (Printer Adapter + ESC/POS + Receipts)
21. Barcode scanner optimization (HID detection, auto-add)

### Phase 5: Payments & Security
22. Payment types enhancement (bank transfer, e-wallet, multiple per invoice)
23. Role-Based Access Control (4 roles + granular permissions)
24. Expense Entry Audit (user tracking)
25. CI/CD & cross-platform builds (GitHub Actions)