import db, { addAuditLog } from '../database/db.js';

export const supplierService = {
  getAll() {
    return db.prepare('SELECT * FROM suppliers ORDER BY name ASC').all();
  },

  getById(id) {
    return db.prepare('SELECT * FROM suppliers WHERE id = ?').get(id);
  },

  search(query) {
    return db.prepare(`
      SELECT * FROM suppliers
      WHERE name LIKE ? OR phone LIKE ?
      ORDER BY name ASC
    `).all(`%${query}%`, `%${query}%`);
  },

  create(supplier) {
    const stmt = db.prepare(`
      INSERT INTO suppliers (name, phone, email, address, balance, notes)
      VALUES (?, ?, ?, ?, ?, ?)
    `);
    const result = stmt.run(
      supplier.name,
      supplier.phone || null,
      supplier.email || null,
      supplier.address || null,
      supplier.balance || 0,
      supplier.notes || null
    );
    addAuditLog(null, 'create', 'supplier', result.lastInsertRowid, null, supplier);
    return this.getById(result.lastInsertRowid);
  },

  update(id, supplier) {
    const old = this.getById(id);
    const stmt = db.prepare(`
      UPDATE suppliers
      SET name = ?, phone = ?, email = ?, address = ?, balance = ?, notes = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `);
    stmt.run(
      supplier.name,
      supplier.phone || null,
      supplier.email || null,
      supplier.address || null,
      supplier.balance || 0,
      supplier.notes || null,
      id
    );
    addAuditLog(null, 'update', 'supplier', id, old, supplier);
    return this.getById(id);
  },

  delete(id) {
    const old = this.getById(id);
    db.prepare('DELETE FROM suppliers WHERE id = ?').run(id);
    addAuditLog(null, 'delete', 'supplier', id, old, null);
    return { success: true };
  },

  updateBalance(id, amount) {
    const supplier = this.getById(id);
    if (!supplier) throw new Error('Supplier not found');

    const newBalance = supplier.balance + amount;
    db.prepare('UPDATE suppliers SET balance = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(newBalance, id);
    addAuditLog(null, 'balance_change', 'supplier', id, { balance: supplier.balance }, { balance: newBalance });
    return this.getById(id);
  }
};