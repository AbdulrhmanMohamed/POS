const { app, BrowserWindow, ipcMain, nativeImage, dialog } = require('electron');
const { autoUpdater } = require('electron-updater');
const Database = require('better-sqlite3');
const path = require('path');
const crypto = require('crypto');
const { spawn } = require('child_process');

let mainWindow;
let db;
let viteProc;

function startVite() {
  return new Promise((resolve, reject) => {
    if (process.env.NODE_ENV === 'production' || process.env.NODE_ENV === 'test') return resolve();

    viteProc = spawn('npx', ['vite', '--port', '3000', '--strictPort'], {
      cwd: path.join(__dirname, '..'),
      stdio: ['ignore', 'pipe', 'pipe'],
      env: { ...process.env },
    });

    let started = false;
    const onData = (data) => {
      const text = data.toString();
      if (!started && text.includes('ready in')) {
        started = true;
        setTimeout(resolve, 500);
      }
    };

    viteProc.stdout.on('data', onData);
    viteProc.stderr.on('data', onData);
    viteProc.on('error', reject);
    viteProc.on('exit', (code) => {
      if (!started) reject(new Error(`Vite exited with code ${code}`));
    });

    setTimeout(() => {
      if (!started) reject(new Error('Vite start timeout'));
    }, 15000);
  });
}

async function createWindow() {
  const iconPath = path.join(__dirname, 'assets', 'icon.png');
  const icon = nativeImage.createFromPath(iconPath);

  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    icon: iconPath,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  mainWindow.loadURL('http://localhost:3000');
  if (process.env.NODE_ENV !== 'test') {
    mainWindow.webContents.openDevTools();
  }
}

// Auto-updater
autoUpdater.autoDownload = false;
autoUpdater.autoInstallOnAppQuit = true;

function setupAutoUpdater() {
  if (process.env.NODE_ENV === 'development' || process.env.NODE_ENV === 'test') return;

  autoUpdater.checkForUpdates();

  setInterval(() => {
    autoUpdater.checkForUpdates();
  }, 60 * 60 * 1000);

  autoUpdater.on('update-available', (info) => {
    mainWindow?.webContents?.send('update:available', info);
    dialog.showMessageBox(mainWindow, {
      type: 'info',
      title: 'Update Available',
      message: `Version ${info.version} is available. Download now?`,
      buttons: ['Download', 'Later'],
    }).then(({ response }) => {
      if (response === 0) autoUpdater.downloadUpdate();
    });
  });

  autoUpdater.on('download-progress', (progress) => {
    mainWindow?.webContents?.send('update:progress', progress);
  });

  autoUpdater.on('update-downloaded', () => {
    mainWindow?.webContents?.send('update:downloaded');
    dialog.showMessageBox(mainWindow, {
      type: 'info',
      title: 'Update Ready',
      message: 'Update downloaded. Restart to install?',
      buttons: ['Restart', 'Later'],
    }).then(({ response }) => {
      if (response === 0) autoUpdater.quitAndInstall();
    });
  });

  autoUpdater.on('error', (err) => {
    console.error('Auto-update error:', err.message);
    mainWindow?.webContents?.send('update:error', err.message);
  });

  ipcMain.handle('update:check', () => autoUpdater.checkForUpdates());
  ipcMain.handle('update:download', () => autoUpdater.downloadUpdate());
  ipcMain.handle('update:install', () => autoUpdater.quitAndInstall());
}

function initDatabase() {
  const userDataPath = app.getPath('userData');
  const fs = require('fs');
  if (!fs.existsSync(userDataPath)) {
    fs.mkdirSync(userDataPath, { recursive: true });
  }
  const dbPath = path.join(userDataPath, 'database.db');
  db = new Database(dbPath);

  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');

  console.log('✅ SQLite database ready at:', dbPath);
}

function sanitizeValue(v) {
  if (v === undefined) return null;
  if (typeof v === 'number' && isNaN(v)) return null;
  if (typeof v === 'boolean') return v ? 1 : 0;
  if (typeof v === 'object' && v !== null) {
    if (v instanceof Date) return v.toISOString();
    if (Buffer.isBuffer(v)) return v;
    return null;
  }
  return v;
}

function sanitizeParams(params) {
  return (params || []).map(sanitizeValue);
}

ipcMain.handle('db:all', (_, sql, params = []) => {
  try {
    const stmt = db.prepare(sql);
    return stmt.all(...sanitizeParams(params));
  } catch (err) {
    console.error('db:all error:', err.message);
    throw err;
  }
});

ipcMain.handle('db:get', (_, sql, params = []) => {
  try {
    const stmt = db.prepare(sql);
    return stmt.get(...sanitizeParams(params)) || null;
  } catch (err) {
    console.error('db:get error:', err.message);
    throw err;
  }
});

