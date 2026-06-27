import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const db = new Database(path.join(__dirname, 'database.db'));

db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

function main() {
  const tables = [
    'exchange_items','exchanges','return_items','returns',
    'invoice_items','invoices','purchase_order_items','purchase_orders',
    'cashier_movements','cash_registers','inventory',
    'product_variants','price_tiers','bulk_discounts','promo_periods',
    'worker_payments','workers','expenses',
    'supplier_payments','customer_payments','audit_logs',
    'products','customers','suppliers','settings',
  ];
  for (const t of tables) {
    try { db.exec(`DELETE FROM "${t}"`); } catch {}
  }

  // settings
  for (const [k,v] of [['language','ar'],['theme','light'],['currency','SAR'],['currency_symbol','ر.س'],['company_name','متجر النور'],['company_phone','0551234567'],['company_address','الرياض'],['tax_rate','15'],['invoice_prefix','INV']]) {
    db.prepare('INSERT OR IGNORE INTO settings ("key", value) VALUES (?, ?)').run(k, v);
  }

  // users
  db.prepare('INSERT OR IGNORE INTO users (username, password, role) VALUES (?, ?, ?)').run('adminUser', 'admin123', 'admin');

  // suppliers
  db.prepare('INSERT OR IGNORE INTO suppliers (name, phone, email, address, balance, notes) VALUES (?, ?, ?, ?, ?, ?)').run('المورد الأساسي', '0112345678', 'info@supplier.com', 'الرياض', 0, 'مورد رئيسي');
  db.prepare('INSERT OR IGNORE INTO suppliers (name, phone, email, address, balance, notes) VALUES (?, ?, ?, ?, ?, ?)').run('مورد الفواكه والخضروات', '0118765432', 'fruit@supplier.com', 'الرياض سوق الجملة', 0, 'فواكه وخضروات طازجة');
  const sup1 = db.prepare('SELECT id FROM suppliers ORDER BY id LIMIT 1').get();
  const sup2 = db.prepare('SELECT id FROM suppliers ORDER BY id DESC LIMIT 1').get();

  // products
  const pStmt = db.prepare('INSERT OR IGNORE INTO products (name, barcode, price, cost, stock, min_stock, category, unit, supplier_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)');
  for (const p of [
    ['منتج أ','10000001',10,5,100,10,'فئة أ','piece',sup1.id],
    ['منتج ب','10000002',20,12,50,5,'فئة أ','piece',sup1.id],
    ['منتج ج','10000003',5,2,200,30,'فئة أ','piece',sup1.id],
    ['منتج د','10000004',50,30,10,3,'فئة أ','piece',sup1.id],
    ['تفاح أحمر','20000001',8,4,80,20,'فواكه','kg',sup2.id],
    ['موز','20000002',6,3,60,15,'فواكه','kg',sup2.id],
    ['برتقال','20000003',5,2.5,100,25,'فواكه','kg',sup2.id],
    ['طماطم','20000004',4,2,90,20,'خضروات','kg',sup2.id],
    ['خيار','20000005',3,1.5,70,15,'خضروات','kg',sup2.id],
  ]) { pStmt.run(...p); }

  const prodA = db.prepare("SELECT id,name,barcode,price,cost FROM products WHERE barcode='10000001'").get();
  const prodB = db.prepare("SELECT id,name,barcode,price,cost FROM products WHERE barcode='10000002'").get();
  const prodC = db.prepare("SELECT id,name,barcode,price,cost FROM products WHERE barcode='10000003'").get();

  // customers
  db.prepare('INSERT OR IGNORE INTO customers (name,phone,email,address,balance,credit_limit,notes) VALUES (?,?,?,?,?,?,?)').run('أحمد','0551111111','ahmed@test.com','الرياض',0,5000,'');
  db.prepare('INSERT OR IGNORE INTO customers (name,phone,email,address,balance,credit_limit,notes) VALUES (?,?,?,?,?,?,?)').run('فاطمة','0552222222','fatima@test.com','الرياض',200,3000,'');
  const cust1 = db.prepare('SELECT id FROM customers ORDER BY id LIMIT 1').get();

  // PO
  db.prepare("INSERT OR IGNORE INTO purchase_orders (po_number,supplier_id,subtotal,total,status,notes,created_at) VALUES (?,?,?,?,?,?,datetime('now','-10 days'))").run('PO-001',sup1.id,110,110,'received','بضائع متنوعة');
  const po1 = db.prepare('SELECT id FROM purchase_orders ORDER BY id DESC LIMIT 1').get();
  db.prepare('INSERT OR IGNORE INTO purchase_order_items (purchase_order_id,product_id,product_name,quantity,unit_price,total_price) VALUES (?,?,?,?,?,?)').run(po1.id,prodA.id,prodA.name,10,prodA.cost,10*prodA.cost);
  db.prepare('INSERT OR IGNORE INTO purchase_order_items (purchase_order_id,product_id,product_name,quantity,unit_price,total_price) VALUES (?,?,?,?,?,?)').run(po1.id,prodB.id,prodB.name,5,prodB.cost,5*prodB.cost);

  // invoices
  const t1 = Number(prodA.price)*3 + Number(prodC.price)*6;
  db.prepare("INSERT OR IGNORE INTO invoices (invoice_number,customer_id,subtotal,total,paid,status,created_at) VALUES (?,?,?,?,?,?,datetime('now','-5 days'))").run('INV-1000',cust1.id,t1,t1,t1,'completed');
  const inv1 = db.prepare('SELECT id FROM invoices ORDER BY id DESC LIMIT 1').get();
  db.prepare('INSERT OR IGNORE INTO invoice_items (invoice_id,product_id,product_name,barcode,quantity,unit_price,unit_cost,total_price) VALUES (?,?,?,?,?,?,?,?)').run(inv1.id,prodA.id,prodA.name,prodA.barcode,3,prodA.price,prodA.cost,3*Number(prodA.price));
  db.prepare('INSERT OR IGNORE INTO invoice_items (invoice_id,product_id,product_name,barcode,quantity,unit_price,unit_cost,total_price) VALUES (?,?,?,?,?,?,?,?)').run(inv1.id,prodC.id,prodC.name,prodC.barcode,6,prodC.price,prodC.cost,6*Number(prodC.price));
  db.prepare('UPDATE products SET stock = MAX(stock-3,0) WHERE id = ?').run(prodA.id);
  db.prepare('UPDATE products SET stock = MAX(stock-6,0) WHERE id = ?').run(prodC.id);

  db.prepare("INSERT OR IGNORE INTO invoices (invoice_number,subtotal,total,paid,status,created_at) VALUES (?,?,?,?,?,datetime('now','-2 days'))").run('INV-1001',Number(prodB.price),Number(prodB.price),Number(prodB.price),'completed');
  const inv2 = db.prepare('SELECT id FROM invoices ORDER BY id DESC LIMIT 1').get();
  db.prepare('INSERT OR IGNORE INTO invoice_items (invoice_id,product_id,product_name,barcode,quantity,unit_price,unit_cost,total_price) VALUES (?,?,?,?,?,?,?,?)').run(inv2.id,prodB.id,prodB.name,prodB.barcode,1,prodB.price,prodB.cost,Number(prodB.price));
  db.prepare('UPDATE products SET stock = MAX(stock-1,0) WHERE id = ?').run(prodB.id);

  // return
  const rows = db.prepare('SELECT * FROM invoice_items WHERE invoice_id = ? LIMIT 1').all(inv1.id);
  if (rows.length) {
    const amt = Number(rows[0].total_price);
    db.prepare('INSERT OR IGNORE INTO returns (return_number,invoice_id,reason,total,status) VALUES (?,?,?,?,?)').run('RET-1000',inv1.id,'تلف',amt,'completed');
    const ret = db.prepare('SELECT id FROM returns ORDER BY id DESC LIMIT 1').get();
    db.prepare('INSERT OR IGNORE INTO return_items (return_id,product_id,product_name,quantity,unit_price,total_price) VALUES (?,?,?,?,?,?)').run(ret.id,rows[0].product_id,rows[0].product_name,rows[0].quantity,rows[0].unit_price,amt);
  }

  // cash register
  db.prepare("INSERT OR IGNORE INTO cash_registers (opening_balance,status,opened_at) VALUES (?,?,datetime('now'))").run(500,'open');
  const reg = db.prepare('SELECT id FROM cash_registers ORDER BY id DESC LIMIT 1').get();
  const invRows = db.prepare('SELECT id,total FROM invoices').all();
  for (const inv of invRows) {
    db.prepare('INSERT OR IGNORE INTO cashier_movements (register_id,type,amount,reason) VALUES (?,?,?,?)').run(reg.id,'in',Number(inv.total),'فاتورة');
  }
  db.prepare('INSERT OR IGNORE INTO cashier_movements (register_id,type,amount,reason) VALUES (?,?,?,?)').run(reg.id,'out',100,'مصروف');

  // inventory
  db.prepare('INSERT OR IGNORE INTO inventory (product_id,type,quantity,balance_before,balance_after,notes) VALUES (?,?,?,?,?,?)').run(prodA.id,'purchase',10,0,10,'شراء PO-001');

  // expense
  db.prepare('INSERT OR IGNORE INTO expenses (category,amount,description,date) VALUES (?,?,?,?)').run('إيجار',1500,'إيجار المحل',new Date().toISOString().slice(0,10));

  // worker
  db.prepare('INSERT OR IGNORE INTO workers (name,phone,position,salary,is_active) VALUES (?,?,?,?,?)').run('موظف 1','0560000000','كاشير',2000,true);
  const w = db.prepare('SELECT id FROM workers ORDER BY id DESC LIMIT 1').get();
  db.prepare('INSERT OR IGNORE INTO worker_payments (worker_id,amount,month,notes) VALUES (?,?,?,?)').run(w.id,2000,'2026-05','راتب');

  // payments
  db.prepare('INSERT OR IGNORE INTO supplier_payments (supplier_id,amount,payment_method,notes) VALUES (?,?,?,?)').run(sup1.id,500,'bank','دفعة');
  db.prepare('INSERT OR IGNORE INTO customer_payments (customer_id,amount,payment_method,notes) VALUES (?,?,?,?)').run(cust1.id,100,'cash','دفعة');

  db.close();
  console.log('Reseed complete — 2 suppliers, 9 products (incl. fruits & veg), fully linked.');
}

main();
