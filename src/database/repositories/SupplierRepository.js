import { BaseRepository } from './BaseRepository.js';
import dbManager from '../DB.js';
import { SupplierSchema } from '../schemas.js';
import { Sanitizer } from '../../utils/sanitizer.js';

export class SupplierRepository extends BaseRepository {
  constructor() {
    super('suppliers');
  }

  create(data) {
    return super.create(data, SupplierSchema);
  }

  update(id, data) {
    return super.update(id, data, SupplierSchema);
  }

  search(query) {
    const safeQuery = Sanitizer.sanitizeString(query, 255);
    return dbManager.all(
      'SELECT * FROM suppliers WHERE name LIKE ? OR phone LIKE ?',
      [`%${safeQuery}%`, `%${safeQuery}%`]
    );
  }

  async updateBalance(id, newBalance) {
    const safeId = this.validateId(id);
    const safeBalance = Sanitizer.sanitizeNumber(newBalance, 0);
    return dbManager.run(
      'UPDATE suppliers SET balance = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      [safeBalance, safeId]
    );
  }
}