ipcMain.handle('db:run', (_, sql, params = []) => {
  try {
    const stmt = db.prepare(sql);
    const result = stmt.run(...sanitizeParams(params));
    return { lastInsertRowid: result.lastInsertRowid, changes: result.changes };
  } catch (err) {
    console.error('db:run error:', err.message);
    throw err;
  }
});

function generateOperationId() {
  const timestamp = Date.now().toString(36);
  const random = crypto.randomBytes(4).toString('hex');
  return `${timestamp}-${random}`;
}

ipcMain.handle('audit:log', (_, entry) => {
  try {
    const operationId = entry.operation_id || generateOperationId();
    const stmt = db.prepare(`
      INSERT INTO audit_logs (user_id, action, entity_type, entity_id, table_name, row_id, old_value, new_value, operation_id, is_undone)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0)
    `);
    stmt.run(
      entry.user_id || null,
      entry.action,
      entry.entity_type,
      entry.entity_id || null,
      entry.table_name || null,
      entry.row_id || null,
      entry.old_value ? JSON.stringify(entry.old_value) : null,
      entry.new_value ? JSON.stringify(entry.new_value) : null,
      operationId
    );
    return { operation_id: operationId };
  } catch (err) {
    console.error('audit:log error:', err.message);
    return { error: err.message };
  }
});

ipcMain.handle('audit:getOperations', (_, limit = 50) => {
  try {
    return db.prepare(`
      SELECT operation_id, action, entity_type, entity_id,
             MIN(created_at) as created_at, COUNT(*) as entry_count
      FROM audit_logs
      WHERE operation_id IS NOT NULL
      GROUP BY operation_id
      ORDER BY created_at DESC
      LIMIT ?
    `).all(limit);
  } catch (err) {
    console.error('audit:getOperations error:', err.message);
    return [];
  }
});

ipcMain.handle('audit:getOperationDetail', (_, operationId) => {
  try {
    return db.prepare(`SELECT * FROM audit_logs WHERE operation_id = ? ORDER BY id ASC`).all(operationId);
  } catch (err) {
    console.error('audit:getOperationDetail error:', err.message);
    return [];
  }
});

ipcMain.handle('audit:undo', (_, operationId) => {
  try {
    const entries = db.prepare(`
      SELECT * FROM audit_logs WHERE operation_id = ? AND (is_undone IS NULL OR is_undone = 0) ORDER BY id DESC
    `).all(operationId);

    if (entries.length === 0) {
      return { success: false, error: 'عملية غير موجودة أو تم تراجع عنها مسبقاً' };
    }

    const undoTransaction = db.transaction(() => {
      for (const entry of entries) {
        const tableName = entry.table_name;
        const rowId = entry.row_id;

        switch (entry.action) {
          case 'create': {
            if (tableName && rowId) {
              db.prepare(`DELETE FROM "${tableName}" WHERE id = ?`).run(rowId);
            }
            break;
          }
          case 'update': {
            if (tableName && rowId && entry.old_value) {
              const oldData = JSON.parse(entry.old_value);
              const setClause = Object.keys(oldData).map(k => `"${k}" = ?`).join(', ');
              const values = Object.values(oldData).map(sanitizeValue);
              values.push(rowId);
              db.prepare(`UPDATE "${tableName}" SET ${setClause} WHERE id = ?`).run(...values);
            }
            break;
          }
          case 'delete': {
            if (tableName && entry.old_value) {
              const oldData = JSON.parse(entry.old_value);
              const columns = Object.keys(oldData).map(k => `"${k}"`).join(', ');
              const placeholders = Object.keys(oldData).map(() => '?').join(', ');
              const values = Object.values(oldData).map(sanitizeValue);
              db.prepare(`INSERT OR IGNORE INTO "${tableName}" (${columns}) VALUES (${placeholders})`).run(...values);
            }
            break;
          }
          case 'receive': {
            if (tableName === 'purchase_orders' && entry.old_value) {
              const oldData = JSON.parse(entry.old_value);
              if (oldData.status) {
                db.prepare('UPDATE purchase_orders SET status = ?, received_at = NULL WHERE id = ?').run(oldData.status, rowId);
              }
            } else if (tableName === 'products' && entry.old_value) {
              const oldData = JSON.parse(entry.old_value);
              const setClause = Object.keys(oldData).map(k => `"${k}" = ?`).join(', ');
              const values = Object.values(oldData).map(sanitizeValue);
              values.push(rowId);
              db.prepare(`UPDATE "${tableName}" SET ${setClause} WHERE id = ?`).run(...values);
            } else if (tableName === 'cashier_movements' && rowId) {
              db.prepare('DELETE FROM cashier_movements WHERE id = ?').run(rowId);
            }
            break;
          }
        }
      }

      db.prepare('UPDATE audit_logs SET is_undone = 1 WHERE operation_id = ?').run(operationId);
    });

    undoTransaction();
    return { success: true };
  } catch (err) {
    console.error('audit:undo error:', err.message);
    return { success: false, error: err.message };
  }
});

