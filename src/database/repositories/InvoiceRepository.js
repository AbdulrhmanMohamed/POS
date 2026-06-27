import { BaseRepository } from './BaseRepository.js';
import dbManager from '../DB.js';
import { InvoiceSchema, InvoiceItemSchema } from '../schemas.js';
import { Sanitizer } from '../../utils/sanitizer.js';

export class InvoiceRepository extends BaseRepository {
  constructor() {
    super('invoices');
  }

  create(data) {
    return super.create(data, InvoiceSchema);
  }

  update(id, data) {
    return super.update(id, data, InvoiceSchema);
  }

  findWithCustomer() {
    return dbManager.all(`
      SELECT i.*, c.name as customer_name
      FROM invoices i
      LEFT JOIN customers c ON i.customer_id = c.id
      ORDER BY i.created_at DESC
    `);
  }

  async findByIdWithItems(id) {
    const safeId = this.validateId(id);
    const invoice = dbManager.get(`
      SELECT i.*, c.name as customer_name, c.phone as customer_phone
      FROM invoices i
      LEFT JOIN customers c ON i.customer_id = c.id
      WHERE i.id = ?
    `, [safeId]);

    if (!invoice) return null;

    const items = dbManager.all('SELECT * FROM invoice_items WHERE invoice_id = ?', [safeId]);
    return { ...invoice, items };
  }

  findByDateRange(startDate, endDate) {
    const safeStart = Sanitizer.sanitizeString(startDate, 10);
    const safeEnd = Sanitizer.sanitizeString(endDate, 10);
    return dbManager.all(`
      SELECT i.*, c.name as customer_name
      FROM invoices i
      LEFT JOIN customers c ON i.customer_id = c.id
      WHERE DATE(i.created_at) BETWEEN DATE(?) AND DATE(?)
      ORDER BY i.created_at DESC
    `, [safeStart, safeEnd]);
  }

  getDailySales(date = null) {
    const safeDate = date || new Date().toISOString().slice(0, 10);
    return dbManager.get(`
      SELECT SUM(total) as total, COUNT(*) as count
      FROM invoices
      WHERE DATE(created_at) = DATE(?)
    `, [safeDate]);
  }

  generateInvoiceNumber() {
    const prefix = 'INV';
    const today = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const countResult = dbManager.get('SELECT COUNT(*) as cnt FROM invoices WHERE invoice_number LIKE ?', [`${prefix}-${today}%`]);
    const count = (countResult?.cnt || 0) + 1;
    return `${prefix}-${today}-${String(count).padStart(4, '0')}`;
  }

  async createInvoiceWithItems(invoiceData, items) {
    const invoiceSchema = Sanitizer.sanitizeObject(invoiceData, InvoiceSchema);

    return dbManager.transaction(async (connection) => {
      const result = await connection.execute(
        `INSERT INTO invoices (invoice_number, customer_id, subtotal, discount, total, paid, due, status, notes) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [invoiceSchema.invoice_number, invoiceSchema.customer_id, invoiceSchema.subtotal, invoiceSchema.discount, invoiceSchema.total, invoiceSchema.paid, invoiceSchema.due, invoiceSchema.status, invoiceSchema.notes || null]
      );
      const invoiceId = result.insertId;

      for (const item of items) {
        const safeItem = Sanitizer.sanitizeObject(item, InvoiceItemSchema);
        await connection.execute(
          `INSERT INTO invoice_items (invoice_id, product_id, product_name, barcode, quantity, unit_price, total_price) VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [invoiceId, safeItem.product_id, safeItem.product_name, safeItem.barcode, safeItem.quantity, safeItem.unit_price, safeItem.total_price]
        );

        const product = await connection.execute('SELECT stock FROM products WHERE id = ?', [safeItem.product_id]);
        const newStock = product[0][0].stock - safeItem.quantity;
        await connection.execute('UPDATE products SET stock = ? WHERE id = ?', [newStock, safeItem.product_id]);
      }

      return invoiceId;
    });
  }
}