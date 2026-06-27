const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  db: {
    all: (sql, params) => ipcRenderer.invoke('db:all', sql, params),
    get: (sql, params) => ipcRenderer.invoke('db:get', sql, params),
    run: (sql, params) => ipcRenderer.invoke('db:run', sql, params),
  },
  getPrinters: () => ipcRenderer.invoke('get-printers'),
  print: (options) => ipcRenderer.invoke('print:receipt', options),
  audit: {
    log: (entry) => ipcRenderer.invoke('audit:log', entry),
    undo: (operationId) => ipcRenderer.invoke('audit:undo', operationId),
    redo: (operationId) => ipcRenderer.invoke('audit:redo', operationId),
    getOperations: (limit) => ipcRenderer.invoke('audit:getOperations', limit),
    getOperationDetail: (operationId) => ipcRenderer.invoke('audit:getOperationDetail', operationId),
  },
  update: {
    check: () => ipcRenderer.invoke('update:check'),
    download: () => ipcRenderer.invoke('update:download'),
    install: () => ipcRenderer.invoke('update:install'),
    onAvailable: (cb) => ipcRenderer.on('update:available', (_, info) => cb(info)),
    onProgress: (cb) => ipcRenderer.on('update:progress', (_, p) => cb(p)),
    onDownloaded: (cb) => ipcRenderer.on('update:downloaded', () => cb()),
    onError: (cb) => ipcRenderer.on('update:error', (_, msg) => cb(msg)),
  },
});
