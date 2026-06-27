import db, { addAuditLog } from '../database/db.js';

export const inventoryService = {
  getAll() {
    return db.prepare(`
      SELECT i.*, p.name as product_name, p.barcode
      FROM inventory i
      JOIN products p ON i.product_id = p.id
      ORDER BY i.created_at DESC
    `).all();
  },

  getByProductId(productId) {
    return db.prepare(`
      SELECT * FROM inventory
      WHERE product_id = ?
      ORDER BY created_at DESC
    `).all(productId);
  },

  getByDateRange(startDate, endDate) {
    return db.prepare(`
      SELECT i.*, p.name as product_name, p.barcode
      FROM inventory i
      JOIN products p ON i.product_id = p.id
      WHERE DATE(i.created_at) BETWEEN DATE(?) AND DATE(?)
      ORDER BY i.created_at DESC
    `).all(startDate, endDate);
  },

  add(productId, quantity, notes) {
    const product = db.prepare('SELECT * FROM products WHERE id = ?').get(productId);
    if (!product) throw new Error('Product not found');

    const balanceBefore = product.stock;
    const balanceAfter = balanceBefore + quantity;

    const transaction = db.transaction(() => {
      db.prepare('UPDATE products SET stock = ? WHERE id = ?').run(balanceAfter, productId);
      db.prepare(`
        INSERT INTO inventory (product_id, type, quantity, balance_before, balance_after, notes)
        VALUES (?, 'add', ?, ?, ?, ?)
      `).run(productId, quantity, balanceBefore, balanceAfter, notes || null);
      addAuditLog(null, 'inventory_add', 'product', productId, { stock: balanceBefore }, { stock: balanceAfter });
    });

    transaction();
    return { success: true, newStock: balanceAfter };
  },

  subtract(productId, quantity, notes) {
    const product = db.prepare('SELECT * FROM products WHERE id = ?').get(productId);
    if (!product) throw new Error('Product not found');
    if (product.stock < quantity) throw new Error('Insufficient stock');

    const balanceBefore = product.stock;
    const balanceAfter = balanceBefore - quantity;

    const transaction = db.transaction(() => {
      db.prepare('UPDATE products SET stock = ? WHERE id = ?').run(balanceAfter, productId);
      db.prepare(`
        INSERT INTO inventory (product_id, type, quantity, balance_before, balance_after, notes)
        VALUES (?, 'subtract', ?, ?, ?, ?)
      `).run(productId, quantity, balanceBefore, balanceAfter, notes || null);
      addAuditLog(null, 'inventory_subtract', 'product', productId, { stock: balanceBefore }, { stock: balanceAfter });
    });

    transaction();
    return { success: true, newStock: balanceAfter };
  }
};