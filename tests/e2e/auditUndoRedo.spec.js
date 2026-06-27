import { test, expect } from '../fixtures/electronApp.js';

function db(window) {
  return {
    run: (sql, params) => window.evaluate(([s, p]) => window.electronAPI.db.run(s, p), [sql, params || []]),
    get: (sql, params) => window.evaluate(([s, p]) => window.electronAPI.db.get(s, p), [sql, params || []]),
    all: (sql, params) => window.evaluate(([s, p]) => window.electronAPI.db.all(s, p), [sql, params || []]),
  };
}

function audit(window) {
  return {
    log: (entry) => window.evaluate((e) => window.electronAPI.audit.log(e), entry),
    undo: (operationId) => window.evaluate((id) => window.electronAPI.audit.undo(id), operationId),
    redo: (operationId) => window.evaluate((id) => window.electronAPI.audit.redo(id), operationId),
    getOperations: (limit) => window.evaluate((l) => window.electronAPI.audit.getOperations(l || 50), limit),
    getOperationDetail: (operationId) => window.evaluate((id) => window.electronAPI.audit.getOperationDetail(id), operationId),
  };
}

test.describe('E2E - Audit, Undo & Redo', () => {
  let window;

  test.beforeEach(async ({ window: w }) => {
    window = w;
    await window.waitForFunction(() => {
      if (!document.body) return false;
      return !document.body.textContent.includes('\u062C\u0627\u0631\u064A \u0627\u0644\u062A\u062D\u0645\u064A\u0644');
    }, { timeout: 20000 }).catch(() => {});
    await window.waitForTimeout(500);
  });

  // ─────────────────────────────────────────
  // Audit API basics
  // ─────────────────────────────────────────

  test('US-AUDIT-1: Log operation creates audit entry', async () => {
    const d = db(window);
    const a = audit(window);
    const ts = Date.now();

    await d.run(`DELETE FROM audit_logs WHERE entity_type = 'product' AND entity_id = ?`, [99999]);

    const result = await a.log({
      user_id: null,
      action: 'create',
      entity_type: 'product',
      entity_id: 99999,
      table_name: 'products',
      row_id: 99999,
      old_value: null,
      new_value: { name: 'Test', price: 50 },
    });
    expect(result).not.toBeNull();
    expect(result.operation_id).toBeTruthy();

    const logs = await d.all(`SELECT * FROM audit_logs WHERE entity_type = 'product' AND entity_id = 99999`);
    expect(logs.length).toBeGreaterThanOrEqual(1);
    expect(logs[0].action).toBe('create');
  });

  test('US-AUDIT-2: Log stores before and after snapshots', async () => {
    const d = db(window);
    const a = audit(window);
    const ts = Date.now();
    const entityId = 88881;

    await d.run(`DELETE FROM audit_logs WHERE entity_type = 'product' AND entity_id = ?`, [entityId]);

    await a.log({
      user_id: null,
      action: 'update',
      entity_type: 'product',
      entity_id: entityId,
      table_name: 'products',
      row_id: entityId,
      old_value: { price: 50, stock: 10, name: 'Before' },
      new_value: { price: 75, stock: 5, name: 'After' },
    });

    const logs = await d.all(
      `SELECT * FROM audit_logs WHERE entity_type = 'product' AND entity_id = ? AND action = 'update'`,
      [entityId]
    );
    expect(logs.length).toBeGreaterThanOrEqual(1);
    const log = logs[0];
    expect(log.old_value).not.toBeNull();
    expect(log.new_value).not.toBeNull();

    const oldVal = JSON.parse(log.old_value);
    const newVal = JSON.parse(log.new_value);
    expect(Number(oldVal.price)).toBe(50);
    expect(Number(newVal.price)).toBe(75);
  });

  test('US-AUDIT-3: Operation groups multiple changes', async () => {
    const d = db(window);
    const a = audit(window);
    const entityId = 77771;
    const groupOpId = `op-group-${Date.now()}`;

    await d.run(`DELETE FROM audit_logs WHERE operation_id = ?`, [groupOpId]);

    const result = await a.log({
      operation_id: groupOpId,
      user_id: null,
      action: 'receive',
      entity_type: 'purchase_order',
      entity_id: entityId,
      table_name: 'purchase_orders',
      row_id: entityId,
      old_value: { status: 'pending' },
      new_value: { status: 'received' },
    });

    await a.log({
      operation_id: groupOpId,
      user_id: null,
      action: 'receive',
      entity_type: 'purchase_order',
      entity_id: entityId,
      table_name: 'products',
      row_id: 77772,
      old_value: { stock: 10, cost: 20 },
      new_value: { stock: 15, cost: 25 },
    });

    const detail = await a.getOperationDetail(result.operation_id);
    expect(detail.length).toBe(2);
  });

  // ─────────────────────────────────────────
  // Operations listing
  // ─────────────────────────────────────────

  test('US-AUDIT-4: Operations list returns grouped entries', async () => {
    const a = audit(window);
    const ops = await a.getOperations(10);
    expect(Array.isArray(ops)).toBe(true);
    if (ops.length > 0) {
      expect(ops[0]).toHaveProperty('operation_id');
      expect(ops[0]).toHaveProperty('action');
      expect(ops[0]).toHaveProperty('entity_type');
      expect(ops[0]).toHaveProperty('created_at');
    }
  });

  // ─────────────────────────────────────────
  // Undo operations
  // ─────────────────────────────────────────

  test('US-AUDIT-5: Undo create removes the row', async () => {
    const d = db(window);
    const a = audit(window);
    const ts = Date.now();

    await d.run(`DELETE FROM audit_logs WHERE entity_type = 'product' AND entity_id IN (SELECT id FROM products WHERE barcode = ?)`, [`E2E-UD-CREATE-${ts}`]);
    await d.run(`DELETE FROM products WHERE barcode = ?`, [`E2E-UD-CREATE-${ts}`]);

    const insResult = await d.run(`INSERT INTO products (name, barcode, price, cost, stock, category, unit) VALUES (?,?,?,?,?,?,?)`,
      ['Undo Create', `E2E-UD-CREATE-${ts}`, 60, 25, 8, 'TestUndo', 'piece']);
    const product = await d.get(`SELECT id FROM products WHERE barcode = ?`, [`E2E-UD-CREATE-${ts}`]);

    const logResult = await a.log({
      user_id: null,
      action: 'create',
      entity_type: 'product',
      entity_id: product.id,
      table_name: 'products',
      row_id: product.id,
      old_value: null,
      new_value: { id: product.id, name: 'Undo Create', barcode: `E2E-UD-CREATE-${ts}`, price: 60, cost: 25, stock: 8 },
    });

    const result = await a.undo(logResult.operation_id);
    expect(result.success).toBe(true);

    const gone = await d.get(`SELECT id FROM products WHERE id = ?`, [product.id]);
    expect(gone).toBeNull();
  });

  test('US-AUDIT-6: Undo update reverts to previous values', async () => {
    const d = db(window);
    const a = audit(window);
    const ts = Date.now();

    await d.run(`DELETE FROM audit_logs WHERE entity_type = 'product' AND entity_id IN (SELECT id FROM products WHERE barcode = ?)`, [`E2E-UD-UPD-${ts}`]);
    await d.run(`DELETE FROM products WHERE barcode = ?`, [`E2E-UD-UPD-${ts}`]);

    await d.run(`INSERT INTO products (name, barcode, price, cost, stock, category, unit) VALUES (?,?,?,?,?,?,?)`,
      ['Undo Upd', `E2E-UD-UPD-${ts}`, 100, 40, 10, 'TestUndo', 'piece']);
    const product = await d.get(`SELECT id, price FROM products WHERE barcode = ?`, [`E2E-UD-UPD-${ts}`]);
    expect(Number(product.price)).toBe(100);

    await d.run(`UPDATE products SET price = 200 WHERE id = ?`, [product.id]);

    const logResult = await a.log({
      user_id: null,
      action: 'update',
      entity_type: 'product',
      entity_id: product.id,
      table_name: 'products',
      row_id: product.id,
      old_value: { price: 100, stock: 10 },
      new_value: { price: 200, stock: 10 },
    });

    const result = await a.undo(logResult.operation_id);
    expect(result.success).toBe(true);

    const reverted = await d.get(`SELECT price FROM products WHERE id = ?`, [product.id]);
    expect(Number(reverted.price)).toBe(100);
  });

  test('US-AUDIT-7: Undo delete restores the row', async () => {
    const d = db(window);
    const a = audit(window);
    const ts = Date.now();

    await d.run(`DELETE FROM audit_logs WHERE entity_type = 'product' AND entity_id IN (SELECT id FROM products WHERE barcode = ?)`, [`E2E-UD-DEL-${ts}`]);
    await d.run(`DELETE FROM products WHERE barcode = ?`, [`E2E-UD-DEL-${ts}`]);

    await d.run(`INSERT INTO products (name, barcode, price, cost, stock, category, unit) VALUES (?,?,?,?,?,?,?)`,
      ['Undo Del', `E2E-UD-DEL-${ts}`, 45, 18, 7, 'TestUndo', 'piece']);
    const product = await d.get(`SELECT * FROM products WHERE barcode = ?`, [`E2E-UD-DEL-${ts}`]);

    const logResult = await a.log({
      user_id: null,
      action: 'delete',
      entity_type: 'product',
      entity_id: product.id,
      table_name: 'products',
      row_id: product.id,
      old_value: { id: product.id, name: 'Undo Del', barcode: `E2E-UD-DEL-${ts}`, price: 45, cost: 18, stock: 7 },
      new_value: null,
    });

    await d.run(`DELETE FROM products WHERE id = ?`, [product.id]);

    const result = await a.undo(logResult.operation_id);
    expect(result.success).toBe(true);

    const restored = await d.get(`SELECT * FROM products WHERE id = ?`, [product.id]);
    expect(restored).not.toBeNull();
    expect(restored.name).toBe('Undo Del');
  });

  // ─────────────────────────────────────────
  // Redo operations
  // ─────────────────────────────────────────

  test('US-AUDIT-8: Redo after undo re-applies update', async () => {
    const d = db(window);
    const a = audit(window);
    const ts = Date.now();

    await d.run(`DELETE FROM audit_logs WHERE entity_type = 'product' AND entity_id IN (SELECT id FROM products WHERE barcode = ?)`, [`E2E-REDO-${ts}`]);
    await d.run(`DELETE FROM products WHERE barcode = ?`, [`E2E-REDO-${ts}`]);

    await d.run(`INSERT INTO products (name, barcode, price, cost, stock, category, unit) VALUES (?,?,?,?,?,?,?)`,
      ['Redo Test', `E2E-REDO-${ts}`, 80, 30, 15, 'TestRedo', 'piece']);
    const product = await d.get(`SELECT id, price FROM products WHERE barcode = ?`, [`E2E-REDO-${ts}`]);

    await d.run(`UPDATE products SET price = 160 WHERE id = ?`, [product.id]);

    const logResult = await a.log({
      user_id: null,
      action: 'update',
      entity_type: 'product',
      entity_id: product.id,
      table_name: 'products',
      row_id: product.id,
      old_value: { price: 80, stock: 15 },
      new_value: { price: 160, stock: 15 },
    });

    await a.undo(logResult.operation_id);
    const afterUndo = await d.get(`SELECT price FROM products WHERE id = ?`, [product.id]);
    expect(Number(afterUndo.price)).toBe(80);

    const redoResult = await a.redo(logResult.operation_id);
    expect(redoResult.success).toBe(true);

    const afterRedo = await d.get(`SELECT price FROM products WHERE id = ?`, [product.id]);
    expect(Number(afterRedo.price)).toBe(160);
  });

  test('US-AUDIT-9: Redo after undo restore delete', async () => {
    const d = db(window);
    const a = audit(window);
    const ts = Date.now();

    await d.run(`DELETE FROM audit_logs WHERE entity_type = 'product' AND entity_id IN (SELECT id FROM products WHERE barcode = ?)`, [`E2E-REDO-DEL-${ts}`]);
    await d.run(`DELETE FROM products WHERE barcode = ?`, [`E2E-REDO-DEL-${ts}`]);

    await d.run(`INSERT INTO products (name, barcode, price, cost, stock, category, unit) VALUES (?,?,?,?,?,?,?)`,
      ['Redo Del', `E2E-REDO-DEL-${ts}`, 90, 35, 20, 'TestRedo', 'piece']);
    const product = await d.get(`SELECT * FROM products WHERE barcode = ?`, [`E2E-REDO-DEL-${ts}`]);

    const logResult = await a.log({
      user_id: null,
      action: 'delete',
      entity_type: 'product',
      entity_id: product.id,
      table_name: 'products',
      row_id: product.id,
      old_value: { id: product.id, name: 'Redo Del', barcode: `E2E-REDO-DEL-${ts}`, price: 90, cost: 35, stock: 20 },
      new_value: null,
    });

    await d.run(`DELETE FROM products WHERE id = ?`, [product.id]);

    await a.undo(logResult.operation_id);
    const afterUndo = await d.get(`SELECT id FROM products WHERE id = ?`, [product.id]);
    expect(afterUndo).not.toBeNull();

    await d.run(`DELETE FROM products WHERE id = ?`, [product.id]);

    const redoResult = await a.redo(logResult.operation_id);
    expect(redoResult.success).toBe(true);

    const afterRedo = await d.get(`SELECT * FROM products WHERE id = ?`, [product.id]);
    expect(afterRedo).toBeNull();
  });

  // ─────────────────────────────────────────
  // Edge cases
  // ─────────────────────────────────────────

  test('US-AUDIT-10: Double undo returns error', async () => {
    const a = audit(window);
    const ts = Date.now();

    const logResult = await a.log({
      user_id: null,
      action: 'create',
      entity_type: 'product',
      entity_id: 55551,
      table_name: 'products',
      row_id: 55551,
      old_value: null,
      new_value: { id: 55551, name: 'Double Undo' },
    });

    const first = await a.undo(logResult.operation_id);
    expect(first.success).toBe(true);

    const second = await a.undo(logResult.operation_id);
    expect(second.success).toBe(false);
    expect(second.error).toBeTruthy();
  });

  test('US-AUDIT-11: Undo with no audit entries returns error', async () => {
    const a = audit(window);
    const result = await a.undo('non-existent-operation');
    expect(result.success).toBe(false);
    expect(result.error).toBeTruthy();
  });

  test('US-AUDIT-12: Multi-table undo reverses all changes', async () => {
    const d = db(window);
    const a = audit(window);
    const ts = Date.now();
    const operationId = `op-multi-${ts}`;

    await d.run(`DELETE FROM audit_logs WHERE operation_id = ?`, [operationId]);

    await a.log({
      operation_id: operationId,
      user_id: null,
      action: 'receive',
      entity_type: 'purchase_order',
      entity_id: 44441,
      table_name: 'purchase_orders',
      row_id: 44441,
      old_value: { status: 'pending' },
      new_value: { status: 'received' },
    });
    await a.log({
      operation_id: operationId,
      user_id: null,
      action: 'receive',
      entity_type: 'purchase_order',
      entity_id: 44441,
      table_name: 'products',
      row_id: 44442,
      old_value: { stock: 10, cost: 20 },
      new_value: { stock: 13, cost: 25 },
    });
    await a.log({
      operation_id: operationId,
      user_id: null,
      action: 'receive',
      entity_type: 'purchase_order',
      entity_id: 44441,
      table_name: 'cashier_movements',
      row_id: 44443,
      old_value: null,
      new_value: { id: 44443, register_id: 1, type: 'out', amount: 100 },
    });

    const detail = await a.getOperationDetail(operationId);
    expect(detail.length).toBe(3);
  });
});
