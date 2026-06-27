<div align="center">
  <img src="build/icon.png" alt="POS System Logo" width="120" height="120">
  <h1 align="center">Professional POS System</h1>
  <p align="center">
    <strong>نظام نقاط بيع متكامل</strong>
    <br />
    Enterprise-grade point of sale solution for retail, wholesale, and small businesses
    <br />
    <br />
    <a href="#features">Features</a>
    &middot;
    <a href="#screenshots">Screenshots</a>
    &middot;
    <a href="#download">Download</a>
    &middot;
    <a href="#comparison">Why This POS?</a>
  </p>
</div>

<p align="center">
  <img src="https://img.shields.io/badge/platform-Windows%20%7C%20macOS-blue?style=flat-square">
  <img src="https://img.shields.io/github/v/release/AbdulrhmanMohamed/POS?style=flat-square">
  <img src="https://img.shields.io/github/downloads/AbdulrhmanMohamed/POS/total?style=flat-square">
  <img src="https://img.shields.io/badge/license-MIT-green?style=flat-square">
</p>

---

## Overview

A modern, lightning-fast Point of Sale system designed for the Arabic market. Built for retail stores, supermarkets, pharmacies, and wholesale businesses that need a reliable, offline-first POS without recurring subscription fees.

Unlike cloud-based POS systems that require constant internet and charge monthly, this runs **natively on Windows & macOS** with full offline capability, automatic updates via GitHub, and local SQLite database — your data stays yours.

---

## Features

### Point of Sale
- Lightning-fast product search (barcode, name, Arabic)
- Real-time inventory deduction
- Multiple payment methods (cash, card, credit)
- Return & exchange management
- Receipt printing (thermal/standard)

### Inventory Management
- Real-time stock tracking with low-stock alerts
- Purchase orders with receive workflow
- Inventory valuation (cost-based)
- Barcode generation & label printing
- Category management
- Price tiers & bulk discounts
- Promotional periods

### Accounting & Finance
- **Full Chart of Accounts** with Arabic chart of accounts
- Double-entry journal entries with debit/credit
- Opening balance management
- Profit & loss tracking
- Expense management
- Cash register management
- Accounts receivable/payable
- Journal entry audit trail

### Customer & Supplier Management
- Customer profiles with purchase history
- Supplier management with debt tracking
- Customer frequency analysis
- Balance tracking

### Business Intelligence
- Daily sales report
- Sales performance (week/month/year-over-year)
- Profit trends with charts
- Top/least selling products
- Customer purchase frequency
- Product trends & stagnant product detection
- Filtered KPIs by date, product, category, customer
- Interactive charts (line, bar, pie)

### Audit & Compliance
- **Full audit log** with operation tracking
- **Undo/Redo** support for all operations
- Activity timeline with entity-level tracking
- Data integrity checks

### Operational
- Multi-worker management with payments
- Cashier shift management
- Supplier payment tracking
- Customer payment tracking
- Bulk discount rules
- Promotional pricing periods

---

## Why This POS? — vs Competitors

| Feature | **This POS** | Traditional POS | Cloud POS (e.g., Shopify POS, Square) |
|---------|-------------|----------------|--------------------------------------|
| **Monthly Fee** | **Free** | $50–200/mo | $30–300/mo + transaction fees |
| **Offline Mode** | **Full** (local SQLite) | Partial | Limited / none |
| **Data Ownership** | **100% yours** (local file) | Vendor-controlled | Vendor-controlled |
| **Internet Required** | **No** | No (usually) | **Yes** |
| **Arabic Support** | **Full** (RTL UI, Arabic charts) | Rare | Limited / none |
| **Windows + macOS** | **Both** | Usually Windows-only | Web-based |
| **Chart of Accounts** | **Full double-entry** (seeded) | Premium add-on | Not included |
| **Audit Trail** | **Built-in** with undo/redo | Premium add-on | Limited |
| **Journal Entries**| **Full support** | Separate module | Not available |
| **Inventory** | Real-time, multi-tier pricing | Extra cost | Basic |
| **Updates** | **Automatic** (GitHub) | Paid upgrades | Automatic |
| **Customizable** | **Full source code** | Closed | Closed |
| **Data Privacy** | **100% local** | On-premise option | Stored on vendor servers |

**Bottom line:** This POS gives you everything an enterprise system offers — without monthly fees, without internet dependency, and with complete data privacy.

---

## Tech Stack

<div align="center">

| Layer | Technology |
|-------|-----------|
| **Desktop Shell** | Electron 28 |
| **Frontend** | React 18 + Vite 5 |
| **State** | Zustand |
| **Database** | SQLite (better-sqlite3) |
| **Charts** | Recharts |
| **i18n** | i18next (Arabic + English) |
| **Build** | electron-builder |
| **Updates** | electron-updater (GitHub Releases) |
| **Barcode** | JsBarcode |

</div>

---

## Download

Get the latest installer for your platform from the [Releases page](https://github.com/AbdulrhmanMohamed/POS/releases).

| Platform | File |
|----------|------|
| **Windows** | `POS-System-Setup-x.x.x.exe` |
| **macOS** | `POS-System-x.x.x.dmg` |

Your app will **automatically update** when a new version is released — just restart when prompted.

---

## Getting Started (Development)

```bash
# Clone
git clone https://github.com/AbdulrhmanMohamed/POS.git
cd POS

# Install
npm install

# Run in dev mode
npm run dev     # Vite dev server
npm run electron  # Launch Electron

# Build for production
npm run build     # Build frontend
npm run dist:mac  # macOS installer
npm run dist:win  # Windows installer
```

---

## Screenshots

> _Coming soon — add images to a `screenshots/` directory and reference them here._

| | |
|---|---|
| Point of Sale | Products |
| _Lightning-fast checkout_ | _Full inventory management_ |
| Chart of Accounts | Reports |
| _Double-entry accounting_ | _Business intelligence_ |

---

## Usage

### Quick Start
1. Download and install the app
2. Launch — database is created automatically with seed data
3. Start selling: search products by barcode or name
4. Track everything: reports, inventory, accounting

### Keyboard Shortcuts
- `F1` — Quick search
- `F2` — New invoice
- `F12` — Open cash register

---

## Roadmap

- [x] Point of Sale core
- [x] Inventory management
- [x] Chart of Accounts + double-entry
- [x] Reports & BI
- [x] Audit log with undo/redo
- [x] Auto-update via GitHub
- [x] Cross-platform (Windows + macOS)
- [ ] Customer loyalty program
- [ ] Multi-store support
- [ ] Cloud sync (optional)
- [ ] Touchscreen-optimized POS mode
- [ ] API for e-commerce integration

---

## License

Distributed under the MIT License. See `LICENSE` for more information.

---

## Support

- Issues: [GitHub Issues](https://github.com/AbdulrhmanMohamed/POS/issues)
- Email: _your-email@example.com_

---

<div align="center">
  <sub>Built with ❤️ for the Arabic market</sub>
</div>
