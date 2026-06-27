import Database from 'better-sqlite3';
import { IDatabaseAdapter } from './IDatabaseAdapter.js';

export class SQLiteAdapter extends IDatabaseAdapter {
  constructor(config) {
    super();
    this.config = config;
    this.db = null;
  }

  async initialize() {
    this.db = new Database(this.config.dbPath || ':memory:');

    this.db.pragma('journal_mode = WAL');
    this.db.pragma('foreign_keys = ON');

    this._createTables();
    this._seedAllData();
    console.log('✅ SQLite Database initialized with seed data');
    return this;
  }

  _createTables() {
    const queries = [
      `CREATE TABLE IF NOT EXISTS settings (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        "key" TEXT UNIQUE NOT NULL,
        value TEXT,
        created_at TEXT DEFAULT (datetime('now'))
      )`,
      `CREATE TABLE IF NOT EXISTS products (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        barcode TEXT UNIQUE,
        price REAL NOT NULL DEFAULT 0,
        cost REAL NOT NULL DEFAULT 0,
        stock INTEGER NOT NULL DEFAULT 0,
        min_stock INTEGER NOT NULL DEFAULT 0,
        category TEXT,
        unit TEXT DEFAULT 'piece',
        supplier_id INTEGER DEFAULT NULL,
        image TEXT,
        created_at TEXT DEFAULT (datetime('now')),
        updated_at TEXT DEFAULT (datetime('now'))
      )`,
      `CREATE TABLE IF NOT EXISTS customers (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        phone TEXT,
        email TEXT,
        address TEXT,
        balance REAL NOT NULL DEFAULT 0,
        credit_limit REAL NOT NULL DEFAULT 0,
        notes TEXT,
        created_at TEXT DEFAULT (datetime('now')),
        updated_at TEXT DEFAULT (datetime('now'))
      )`,
      `CREATE TABLE IF NOT EXISTS suppliers (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        phone TEXT,
        email TEXT,
        address TEXT,
        balance REAL NOT NULL DEFAULT 0,
        notes TEXT,
        created_at TEXT DEFAULT (datetime('now')),
        updated_at TEXT DEFAULT (datetime('now'))
      )`,
      `CREATE TABLE IF NOT EXISTS invoices (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        invoice_number TEXT UNIQUE NOT NULL,
        customer_id INTEGER,
        subtotal REAL NOT NULL DEFAULT 0,
        discount REAL NOT NULL DEFAULT 0,
        total REAL NOT NULL DEFAULT 0,
        paid REAL NOT NULL DEFAULT 0,
        due REAL NOT NULL DEFAULT 0,
        status TEXT DEFAULT 'completed',
        notes TEXT,
        created_at TEXT DEFAULT (datetime('now')),
        FOREIGN KEY (customer_id) REFERENCES customers(id)
      )`,
      `CREATE TABLE IF NOT EXISTS invoice_items (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        invoice_id INTEGER NOT NULL,
        product_id INTEGER NOT NULL,
        product_name TEXT NOT NULL,
        barcode TEXT,
        quantity INTEGER NOT NULL,
        unit_price REAL NOT NULL,
        unit_cost REAL DEFAULT 0,
        total_price REAL NOT NULL,
        created_at TEXT DEFAULT (datetime('now')),
        FOREIGN KEY (invoice_id) REFERENCES invoices(id) ON DELETE CASCADE,
        FOREIGN KEY (product_id) REFERENCES products(id)
      )`,
      `CREATE TABLE IF NOT EXISTS inventory (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        product_id INTEGER NOT NULL,
        type TEXT NOT NULL,
        quantity INTEGER NOT NULL,
        balance_before INTEGER NOT NULL,
        balance_after INTEGER NOT NULL,
        notes TEXT,
        status TEXT DEFAULT 'available',
        created_at TEXT DEFAULT (datetime('now')),
        FOREIGN KEY (product_id) REFERENCES products(id)
      )`,
      `CREATE TABLE IF NOT EXISTS cash_registers (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        opening_balance REAL NOT NULL DEFAULT 0,
        closing_balance REAL,
        opened_at TEXT DEFAULT (datetime('now')),
        closed_at TEXT,
        status TEXT DEFAULT 'open',
        notes TEXT
      )`,
      `CREATE TABLE IF NOT EXISTS cashier_movements (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        register_id INTEGER NOT NULL,
        type TEXT NOT NULL CHECK(type IN ('in', 'out')),
        amount REAL NOT NULL,
        reason TEXT,
        created_at TEXT DEFAULT (datetime('now')),
        FOREIGN KEY (register_id) REFERENCES cash_registers(id) ON DELETE CASCADE
      )`,
      `CREATE TABLE IF NOT EXISTS price_tiers (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        product_id INTEGER NOT NULL,
        tier_name TEXT NOT NULL,
        price REAL NOT NULL,
        created_at TEXT DEFAULT (datetime('now')),
        FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
      )`,
      `CREATE TABLE IF NOT EXISTS bulk_discounts (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        product_id INTEGER NOT NULL,
        min_quantity INTEGER NOT NULL,
        discount_percent REAL NOT NULL,
        created_at TEXT DEFAULT (datetime('now')),
        FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
      )`,
      `CREATE TABLE IF NOT EXISTS promo_periods (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        product_id INTEGER NOT NULL,
        promo_price REAL NOT NULL,
        start_date TEXT NOT NULL,
        end_date TEXT NOT NULL,
        created_at TEXT DEFAULT (datetime('now')),
        FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
      )`,
      `CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT UNIQUE NOT NULL,
        password TEXT NOT NULL,
        role TEXT NOT NULL DEFAULT 'cashier' CHECK(role IN ('admin', 'cashier')),
        created_at TEXT DEFAULT (datetime('now'))
      )`,
      `CREATE TABLE IF NOT EXISTS audit_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER,
        action TEXT NOT NULL,
        entity_type TEXT NOT NULL,
        entity_id INTEGER,
        old_value TEXT,
        new_value TEXT,
        created_at TEXT DEFAULT (datetime('now'))
      )`,
      `CREATE TABLE IF NOT EXISTS purchase_orders (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        po_number TEXT UNIQUE NOT NULL,
        supplier_id INTEGER NOT NULL,
        subtotal REAL NOT NULL DEFAULT 0,
        total REAL NOT NULL DEFAULT 0,
        status TEXT DEFAULT 'pending',
        notes TEXT,
        received_at TEXT,
        created_at TEXT DEFAULT (datetime('now')),
        FOREIGN KEY (supplier_id) REFERENCES suppliers(id)
      )`,
      `CREATE TABLE IF NOT EXISTS purchase_order_items (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        purchase_order_id INTEGER NOT NULL,
        product_id INTEGER NOT NULL,
        product_name TEXT NOT NULL,
        quantity INTEGER NOT NULL,
        unit_price REAL NOT NULL,
        total_price REAL NOT NULL,
        FOREIGN KEY (purchase_order_id) REFERENCES purchase_orders(id) ON DELETE CASCADE,
        FOREIGN KEY (product_id) REFERENCES products(id)
      )`,
      `CREATE TABLE IF NOT EXISTS returns (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        return_number TEXT UNIQUE NOT NULL,
        invoice_id INTEGER NOT NULL,
        customer_id INTEGER,
        total REAL NOT NULL DEFAULT 0,
        reason TEXT,
        status TEXT DEFAULT 'completed',
        created_at TEXT DEFAULT (datetime('now')),
        FOREIGN KEY (invoice_id) REFERENCES invoices(id),
        FOREIGN KEY (customer_id) REFERENCES customers(id)
      )`,
      `CREATE TABLE IF NOT EXISTS return_items (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        return_id INTEGER NOT NULL,
        product_id INTEGER NOT NULL,
        product_name TEXT NOT NULL,
        quantity INTEGER NOT NULL,
        unit_price REAL NOT NULL,
        total_price REAL NOT NULL,
        FOREIGN KEY (return_id) REFERENCES returns(id) ON DELETE CASCADE,
        FOREIGN KEY (product_id) REFERENCES products(id)
      )`,
      `CREATE TABLE IF NOT EXISTS supplier_payments (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        supplier_id INTEGER NOT NULL,
        amount REAL NOT NULL,
        payment_method TEXT DEFAULT 'cash',
        date TEXT DEFAULT (date('now')),
        notes TEXT,
        created_at TEXT DEFAULT (datetime('now')),
        FOREIGN KEY (supplier_id) REFERENCES suppliers(id) ON DELETE CASCADE
      )`,
      `CREATE TABLE IF NOT EXISTS customer_payments (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        customer_id INTEGER NOT NULL,
        amount REAL NOT NULL,
        payment_method TEXT DEFAULT 'cash',
        date TEXT DEFAULT (date('now')),
        notes TEXT,
        created_at TEXT DEFAULT (datetime('now')),
        FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE CASCADE
      )`,
      `CREATE TABLE IF NOT EXISTS workers (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        phone TEXT,
        position TEXT,
        salary REAL DEFAULT 0,
        is_active INTEGER DEFAULT 1,
        created_at TEXT DEFAULT (datetime('now')),
        updated_at TEXT DEFAULT (datetime('now'))
      )`,
      `CREATE TABLE IF NOT EXISTS worker_payments (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        worker_id INTEGER NOT NULL,
        amount REAL NOT NULL,
        month TEXT NOT NULL,
        notes TEXT,
        created_at TEXT DEFAULT (datetime('now')),
        FOREIGN KEY (worker_id) REFERENCES workers(id) ON DELETE CASCADE
      )`,
      `CREATE TABLE IF NOT EXISTS expenses (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        category TEXT NOT NULL,
        amount REAL NOT NULL,
        description TEXT,
        date TEXT DEFAULT (date('now')),
        created_at TEXT DEFAULT (datetime('now'))
      )`,
      `CREATE TABLE IF NOT EXISTS exchanges (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        exchange_number TEXT NOT NULL,
        invoice_id INTEGER NOT NULL,
        customer_id INTEGER,
        total_returned REAL DEFAULT 0,
        total_replacement REAL DEFAULT 0,
        difference REAL DEFAULT 0,
        reason TEXT,
        status TEXT DEFAULT 'completed',
        created_at TEXT DEFAULT (datetime('now')),
        FOREIGN KEY (invoice_id) REFERENCES invoices(id) ON DELETE CASCADE
      )`,
      `CREATE TABLE IF NOT EXISTS exchange_items (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        exchange_id INTEGER NOT NULL,
        product_id INTEGER NOT NULL,
        quantity INTEGER NOT NULL,
        unit_price REAL NOT NULL,
        total REAL NOT NULL,
        type TEXT NOT NULL CHECK(type IN ('returned', 'replacement')),
        FOREIGN KEY (exchange_id) REFERENCES exchanges(id) ON DELETE CASCADE
      )`,
    ];

    const createStmt = this.db.transaction(() => {
      for (const sql of queries) {
        this.db.exec(sql);
      }
    });
    createStmt();
  }