ipcMain.handle('audit:redo', (_, operationId) => {
  try {
    const entries = db.prepare(`
      SELECT * FROM audit_logs WHERE operation_id = ? AND is_undone = 1 ORDER BY id ASC
    `).all(operationId);

    if (entries.length === 0) {
      return { success: false, error: 'عملية غير موجودة أو تم إعادتها مسبقاً' };
    }

    const redoTransaction = db.transaction(() => {
      for (const entry of entries) {
        const tableName = entry.table_name;
        const rowId = entry.row_id;

        switch (entry.action) {
          case 'create': {
            if (tableName && entry.new_value) {
              const newData = JSON.parse(entry.new_value);
              const columns = Object.keys(newData).map(k => `"${k}"`).join(', ');
              const placeholders = Object.keys(newData).map(() => '?').join(', ');
              const values = Object.values(newData).map(sanitizeValue);
              db.prepare(`INSERT OR IGNORE INTO "${tableName}" (${columns}) VALUES (${placeholders})`).run(...values);
            }
            break;
          }
          case 'update': {
            if (tableName && rowId && entry.new_value) {
              const newData = JSON.parse(entry.new_value);
              const setClause = Object.keys(newData).map(k => `"${k}" = ?`).join(', ');
              const values = Object.values(newData).map(sanitizeValue);
              values.push(rowId);
              db.prepare(`UPDATE "${tableName}" SET ${setClause} WHERE id = ?`).run(...values);
            }
            break;
          }
          case 'delete': {
            if (tableName && rowId) {
              db.prepare(`DELETE FROM "${tableName}" WHERE id = ?`).run(rowId);
            }
            break;
          }
          case 'receive': {
            if (tableName === 'purchase_orders' && entry.new_value) {
              const newData = JSON.parse(entry.new_value);
              if (newData.status) {
                const now = new Date().toISOString().replace('T', ' ').split('.')[0];
                db.prepare('UPDATE purchase_orders SET status = ?, received_at = ? WHERE id = ?').run(newData.status, now, rowId);
              }
            } else if (tableName === 'products' && entry.new_value) {
              const newData = JSON.parse(entry.new_value);
              if (newData.stock !== undefined) {
                db.prepare(`UPDATE "${tableName}" SET stock = ? WHERE id = ?`).run(sanitizeValue(newData.stock), rowId);
              }
            } else if (tableName === 'cashier_movements' && entry.new_value) {
              const newData = JSON.parse(entry.new_value);
              const columns = Object.keys(newData).map(k => `"${k}"`).join(', ');
              const placeholders = Object.keys(newData).map(() => '?').join(', ');
              const values = Object.values(newData).map(sanitizeValue);
              db.prepare(`INSERT OR IGNORE INTO "${tableName}" (${columns}) VALUES (${placeholders})`).run(...values);
            }
            break;
          }
        }
      }

      db.prepare('UPDATE audit_logs SET is_undone = 0 WHERE operation_id = ?').run(operationId);
    });

    redoTransaction();
    return { success: true };
  } catch (err) {
    console.error('audit:redo error:', err.message);
    return { success: false, error: err.message };
  }
});

ipcMain.handle('get-printers', async () => {
  return mainWindow?.webContents?.getPrintersAsync() || [];
});

ipcMain.handle('print:receipt', async (_, htmlContent) => {
  try {
    const { BrowserWindow } = require('electron');
    const printWin = new BrowserWindow({
      width: 400,
      height: 600,
      show: false,
      webPreferences: { contextIsolation: true, nodeIntegration: false }
    });
    await printWin.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(htmlContent)}`);
    printWin.webContents.on('did-finish-load', () => {
      printWin.webContents.print({ silent: false }, () => printWin.close());
    });
    return { success: true };
  } catch (err) {
    console.error('Print error:', err.message);
    return { success: false, error: err.message };
  }
});

app.whenReady().then(async () => {
  try {
    await startVite();
  } catch (err) {
    console.error('Failed to start Vite, trying to load app anyway:', err.message);
  }
  try {
    initDatabase();
  } catch (err) {
    console.error('Failed to init database:', err.message);
  }
  await createWindow();
  setupAutoUpdater();
});

app.on('window-all-closed', () => {
  if (db) db.close();
  if (viteProc) viteProc.kill();
  app.quit();
});
