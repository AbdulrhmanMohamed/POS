import db, { addAuditLog } from '../database/db.js';

export const customerService = {
  getAll() {
    return db.prepare('SELECT * FROM customers ORDER BY name ASC').all();
  },

  getById(id) {
    return db.prepare('SELECT * FROM customers WHERE id = ?').get(id);
  },

  search(query) {
    return db.prepare(`
      SELECT * FROM customers
      WHERE name LIKE ? OR phone LIKE ?
      ORDER BY name ASC
    `).all(`%${query}%`, `%${query}%`);
  },

  create(customer) {
    const stmt = db.prepare(`
      INSERT INTO customers (name, phone, email, address, balance, notes)
      VALUES (?, ?, ?, ?, ?, ?)
    `);
    const result = stmt.run(
      customer.name,
      customer.phone || null,
      customer.email || null,
      customer.address || null,
      customer.balance || 0,
      customer.notes || null
    );
    addAuditLog(null, 'create', 'customer', result.lastInsertRowid, null, customer);
    return this.getById(result.lastInsertRowid);
  },

  update(id, customer) {
    const old = this.getById(id);
    const stmt = db.prepare(`
      UPDATE customers
      SET name = ?, phone = ?, email = ?, address = ?, balance = ?, notes = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `);
    stmt.run(
      customer.name,
      customer.phone || null,
      customer.email || null,
      customer.address || null,
      customer.balance || 0,
      customer.notes || null,
      id
    );
    addAuditLog(null, 'update', 'customer', id, old, customer);
    return this.getById(id);
  },

  delete(id) {
    const old = this.getById(id);
    db.prepare('DELETE FROM customers WHERE id = ?').run(id);
    addAuditLog(null, 'delete', 'customer', id, old, null);
    return { success: true };
  },

  updateBalance(id, amount) {
    const customer = this.getById(id);
    if (!customer) throw new Error('Customer not found');

    const newBalance = customer.balance + amount;
    db.prepare('UPDATE customers SET balance = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(newBalance, id);
    addAuditLog(null, 'balance_change', 'customer', id, { balance: customer.balance }, { balance: newBalance });
    return this.getById(id);
  },

  getCustomersWithDebt() {
    return db.prepare('SELECT * FROM customers WHERE balance > 0 ORDER BY balance DESC').all();
  }
};