  _seedAllData() {
    this._seedSettings();
    this._seedUsers();
    this._seedSuppliers();
    this._seedProducts();
    this._seedCustomers();
    this._seedPurchaseOrders();
    this._seedInvoices();
    this._seedReturns();
    this._seedCashRegister();
    this._seedInventory();
    this._seedExpenses();
    this._seedWorkers();
    this._seedPayments();
  }

  _deleteAll() {
    const tables = [
      'exchange_items', 'exchanges',
      'return_items', 'returns',
      'invoice_items', 'invoices',
      'purchase_order_items', 'purchase_orders',
      'cashier_movements', 'cash_registers',
      'inventory',
      'price_tiers', 'bulk_discounts', 'promo_periods',
      'worker_payments', 'workers',
      'expenses',
      'supplier_payments', 'customer_payments',
      'audit_logs',
      'products',
      'customers', 'suppliers',
      'settings',
    ];
    for (const t of tables) {
      try { this.db.exec(`DELETE FROM "${t}"`); } catch {}
    }
  }

  reseed() {
    this._deleteAll();
    this._seedAllData();
  }

  _seedSettings() {
    const stmt = this.db.prepare('INSERT OR IGNORE INTO settings ("key", value) VALUES (?, ?)');
    for (const [k, v] of [['language','ar'],['theme','light'],['currency','SAR'],['currency_symbol','ر.س'],['company_name','متجر النور'],['company_phone','0551234567'],['company_address','الرياض'],['tax_rate','15'],['invoice_prefix','INV']]) {
      stmt.run(k, v);
    }
  }

