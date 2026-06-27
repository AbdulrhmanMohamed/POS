import { runMigrations } from './migrations.js';
import { seedDatabase } from './seed.js';

const db = window.electronAPI?.db;

class ProductRepo {
  async findAll(orderBy = 'id DESC', limit = null) {
    if (!db) return [];
    const products = await db.all('SELECT p.*, s.name as supplier_name FROM products p LEFT JOIN suppliers s ON p.supplier_id = s.id ORDER BY p.name ASC');
    return limit ? products.slice(0, limit) : products;
  }

  async findById(id) {
    if (!db) return null;
    return db.get('SELECT p.*, s.name as supplier_name FROM products p LEFT JOIN suppliers s ON p.supplier_id = s.id WHERE p.id = ?', [id]);
  }

  async create(data) {
    if (!db) return null;
    const columns = Object.keys(data).join(', ');
    const placeholders = Object.keys(data).map(() => '?').join(', ');
    const values = Object.values(data);
    const result = await db.run(`INSERT INTO products (${columns}) VALUES (${placeholders})`, values);
    return { id: result.lastInsertRowid };
  }

  async update(id, data) {
    if (!db) return null;
    const setClause = Object.keys(data).map(k => `${k} = ?`).join(', ');
    const values = [...Object.values(data), id];
    await db.run(`UPDATE products SET ${setClause} WHERE id = ?`, values);
    return { id };
  }

  async delete(id) {
    if (!db) return { changes: 0 };
    return db.run('DELETE FROM products WHERE id = ?', [id]);
  }

  async hasPendingPurchaseOrders(productId) {
    if (!db) return false;
    const result = await db.get(
      'SELECT COUNT(*) as count FROM purchase_order_items poi JOIN purchase_orders po ON poi.purchase_order_id = po.id WHERE poi.product_id = ? AND po.status = ?',
      [productId, 'pending']
    );
    return (result?.count || 0) > 0;
  }

  async updateStatus(id, status) {
    if (!db) return null;
    return db.run('UPDATE products SET status = ? WHERE id = ?', [status, id]);
  }

  async findByBarcode(barcode) {
    if (!db) return null;
    return db.get('SELECT * FROM products WHERE barcode = ?', [barcode]);
  }

  async search(query) {
    if (!db) return [];
    const q = `%${query}%`;
    return db.all('SELECT * FROM products WHERE name LIKE ? OR barcode LIKE ?', [q, q]);
  }

  async findLowStock() {
    if (!db) return [];
    return db.all('SELECT * FROM products WHERE stock <= min_stock AND min_stock > 0');
  }

  async getCategorySummary() {
    if (!db) return [];
    return db.all(`SELECT category, COUNT(*) as count FROM products WHERE category IS NOT NULL AND category!='' GROUP BY category ORDER BY count DESC`);
  }

  async updateStock(id, newStock) {
    if (!db) return { changes: 0 };
    return db.run('UPDATE products SET stock = ? WHERE id = ?', [newStock, id]);
  }
}

class CustomerRepo {
  async findAll(orderBy = 'id DESC', limit = null) {
    if (!db) return [];
    const customers = await db.all('SELECT * FROM customers ORDER BY name ASC');
    return limit ? customers.slice(0, limit) : customers;
  }

  async findById(id) {
    if (!db) return null;
    return db.get('SELECT * FROM customers WHERE id = ?', [id]);
  }

  async create(data) {
    if (!db) return null;
    const columns = Object.keys(data).join(', ');
    const placeholders = Object.keys(data).map(() => '?').join(', ');
    const values = Object.values(data);
    const result = await db.run(`INSERT INTO customers (${columns}) VALUES (${placeholders})`, values);
    return { id: result.lastInsertRowid };
  }

  async update(id, data) {
    if (!db) return null;
    const setClause = Object.keys(data).map(k => `${k} = ?`).join(', ');
    const values = [...Object.values(data), id];
    await db.run(`UPDATE customers SET ${setClause} WHERE id = ?`, values);
    return { id };
  }

  async delete(id) {
    if (!db) return { changes: 0 };
    return db.run('DELETE FROM customers WHERE id = ?', [id]);
  }

  async hasInvoices(customerId) {
    if (!db) return false;
    const result = await db.get('SELECT COUNT(*) as count FROM invoices WHERE customer_id = ?', [customerId]);
    return (result?.count || 0) > 0;
  }
}

class SupplierRepo {
  async findAll(orderBy = 'id DESC', limit = null) {
    if (!db) return [];
    const suppliers = await db.all('SELECT * FROM suppliers ORDER BY name ASC');
    return limit ? suppliers.slice(0, limit) : suppliers;
  }

  async findById(id) {
    if (!db) return null;
    return db.get('SELECT * FROM suppliers WHERE id = ?', [id]);
  }

  async create(data) {
    if (!db) return null;
    const columns = Object.keys(data).join(', ');
    const placeholders = Object.keys(data).map(() => '?').join(', ');
    const values = Object.values(data);
    const result = await db.run(`INSERT INTO suppliers (${columns}) VALUES (${placeholders})`, values);
    return { id: result.lastInsertRowid };
  }

  async update(id, data) {
    if (!db) return null;
    const setClause = Object.keys(data).map(k => `${k} = ?`).join(', ');
    const values = [...Object.values(data), id];
    await db.run(`UPDATE suppliers SET ${setClause} WHERE id = ?`, values);
    return { id };
  }

  async delete(id) {
    if (!db) return { changes: 0 };
    return db.run('DELETE FROM suppliers WHERE id = ?', [id]);
  }

  async hasPurchaseOrders(supplierId) {
    if (!db) return false;
    const result = await db.get('SELECT COUNT(*) as count FROM purchase_orders WHERE supplier_id = ?', [supplierId]);
    return (result?.count || 0) > 0;
  }
}

class InvoiceRepo {
  async findAll(orderBy = 'id DESC', limit = null) {
    if (!db) return [];
    const invoices = await db.all('SELECT * FROM invoices ORDER BY created_at DESC');
    return limit ? invoices.slice(0, limit) : invoices;
  }

  async findById(id) {
    if (!db) return null;
    return db.get('SELECT * FROM invoices WHERE id = ?', [id]);
  }

  async create(data) {
    if (!db) return null;
    const columns = Object.keys(data).join(', ');
    const placeholders = Object.keys(data).map(() => '?').join(', ');
    const values = Object.values(data);
    const result = await db.run(`INSERT INTO invoices (${columns}) VALUES (${placeholders})`, values);
    return { id: result.lastInsertRowid };
  }

  async findWithCustomer() {
    return this.findAll();
  }

