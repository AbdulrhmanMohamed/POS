import { BaseRepository } from './BaseRepository.js';
import dbManager from '../DB.js';
import { InventorySchema } from '../schemas.js';
import { Sanitizer } from '../../utils/sanitizer.js';

export class InventoryRepository extends BaseRepository {
  constructor() {
    super('inventory');
  }

  create(data) {
    return super.create(data, InventorySchema);
  }

  findAllWithProduct(limit = 100) {
    const safeLimit = Sanitizer.sanitizeInteger(limit, 100);
    return dbManager.all(`
      SELECT i.*, p.name as product_name, p.barcode
      FROM inventory i
      JOIN products p ON i.product_id = p.id
      ORDER BY i.created_at DESC
      LIMIT ?
    `, [safeLimit]);
  }

  findByProductId(productId) {
    const safeId = this.validateId(productId);
    return dbManager.all(`
      SELECT * FROM inventory
      WHERE product_id = ?
      ORDER BY created_at DESC
    `, [safeId]);
  }

  findByDateRange(startDate, endDate) {
    const safeStart = Sanitizer.sanitizeString(startDate, 10);
    const safeEnd = Sanitizer.sanitizeString(endDate, 10);
    return dbManager.all(`
      SELECT i.*, p.name as product_name, p.barcode
      FROM inventory i
      JOIN products p ON i.product_id = p.id
      WHERE DATE(i.created_at) BETWEEN DATE(?) AND DATE(?)
      ORDER BY i.created_at DESC
    `, [safeStart, safeEnd]);
  }
}