  _seedUsers() {
    this.db.prepare('INSERT OR IGNORE INTO users (username, password, role) VALUES (?, ?, ?)').run('adminUser', 'admin123', 'admin');
  }

  _seedSuppliers() {
    this.db.prepare('INSERT OR IGNORE INTO suppliers (name, phone, email, address, balance, notes) VALUES (?, ?, ?, ?, ?, ?)')
      .run('المورد الأساسي', '0112345678', 'info@supplier.com', 'الرياض', 0, 'مورد رئيسي');
    this.db.prepare('INSERT OR IGNORE INTO suppliers (name, phone, email, address, balance, notes) VALUES (?, ?, ?, ?, ?, ?)')
      .run('مورد الفواكه والخضروات', '0118765432', 'fruit@supplier.com', 'الرياض سوق الجملة', 0, 'فواكه وخضروات طازجة');
  }

  _seedProducts() {
    const sup1 = this.db.prepare('SELECT id FROM suppliers ORDER BY id LIMIT 1').get();
    const sup2 = this.db.prepare('SELECT id FROM suppliers ORDER BY id DESC LIMIT 1').get();

    const stmt = this.db.prepare('INSERT OR IGNORE INTO products (name, barcode, price, cost, stock, min_stock, category, unit, supplier_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)');
    for (const p of [
      ['منتج أ', '10000001', 10, 5, 100, 10, 'فئة أ', 'piece', sup1.id],
      ['منتج ب', '10000002', 20, 12, 50, 5, 'فئة أ', 'piece', sup1.id],
      ['منتج ج', '10000003', 5, 2, 200, 30, 'فئة أ', 'piece', sup1.id],
      ['منتج د', '10000004', 50, 30, 10, 3, 'فئة أ', 'piece', sup1.id],
      ['تفاح أحمر', '20000001', 8, 4, 80, 20, 'فواكه', 'kg', sup2.id],
      ['موز', '20000002', 6, 3, 60, 15, 'فواكه', 'kg', sup2.id],
      ['برتقال', '20000003', 5, 2.5, 100, 25, 'فواكه', 'kg', sup2.id],
      ['طماطم', '20000004', 4, 2, 90, 20, 'خضروات', 'kg', sup2.id],
      ['خيار', '20000005', 3, 1.5, 70, 15, 'خضروات', 'kg', sup2.id],
    ]) {
      stmt.run(...p);
    }
  }