  async getDailySales(date = null) {
    if (!db) return { total: 0, count: 0 };
    const safeDate = date || new Date().toISOString().slice(0, 10);
    const invoices = await db.all('SELECT * FROM invoices');
    const today = invoices.filter(i => {
      if (!i.created_at) return false;
      const dateStr = new Date(i.created_at).toISOString().slice(0, 10);
      return dateStr === safeDate;
    });
    const total = today.reduce((sum, i) => sum + (parseFloat(i.total) || 0), 0);
    return { total, count: today.length };
  }

  generateInvoiceNumber() {
    const prefix = 'INV';
    const today = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    return `${prefix}-${today}-${String(Math.floor(Math.random() * 10000)).padStart(4, '0')}`;
  }

  async createInvoiceWithItems(invoiceData, items) {
    if (!db) return null;
    const invoiceId = await this.create(invoiceData);
    if (!invoiceId?.id) return null;
    for (const item of items) {
      const product = await db.get('SELECT stock, cost FROM products WHERE id = ?', [item.product_id]);
      const unitCost = product ? Number(product.cost) : 0;
      await db.run(
        'INSERT INTO invoice_items (invoice_id, product_id, product_name, barcode, quantity, unit_price, unit_cost, total_price) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
        [invoiceId.id, item.product_id, item.product_name, item.barcode, item.quantity, item.unit_price, unitCost, item.total_price]
      );
      if (product) {
        const newStock = product.stock - item.quantity;
        await db.run('UPDATE products SET stock = ? WHERE id = ?', [newStock, item.product_id]);
        await db.run(
          'INSERT INTO inventory (product_id, type, quantity, balance_before, balance_after, notes) VALUES (?, ?, ?, ?, ?, ?)',
          [item.product_id, 'sale', item.quantity, product.stock, newStock, `Sale: ${invoiceData.invoice_number || invoiceId.id}`]
        );
      }
    }
    const openRegister = await db.get('SELECT id FROM cash_registers WHERE status = ?', ['open']);
    if (openRegister) {
      const total = Number(invoiceData.total) || 0;
      if (total > 0) {
        await db.run(
          'INSERT INTO cashier_movements (register_id, type, amount, reason) VALUES (?, ?, ?, ?)',
          [openRegister.id, 'in', total, `POS Sale: ${invoiceData.invoice_number || invoiceId.id}`]
        );
      }
    }

    try {
      const entryDate = new Date().toISOString().slice(0, 10);
      const entryNumber = `JE-INV-${entryDate.replace(/-/g, '')}-${String(Math.floor(Math.random() * 1000)).padStart(3, '0')}`;
      const invTotal = Number(invoiceData.total) || 0;
      const journalItems = [
        { account_id: 1110, debit: invTotal, credit: 0, description: `Sale: ${invoiceData.invoice_number}` },
        { account_id: 4110, debit: 0, credit: invTotal, description: `Sale: ${invoiceData.invoice_number}` },
      ];
      const totalCost = items.reduce((sum, item) => sum + (item.quantity * (item.unit_cost || 0)), 0);
      if (totalCost > 0) {
        journalItems.push(
          { account_id: 5110, debit: totalCost, credit: 0, description: `COGS: ${invoiceData.invoice_number}` },
          { account_id: 1310, debit: 0, credit: totalCost, description: `COGS: ${invoiceData.invoice_number}` }
        );
      }
      const jeId = await db.run(
        'INSERT INTO journal_entries (entry_number, date, description, reference, source_type, source_id, status, total_debit, total_credit) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
        [entryNumber, entryDate, `Sale - ${invoiceData.invoice_number}`, invoiceData.invoice_number, 'invoice', invoiceId.id, 'posted', invTotal + totalCost, invTotal + totalCost]
      );
      const journalEntryId = jeId?.lastInsertRowid;
      if (journalEntryId) {
        for (const ji of journalItems) {
          await db.run(
            'INSERT INTO journal_items (entry_id, account_id, debit, credit, description) VALUES (?, ?, ?, ?, ?)',
            [journalEntryId, ji.account_id, ji.debit, ji.credit, ji.description]
          );
        }
      }
    } catch (err) {
      console.error('Failed to create journal entry:', err);
    }

    return invoiceId;
  }

  async updateStatus(id, status, paid = null) {
    if (!db) return null;
    if (paid !== null) {
      await db.run('UPDATE invoices SET status = ?, paid = ? WHERE id = ?', [status, paid, id]);
    } else {
      await db.run('UPDATE invoices SET status = ? WHERE id = ?', [status, id]);
    }
    return { id };
  }

  async findInvoicedByCustomer(customerId) {
    if (!db) return [];
    return db.all('SELECT * FROM invoices WHERE customer_id = ? ORDER BY created_at DESC', [customerId]);
  }
}

class InventoryRepo {
  async findAll(limit = 100, offset = 0) {
    if (!db) return [];
    return db.all('SELECT i.*, p.name as product_name, p.barcode, p.category FROM inventory i JOIN products p ON i.product_id = p.id ORDER BY i.created_at DESC LIMIT ? OFFSET ?', [limit, offset]);
  }

  async count() {
    if (!db) return 0;
    const r = await db.get('SELECT COUNT(*) as total FROM inventory');
    return r?.total || 0;
  }

  async findById(id) {
    if (!db) return null;
    return db.get('SELECT i.*, p.name as product_name, p.barcode FROM inventory i JOIN products p ON i.product_id = p.id WHERE i.id = ?', [id]);
  }

  async findByProductId(productId, limit = 50) {
    if (!db) return [];
    return db.all(
      'SELECT * FROM inventory WHERE product_id = ? ORDER BY created_at DESC LIMIT ?',
      [productId, limit]
    );
  }

  async getTotalValue() {
    if (!db) return 0;
    const r = await db.get('SELECT COALESCE(SUM(stock*cost),0) as total FROM products');
    return Number(r?.total || 0);
  }

  async getValueByCategory() {
    if (!db) return [];
    return db.all(
      `SELECT category, COALESCE(SUM(stock*cost),0) as value, COUNT(*) as product_count FROM products WHERE category IS NOT NULL AND category!='' GROUP BY category ORDER BY value DESC`
    );
  }

  async getLowStockProducts(limit = 20) {
    if (!db) return [];
    return db.all(
      `SELECT id, name, barcode, stock, min_stock, category, unit, (stock*cost) as value FROM products WHERE stock <= min_stock AND min_stock > 0 ORDER BY stock ASC LIMIT ?`,
      [limit]
    );
  }

  async getLowStockCount() {
    if (!db) return 0;
    const r = await db.get('SELECT COUNT(*) as count FROM products WHERE stock <= min_stock AND min_stock > 0');
    return r?.count || 0;
  }

  async create(data) {
    if (!db) return null;
    const columns = Object.keys(data).join(', ');
    const placeholders = Object.keys(data).map(() => '?').join(', ');
    const values = Object.values(data);
    const result = await db.run(`INSERT INTO inventory (${columns}) VALUES (${placeholders})`, values);
    return { id: result.lastInsertRowid };
  }

