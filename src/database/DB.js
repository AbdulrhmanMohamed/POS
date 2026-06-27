const electronDb = window.electronAPI?.db;

function prepare(sql) {
  const stmt = sql;
  return {
    all(...params) {
      return electronDb?.all(stmt, params) ?? [];
    },
    get(...params) {
      return electronDb?.get(stmt, params) ?? null;
    },
    run(...params) {
      return electronDb?.run(stmt, params) ?? { lastInsertRowid: null, changes: 0 };
    }
  };
}

const db = {
  prepare,
  transaction(fn) {
    return fn();
  }
};

export function addAuditLog(userId, action, entityType, entityId, oldValue, newValue) {
  try {
    electronDb?.run(
      'INSERT INTO audit_logs (user_id, action, entity_type, entity_id, old_value, new_value) VALUES (?, ?, ?, ?, ?, ?)',
      [userId || null, action, entityType, entityId || null, oldValue ? JSON.stringify(oldValue) : null, newValue ? JSON.stringify(newValue) : null]
    );
  } catch (e) {
    console.error('Audit log error:', e);
  }
}

export default db;