  _seedCustomers() {
    this.db.prepare('INSERT OR IGNORE INTO customers (name, phone, email, address, balance, credit_limit, notes) VALUES (?, ?, ?, ?, ?, ?, ?)')
      .run('أحمد', '0551111111', 'ahmed@test.com', 'الرياض', 0, 5000, '');
    this.db.prepare('INSERT OR IGNORE INTO customers (name, phone, email, address, balance, credit_limit, notes) VALUES (?, ?, ?, ?, ?, ?, ?)')
      .run('فاطمة', '0552222222', 'fatima@test.com', 'الرياض', 200, 3000, '');
  }

  _seedPurchaseOrders() {
    const sup1 = this.db.prepare('SELECT id FROM suppliers ORDER BY id LIMIT 1').get();
    const prods = this.db.prepare("SELECT id, name, cost FROM products WHERE barcode IN ('10000001','10000002') ORDER BY barcode").all();

    this.db.prepare("INSERT OR IGNORE INTO purchase_orders (po_number, supplier_id, subtotal, total, status, notes, created_at) VALUES (?, ?, ?, ?, ?, ?, datetime('now', '-10 days'))")
      .run('PO-001', sup1.id, 110, 110, 'received', 'بضائع متنوعة');
    const po1 = this.db.prepare('SELECT id FROM purchase_orders ORDER BY id DESC LIMIT 1').get();

    this.db.prepare('INSERT OR IGNORE INTO purchase_order_items (purchase_order_id, product_id, product_name, quantity, unit_price, total_price) VALUES (?, ?, ?, ?, ?, ?)')
      .run(po1.id, prods[0].id, prods[0].name, 10, prods[0].cost, 10 * prods[0].cost);
    this.db.prepare('INSERT OR IGNORE INTO purchase_order_items (purchase_order_id, product_id, product_name, quantity, unit_price, total_price) VALUES (?, ?, ?, ?, ?, ?)')
      .run(po1.id, prods[1].id, prods[1].name, 5, prods[1].cost, 5 * prods[1].cost);
  }