  async update(id, data) {
    if (!db) return null;
    const setClause = Object.keys(data).map(k => `${k} = ?`).join(', ');
    const values = [...Object.values(data), id];
    await db.run(`UPDATE inventory SET ${setClause} WHERE id = ?`, values);
    return { id };
  }

  async delete(id) {
    if (!db) return { changes: 0 };
    return db.run('DELETE FROM inventory WHERE id = ?', [id]);
  }

  async countByProductId(productId) {
    if (!db) return 0;
    const result = await db.get('SELECT COUNT(*) as count FROM inventory WHERE product_id = ?', [productId]);
    return result?.count || 0;
  }
}

class AuditLogRepo {
  async findAll(limit = 100) {
    if (!db) return [];
    const logs = await db.all('SELECT * FROM audit_logs ORDER BY created_at DESC');
    return limit ? logs.slice(0, limit) : logs;
  }

  async findByOperation(operationId) {
    if (!db) return [];
    return db.all('SELECT * FROM audit_logs WHERE operation_id = ? ORDER BY id ASC', [operationId]);
  }

  async getOperations(limit = 50) {
    if (!db) return [];
    return db.all(
      `SELECT operation_id, action, entity_type, entity_id,
              MIN(created_at) as created_at, COUNT(*) as entry_count
       FROM audit_logs
       WHERE operation_id IS NOT NULL
       GROUP BY operation_id
       ORDER BY created_at DESC
       LIMIT ?`,
      [limit]
    );
  }

  async log(entry) {
    if (!db) return null;
    return db.run(
      `INSERT INTO audit_logs (user_id, action, entity_type, entity_id, table_name, row_id, old_value, new_value, operation_id, is_undone)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0)`,
      [
        entry.user_id || null,
        entry.action,
        entry.entity_type,
        entry.entity_id || null,
        entry.table_name || null,
        entry.row_id || null,
        entry.old_value ? JSON.stringify(entry.old_value) : null,
        entry.new_value ? JSON.stringify(entry.new_value) : null,
        entry.operation_id || null,
      ]
    );
  }
}

class SettingsRepo {
  async getAll() {
    if (!db) return {};
    const rows = await db.all('SELECT "key", value FROM settings');
    const settings = {};
    rows.forEach(r => { settings[r.key] = r.value; });
    return settings;
  }

  async get(key) {
    const settings = await this.getAll();
    return settings[key];
  }

  async set(key, value) {
    if (!db) return { success: false };
    await db.run('INSERT INTO settings ("key", value) VALUES (?, ?) ON CONFLICT("key") DO UPDATE SET value = excluded.value', [key, value]);
    return { success: true };
  }
}

class PurchaseOrderRepo {
  async findAll(limit = 100) {
    if (!db) return [];
    const orders = await db.all('SELECT po.*, s.name as supplier_name FROM purchase_orders po LEFT JOIN suppliers s ON po.supplier_id = s.id ORDER BY po.created_at DESC');
    return limit ? orders.slice(0, limit) : orders;
  }

  async findById(id) {
    if (!db) return null;
    return db.get('SELECT po.*, s.name as supplier_name FROM purchase_orders po LEFT JOIN suppliers s ON po.supplier_id = s.id WHERE po.id = ?', [id]);
  }

  async create(data) {
    if (!db) return null;
    const columns = Object.keys(data).join(', ');
    const placeholders = Object.keys(data).map(() => '?').join(', ');
    const values = Object.values(data);
    const result = await db.run(`INSERT INTO purchase_orders (${columns}) VALUES (${placeholders})`, values);
    return { id: result.lastInsertRowid };
  }

  async update(id, data) {
    if (!db) return null;
    const setClause = Object.keys(data).map(k => `${k} = ?`).join(', ');
    const values = [...Object.values(data), id];
    await db.run(`UPDATE purchase_orders SET ${setClause} WHERE id = ?`, values);
    return { id };
  }

  async delete(id) {
    if (!db) return { changes: 0 };
    return db.run('DELETE FROM purchase_orders WHERE id = ?', [id]);
  }

  async cancelOrder(orderId) {
    if (!db) return null;
    const order = await this.findById(orderId);
    if (!order || order.status !== 'pending') return null;
    await this.update(orderId, { status: 'cancelled' });
    return { id: orderId };
  }

  async getItems(orderId) {
    if (!db) return [];
    return db.all('SELECT * FROM purchase_order_items WHERE purchase_order_id = ?', [orderId]);
  }

  async findBySupplier(supplierId) {
    if (!db) return [];
    return db.all(
      'SELECT po.*, s.name as supplier_name FROM purchase_orders po LEFT JOIN suppliers s ON po.supplier_id = s.id WHERE po.supplier_id = ? ORDER BY po.created_at DESC',
      [supplierId]
    );
  }

  async createWithItems(orderData, items) {
    if (!db) return null;
    const orderId = await this.create(orderData);
    if (!orderId?.id) return null;
    for (const item of items) {
      await db.run(
        'INSERT INTO purchase_order_items (purchase_order_id, product_id, product_name, quantity, unit_price, total_price) VALUES (?, ?, ?, ?, ?, ?)',
        [orderId.id, item.product_id, item.product_name, item.quantity, item.unit_price, item.total_price]
      );
    }
    return orderId;
  }

  async receiveOrder(orderId) {
    const order = await this.findById(orderId);
    if (!order || order.status !== 'pending') return null;
    
    const items = await this.getItems(orderId);
    for (const item of items) {
      const product = await db.get('SELECT stock, cost FROM products WHERE id = ?', [item.product_id]);
      if (product) {
        const newStock = product.stock + item.quantity;
        const poUnitCost = Number(item.unit_price) || 0;
        const oldCost = product.cost;
        await db.run('UPDATE products SET stock = ?, cost = ? WHERE id = ?', [newStock, poUnitCost, item.product_id]);
        let notes = `PO: ${order.po_number}`;
        if (Number(oldCost) !== poUnitCost) {
          notes += ` (cost: ${oldCost} → ${poUnitCost})`;
        }
        await db.run(
          'INSERT INTO inventory (product_id, type, quantity, balance_before, balance_after, notes) VALUES (?, ?, ?, ?, ?, ?)',
          [item.product_id, 'add', item.quantity, product.stock, newStock, notes]
        );
      }
    }
    const now = new Date();
    const mysqlDate = now.getFullYear() + '-' +
      String(now.getMonth() + 1).padStart(2, '0') + '-' +
      String(now.getDate()).padStart(2, '0') + ' ' +
      String(now.getHours()).padStart(2, '0') + ':' +
      String(now.getMinutes()).padStart(2, '0') + ':' +
      String(now.getSeconds()).padStart(2, '0');
    await this.update(orderId, { status: 'received', received_at: mysqlDate });

    const openRegister = await db.get('SELECT id FROM cash_registers WHERE status = ?', ['open']);
    if (openRegister && Number(order.total) > 0) {
      await db.run(
        'INSERT INTO cashier_movements (register_id, type, amount, reason) VALUES (?, ?, ?, ?)',
        [openRegister.id, 'out', Number(order.total), `PO Receive: ${order.po_number}`]
      );
    }

    return { id: orderId };
  }
}

