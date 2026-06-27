export class POSApp {
  constructor(page) {
    this.page = page;
  }

  async navigateTo(section) {
    const navMap = {
      pos: 'البيع',
      products: 'المنتجات',
      customers: 'العملاء',
      suppliers: 'الموردين',
      inventory: 'المخزون',
      reports: 'التقارير',
      settings: 'الإعدادات',
      auditLogs: 'سجل التدقيق',
      purchaseOrders: 'أوامر الشراء',
      invoices: 'الفواتير',
      returns: 'المرتجعات',
      accounting: 'المحاسبة',
      chartOfAccounts: 'دليل الحسابات',
      journalEntries: 'القيود اليومية',
      accountLedger: 'دفتر الأستاذ',
      expenses: 'المصروفات',
      workers: 'العمال',
    };

    const label = navMap[section];
    if (!label) throw new Error(`Unknown section: ${section}`);

    await this.page.click(`text=${label}`);
    await this.page.waitForTimeout(500);
  }

  async addProduct({ name, barcode, price, cost, stock, category }) {
    await this.navigateTo('products');
    await this.page.click('text=إضافة منتج');

    await this.page.fill('input[placeholder*="اسم المنتج"]', name);
    if (barcode) await this.page.fill('input[placeholder*="الباركود"]', barcode);
    if (price) await this.page.fill('input[placeholder*="السعر"]', String(price));
    if (cost) await this.page.fill('input[placeholder*="التكلفة"]', String(cost));
    if (stock) await this.page.fill('input[type="number"]', String(stock));
    if (category) await this.page.fill('input[placeholder*="التصنيف"]', category);

    await this.page.click('button:has-text("حفظ")');
    await this.page.waitForTimeout(500);
  }

  async addCustomer({ name, phone, creditLimit }) {
    await this.navigateTo('customers');
    await this.page.click('text=إضافة عميل');

    await this.page.fill('input[placeholder*="اسم العميل"]', name);
    if (phone) await this.page.fill('input[type="tel"], input[placeholder*="الهاتف"]', phone);
    if (creditLimit) await this.page.fill('input[placeholder*="الحد الائتماني"]', String(creditLimit));

    await this.page.click('button:has-text("حفظ")');
    await this.page.waitForTimeout(500);
  }

  async addSupplier({ name, phone }) {
    await this.navigateTo('suppliers');
    await this.page.click('text=إضافة مورد');

    await this.page.fill('input[placeholder*="اسم المورد"]', name);
    if (phone) await this.page.fill('input[type="tel"], input[placeholder*="الهاتف"]', phone);

    await this.page.click('button:has-text("حفظ")');
    await this.page.waitForTimeout(500);
  }

  async getTableText() {
    const rows = await this.page.$$('table tbody tr');
    const data = [];
    for (const row of rows) {
      const cells = await row.$$('td');
      const rowData = [];
      for (const cell of cells) {
        rowData.push(await cell.textContent());
      }
      data.push(rowData);
    }
    return data;
  }

  async pageTitle() {
    const h1 = await this.page.$('h1');
    return h1 ? await h1.textContent() : '';
  }
}