  _seedInvoices() {
    const cust = this.db.prepare('SELECT id FROM customers ORDER BY id LIMIT 1').get();
    const prods = this.db.prepare("SELECT id, name, barcode, price, cost FROM products WHERE barcode IN ('10000001','10000003','10000002') ORDER BY barcode").all();

    const now = new Date();
    const total1 = Number(prods[0].price) * 3 + Number(prods[1].price) * 6;

    this.db.prepare('INSERT OR IGNORE INTO invoices (invoice_number, customer_id, subtotal, total, paid, status, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)')
      .run('INV-1000', cust.id, total1, total1, total1, 'completed', new Date(now.getTime() - 5 * 86400000).toISOString());
    const inv1 = this.db.prepare('SELECT id FROM invoices ORDER BY id DESC LIMIT 1').get();

    this.db.prepare('INSERT OR IGNORE INTO invoice_items (invoice_id, product_id, product_name, barcode, quantity, unit_price, unit_cost, total_price) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
      .run(inv1.id, prods[0].id, prods[0].name, prods[0].barcode, 3, prods[0].price, prods[0].cost, 3 * Number(prods[0].price));
    this.db.prepare('INSERT OR IGNORE INTO invoice_items (invoice_id, product_id, product_name, barcode, quantity, unit_price, unit_cost, total_price) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
      .run(inv1.id, prods[1].id, prods[1].name, prods[1].barcode, 6, prods[1].price, prods[1].cost, 6 * Number(prods[1].price));

    this.db.prepare('UPDATE products SET stock = stock - 3 WHERE id = ?').run(prods[0].id);
    this.db.prepare('UPDATE products SET stock = stock - 6 WHERE id = ?').run(prods[1].id);
    this.db.prepare('UPDATE customers SET balance = balance + ? WHERE id = ?').run(total1, cust.id);

    this.db.prepare("INSERT OR IGNORE INTO invoices (invoice_number, subtotal, total, paid, status, created_at) VALUES (?, ?, ?, ?, ?, ?)")
      .run('INV-1001', Number(prods[2].price), Number(prods[2].price), Number(prods[2].price), 'completed', new Date(now.getTime() - 2 * 86400000).toISOString());
    const inv2 = this.db.prepare('SELECT id FROM invoices ORDER BY id DESC LIMIT 1').get();

    this.db.prepare('INSERT OR IGNORE INTO invoice_items (invoice_id, product_id, product_name, barcode, quantity, unit_price, unit_cost, total_price) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
      .run(inv2.id, prods[2].id, prods[2].name, prods[2].barcode, 1, prods[2].price, prods[2].cost, Number(prods[2].price));

    this.db.prepare('UPDATE products SET stock = stock - 1 WHERE id = ?').run(prods[2].id);
  }

  _seedReturns() {
    try {
      const inv = this.db.prepare('SELECT id FROM invoices ORDER BY id LIMIT 1').get();
      const items = this.db.prepare('SELECT * FROM invoice_items WHERE invoice_id = ? LIMIT 1').all(inv.id);
      if (items.length > 0) {
        const amt = Number(items[0].total_price);
        this.db.prepare('INSERT OR IGNORE INTO returns (return_number, invoice_id, reason, total, status) VALUES (?, ?, ?, ?, ?)')
          .run('RET-1000', inv.id, 'تلف في المنتج', amt, 'completed');
        const ret = this.db.prepare('SELECT MAX(id) as id FROM returns').get();
        this.db.prepare('INSERT OR IGNORE INTO return_items (return_id, product_id, product_name, quantity, unit_price, total_price) VALUES (?, ?, ?, ?, ?, ?)')
          .run(ret.id, items[0].product_id, items[0].product_name, items[0].quantity, items[0].unit_price, amt);
      }
    } catch {}
  }

  _seedCashRegister() {
    try {
      this.db.prepare("INSERT OR IGNORE INTO cash_registers (opening_balance, status, opened_at) VALUES (?, ?, datetime('now'))").run(500, 'open');
      const reg = this.db.prepare('SELECT MAX(id) as id FROM cash_registers').get();
      const invoices = this.db.prepare('SELECT id, total FROM invoices').all();
      for (const inv of invoices) {
        this.db.prepare('INSERT OR IGNORE INTO cashier_movements (register_id, type, amount, reason) VALUES (?, ?, ?, ?)')
          .run(reg.id, 'in', Number(inv.total), 'فاتورة');
      }
      this.db.prepare('INSERT OR IGNORE INTO cashier_movements (register_id, type, amount, reason) VALUES (?, ?, ?, ?)')
        .run(reg.id, 'out', 100, 'مصروف');
    } catch {}
  }

  _seedInventory() {
    try {
      const prod = this.db.prepare("SELECT id FROM products WHERE barcode = '10000001'").get();
      const po = this.db.prepare('SELECT id FROM purchase_orders ORDER BY id LIMIT 1').get();
      if (po) {
        this.db.prepare('INSERT OR IGNORE INTO inventory (product_id, type, quantity, balance_before, balance_after, notes) VALUES (?, ?, ?, ?, ?, ?)')
          .run(prod.id, 'purchase', 10, 0, 10, 'شراء PO-001');
      }
    } catch {}
  }

  _seedExpenses() {
    try {
      this.db.prepare('INSERT OR IGNORE INTO expenses (category, amount, description, date) VALUES (?, ?, ?, ?)')
        .run('إيجار', 1500, 'إيجار المحل', new Date().toISOString().slice(0, 10));
    } catch {}
  }

  _seedWorkers() {
    try {
      this.db.prepare('INSERT OR IGNORE INTO workers (name, phone, position, salary, is_active) VALUES (?, ?, ?, ?, ?)')
        .run('موظف 1', '0560000000', 'كاشير', 2000, true);
      const w = this.db.prepare('SELECT MAX(id) as id FROM workers').get();
      this.db.prepare('INSERT OR IGNORE INTO worker_payments (worker_id, amount, month, notes) VALUES (?, ?, ?, ?)')
        .run(w.id, 2000, '2026-05', 'راتب');
    } catch {}
  }

  _seedPayments() {
    try {
      const sup1 = this.db.prepare('SELECT id FROM suppliers ORDER BY id LIMIT 1').get();
      this.db.prepare('INSERT OR IGNORE INTO supplier_payments (supplier_id, amount, payment_method, notes) VALUES (?, ?, ?, ?)')
        .run(sup1.id, 500, 'bank', 'دفعة');
      const cust = this.db.prepare('SELECT id FROM customers ORDER BY id LIMIT 1').get();
      this.db.prepare('INSERT OR IGNORE INTO customer_payments (customer_id, amount, payment_method, notes) VALUES (?, ?, ?, ?)')
        .run(cust.id, 100, 'cash', 'دفعة');
    } catch {}
  }

  query(sql, params = []) {
    const stmt = this.db.prepare(sql);
    return stmt.all(...params);
  }

  run(sql, params = []) {
    const stmt = this.db.prepare(sql);
    const result = stmt.run(...params);
    return { lastInsertRowid: result.lastInsertRowid, changes: result.changes };
  }

  get(sql, params = []) {
    const stmt = this.db.prepare(sql);
    return stmt.get(...params) || null;
  }

  all(sql, params = []) {
    const stmt = this.db.prepare(sql);
    return stmt.all(...params);
  }

  transaction(callback) {
    const transaction = this.db.transaction(callback);
    return transaction();
  }

  close() {
    if (this.db) {
      this.db.close();
    }
  }
}