class ReturnRepo {
  async findAll(limit = 100) {
    if (!db) return [];
    const returns = await db.all('SELECT r.*, c.name as customer_name, i.invoice_number FROM returns r LEFT JOIN customers c ON r.customer_id = c.id LEFT JOIN invoices i ON r.invoice_id = i.id ORDER BY r.created_at DESC');
    return limit ? returns.slice(0, limit) : returns;
  }

  async findById(id) {
    if (!db) return null;
    return db.get('SELECT r.*, c.name as customer_name FROM returns r LEFT JOIN customers c ON r.customer_id = c.id WHERE r.id = ?', [id]);
  }

  async create(data) {
    if (!db) return null;
    const columns = Object.keys(data).join(', ');
    const placeholders = Object.keys(data).map(() => '?').join(', ');
    const values = Object.values(data);
    const result = await db.run(`INSERT INTO returns (${columns}) VALUES (${placeholders})`, values);
    return { id: result.lastInsertRowid };
  }

  async getItems(returnId) {
    if (!db) return [];
    return db.all('SELECT * FROM return_items WHERE return_id = ?', [returnId]);
  }

  async findByCustomer(customerId) {
    if (!db) return [];
    return db.all(
      'SELECT r.*, i.invoice_number FROM returns r LEFT JOIN invoices i ON r.invoice_id = i.id WHERE r.customer_id = ? ORDER BY r.created_at DESC',
      [customerId]
    );
  }

  async createWithItems(returnData, items) {
    if (!db) return null;

    const invoice = await db.get('SELECT status FROM invoices WHERE id = ?', [returnData.invoice_id]);
    if (invoice && invoice.status === 'cancelled') {
      throw new Error('Cannot return items from a cancelled invoice');
    }

    for (const item of items) {
      const existingReturn = await db.get(
        'SELECT ri.id FROM return_items ri JOIN returns r ON ri.return_id = r.id WHERE ri.product_id = ? AND r.invoice_id = ? AND r.status != ?',
        [item.product_id, returnData.invoice_id, 'cancelled']
      );
      if (existingReturn) {
        throw new Error(`Product ${item.product_id} already returned for this invoice`);
      }
    }

    const returnId = await this.create(returnData);
    if (!returnId?.id) return null;
    for (const item of items) {
      await db.run(
        'INSERT INTO return_items (return_id, product_id, product_name, quantity, unit_price, total_price) VALUES (?, ?, ?, ?, ?, ?)',
        [returnId.id, item.product_id, item.product_name, item.quantity, item.unit_price, item.total_price]
      );
      
      const product = await db.get('SELECT stock FROM products WHERE id = ?', [item.product_id]);
      if (product) {
        const newStock = product.stock + item.quantity;
        await db.run('UPDATE products SET stock = ? WHERE id = ?', [newStock, item.product_id]);
        await db.run(
          'INSERT INTO inventory (product_id, type, quantity, balance_before, balance_after, notes) VALUES (?, ?, ?, ?, ?, ?)',
          [item.product_id, 'return', item.quantity, product.stock, newStock, `Return: ${returnData.return_number}`]
        );
      }
    }
    return returnId;
  }
}

class ExchangeRepo {
  async findAll(limit = 100) {
    if (!db) return [];
    const exchanges = await db.all(
      `SELECT e.*, c.name as customer_name, i.invoice_number 
       FROM exchanges e 
       LEFT JOIN customers c ON e.customer_id = c.id 
       LEFT JOIN invoices i ON e.invoice_id = i.id 
       ORDER BY e.created_at DESC`
    );
    return limit ? exchanges.slice(0, limit) : exchanges;
  }

  async findById(id) {
    if (!db) return null;
    return db.get('SELECT * FROM exchanges WHERE id = ?', [id]);
  }

  async create(data) {
    if (!db) return null;
    const columns = Object.keys(data).join(', ');
    const placeholders = Object.keys(data).map(() => '?').join(', ');
    const values = Object.values(data);
    const result = await db.run(`INSERT INTO exchanges (${columns}) VALUES (${placeholders})`, values);
    return { id: result.lastInsertRowid };
  }

  async getItems(exchangeId) {
    if (!db) return [];
    return db.all('SELECT * FROM exchange_items WHERE exchange_id = ?', [exchangeId]);
  }

  async createWithItems(exchangeData, returnedItems, replacementItems) {
    if (!db) return null;
    const exchangeId = await this.create(exchangeData);
    if (!exchangeId?.id) return null;

    for (const item of returnedItems) {
      await db.run(
        'INSERT INTO exchange_items (exchange_id, product_id, quantity, unit_price, total, type) VALUES (?, ?, ?, ?, ?, ?)',
        [exchangeId.id, item.product_id, item.quantity, item.unit_price, item.total, 'returned']
      );
      const product = await db.get('SELECT stock FROM products WHERE id = ?', [item.product_id]);
      if (product) {
        const newStock = product.stock + item.quantity;
        await db.run('UPDATE products SET stock = ? WHERE id = ?', [newStock, item.product_id]);
        await db.run(
          'INSERT INTO inventory (product_id, type, quantity, balance_before, balance_after, notes) VALUES (?, ?, ?, ?, ?, ?)',
          [item.product_id, 'return', item.quantity, product.stock, newStock, `Exchange return: ${exchangeData.exchange_number}`]
        );
      }
    }

    for (const item of replacementItems) {
      await db.run(
        'INSERT INTO exchange_items (exchange_id, product_id, quantity, unit_price, total, type) VALUES (?, ?, ?, ?, ?, ?)',
        [exchangeId.id, item.product_id, item.quantity, item.unit_price, item.total, 'replacement']
      );
      const product = await db.get('SELECT stock, cost FROM products WHERE id = ?', [item.product_id]);
      if (product) {
        const newStock = product.stock - item.quantity;
        if (newStock >= 0) {
          await db.run('UPDATE products SET stock = ? WHERE id = ?', [newStock, item.product_id]);
          await db.run(
            'INSERT INTO inventory (product_id, type, quantity, balance_before, balance_after, notes) VALUES (?, ?, ?, ?, ?, ?)',
            [item.product_id, 'sale', item.quantity, product.stock, newStock, `Exchange replacement: ${exchangeData.exchange_number}`]
          );
        }
      }
    }

    return exchangeId;
  }
}

class AccountRepo {
  async findAll() {
    if (!db) return [];
    return db.all('SELECT * FROM accounts WHERE is_active = 1 ORDER BY code');
  }

