import { BaseRepository } from './BaseRepository.js';
import dbManager from '../DB.js';
import { CustomerSchema } from '../schemas.js';
import { Sanitizer } from '../../utils/sanitizer.js';

export class CustomerRepository extends BaseRepository {
  constructor() {
    super('customers');
  }

  create(data) {
    return super.create(data, CustomerSchema);
  }

  update(id, data) {
    return super.update(id, data, CustomerSchema);
  }

  search(query) {
    const safeQuery = Sanitizer.sanitizeString(query, 255);
    return dbManager.all(
      'SELECT * FROM customers WHERE name LIKE ? OR phone LIKE ?',
      [`%${safeQuery}%`, `%${safeQuery}%`]
    );
  }

  findWithDebt() {
    return dbManager.all('SELECT * FROM customers WHERE balance > 0 ORDER BY balance DESC');
  }

  async updateBalance(id, newBalance) {
    const safeId = this.validateId(id);
    const safeBalance = Sanitizer.sanitizeNumber(newBalance, 0);
    return dbManager.run(
      'UPDATE customers SET balance = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      [safeBalance, safeId]
    );
  }

  getStats() {
    return dbManager.get(`
      SELECT
        COUNT(*) as total,
        SUM(CASE WHEN balance > 0 THEN 1 ELSE 0 END) as withDebt,
        SUM(balance) as totalDebt
      FROM customers
    `);
  }
}