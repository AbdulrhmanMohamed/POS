import { BaseRepository } from './BaseRepository.js';
import dbManager from '../DB.js';
import { ProductSchema } from '../schemas.js';
import { Sanitizer } from '../../utils/sanitizer.js';

export class ProductRepository extends BaseRepository {
  constructor() {
    super('products');
  }

  create(data) {
    return super.create(data, ProductSchema);
  }

  update(id, data) {
    return super.update(id, data, ProductSchema);
  }

  async findByBarcode(barcode) {
    const safeBarcode = Sanitizer.sanitizeBarcode(barcode);
    return dbManager.get('SELECT * FROM products WHERE barcode = ?', [safeBarcode]);
  }

  search(query) {
    const safeQuery = Sanitizer.sanitizeString(query, 255);
    return dbManager.all(
      'SELECT * FROM products WHERE name LIKE ? OR barcode LIKE ?',
      [`%${safeQuery}%`, `%${safeQuery}%`]
    );
  }

  findLowStock() {
    return dbManager.all('SELECT * FROM products WHERE stock <= min_stock AND min_stock > 0');
  }

  async updateStock(id, newStock) {
    const safeId = this.validateId(id);
    const safeStock = Sanitizer.sanitizeInteger(newStock, 0);
    return dbManager.run(
      'UPDATE products SET stock = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      [safeStock, safeId]
    );
  }

  findByCategory(category) {
    const safeCategory = Sanitizer.sanitizeString(category, 100);
    return dbManager.all('SELECT * FROM products WHERE category = ?', [safeCategory]);
  }

  getCategories() {
    return dbManager.all('SELECT DISTINCT category FROM products WHERE category IS NOT NULL');
  }
}