  async findById(id) {
    if (!db) return null;
    return db.get('SELECT * FROM accounts WHERE id = ?', [id]);
  }

  async findByCode(code) {
    if (!db) return null;
    return db.get('SELECT * FROM accounts WHERE code = ?', [code]);
  }

  async create(data) {
    if (!db) return null;
    const columns = Object.keys(data).join(', ');
    const placeholders = Object.keys(data).map(() => '?').join(', ');
    const values = Object.values(data);
    const result = await db.run(`INSERT INTO accounts (${columns}) VALUES (${placeholders})`, values);
    return { id: result.lastInsertRowid };
  }

  async update(id, data) {
    if (!db) return null;
    const setClause = Object.keys(data).map(k => `${k} = ?`).join(', ');
    const values = [...Object.values(data), id];
    await db.run(`UPDATE accounts SET ${setClause} WHERE id = ?`, values);
    return { id };
  }

  async getBalance(accountId) {
    const items = await db.all('SELECT SUM(debit) as total_debit, SUM(credit) as total_credit FROM journal_items WHERE account_id = ?', [accountId]);
    const { total_debit = 0, total_credit = 0 } = items[0] || {};
    return { debit: total_debit || 0, credit: total_credit || 0, balance: (total_debit || 0) - (total_credit || 0) };
  }

  async getTransactions(accountId, limit = 50) {
    return db.all(`
      SELECT ji.*, je.date, je.entry_number, je.description as entry_description, a.code, a.name as account_name, a.type
      FROM journal_items ji
      JOIN journal_entries je ON ji.entry_id = je.id
      JOIN accounts a ON ji.account_id = a.id
      WHERE ji.account_id = ?
      ORDER BY je.date DESC, je.id DESC
      LIMIT ?
    `, [accountId, limit]);
  }

  async delete(id) {
    if (!db) return null;
    const count = await db.get('SELECT COUNT(*) as cnt FROM journal_items WHERE account_id = ?', [id]);
    if (count.cnt > 0) {
      throw new Error('Cannot delete account with transactions');
    }
    await db.run('DELETE FROM accounts WHERE id = ?', [id]);
    return { id };
  }

  async run(sql, params) {
    if (!db) return null;
    return db.run(sql, params);
  }

  async get(sql, params) {
    if (!db) return null;
    return db.get(sql, params);
  }
}

class JournalEntryRepo {
  async findAll(limit = 100) {
    if (!db) return [];
    return db.all('SELECT * FROM journal_entries ORDER BY date DESC, id DESC');
  }

  async findById(id) {
    if (!db) return null;
    return db.get('SELECT * FROM journal_entries WHERE id = ?', [id]);
  }

  async getItems(entryId) {
    if (!db) return [];
    return db.all(`
      SELECT ji.*, a.code, a.name as account_name, a.type
      FROM journal_items ji
      JOIN accounts a ON ji.account_id = a.id
      WHERE ji.entry_id = ?
    `, [entryId]);
  }

  async createWithItems(entryData, items) {
    if (!db) return null;
    
    const totalDebit = items.reduce((sum, i) => sum + (parseFloat(i.debit) || 0), 0);
    const totalCredit = items.reduce((sum, i) => sum + (parseFloat(i.credit) || 0), 0);
    
    if (Math.abs(totalDebit - totalCredit) > 0.01) {
      throw new Error('Debit and credit must be equal');
    }

    const entry = { ...entryData, total_debit: totalDebit, total_credit: totalCredit };
    const columns = Object.keys(entry).join(', ');
    const placeholders = Object.keys(entry).map(() => '?').join(', ');
    const values = Object.values(entry);
    const result = await db.run(`INSERT INTO journal_entries (${columns}) VALUES (${placeholders})`, values);
    
    const entryId = result.lastInsertRowid;
    if (!entryId) return null;

    for (const item of items) {
      await db.run(
        'INSERT INTO journal_items (entry_id, account_id, debit, credit, description) VALUES (?, ?, ?, ?, ?)',
        [entryId, item.account_id, item.debit || 0, item.credit || 0, item.description || null]
      );
    }

    return { id: entryId };
  }

  generateEntryNumber() {
    return `JE-${new Date().toISOString().slice(0,10).replace(/-/g,'')}-${String(Math.floor(Math.random()*1000)).padStart(3,'0')}`;
  }
}

class ReportRepo {
  get db() { return window.electronAPI?.db; }

  async dailyReport(date = null) {
    if (!this.db) return null;
    const d = date || new Date().toISOString().slice(0, 10);
    const sales = await this.db.get(
      'SELECT COALESCE(SUM(total),0) as total, COUNT(*) as count FROM invoices WHERE DATE(created_at) = ?', [d]
    );
    const returns = await this.db.get(
      'SELECT COALESCE(SUM(total),0) as total FROM returns WHERE DATE(created_at) = ?', [d]
    );
    const expenses = await this.db.get(
      'SELECT COALESCE(SUM(amount),0) as total FROM expenses WHERE DATE(date) = ?', [d]
    );
    const wages = await this.db.get(
      'SELECT COALESCE(SUM(amount),0) as total FROM worker_payments WHERE DATE(created_at) = ?', [d]
    );
    const supplierPayments = await this.db.get(
      'SELECT COALESCE(SUM(amount),0) as total FROM supplier_payments WHERE DATE(created_at) = ?', [d]
    );
    const profit = await this.db.get(
      `SELECT COALESCE(SUM((ii.unit_price - ii.unit_cost) * ii.quantity),0) as total
       FROM invoice_items ii
       JOIN invoices i ON ii.invoice_id = i.id WHERE DATE(i.created_at) = ?`, [d]
    );
    return {
      sales: sales?.total || 0, invoicesCount: sales?.count || 0,
      returns: returns?.total || 0, expenses: expenses?.total || 0,
      wages: wages?.total || 0, supplierPayments: supplierPayments?.total || 0,
      profit: profit?.total || 0,
      net: (sales?.total || 0) - (returns?.total || 0) - (expenses?.total || 0) - (wages?.total || 0)
    };
  }

