import dbManager from '../DB.js';
import { Sanitizer } from '../../utils/sanitizer.js';

export class BaseRepository {
  constructor(tableName) {
    this.tableName = tableName;
  }

  validateId(id) {
    const sanitized = Sanitizer.sanitizeInteger(id, 0);
    if (sanitized <= 0) throw new Error('Invalid ID');
    return sanitized;
  }

  validateFieldName(field) {
    const allowed = /^[a-zA-Z_][a-zA-Z0-9_]*$/;
    if (!allowed.test(field)) throw new Error('Invalid field name');
    return field;
  }

  validateOrderBy(orderBy) {
    const parts = orderBy.trim().split(/\s+/);
    if (parts.length === 0) return 'id DESC';
    const field = parts[0];
    const direction = parts[1]?.toUpperCase() || 'DESC';
    if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(field)) return 'id DESC';
    if (!['ASC', 'DESC'].includes(direction)) return 'id DESC';
    return `${field} ${direction}`;
  }

  async findAll(orderBy = 'id DESC', limit = null) {
    const safeOrderBy = this.validateOrderBy(orderBy);
    const sql = limit
      ? `SELECT * FROM ${this.tableName} ORDER BY ${safeOrderBy} LIMIT ?`
      : `SELECT * FROM ${this.tableName} ORDER BY ${safeOrderBy}`;
    return limit ? dbManager.all(sql, [limit]) : dbManager.all(sql);
  }

  async findById(id) {
    if (!dbManager.adapter) return null;
    const safeId = this.validateId(id);
    return dbManager.get(`SELECT * FROM ${this.tableName} WHERE id = ?`, [safeId]);
  }

  async findByField(field, value) {
    const safeField = this.validateFieldName(field);
    return dbManager.get(`SELECT * FROM ${this.tableName} WHERE ${safeField} = ?`, [value]);
  }

  async search(field, query) {
    const safeField = this.validateFieldName(field);
    const safeQuery = Sanitizer.sanitizeString(query, 255);
    return dbManager.all(
      `SELECT * FROM ${this.tableName} WHERE ${safeField} LIKE ?`,
      [`%${safeQuery}%`]
    );
  }

  async create(data, schema = null) {
    if (!dbManager.adapter) return null;
    if (schema) {
      data = Sanitizer.sanitizeObject(data, schema);
    }
    const columns = Object.keys(data).join(', ');
    const placeholders = Object.keys(data).map(() => '?').join(', ');
    const values = Object.values(data);
    const sql = `INSERT INTO ${this.tableName} (${columns}) VALUES (${placeholders})`;
    const result = await dbManager.run(sql, values);
    if (!result || result.lastInsertRowid <= 0) return null;
    return this.findById(result.lastInsertRowid);
  }

  async update(id, data, schema = null) {
    if (!dbManager.adapter) return null;
    const safeId = this.validateId(id);
    if (schema) {
      data = Sanitizer.sanitizeObject(data, schema);
    }
    const setClause = Object.keys(data).map(key => `${key} = ?`).join(', ');
    const values = [...Object.values(data), safeId];
    const sql = `UPDATE ${this.tableName} SET ${setClause} WHERE id = ?`;
    await dbManager.run(sql, values);
    return this.findById(safeId);
  }

  async delete(id) {
    if (!dbManager.adapter) return { changes: 0 };
    const safeId = this.validateId(id);
    return dbManager.run(`DELETE FROM ${this.tableName} WHERE id = ?`, [safeId]);
  }

  async count() {
    const result = await dbManager.get(`SELECT COUNT(*) as count FROM ${this.tableName}`);
    return result?.count || 0;
  }
}