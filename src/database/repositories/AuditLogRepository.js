import { BaseRepository } from './BaseRepository.js';
import dbManager from '../DB.js';
import { AuditLogSchema } from '../schemas.js';
import { Sanitizer } from '../../utils/sanitizer.js';

export class AuditLogRepository extends BaseRepository {
  constructor() {
    super('audit_logs');
  }

  create(data) {
    const sanitized = { ...data };
    if (data.old_value) sanitized.old_value = JSON.stringify(data.old_value);
    if (data.new_value) sanitized.new_value = JSON.stringify(data.new_value);
    return super.create(sanitized, AuditLogSchema);
  }

  findAll(limit = 100) {
    const safeLimit = Sanitizer.sanitizeInteger(limit, 100);
    return dbManager.all(`
      SELECT * FROM audit_logs
      ORDER BY created_at DESC
      LIMIT ?
    `, [safeLimit]);
  }

  findByEntity(entityType, entityId) {
    const safeType = Sanitizer.sanitizeString(entityType, 50);
    const safeId = this.validateId(entityId);
    return dbManager.all(`
      SELECT * FROM audit_logs
      WHERE entity_type = ? AND entity_id = ?
      ORDER BY created_at DESC
    `, [safeType, safeId]);
  }

  findByDateRange(startDate, endDate) {
    const safeStart = Sanitizer.sanitizeString(startDate, 10);
    const safeEnd = Sanitizer.sanitizeString(endDate, 10);
    return dbManager.all(`
      SELECT * FROM audit_logs
      WHERE DATE(created_at) BETWEEN DATE(?) AND DATE(?)
      ORDER BY created_at DESC
    `, [safeStart, safeEnd]);
  }

  search(query) {
    const safeQuery = Sanitizer.sanitizeString(query, 255);
    return dbManager.all(`
      SELECT * FROM audit_logs
      WHERE action LIKE ? OR entity_type LIKE ?
      ORDER BY created_at DESC
      LIMIT 100
    `, [`%${safeQuery}%`, `%${safeQuery}%`]);
  }
}