  async reportByPeriod(period, startDate, endDate) {
    if (!this.db) return null;

    const buildFilter = (col) => {
      if (period === 'daily') return `date(${col}) = date('now')`;
      if (period === 'weekly') return `strftime('%Y%W', ${col}) = strftime('%Y%W', 'now')`;
      if (period === 'monthly') return `strftime('%Y', ${col}) = strftime('%Y', 'now') AND strftime('%m', ${col}) = strftime('%m', 'now')`;
      return `date(${col}) BETWEEN ? AND ?`;
    };

    const invFilter = buildFilter('created_at');
    const invJoinFilter = buildFilter('i.created_at');
    const expFilter = buildFilter('date');
    const retFilter = buildFilter('created_at');
    const params = period === 'custom' ? [startDate, endDate] : [];

    const sales = await this.db.get(
      `SELECT COALESCE(SUM(total),0) as total, COUNT(*) as count FROM invoices WHERE ${invFilter}`, params
    );
    const returns = await this.db.get(
      `SELECT COALESCE(SUM(total),0) as total FROM returns WHERE ${retFilter}`, params
    );
    const expenses = await this.db.get(
      `SELECT COALESCE(SUM(amount),0) as total FROM expenses WHERE ${expFilter}`, params
    );

    const topProducts = await this.db.all(
      `SELECT p.id, p.name, SUM(ii.quantity) as qty, SUM(ii.total_price) as total
       FROM invoice_items ii JOIN products p ON ii.product_id = p.id
       JOIN invoices i ON ii.invoice_id = i.id
       WHERE ${invJoinFilter} GROUP BY p.id, p.name ORDER BY total DESC LIMIT 10`, params
    );

    const leastProducts = await this.db.all(
      `SELECT p.id, p.name, SUM(ii.quantity) as qty, SUM(ii.total_price) as total
       FROM invoice_items ii JOIN products p ON ii.product_id = p.id
       JOIN invoices i ON ii.invoice_id = i.id
       WHERE ${invJoinFilter} GROUP BY p.id, p.name ORDER BY total ASC LIMIT 10`, params
    );

    const customerDebts = await this.db.get('SELECT COALESCE(SUM(balance),0) as total FROM customers WHERE balance > 0');
    const supplierDebts = await this.db.get('SELECT COALESCE(SUM(balance),0) as total FROM suppliers WHERE balance > 0');
    const inventoryValue = await this.db.get('SELECT COALESCE(SUM(stock * cost),0) as total FROM products');

    return {
      sales: sales?.total || 0, invoicesCount: sales?.count || 0,
      returns: returns?.total || 0,
      expenses: expenses?.total || 0,
      topProducts: topProducts || [], leastProducts: leastProducts || [],
      customerDebts: customerDebts?.total || 0, supplierDebts: supplierDebts?.total || 0,
      inventoryValue: inventoryValue?.total || 0
    };
  }

  async performanceReport() {
    if (!this.db) return null;
    const thisWeek = await this.db.get("SELECT COALESCE(SUM(total),0) as total FROM invoices WHERE strftime('%Y%W', created_at) = strftime('%Y%W', 'now')");
    const lastWeek = await this.db.get("SELECT COALESCE(SUM(total),0) as total FROM invoices WHERE strftime('%Y%W', created_at) = strftime('%Y%W', 'now', '-7 days')");
    const thisMonth = await this.db.get("SELECT COALESCE(SUM(total),0) as total FROM invoices WHERE strftime('%Y', created_at) = strftime('%Y', 'now') AND strftime('%m', created_at) = strftime('%m', 'now')");
    const lastMonth = await this.db.get("SELECT COALESCE(SUM(total),0) as total FROM invoices WHERE strftime('%Y', created_at) = strftime('%Y', 'now', '-1 month') AND strftime('%m', created_at) = strftime('%m', 'now', '-1 month')");
    const thisYear = await this.db.get("SELECT COALESCE(SUM(total),0) as total FROM invoices WHERE strftime('%Y', created_at) = strftime('%Y', 'now')");
    const lastYear = await this.db.get("SELECT COALESCE(SUM(total),0) as total FROM invoices WHERE strftime('%Y', created_at) = strftime('%Y', 'now', '-1 year')");

    const bestDays = await this.db.all(
      `SELECT CASE CAST(strftime('%w', created_at) AS INTEGER) WHEN 0 THEN 'Sunday' WHEN 1 THEN 'Monday' WHEN 2 THEN 'Tuesday' WHEN 3 THEN 'Wednesday' WHEN 4 THEN 'Thursday' WHEN 5 THEN 'Friday' WHEN 6 THEN 'Saturday' END as day_name, COALESCE(SUM(total),0) as total, COUNT(*) as count
       FROM invoices GROUP BY day_name ORDER BY total DESC`
    );
    const bestHours = await this.db.all(
      `SELECT CAST(strftime('%H', created_at) AS INTEGER) as hour, COALESCE(SUM(total),0) as total, COUNT(*) as count
       FROM invoices GROUP BY hour ORDER BY total DESC`
    );
    const productTrends = await this.db.all(
      `SELECT p.name, SUM(ii.quantity) as qty, SUM(ii.total_price) as total
       FROM invoice_items ii JOIN products p ON ii.product_id = p.id
       JOIN invoices i ON ii.invoice_id = i.id
       WHERE i.created_at >= date('now', '-30 days')
       GROUP BY p.id, p.name ORDER BY total DESC LIMIT 10`
    );

    return {
      thisWeek: thisWeek?.total || 0,
      lastWeek: lastWeek?.total || 0,
      thisMonth: thisMonth?.total || 0,
      lastMonth: lastMonth?.total || 0,
      thisYear: thisYear?.total || 0,
      lastYear: lastYear?.total || 0,
      bestDays: bestDays || [],
      bestHours: bestHours || [],
      productTrends: productTrends || []
    };
  }

