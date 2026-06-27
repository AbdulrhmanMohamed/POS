export class IDatabaseAdapter {
  initialize() { throw new Error('Not implemented'); }
  query(sql, params) { throw new Error('Not implemented'); }
  run(sql, params) { throw new Error('Not implemented'); }
  get(sql, params) { throw new Error('Not implemented'); }
  all(sql, params) { throw new Error('Not implemented'); }
  transaction(callback) { throw new Error('Not implemented'); }
  close() { throw new Error('Not implemented'); }
}