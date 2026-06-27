import db, { addAuditLog } from '../database/db.js';
import { productService } from './productService.js';

export const invoiceService = {
  generateInvoiceNumber() {
    const prefix = db.prepare("SELECT value FROM settings WHERE key = 'invoice_prefix'").get()?.value || 'INV';
    const today = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const count = db.prepare(`
      SELECT COUNT(*) as count FROM invoices
      WHERE invoice_number LIKE ?
    `).get(`${prefix}-${today}%`).count || 0;
    return `${prefix}-${today}-${String(count + 1).padStart(4, '0')}`;
  },

  getAll() {
    return db.prepare(`
      SELECT i.*, c.name as customer_name
      FROM invoices i
      LEFT JOIN customers c ON i.customer_id = c.id
      ORDER BY i.created_at DESC
    `).all();
  },

  getById(id) {
    const invoice = db.prepare(`
      SELECT i.*, c.name as customer_name, c.phone as customer_phone
      FROM invoices i
      LEFT JOIN customers c ON i.customer_id = c.id
      WHERE i.id = ?
    `).get(id);

    if (!invoice) return null;

    const items = db.prepare(`
      SELECT * FROM invoice_items WHERE invoice_id = ?
    `).all(id);

    return { ...invoice, items };
  },

  create(invoiceData) {
    const invoiceNumber = this.generateInvoiceNumber();
    const { customer_id, discount = 0, notes, items } = invoiceData;

    const subtotal = items.reduce((sum, item) => sum + (item.quantity * item.unit_price), 0);
    const total = subtotal - discount;

    const insertInvoice = db.prepare(`
      INSERT INTO invoices (invoice_number, customer_id, subtotal, discount, total, paid, due, status, notes)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const transaction = db.transaction(() => {
      const result = insertInvoice.run(invoiceNumber, customer_id || null, subtotal, discount, total, total, 0, 'completed', notes || null);
      const invoiceId = result.lastInsertRowid;

      const insertItem = db.prepare(`
        INSERT INTO invoice_items (invoice_id, product_id, product_name, barcode, quantity, unit_price, total_price)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `);

      items.forEach(item => {
        const product = productService.getById(item.product_id);
        if (!product) throw new Error(`Product ${item.product_id} not found`);

        insertItem.run(
          invoiceId,
          item.product_id,
          product.name,
          product.barcode,
          item.quantity,
          item.unit_price,
          item.quantity * item.unit_price
        );

        productService.updateStock(item.product_id, item.quantity, 'subtract', `Sale #${invoiceNumber}`);
      });

      addAuditLog(null, 'create', 'invoice', invoiceId, null, { invoiceNumber, total });
      return invoiceId;
    });

    const invoiceId = transaction();
    return this.getById(invoiceId);
  },

  update(id, invoiceData) {
    const old = this.getById(id);
    const { customer_id, discount, notes } = invoiceData;

    db.prepare(`
      UPDATE invoices SET customer_id = ?, discount = ?, notes = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(customer_id, discount, notes, id);

    addAuditLog(null, 'update', 'invoice', id, old, invoiceData);
    return this.getById(id);
  },

  delete(id) {
    const invoice = this.getById(id);
    if (!invoice) throw new Error('Invoice not found');

    const transaction = db.transaction(() => {
      const items = db.prepare('SELECT * FROM invoice_items WHERE invoice_id = ?').all(id);
      items.forEach(item => {
        productService.updateStock(item.product_id, item.quantity, 'add', `Invoice cancelled #${invoice.invoice_number}`);
      });

      db.prepare('DELETE FROM invoice_items WHERE invoice_id = ?').run(id);
      db.prepare('DELETE FROM invoices WHERE id = ?').run(id);
      addAuditLog(null, 'delete', 'invoice', id, invoice, null);
    });

    transaction();
    return { success: true };
  },

  getByDateRange(startDate, endDate) {
    return db.prepare(`
      SELECT i.*, c.name as customer_name
      FROM invoices i
      LEFT JOIN customers c ON i.customer_id = c.id
      WHERE DATE(i.created_at) BETWEEN DATE(?) AND DATE(?)
      ORDER BY i.created_at DESC
    `).all(startDate, endDate);
  },

  getDailySales(date = new Date()) {
    return db.prepare(`
      SELECT SUM(total) as total, COUNT(*) as count
      FROM invoices
      WHERE DATE(created_at) = DATE(?)
    `).get(date.toISOString().slice(0, 10));
  },

  getTopProducts(limit = 10) {
    return db.prepare(`
      SELECT product_id, product_name, SUM(quantity) as total_qty, SUM(total_price) as total_sales
      FROM invoice_items
      GROUP BY product_id
      ORDER BY total_sales DESC
      LIMIT ?
    `).all(limit);
  }
};