  async kpis() {
    if (!this.db) return null;
    const totalSales = await this.db.get('SELECT COALESCE(SUM(total),0) as total, COUNT(*) as count FROM invoices');
    const totalReturns = await this.db.get('SELECT COALESCE(SUM(total),0) as total FROM returns');
    const totalExpenses = await this.db.get('SELECT COALESCE(SUM(amount),0) as total FROM expenses');
    const totalWages = await this.db.get('SELECT COALESCE(SUM(amount),0) as total FROM worker_payments');
    const profit = await this.db.get(
      `SELECT COALESCE(SUM((ii.unit_price - ii.unit_cost) * ii.quantity),0) as total
       FROM invoice_items ii`
    );
    const avgInvoice = totalSales?.count > 0 ? (totalSales.total / totalSales.count) : 0;
    const inventoryValue = await this.db.get('SELECT COALESCE(SUM(stock * cost),0) as total FROM products');
    const customerDebts = await this.db.get('SELECT COALESCE(SUM(balance),0) as total FROM customers WHERE balance > 0');
    const supplierDebts = await this.db.get('SELECT COALESCE(SUM(balance),0) as total FROM suppliers WHERE balance > 0');

    const stagnant = await this.db.all(
      `SELECT p.id, p.name, p.stock FROM products p WHERE p.id NOT IN (
        SELECT DISTINCT ii.product_id FROM invoice_items ii JOIN invoices i ON ii.invoice_id = i.id
        WHERE i.created_at >= date('now', '-90 days')
      ) AND p.stock > 0 ORDER BY p.stock DESC LIMIT 10`
    );

    const topProducts = await this.db.all(
      `SELECT p.id, p.name, SUM(ii.quantity) as qty, SUM(ii.total_price) as total
       FROM invoice_items ii JOIN products p ON ii.product_id = p.id
       JOIN invoices i ON ii.invoice_id = i.id
       WHERE i.created_at >= date('now', '-30 days')
       GROUP BY p.id, p.name ORDER BY total DESC LIMIT 10`
    );

    const returnRate = totalSales?.total > 0 ? ((totalReturns?.total || 0) / totalSales.total * 100) : 0;

    const salesOverTime = await this.db.all(
      `SELECT DATE(created_at) as date, COALESCE(SUM(total),0) as total, COUNT(*) as count
       FROM invoices WHERE created_at >= date('now', '-30 days')
       GROUP BY DATE(created_at) ORDER BY date`
    );
    const profitTrend = await this.db.all(
      `SELECT DATE(i.created_at) as date, COALESCE(SUM((ii.unit_price - ii.unit_cost) * ii.quantity),0) as profit
       FROM invoice_items ii
       JOIN invoices i ON ii.invoice_id = i.id
       WHERE i.created_at >= date('now', '-30 days')
       GROUP BY DATE(i.created_at) ORDER BY date`
    );

    return {
      totalSales: totalSales?.total || 0, totalInvoices: totalSales?.count || 0,
      totalReturns: totalReturns?.total || 0,
      totalExpenses: totalExpenses?.total || 0, totalWages: totalWages?.total || 0,
      netProfit: profit?.total || 0,
      avgInvoiceValue: avgInvoice,
      inventoryValue: inventoryValue?.total || 0,
      customerDebts: customerDebts?.total || 0,
      supplierDebts: supplierDebts?.total || 0,
      stagnantProducts: stagnant || [],
      topProducts: topProducts || [],
      returnRate,
      salesOverTime: salesOverTime || [],
      profitTrend: profitTrend || []
    };
  }

  async customerFrequency(limit = 10) {
    if (!this.db) return [];
    return this.db.all(
      `SELECT c.id, c.name, COUNT(i.id) as orderCount, COALESCE(SUM(i.total),0) as totalSpent,
              MAX(i.created_at) as lastPurchase
       FROM customers c JOIN invoices i ON c.id = i.customer_id
       GROUP BY c.id, c.name
       ORDER BY orderCount DESC LIMIT ?`, [limit]
    );
  }

  async getRecentActivity(limit = 50) {
    if (!this.db) return [];

    const queries = [
      { sql: `SELECT 'product' as entity_type, id as entity_id, name as title, 'create' as action, created_at FROM products`, order: 'created_at' },
      { sql: `SELECT 'account' as entity_type, id as entity_id, name || ' (' || code || ')' as title, 'create' as action, created_at FROM accounts`, order: 'created_at' },
      { sql: `SELECT 'journal_entry' as entity_type, id as entity_id, description || ' (' || entry_number || ')' as title, 'create' as action, created_at FROM journal_entries`, order: 'created_at' },
      { sql: `SELECT 'invoice' as entity_type, id as entity_id, 'فاتورة #' || id as title, 'create' as action, created_at FROM invoices`, order: 'created_at' },
      { sql: `SELECT 'expense' as entity_type, id as entity_id, description as title, 'create' as action, created_at FROM expenses`, order: 'created_at' },
      { sql: `SELECT 'customer' as entity_type, id as entity_id, name as title, 'create' as action, created_at FROM customers`, order: 'created_at' },
      { sql: `SELECT 'supplier' as entity_type, id as entity_id, name as title, 'create' as action, created_at FROM suppliers`, order: 'created_at' },
    ];

    const unionParts = queries.map((q, i) => {
      const idx = i + 1;
      return `SELECT ${idx} as src, ${q.sql}`;
    });

    const sql = `
      SELECT src, entity_type, entity_id, title, action, created_at
      FROM (${unionParts.join(' UNION ALL ')})
      ORDER BY created_at DESC
      LIMIT ?
    `;

    return this.db.all(sql, [limit]);
  }

  async undoEntity(entityType, entityId) {
    if (!this.db) return null;
    try {
      switch (entityType) {
        case 'product':
          await this.db.run('DELETE FROM products WHERE id = ?', [entityId]);
          return { success: true, message: 'Product deleted' };
        case 'account': {
          const cnt = await this.db.get('SELECT COUNT(*) as cnt FROM journal_items WHERE account_id = ?', [entityId]);
          if (cnt.cnt > 0) throw new Error('Cannot undo: account has transactions');
          await this.db.run('DELETE FROM accounts WHERE id = ?', [entityId]);
          return { success: true, message: 'Account deleted' };
        }
        case 'journal_entry': {
          await this.db.run('DELETE FROM journal_items WHERE entry_id = ?', [entityId]);
          await this.db.run('DELETE FROM journal_entries WHERE id = ?', [entityId]);
          return { success: true, message: 'Journal entry deleted' };
        }
        case 'invoice': {
          await this.db.run('DELETE FROM invoice_items WHERE invoice_id = ?', [entityId]);
          await this.db.run('DELETE FROM invoices WHERE id = ?', [entityId]);
          return { success: true, message: 'Invoice deleted' };
        }
        case 'expense':
          await this.db.run('DELETE FROM expenses WHERE id = ?', [entityId]);
          return { success: true, message: 'Expense deleted' };
        case 'customer':
          await this.db.run('DELETE FROM customers WHERE id = ?', [entityId]);
          return { success: true, message: 'Customer deleted' };
        case 'supplier':
          await this.db.run('DELETE FROM suppliers WHERE id = ?', [entityId]);
          return { success: true, message: 'Supplier deleted' };
        default:
          throw new Error(`Unknown entity type: ${entityType}`);
      }
    } catch (err) {
      return { success: false, message: err.message };
    }
  }

  async filteredKpis(filters = {}) {
    if (!this.db) return null;
    const invConds = []; const joinConds = []; const params = [];
    if (filters.dateFrom && filters.dateTo) {
      invConds.push('DATE(i.created_at) BETWEEN ? AND ?');
      joinConds.push('DATE(i.created_at) BETWEEN ? AND ?');
      params.push(filters.dateFrom, filters.dateTo);
    }
    if (filters.customerId) {
      invConds.push('i.customer_id = ?');
      joinConds.push('i.customer_id = ?');
      params.push(filters.customerId);
    }
    if (filters.productId) {
      joinConds.push('ii.product_id = ?');
      params.push(filters.productId);
    }
    if (filters.category) {
      joinConds.push('p.category = ?');
      params.push(filters.category);
    }
    const invWhere = invConds.length ? 'WHERE ' + invConds.join(' AND ') : '';
    const joinWhere = joinConds.length ? 'WHERE ' + joinConds.join(' AND ') : '';

    const sales = await this.db.get(
      `SELECT COALESCE(SUM(i.total),0) as total, COUNT(*) as count
       FROM invoices i ${invWhere}`, params
    );
    const profit = await this.db.get(
      `SELECT COALESCE(SUM((ii.unit_price - ii.unit_cost) * ii.quantity),0) as total
       FROM invoice_items ii JOIN invoices i ON ii.invoice_id = i.id
       ${joinWhere}`, params
    );
    const totalInvoices = sales?.count || 0;
    const avgInvoice = totalInvoices > 0 ? (sales?.total || 0) / totalInvoices : 0;

    return {
      totalSales: sales?.total || 0,
      totalInvoices,
      netProfit: profit?.total || 0,
      avgInvoiceValue: avgInvoice
    };
  }
}

