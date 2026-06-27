async function q(sql, params) {
  return window.electronAPI?.db.run(sql, params);
}
async function q1(sql, params) {
  return window.electronAPI?.db.get(sql, params);
}
async function qAll(sql, params) {
  return window.electronAPI?.db.all(sql, params);
}

export async function seedDatabase() {
  if (!window.electronAPI?.db) return;

  // ═══════════════════════════════════════
  //  الإعدادات Settings
  // ═══════════════════════════════════════
  const settings = [
    ['language', 'ar'],
    ['theme', 'light'],
    ['currency', 'SAR'],
    ['currency_symbol', 'ر.س'],
    ['company_name', 'متجر النور'],
    ['company_phone', '0551234567'],
    ['company_address', 'الرياض - حي النور - شارع الملك عبدالله'],
    ['company_email', 'info@alnoor-store.com'],
    ['tax_rate', '15'],
    ['invoice_prefix', 'INV'],
    ['default_discount', '0'],
    ['barcode_format', 'code128'],
    ['scanner_prefix', ''],
    ['scanner_suffix', ''],
  ];
  for (const [k, v] of settings) {
    await q('INSERT OR IGNORE INTO settings ("key", value) VALUES (?, ?)', [k, v]);
  }

  // ═══════════════════════════════════════
  //  المستخدمين Users
  // ═══════════════════════════════════════
  await q('INSERT OR IGNORE INTO users (username, password, role) VALUES (?, ?, ?)', ['adminUser', 'admin123', 'admin']);
  await q('INSERT OR IGNORE INTO users (username, password, role) VALUES (?, ?, ?)', ['cashier1', 'cash123', 'cashier']);

  // ═══════════════════════════════════════
  //  الموردين Suppliers
  // ═══════════════════════════════════════
  await q("INSERT OR IGNORE INTO suppliers (name, phone, email, address, balance, notes) VALUES (?, ?, ?, ?, ?, ?)",
    ['شركة الغذاء المتكامل', '0112345678', 'info@foodco.com', 'الرياض - المنطقة الصناعية', 1500, 'مورد رئيسي للمواد الغذائية']);
  await q("INSERT OR IGNORE INTO suppliers (name, phone, email, address, balance, notes) VALUES (?, ?, ?, ?, ?, ?)",
    ['مؤسسة الفواكه الطازجة', '0118765432', 'fruit@fresh.com', 'الرياض - سوق الجملة', 0, 'فواكه وخضروات طازجة يومياً']);
  await q("INSERT OR IGNORE INTO suppliers (name, phone, email, address, balance, notes) VALUES (?, ?, ?, ?, ?, ?)",
    ['شركة المشروبات الوطنية', '0115555555', 'info@national-drinks.com', 'جدة - شارع الصناعة', 800, 'مشروبات غازية وعصائر']);

  const supFood = await q1("SELECT id FROM suppliers WHERE name = 'شركة الغذاء المتكامل'");
  const supFruit = await q1("SELECT id FROM suppliers WHERE name = 'مؤسسة الفواكه الطازجة'");
  const supDrink = await q1("SELECT id FROM suppliers WHERE name = 'شركة المشروبات الوطنية'");

  // ═══════════════════════════════════════
  //  المنتجات Products (موزعة على الموردين)
  // ═══════════════════════════════════════
  const products = [
    // مورد الغذاء المتكامل - مواد جافة ومعلبات
    ['أرز بسمتي 5 كجم',    '10000001', 45,  32,  50,  10,  'مواد غذائية',     'piece', supFood.id],
    ['زيت طهي 1.5 لتر',    '10000002', 28,  19,  80,  15,  'مواد غذائية',     'piece', supFood.id],
    ['سكر أبيض 2 كجم',     '10000003', 18,  12,  100, 20,  'مواد غذائية',     'piece', supFood.id],
    ['دقيق قمح 1 كجم',     '10000004', 12,  8,   60,  10,  'مواد غذائية',     'piece', supFood.id],
    ['معلبة تونة 200 جم',  '10000005', 14,  9,   120, 20,  'معلبات',          'piece', supFood.id],
    ['معلبة فول 400 جم',   '10000006', 8,   5,   150, 30,  'معلبات',          'piece', supFood.id],
    ['صلصة طماطم 300 جم',  '10000007', 10,  6,   90,  15,  'معلبات',          'piece', supFood.id],
    ['مكرونة سباغيتي 500 جم', '10000008', 10, 6.5, 70, 10, 'مواد غذائية',     'piece', supFood.id],
    ['خل أبيض 1 لتر',      '10000009', 7,   4,   40,  5,   'مواد غذائية',     'piece', supFood.id],
    ['ملح طعام 1 كجم',     '10000010', 4,   2,   200, 30,  'مواد غذائية',     'piece', supFood.id],

    // مورد الفواكه الطازجة
    ['تفاح أحمر',          '20000001', 12,  7,   60,  15,  'فواكه',           'kg',    supFruit.id],
    ['تفاح أخضر',          '20000002', 13,  8,   45,  10,  'فواكه',           'kg',    supFruit.id],
    ['موز',                '20000003', 9,   5,   80,  20,  'فواكه',           'kg',    supFruit.id],
    ['برتقال',             '20000004', 7,   4,   100, 25,  'فواكه',           'kg',    supFruit.id],
    ['عنب أحمر',           '20000005', 15,  9,   30,  8,   'فواكه',           'kg',    supFruit.id],
    ['طماطم',              '20000006', 6,   3,   90,  20,  'خضروات',          'kg',    supFruit.id],
    ['خيار',               '20000007', 5,   2.5, 70,  15,  'خضروات',          'kg',    supFruit.id],
    ['بطاطس',              '20000008', 5,   2.5, 120, 25,  'خضروات',          'kg',    supFruit.id],
    ['بصل',                '20000009', 4,   2,   150, 30,  'خضروات',          'kg',    supFruit.id],
    ['ثوم',                '20000010', 10,  6,   40,  10,  'خضروات',          'kg',    supFruit.id],

    // مورد المشروبات الوطنية
    ['مياه معدنية 1.5 لتر',  '30000001', 3,  1.5, 500, 100, 'مشروبات',        'piece', supDrink.id],
    ['عصير برتقال 1 لتر',    '30000002', 12, 8,   60,  15,  'مشروبات',         'piece', supDrink.id],
    ['عصير مانجو 1 لتر',     '30000003', 14, 9,   45,  10,  'مشروبات',         'piece', supDrink.id],
    ['بيبسي كولا 330 مل',    '30000004', 3,  1.5, 300, 50,  'مشروبات غازية',   'piece', supDrink.id],
    ['شاي ليبتون 100 كيس',   '30000005', 18, 12,  35,  8,   'مشروبات ساخنة',  'piece', supDrink.id],
    ['قهوة سريعة التحضير 200 جم', '30000006', 25, 17, 25, 5, 'مشروبات ساخنة','piece',  supDrink.id],
    ['حليب طويل الأجل 1 لتر', '30000007', 10, 7,   40,  10,  'ألبان',          'piece', supDrink.id],
    ['زبادي 2 كجم',          '30000008', 22, 15,  20,  5,   'ألبان',          'piece', supDrink.id],
  ];

  for (const p of products) {
    await q(
      'INSERT OR IGNORE INTO products (name, barcode, price, cost, stock, min_stock, category, unit, supplier_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
      p
    );
  }

  // ═══════════════════════════════════════
  //  العملاء Customers
  // ═══════════════════════════════════════
  await q("INSERT OR IGNORE INTO customers (name, phone, email, address, balance, credit_limit, notes) VALUES (?, ?, ?, ?, ?, ?, ?)",
    ['أحمد الحربي', '0551111111', 'ahmed@example.com', 'الرياض - حي الملك فهد', 0, 5000, 'عميل منتظم']);
  await q("INSERT OR IGNORE INTO customers (name, phone, email, address, balance, credit_limit, notes) VALUES (?, ?, ?, ?, ?, ?, ?)",
    ['فاطمة الزهراني', '0552222222', 'fatima@example.com', 'الرياض - حي النزهة', 350, 3000, 'لديها رصيد سابق']);
  await q("INSERT OR IGNORE INTO customers (name, phone, email, address, balance, credit_limit, notes) VALUES (?, ?, ?, ?, ?, ?, ?)",
    ['محمد القحطاني', '0553333333', 'mohammed@example.com', 'الرياض - حي العليا', 0, 10000, 'عميل VIP']);

  const custAhmed = await q1("SELECT id FROM customers WHERE name = 'أحمد الحربي'");
  const custFatima = await q1("SELECT id FROM customers WHERE name = 'فاطمة الزهراني'");
  const custMohammed = await q1("SELECT id FROM customers WHERE name = 'محمد القحطاني'");

  // ═══════════════════════════════════════
  //  أوامر الشراء Purchase Orders
  // ═══════════════════════════════════════
  // PO 1 - مستلم (received)
  const prodRice = await q1("SELECT id, name, price, cost FROM products WHERE barcode = '10000001'");
  const prodOil = await q1("SELECT id, name, price, cost FROM products WHERE barcode = '10000002'");
  const prodSugar = await q1("SELECT id, name, price, cost FROM products WHERE barcode = '10000003'");
  const prodTuna = await q1("SELECT id, name, price, cost FROM products WHERE barcode = '10000005'");
  const prodApple = await q1("SELECT id, name, price, cost FROM products WHERE barcode = '20000001'");
  const prodBanana = await q1("SELECT id, name, price, cost FROM products WHERE barcode = '20000003'");
  const prodTomato = await q1("SELECT id, name, price, cost FROM products WHERE barcode = '20000006'");
  const prodWater = await q1("SELECT id, name, price, cost FROM products WHERE barcode = '30000001'");
  const prodPepsi = await q1("SELECT id, name, price, cost FROM products WHERE barcode = '30000004'");
  const prodTea = await q1("SELECT id, name, price, cost FROM products WHERE barcode = '30000005'");

  await q(
    "INSERT OR IGNORE INTO purchase_orders (po_number, supplier_id, subtotal, total, status, notes, created_at) VALUES (?, ?, ?, ?, ?, ?, datetime('now', '-15 days'))",
    ['PO-001', supFood.id, 785, 785, 'received', 'توريد مواد غذائية للمخزن']);
  const po1 = await q1('SELECT id FROM purchase_orders ORDER BY id DESC LIMIT 1');
  await q('INSERT OR IGNORE INTO purchase_order_items (purchase_order_id, product_id, product_name, quantity, unit_price, total_price) VALUES (?, ?, ?, ?, ?, ?)',
    [po1.id, prodRice.id, prodRice.name, 10, prodRice.cost, 10 * Number(prodRice.cost)]);
  await q('INSERT OR IGNORE INTO purchase_order_items (purchase_order_id, product_id, product_name, quantity, unit_price, total_price) VALUES (?, ?, ?, ?, ?, ?)',
    [po1.id, prodOil.id, prodOil.name, 15, prodOil.cost, 15 * Number(prodOil.cost)]);
  await q('INSERT OR IGNORE INTO purchase_order_items (purchase_order_id, product_id, product_name, quantity, unit_price, total_price) VALUES (?, ?, ?, ?, ?, ?)',
    [po1.id, prodSugar.id, prodSugar.name, 20, prodSugar.cost, 20 * Number(prodSugar.cost)]);
  await q('INSERT OR IGNORE INTO purchase_order_items (purchase_order_id, product_id, product_name, quantity, unit_price, total_price) VALUES (?, ?, ?, ?, ?, ?)',
    [po1.id, prodTuna.id, prodTuna.name, 30, prodTuna.cost, 30 * Number(prodTuna.cost)]);

  // PO 2 - مستلم (received) - فواكه
  await q(
    "INSERT OR IGNORE INTO purchase_orders (po_number, supplier_id, subtotal, total, status, notes, created_at) VALUES (?, ?, ?, ?, ?, ?, datetime('now', '-10 days'))",
    ['PO-002', supFruit.id, 535, 535, 'received', 'توريد فواكه وخضروات']);
  const po2 = await q1("SELECT id FROM purchase_orders WHERE po_number = 'PO-002'");
  if (!po2) {
    const allPos = await qAll('SELECT id, po_number FROM purchase_orders ORDER BY id');
    const po2row = allPos.length >= 2 ? allPos[1] : allPos[allPos.length - 1];
    await q('INSERT OR IGNORE INTO purchase_order_items (purchase_order_id, product_id, product_name, quantity, unit_price, total_price) VALUES (?, ?, ?, ?, ?, ?)',
      [po2row.id, prodApple.id, prodApple.name, 20, prodApple.cost, 20 * Number(prodApple.cost)]);
    await q('INSERT OR IGNORE INTO purchase_order_items (purchase_order_id, product_id, product_name, quantity, unit_price, total_price) VALUES (?, ?, ?, ?, ?, ?)',
      [po2row.id, prodBanana.id, prodBanana.name, 25, prodBanana.cost, 25 * Number(prodBanana.cost)]);
    await q('INSERT OR IGNORE INTO purchase_order_items (purchase_order_id, product_id, product_name, quantity, unit_price, total_price) VALUES (?, ?, ?, ?, ?, ?)',
      [po2row.id, prodTomato.id, prodTomato.name, 30, prodTomato.cost, 30 * Number(prodTomato.cost)]);
  }

  // PO 3 - معلق (pending)
  await q(
    "INSERT OR IGNORE INTO purchase_orders (po_number, supplier_id, subtotal, total, status, notes, created_at) VALUES (?, ?, ?, ?, ?, ?, datetime('now', '-3 days'))",
    ['PO-003', supDrink.id, 450, 450, 'pending', 'توريد مشروبات']);
  const po3 = await q1("SELECT id FROM purchase_orders WHERE po_number = 'PO-003'");
  if (po3) {
    await q('INSERT OR IGNORE INTO purchase_order_items (purchase_order_id, product_id, product_name, quantity, unit_price, total_price) VALUES (?, ?, ?, ?, ?, ?)',
      [po3.id, prodWater.id, prodWater.name, 100, prodWater.cost, 100 * Number(prodWater.cost)]);
    await q('INSERT OR IGNORE INTO purchase_order_items (purchase_order_id, product_id, product_name, quantity, unit_price, total_price) VALUES (?, ?, ?, ?, ?, ?)',
      [po3.id, prodPepsi.id, prodPepsi.name, 100, prodPepsi.cost, 100 * Number(prodPepsi.cost)]);
    await q('INSERT OR IGNORE INTO purchase_order_items (purchase_order_id, product_id, product_name, quantity, unit_price, total_price) VALUES (?, ?, ?, ?, ?, ?)',
      [po3.id, prodTea.id, prodTea.name, 10, prodTea.cost, 10 * Number(prodTea.cost)]);
  }

  // ═══════════════════════════════════════
  //  الفواتير Invoices
  // ═══════════════════════════════════════
  // الفاتورة 1 - completed - أحمد - من 7 أيام
  const inv1Total = Number(prodRice.price) * 2 + Number(prodOil.price) * 1 + Number(prodTuna.price) * 5;
  await q(
    "INSERT OR IGNORE INTO invoices (invoice_number, customer_id, subtotal, total, paid, status, created_at) VALUES (?, ?, ?, ?, ?, ?, datetime('now', '-7 days'))",
    ['INV-20250515-0001', custAhmed.id, inv1Total, inv1Total, inv1Total, 'completed']);
  const inv1 = await q1("SELECT id FROM invoices WHERE invoice_number = 'INV-20250515-0001'");
  if (inv1) {
    await q('INSERT OR IGNORE INTO invoice_items (invoice_id, product_id, product_name, barcode, quantity, unit_price, unit_cost, total_price) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      [inv1.id, prodRice.id, prodRice.name, '10000001', 2, prodRice.price, prodRice.cost, 2 * Number(prodRice.price)]);
    await q('INSERT OR IGNORE INTO invoice_items (invoice_id, product_id, product_name, barcode, quantity, unit_price, unit_cost, total_price) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      [inv1.id, prodOil.id, prodOil.name, '10000002', 1, prodOil.price, prodOil.cost, 1 * Number(prodOil.price)]);
    await q('INSERT OR IGNORE INTO invoice_items (invoice_id, product_id, product_name, barcode, quantity, unit_price, unit_cost, total_price) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      [inv1.id, prodTuna.id, prodTuna.name, '10000005', 5, prodTuna.price, prodTuna.cost, 5 * Number(prodTuna.price)]);
    await q('UPDATE products SET stock = stock - 2 WHERE id = ?', [prodRice.id]);
    await q('UPDATE products SET stock = stock - 1 WHERE id = ?', [prodOil.id]);
    await q('UPDATE products SET stock = stock - 5 WHERE id = ?', [prodTuna.id]);
  }

  // الفاتورة 2 - completed - فاطمة - من 5 أيام
  const inv2Total = Number(prodApple.price) * 3 + Number(prodBanana.price) * 4 + Number(prodTomato.price) * 5;
  await q(
    "INSERT OR IGNORE INTO invoices (invoice_number, customer_id, subtotal, total, paid, status, created_at) VALUES (?, ?, ?, ?, ?, ?, datetime('now', '-5 days'))",
    ['INV-20250517-0002', custFatima.id, inv2Total, inv2Total, inv2Total, 'completed']);
  const inv2 = await q1("SELECT id FROM invoices WHERE invoice_number = 'INV-20250517-0002'");
  if (inv2) {
    await q('INSERT OR IGNORE INTO invoice_items (invoice_id, product_id, product_name, barcode, quantity, unit_price, unit_cost, total_price) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      [inv2.id, prodApple.id, prodApple.name, '20000001', 3, prodApple.price, prodApple.cost, 3 * Number(prodApple.price)]);
    await q('INSERT OR IGNORE INTO invoice_items (invoice_id, product_id, product_name, barcode, quantity, unit_price, unit_cost, total_price) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      [inv2.id, prodBanana.id, prodBanana.name, '20000003', 4, prodBanana.price, prodBanana.cost, 4 * Number(prodBanana.price)]);
    await q('INSERT OR IGNORE INTO invoice_items (invoice_id, product_id, product_name, barcode, quantity, unit_price, unit_cost, total_price) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      [inv2.id, prodTomato.id, prodTomato.name, '20000006', 5, prodTomato.price, prodTomato.cost, 5 * Number(prodTomato.price)]);
    await q('UPDATE products SET stock = stock - 3 WHERE id = ?', [prodApple.id]);
    await q('UPDATE products SET stock = stock - 4 WHERE id = ?', [prodBanana.id]);
    await q('UPDATE products SET stock = stock - 5 WHERE id = ?', [prodTomato.id]);
  }

  // الفاتورة 3 - completed - محمد - من 3 أيام (مشتريات كبيرة)
  const inv3Total = Number(prodRice.price) * 5 + Number(prodWater.price) * 24 + Number(prodPepsi.price) * 12;
  await q(
    "INSERT OR IGNORE INTO invoices (invoice_number, customer_id, subtotal, total, paid, status, created_at) VALUES (?, ?, ?, ?, ?, ?, datetime('now', '-3 days'))",
    ['INV-20250519-0003', custMohammed.id, inv3Total, inv3Total, inv3Total, 'completed']);
  const inv3 = await q1("SELECT id FROM invoices WHERE invoice_number = 'INV-20250519-0003'");
  if (inv3) {
    await q('INSERT OR IGNORE INTO invoice_items (invoice_id, product_id, product_name, barcode, quantity, unit_price, unit_cost, total_price) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      [inv3.id, prodRice.id, prodRice.name, '10000001', 5, prodRice.price, prodRice.cost, 5 * Number(prodRice.price)]);
    await q('INSERT OR IGNORE INTO invoice_items (invoice_id, product_id, product_name, barcode, quantity, unit_price, unit_cost, total_price) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      [inv3.id, prodWater.id, prodWater.name, '30000001', 24, prodWater.price, prodWater.cost, 24 * Number(prodWater.price)]);
    await q('INSERT OR IGNORE INTO invoice_items (invoice_id, product_id, product_name, barcode, quantity, unit_price, unit_cost, total_price) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      [inv3.id, prodPepsi.id, prodPepsi.name, '30000004', 12, prodPepsi.price, prodPepsi.cost, 12 * Number(prodPepsi.price)]);
    await q('UPDATE products SET stock = stock - 5 WHERE id = ?', [prodRice.id]);
    await q('UPDATE products SET stock = stock - 24 WHERE id = ?', [prodWater.id]);
    await q('UPDATE products SET stock = stock - 12 WHERE id = ?', [prodPepsi.id]);
  }

  // الفاتورة 4 - completed - بدون عميل (عميل نقدي) - اليوم
  const inv4Total = Number(prodSugar.price) * 2 + Number(prodTuna.price) * 3 + Number(prodTea.price) * 1;
  await q(
    "INSERT OR IGNORE INTO invoices (invoice_number, subtotal, total, paid, status, created_at) VALUES (?, ?, ?, ?, ?, datetime('now', '-1 days'))",
    ['INV-20250521-0004', inv4Total, inv4Total, inv4Total, 'completed']);
  const inv4 = await q1("SELECT id FROM invoices WHERE invoice_number = 'INV-20250521-0004'");
  if (inv4) {
    await q('INSERT OR IGNORE INTO invoice_items (invoice_id, product_id, product_name, barcode, quantity, unit_price, unit_cost, total_price) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      [inv4.id, prodSugar.id, prodSugar.name, '10000003', 2, prodSugar.price, prodSugar.cost, 2 * Number(prodSugar.price)]);
    await q('INSERT OR IGNORE INTO invoice_items (invoice_id, product_id, product_name, barcode, quantity, unit_price, unit_cost, total_price) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      [inv4.id, prodTuna.id, prodTuna.name, '10000005', 3, prodTuna.price, prodTuna.cost, 3 * Number(prodTuna.price)]);
    await q('INSERT OR IGNORE INTO invoice_items (invoice_id, product_id, product_name, barcode, quantity, unit_price, unit_cost, total_price) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      [inv4.id, prodTea.id, prodTea.name, '30000005', 1, prodTea.price, prodTea.cost, 1 * Number(prodTea.price)]);
    await q('UPDATE products SET stock = stock - 2 WHERE id = ?', [prodSugar.id]);
    await q('UPDATE products SET stock = stock - 3 WHERE id = ?', [prodTuna.id]);
    await q('UPDATE products SET stock = stock - 1 WHERE id = ?', [prodTea.id]);
  }

  // الفاتورة 5 - completed - أحمد - اليوم
  const inv5Total = Number(prodOil.price) * 2 + Number(prodWater.price) * 6;
  await q(
    "INSERT OR IGNORE INTO invoices (invoice_number, customer_id, subtotal, total, paid, status, created_at) VALUES (?, ?, ?, ?, ?, ?, datetime('now'))",
    ['INV-20250522-0005', custAhmed.id, inv5Total, inv5Total, inv5Total, 'completed']);
  const inv5 = await q1("SELECT id FROM invoices WHERE invoice_number = 'INV-20250522-0005'");
  if (inv5) {
    await q('INSERT OR IGNORE INTO invoice_items (invoice_id, product_id, product_name, barcode, quantity, unit_price, unit_cost, total_price) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      [inv5.id, prodOil.id, prodOil.name, '10000002', 2, prodOil.price, prodOil.cost, 2 * Number(prodOil.price)]);
    await q('INSERT OR IGNORE INTO invoice_items (invoice_id, product_id, product_name, barcode, quantity, unit_price, unit_cost, total_price) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      [inv5.id, prodWater.id, prodWater.name, '30000001', 6, prodWater.price, prodWater.cost, 6 * Number(prodWater.price)]);
    await q('UPDATE products SET stock = stock - 2 WHERE id = ?', [prodOil.id]);
    await q('UPDATE products SET stock = stock - 6 WHERE id = ?', [prodWater.id]);
  }

  // ═══════════════════════════════════════
  //  المرتجعات Returns
  // ═══════════════════════════════════════
  const inv1Items = await qAll('SELECT * FROM invoice_items WHERE invoice_id = ? LIMIT 1', [inv1.id]);
  if (inv1Items && inv1Items.length) {
    const returnAmt = Number(inv1Items[0].total_price);
    await q("INSERT OR IGNORE INTO returns (return_number, invoice_id, reason, total, status, created_at) VALUES (?, ?, ?, ?, ?, datetime('now', '-6 days'))",
      ['RET-1000', inv1.id, 'تلف في المنتج - علبة تونة منتفخة', returnAmt, 'completed']);
    const ret1 = await q1("SELECT id FROM returns WHERE return_number = 'RET-1000'");
    if (ret1) {
      await q('INSERT OR IGNORE INTO return_items (return_id, product_id, product_name, quantity, unit_price, total_price) VALUES (?, ?, ?, ?, ?, ?)',
        [ret1.id, inv1Items[0].product_id, inv1Items[0].product_name, inv1Items[0].quantity, inv1Items[0].unit_price, returnAmt]);
    }
  }

  // ═══════════════════════════════════════
  //  التبديلات Exchanges
  // ═══════════════════════════════════════
  if (inv2) {
    const inv2Items = await qAll('SELECT * FROM invoice_items WHERE invoice_id = ? LIMIT 1', [inv2.id]);
    const prodGrape = await q1("SELECT id, price, cost FROM products WHERE barcode = '20000005'");
    if (inv2Items && inv2Items.length && prodGrape) {
      const returnedTotal = Number(inv2Items[0].total_price);
      const replacementTotal = Number(prodGrape.price) * 3;
      const diff = replacementTotal - returnedTotal;
      await q("INSERT OR IGNORE INTO exchanges (exchange_number, invoice_id, customer_id, total_returned, total_replacement, difference, reason, status, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now', '-4 days'))",
        ['EXC-1000', inv2.id, custFatima.id, returnedTotal, replacementTotal, diff, 'استبدال تفاح بعنب - العميل طلب تغيير', 'completed']);
      const exc1 = await q1("SELECT id FROM exchanges WHERE exchange_number = 'EXC-1000'");
      if (exc1) {
        await q("INSERT OR IGNORE INTO exchange_items (exchange_id, product_id, quantity, unit_price, total, type) VALUES (?, ?, ?, ?, ?, ?)",
          [exc1.id, inv2Items[0].product_id, inv2Items[0].quantity, inv2Items[0].unit_price, returnedTotal, 'returned']);
        await q("INSERT OR IGNORE INTO exchange_items (exchange_id, product_id, quantity, unit_price, total, type) VALUES (?, ?, ?, ?, ?, ?)",
          [exc1.id, prodGrape.id, 3, prodGrape.price, replacementTotal, 'replacement']);
      }
    }
  }

  // ═══════════════════════════════════════
  //  الخزنة Cash Register
  // ═══════════════════════════════════════
  // إغلاق الخزنة القديمة أولاً لو موجودة، ثم فتح خزنة جديدة
  const oldReg = await q1("SELECT id FROM cash_registers WHERE status = 'open'");
  if (oldReg) {
    await q("UPDATE cash_registers SET status = 'closed', closed_at = datetime('now', '-1 days'), closing_balance = ? WHERE id = ?",
      [1500, oldReg.id]);
  }

  await q("INSERT OR IGNORE INTO cash_registers (opening_balance, status, opened_at) VALUES (?, ?, datetime('now'))", [1000, 'open']);
  const reg = await q1("SELECT id FROM cash_registers WHERE status = 'open' ORDER BY id DESC LIMIT 1");

  // حركات الخزنة من الفواتير
  const allInvoices = await qAll('SELECT id, invoice_number, total, customer_id FROM invoices');
  for (const inv of allInvoices) {
    await q("INSERT OR IGNORE INTO cashier_movements (register_id, type, amount, reason) VALUES (?, ?, ?, ?)",
      [reg.id, 'in', Number(inv.total), 'POS Sale: ' + inv.invoice_number]);
  }

  // حركات يدوية
  await q("INSERT OR IGNORE INTO cashier_movements (register_id, type, amount, reason) VALUES (?, ?, ?, ?)",
    [reg.id, 'out', 200, 'سحب للأمانة - صيانة مكيف']);
  await q("INSERT OR IGNORE INTO cashier_movements (register_id, type, amount, reason) VALUES (?, ?, ?, ?)",
    [reg.id, 'in', 500, 'إيداع من المدير']);
  await q("INSERT OR IGNORE INTO cashier_movements (register_id, type, amount, reason) VALUES (?, ?, ?, ?)",
    [reg.id, 'out', 300, 'دفع فاتورة كهرباء']);

  // ═══════════════════════════════════════
  //  حركات المخزون Inventory Movements
  // ═══════════════════════════════════════
  await q("INSERT OR IGNORE INTO inventory (product_id, type, quantity, balance_before, balance_after, notes, created_at) VALUES (?, ?, ?, ?, ?, ?, datetime('now', '-15 days'))",
    [prodRice.id, 'add', 10, 0, 10, 'شراء PO-001']);
  await q("INSERT OR IGNORE INTO inventory (product_id, type, quantity, balance_before, balance_after, notes, created_at) VALUES (?, ?, ?, ?, ?, ?, datetime('now', '-15 days'))",
    [prodOil.id, 'add', 15, 0, 15, 'شراء PO-001']);
  await q("INSERT OR IGNORE INTO inventory (product_id, type, quantity, balance_before, balance_after, notes, created_at) VALUES (?, ?, ?, ?, ?, ?, datetime('now', '-7 days'))",
    [prodRice.id, 'sale', 2, 10, 8, 'بيع INV-20250515-0001']);
  await q("INSERT OR IGNORE INTO inventory (product_id, type, quantity, balance_before, balance_after, notes, created_at) VALUES (?, ?, ?, ?, ?, ?, datetime('now', '-5 days'))",
    [prodApple.id, 'sale', 3, 20, 17, 'بيع INV-20250517-0002']);
  await q("INSERT OR IGNORE INTO inventory (product_id, type, quantity, balance_before, balance_after, notes, created_at) VALUES (?, ?, ?, ?, ?, ?, datetime('now', '-3 days'))",
    [prodRice.id, 'sale', 5, 8, 3, 'بيع INV-20250519-0003']);

  // ═══════════════════════════════════════
  //  المصروفات Expenses
  // ═══════════════════════════════════════
  await q("INSERT OR IGNORE INTO expenses (category, amount, description, date) VALUES (?, ?, ?, ?)",
    ['إيجار', 5000, 'إيجار المحل التجاري - شهر مايو', new Date(Date.now() - 5 * 86400000).toISOString().slice(0, 10)]);
  await q("INSERT OR IGNORE INTO expenses (category, amount, description, date) VALUES (?, ?, ?, ?)",
    ['كهرباء', 850, 'فاتورة الكهرباء لشهر أبريل', new Date(Date.now() - 10 * 86400000).toISOString().slice(0, 10)]);
  await q("INSERT OR IGNORE INTO expenses (category, amount, description, date) VALUES (?, ?, ?, ?)",
    ['مياه', 320, 'فاتورة المياه', new Date(Date.now() - 10 * 86400000).toISOString().slice(0, 10)]);
  await q("INSERT OR IGNORE INTO expenses (category, amount, description, date) VALUES (?, ?, ?, ?)",
    ['صيانة', 450, 'صيانة مكيف المحل', new Date(Date.now() - 3 * 86400000).toISOString().slice(0, 10)]);
  await q("INSERT OR IGNORE INTO expenses (category, amount, description, date) VALUES (?, ?, ?, ?)",
    ['نت', 200, 'اشتراك الإنترنت الشهري', new Date(Date.now() - 2 * 86400000).toISOString().slice(0, 10)]);
  await q("INSERT OR IGNORE INTO expenses (category, amount, description, date) VALUES (?, ?, ?, ?)",
    ['نثريات', 150, 'أكياس وحبال ومواد تغليف', new Date(Date.now() - 1 * 86400000).toISOString().slice(0, 10)]);

  // ═══════════════════════════════════════
  //  العمال Workers
  // ═══════════════════════════════════════
  await q("INSERT OR IGNORE INTO workers (name, phone, position, salary, is_active) VALUES (?, ?, ?, ?, ?)",
    ['خالد الأحمدي', '0560000001', 'كاشير', 2500, 1]);
  await q("INSERT OR IGNORE INTO workers (name, phone, position, salary, is_active) VALUES (?, ?, ?, ?, ?)",
    ['سعيد الشمري', '0560000002', 'عامل مخزن', 2000, 1]);
  await q("INSERT OR IGNORE INTO workers (name, phone, position, salary, is_active) VALUES (?, ?, ?, ?, ?)",
    ['ناصر الدوسري', '0560000003', 'محاسب', 3500, 0]);

  const w1 = await q1("SELECT id FROM workers WHERE name = 'خالد الأحمدي'");
  const w2 = await q1("SELECT id FROM workers WHERE name = 'سعيد الشمري'");
  if (w1) {
    await q("INSERT OR IGNORE INTO worker_payments (worker_id, amount, month, notes, created_at) VALUES (?, ?, ?, ?, datetime('now', '-25 days'))",
      [w1.id, 2500, '2026-04', 'راتب شهر أبريل']);
    await q("INSERT OR IGNORE INTO worker_payments (worker_id, amount, month, notes, created_at) VALUES (?, ?, ?, ?, datetime('now', '-25 days'))",
      [w1.id, 2500, '2026-05', 'راتب شهر مايو']);
  }
  if (w2) {
    await q("INSERT OR IGNORE INTO worker_payments (worker_id, amount, month, notes, created_at) VALUES (?, ?, ?, ?, datetime('now', '-25 days'))",
      [w2.id, 2000, '2026-04', 'راتب شهر أبريل']);
    await q("INSERT OR IGNORE INTO worker_payments (worker_id, amount, month, notes, created_at) VALUES (?, ?, ?, ?, datetime('now', '-25 days'))",
      [w2.id, 2000, '2026-05', 'راتب شهر مايو']);
  }

  // ═══════════════════════════════════════
  //  المدفوعات Payments
  // ═══════════════════════════════════════
  await q("INSERT OR IGNORE INTO supplier_payments (supplier_id, amount, payment_method, notes, created_at) VALUES (?, ?, ?, ?, datetime('now', '-12 days'))",
    [supFood.id, 500, 'bank', 'دفعة جزئية لمورد الغذاء']);
  await q("INSERT OR IGNORE INTO customer_payments (customer_id, amount, payment_method, notes, created_at) VALUES (?, ?, ?, ?, datetime('now', '-4 days'))",
    [custFatima.id, 100, 'cash', 'دفعة من فاطمة']);

  // ═══════════════════════════════════════
  //  التسعير المتقدم Advanced Pricing
  // ═══════════════════════════════════════
  // شرائح سعرية
  await q("INSERT OR IGNORE INTO price_tiers (product_id, tier_name, price) VALUES (?, ?, ?)",
    [prodRice.id, 'الجملة', 38]);
  await q("INSERT OR IGNORE INTO price_tiers (product_id, tier_name, price) VALUES (?, ?, ?)",
    [prodRice.id, 'التجزئة', 45]);
  await q("INSERT OR IGNORE INTO price_tiers (product_id, tier_name, price) VALUES (?, ?, ?)",
    [prodOil.id, 'الجملة', 24]);

  // خصومات حجم
  await q("INSERT OR IGNORE INTO bulk_discounts (product_id, min_quantity, discount_percent) VALUES (?, ?, ?)",
    [prodWater.id, 24, 5]);
  await q("INSERT OR IGNORE INTO bulk_discounts (product_id, min_quantity, discount_percent) VALUES (?, ?, ?)",
    [prodPepsi.id, 12, 10]);

  // عروض ترويجية
  await q("INSERT OR IGNORE INTO promo_periods (product_id, promo_price, start_date, end_date) VALUES (?, ?, ?, ?)",
    [prodBanana.id, 7, dateStr(Date.now() - 7 * 86400000), dateStr(Date.now() + 7 * 86400000)]);

  // ═══════════════════════════════════════
  //  دليل الحسابات Chart of Accounts
  // ═══════════════════════════════════════
  const accounts = [
    ['1110', 'صندوق النقدية',     'asset',   1],
    ['1120', 'الحساب الجاري',     'asset',   1],
    ['1310', 'المخزون',           'asset',   1],
    ['1410', 'حسابات مدينة - عملاء', 'asset', 1],
    ['2110', 'حسابات دائنة - موردون', 'liability', 1],
    ['2210', 'رواتب مستحقة',        'liability', 1],
    ['3110', 'رأس المال',          'equity',  1],
    ['3120', 'أرباح محتجزة',       'equity',  1],
    ['4110', 'إيرادات المبيعات',   'revenue', 1],
    ['4120', 'مردودات المبيعات',   'revenue', 1],
    ['5110', 'تكلفة البضاعة المباعة', 'expense', 1],
    ['5210', 'مصروف إيجار',        'expense', 1],
    ['5220', 'مصروف خدمات',        'expense', 1],
    ['5230', 'مصروف رواتب',        'expense', 1],
    ['5240', 'مصروف صيانة',        'expense', 1],
    ['5250', 'مصروفات عمومية',     'expense', 1],
  ];
  for (const [code, name, type, isActive] of accounts) {
    await q('INSERT OR IGNORE INTO accounts (code, name, type, is_active) VALUES (?, ?, ?, ?)',
      [code, name, type, isActive]);
  }

  const accCash = await q1("SELECT id FROM accounts WHERE code = '1110'");
  const accInventory = await q1("SELECT id FROM accounts WHERE code = '1310'");
  const accRevenue = await q1("SELECT id FROM accounts WHERE code = '4110'");
  const accCogs = await q1("SELECT id FROM accounts WHERE code = '5110'");
  const accCapital = await q1("SELECT id FROM accounts WHERE code = '3110'");

  // Journal entry: opening balance for capital
  if (accCapital && accCash) {
    const today = new Date().toISOString().slice(0, 10);
    const entryNum = `JE-${today.replace(/-/g, '')}-001`;
    const existing = await q1('SELECT id FROM journal_entries WHERE entry_number = ?', [entryNum]);
    if (!existing) {
      await q('INSERT INTO journal_entries (entry_number, date, description, total_debit, total_credit, status) VALUES (?, ?, ?, ?, ?, ?)',
        [entryNum, today, 'رأس مال بداية النشاط', 50000, 50000, 'posted']);
      const entry = await q1('SELECT id FROM journal_entries WHERE entry_number = ?', [entryNum]);
      if (entry) {
        await q('INSERT INTO journal_items (entry_id, account_id, debit, credit, description) VALUES (?, ?, ?, ?, ?)',
          [entry.id, accCash.id, 50000, 0, 'رأس مال بداية النشاط']);
        await q('INSERT INTO journal_items (entry_id, account_id, debit, credit, description) VALUES (?, ?, ?, ?, ?)',
          [entry.id, accCapital.id, 0, 50000, 'رأس مال بداية النشاط']);
      }
    }
  }

  // Mark seeding as complete so we can detect partial seeds
  await q('INSERT OR IGNORE INTO settings ("key", value) VALUES (?, ?)', ['seeded_version', '2']);

  console.log('✅ Database seeded with realistic data');
}

function dateStr(ts) {
  return new Date(ts).toISOString().slice(0, 10);
}
