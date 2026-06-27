import db from '../database/db.js';

export const auditService = {
  getAll(limit = 100) {
    return db.prepare(`
      SELECT * FROM audit_logs
      ORDER BY created_at DESC
      LIMIT ?
    `).all(limit);
  },

  getByEntity(entityType, entityId) {
    return db.prepare(`
      SELECT * FROM audit_logs
      WHERE entity_type = ? AND entity_id = ?
      ORDER BY created_at DESC
    `).all(entityType, entityId);
  },

  getByAction(action) {
    return db.prepare(`
      SELECT * FROM audit_logs
      WHERE action = ?
      ORDER BY created_at DESC
    `).all(action);
  },

  getByDateRange(startDate, endDate) {
    return db.prepare(`
      SELECT * FROM audit_logs
      WHERE DATE(created_at) BETWEEN DATE(?) AND DATE(?)
      ORDER BY created_at DESC
    `).all(startDate, endDate);
  },

  search(query) {
    return db.prepare(`
      SELECT * FROM audit_logs
      WHERE action LIKE ? OR entity_type LIKE ? OR old_value LIKE ? OR new_value LIKE ?
      ORDER BY created_at DESC
      LIMIT 100
    `).all(`%${query}%`, `%${query}%`, `%${query}%`, `%${query}%`);
  }
};