class SupplierPaymentRepo {
  async findBySupplier(supplierId) {
    if (!db) return [];
    return db.all('SELECT * FROM supplier_payments WHERE supplier_id = ? ORDER BY created_at DESC', [supplierId]);
  }

  async create(data) {
    if (!db) return null;
    const columns = Object.keys(data).join(', ');
    const placeholders = Object.keys(data).map(() => '?').join(', ');
    const values = Object.values(data);
    const result = await db.run(`INSERT INTO supplier_payments (${columns}) VALUES (${placeholders})`, values);
    return { id: result.lastInsertRowid };
  }
}

class CustomerPaymentRepo {
  async findByCustomer(customerId) {
    if (!db) return [];
    return db.all('SELECT * FROM customer_payments WHERE customer_id = ? ORDER BY created_at DESC', [customerId]);
  }

  async create(data) {
    if (!db) return null;
    const columns = Object.keys(data).join(', ');
    const placeholders = Object.keys(data).map(() => '?').join(', ');
    const values = Object.values(data);
    const result = await db.run(`INSERT INTO customer_payments (${columns}) VALUES (${placeholders})`, values);
    return { id: result.lastInsertRowid };
  }
}

class ExpenseRepo {
  async findAll(limit = 100) {
    if (!db) return [];
    return db.all('SELECT * FROM expenses ORDER BY date DESC, id DESC');
  }

  async findByDateRange(startDate, endDate) {
    if (!db) return [];
    return db.all('SELECT * FROM expenses WHERE date BETWEEN ? AND ? ORDER BY date DESC', [startDate, endDate]);
  }

  async getTotalByCategory(startDate, endDate) {
    if (!db) return [];
    return db.all(`
      SELECT category, SUM(amount) as total 
      FROM expenses 
      WHERE date BETWEEN ? AND ? 
      GROUP BY category
    `, [startDate, endDate]);
  }

  async create(data) {
    if (!db) return null;
    const columns = Object.keys(data).join(', ');
    const placeholders = Object.keys(data).map(() => '?').join(', ');
    const values = Object.values(data);
    const result = await db.run(`INSERT INTO expenses (${columns}) VALUES (${placeholders})`, values);
    return { id: result.lastInsertRowid };
  }
}

class WorkerRepo {
  async findAll() {
    if (!db) return [];
    return db.all('SELECT * FROM workers WHERE is_active = TRUE ORDER BY name');
  }

  async findById(id) {
    if (!db) return null;
    return db.get('SELECT * FROM workers WHERE id = ?', [id]);
  }

  async create(data) {
    if (!db) return null;
    const columns = Object.keys(data).join(', ');
    const placeholders = Object.keys(data).map(() => '?').join(', ');
    const values = Object.values(data);
    const result = await db.run(`INSERT INTO workers (${columns}) VALUES (${placeholders})`, values);
    return { id: result.lastInsertRowid };
  }

  async update(id, data) {
    if (!db) return null;
    const setClause = Object.keys(data).map(k => `${k} = ?`).join(', ');
    const values = [...Object.values(data), id];
    await db.run(`UPDATE workers SET ${setClause} WHERE id = ?`, values);
    return { id };
  }

  async getPayments(workerId) {
    if (!db) return [];
    return db.all('SELECT * FROM worker_payments WHERE worker_id = ? ORDER BY created_at DESC', [workerId]);
  }

  async addPayment(data) {
    if (!db) return null;
    const columns = Object.keys(data).join(', ');
    const placeholders = Object.keys(data).map(() => '?').join(', ');
    const values = Object.values(data);
    const result = await db.run(`INSERT INTO worker_payments (${columns}) VALUES (${placeholders})`, values);
    return { id: result.lastInsertRowid };
  }

  async delete(id) {
    if (!db) return { changes: 0 };
    return db.run('UPDATE workers SET is_active = FALSE WHERE id = ?', [id]);
  }
}

export const ProductRepository = new ProductRepo();
export const CustomerRepository = new CustomerRepo();
export const SupplierRepository = new SupplierRepo();
export const InvoiceRepository = new InvoiceRepo();
export const InventoryRepository = new InventoryRepo();
export const AuditLogRepository = new AuditLogRepo();
export const SettingsRepository = new SettingsRepo();
export const PurchaseOrderRepository = new PurchaseOrderRepo();
export const ReturnRepository = new ReturnRepo();
export const ExchangeRepository = new ExchangeRepo();
export const AccountRepository = new AccountRepo();
export const JournalEntryRepository = new JournalEntryRepo();
export const SupplierPaymentRepository = new SupplierPaymentRepo();
export const CustomerPaymentRepository = new CustomerPaymentRepo();
export const ExpenseRepository = new ExpenseRepo();
export const WorkerRepository = new WorkerRepo();
export const ReportRepository = new ReportRepo();

const CURRENT_SEED_VERSION = '2';

export async function initDatabase() {
  await runMigrations();

  if (db) {
    const version = await db.get('SELECT value FROM settings WHERE "key" = ?', ['seeded_version']);

    if (!version || version.value !== CURRENT_SEED_VERSION) {
      // Clear all data in reverse dependency order, then re-seed
      const tables = [
        'exchange_items', 'exchanges', 'return_items', 'returns',
        'invoice_items', 'invoices', 'purchase_order_items', 'purchase_orders',
        'cashier_movements', 'cash_registers', 'inventory',
        'price_tiers', 'bulk_discounts', 'promo_periods',
        'worker_payments', 'workers', 'expenses',
        'supplier_payments', 'customer_payments', 'journal_items', 'journal_entries', 'accounts',
        'audit_logs', 'products', 'customers', 'suppliers', 'users',
      ];
      for (const t of tables) {
        try { await db.run(`DELETE FROM "${t}"`); } catch {}
      }
      // Clear seeded_version if it exists from partial seed
      try { await db.run('DELETE FROM settings WHERE "key" = ?', ['seeded_version']); } catch {}

      try { await seedDatabase(); } catch (e) { console.error('❌ seed failed:', e); }
    }
  }

  console.log('✅ Electron Database ready');
}

export function getDatabase() {
  return db;
}

export function isDatabaseReady() {
  return !!db;
}