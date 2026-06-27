import db, { addAuditLog } from '../database/db.js';

export const productService = {
  getAll() {
    return db.prepare('SELECT * FROM products ORDER BY name ASC').all();
  },

  getById(id) {
    return db.prepare('SELECT * FROM products WHERE id = ?').get(id);
  },

  getByBarcode(barcode) {
    return db.prepare('SELECT * FROM products WHERE barcode = ?').get(barcode);
  },

  search(query) {
    return db.prepare(`
      SELECT * FROM products
      WHERE name LIKE ? OR barcode LIKE ?
      ORDER BY name ASC
    `).all(`%${query}%`, `%${query}%`);
  },

  create(product) {
    const stmt = db.prepare(`
      INSERT INTO products (name, barcode, price, cost, stock, min_stock, category, unit, image)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    const result = stmt.run(
      product.name,
      product.barcode || null,
      product.price || 0,
      product.cost || 0,
      product.stock || 0,
      product.min_stock || 0,
      product.category || null,
      product.unit || 'piece',
      product.image || null
    );
    addAuditLog(null, 'create', 'product', result.lastInsertRowid, null, product);
    return this.getById(result.lastInsertRowid);
  },

  update(id, product) {
    const old = this.getById(id);
    const stmt = db.prepare(`
      UPDATE products
      SET name = ?, barcode = ?, price = ?, cost = ?, stock = ?, min_stock = ?, category = ?, unit = ?, image = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `);
    stmt.run(
      product.name,
      product.barcode || null,
      product.price,
      product.cost,
      product.stock,
      product.min_stock,
      product.category || null,
      product.unit || 'piece',
      product.image || null,
      id
    );
    addAuditLog(null, 'update', 'product', id, old, product);
    return this.getById(id);
  },

  delete(id) {
    const old = this.getById(id);
    db.prepare('DELETE FROM products WHERE id = ?').run(id);
    addAuditLog(null, 'delete', 'product', id, old, null);
    return { success: true };
  },

  updateStock(id, quantity, type, notes) {
    const product = this.getById(id);
    if (!product) throw new Error('Product not found');

    const balanceBefore = product.stock;
    const balanceAfter = type === 'add' ? balanceBefore + quantity : balanceBefore - quantity;

    if (balanceAfter < 0) throw new Error('Insufficient stock');

    db.prepare('UPDATE products SET stock = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(balanceAfter, id);

    db.prepare(`
      INSERT INTO inventory (product_id, type, quantity, balance_before, balance_after, notes)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(id, type, quantity, balanceBefore, balanceAfter, notes || null);

    addAuditLog(null, 'stock_change', 'product', id, { stock: balanceBefore }, { stock: balanceAfter });
    return this.getById(id);
  },

  getLowStock() {
    return db.prepare('SELECT * FROM products WHERE stock <= min_stock AND min_stock > 0').all();
  }
};