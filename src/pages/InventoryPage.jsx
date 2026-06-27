import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { ProductRepository, InventoryRepository, SettingsRepository } from '../database';

const productRepo = ProductRepository;
const inventoryRepo = InventoryRepository;
const settingsRepo = SettingsRepository;

export default function InventoryPage() {
  const { t } = useTranslation();
  const [records, setRecords] = useState([]);
  const [products, setProducts] = useState([]);
  const [currency, setCurrency] = useState('ر.س');
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [viewing, setViewing] = useState(null);
  const [filterProduct, setFilterProduct] = useState('');
  const [filterType, setFilterType] = useState('');
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [form, setForm] = useState({ product_id: '', quantity: '', type: 'add', notes: '' });
  const [totalValue, setTotalValue] = useState(0);
  const [valueByCategory, setValueByCategory] = useState([]);
  const [lowStockProducts, setLowStockProducts] = useState([]);
  const [lowStockCount, setLowStockCount] = useState(0);
  const [showReconcile, setShowReconcile] = useState(false);
  const [reconcileData, setReconcileData] = useState([]);
  const [lowStockOpen, setLowStockOpen] = useState(true);
  const [categoryOpen, setCategoryOpen] = useState(true);
  const pageSize = 20;

  useEffect(() => {
    loadData();
  }, [page, filterProduct, filterType]);

  const loadData = async () => {
    const settings = await settingsRepo.getAll();
    setCurrency(settings.currency_symbol || 'ر.س');
    const prods = await productRepo.findAll('name ASC');
    setProducts(prods || []);
    let all = await inventoryRepo.findAll(10000, 0);
    if (filterProduct) all = all.filter(r => r.product_id === parseInt(filterProduct));
    if (filterType) all = all.filter(r => r.type === filterType);
    setTotal(all.length);
    setRecords(all.slice((page - 1) * pageSize, page * pageSize));
    const val = await inventoryRepo.getTotalValue();
    setTotalValue(val);
    const cats = await inventoryRepo.getValueByCategory();
    setValueByCategory(cats || []);
    const low = await inventoryRepo.getLowStockProducts();
    setLowStockProducts(low || []);
    const cnt = await inventoryRepo.getLowStockCount();
    setLowStockCount(cnt);
  };

  const openAdd = () => {
    setEditing(null);
    setForm({ product_id: '', quantity: '', type: 'add', notes: '' });
    setShowModal(true);
  };

  const openEdit = (record) => {
    setEditing(record);
    setForm({
      product_id: String(record.product_id),
      quantity: String(record.quantity),
      type: record.type,
      notes: record.notes || ''
    });
    setShowModal(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const qty = parseInt(form.quantity);
    if (qty <= 0) return;
    const product = await productRepo.findById(parseInt(form.product_id));
    if (!product) return;
    if (form.type === 'subtract' && product.stock < qty) {
      alert(t('inventory.noStock'));
      return;
    }

    if (editing) {
      await inventoryRepo.update(editing.id, {
        product_id: parseInt(form.product_id),
        type: form.type,
        quantity: qty,
        notes: form.notes || null
      });
    } else {
      const balanceAfter = form.type === 'add' ? product.stock + qty : product.stock - qty;
      await productRepo.updateStock(parseInt(form.product_id), balanceAfter);
      await inventoryRepo.create({
        product_id: parseInt(form.product_id),
        type: form.type,
        quantity: qty,
        balance_before: product.stock,
        balance_after: balanceAfter,
        notes: form.notes || null
      });
    }

    setShowModal(false);
    setEditing(null);
    setForm({ product_id: '', quantity: '', type: 'add', notes: '' });
    loadData();
  };

  const handleDelete = async (id) => {
    if (!confirm(t('inventory.confirmDelete'))) return;
    await inventoryRepo.delete(id);
    loadData();
  };

  const typeLabel = (type) => {
    const map = {
      add: t('inventory.stockIn'),
      subtract: t('inventory.stockOut'),
      sale: t('inventory.stockSale'),
      return: t('inventory.stockReturn'),
      damage: t('inventory.stockDamage'),
      audit: t('inventory.stockAudit'),
      warehouse_transfer: t('inventory.stockTransfer'),
    };
    return map[type] || type;
  };

  const openReconcile = () => {
    const data = products.map(p => ({
      id: p.id,
      name: p.name,
      barcode: p.barcode,
      stock: p.stock,
      physical: p.stock,
      diff: 0
    }));
    setReconcileData(data);
    setShowReconcile(true);
  };

  const updatePhysical = (index, val) => {
    const updated = [...reconcileData];
    const physical = parseInt(val) || 0;
    updated[index] = { ...updated[index], physical, diff: physical - updated[index].stock };
    setReconcileData(updated);
  };

  const settleReconciliation = async () => {
    const largeDiffs = reconcileData.filter(item => Math.abs(item.diff) > 10 && item.diff !== 0);
    if (largeDiffs.length > 0) {
      if (!confirm(t('inventory.largeDiffWarning'))) return;
    }
    for (const item of reconcileData) {
      if (item.diff === 0) continue;
      const newStock = item.physical;
      await productRepo.updateStock(item.id, newStock);
      await inventoryRepo.create({
        product_id: item.id,
        type: 'audit',
        quantity: Math.abs(item.diff),
        balance_before: item.stock,
        balance_after: newStock,
        notes: `Reconciliation: ${item.stock} -> ${newStock}`
      });
    }
    setShowReconcile(false);
    loadData();
  };

  const exportCSV = () => {
    const headers = [t('common.date'), t('inventory.product'), t('inventory.type'), t('common.quantity'), t('inventory.balanceBefore'), t('inventory.balanceAfter'), t('inventory.notes')];
    const rows = records.map(r => [
      new Date(r.created_at).toLocaleString('ar'),
      r.product_name,
      typeLabel(r.type),
      r.quantity,
      r.balance_before,
      r.balance_after,
      r.notes || ''
    ]);
    const csv = [headers.join(','), ...rows.map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(','))].join('\n');
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `inventory-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const totalPages = Math.ceil(total / pageSize);

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">{t('inventory.title')}</h1>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button className="btn btn-secondary" onClick={openReconcile}>{t('inventory.reconcile')}</button>
          <button className="btn btn-secondary" onClick={exportCSV}>{t('inventory.exportMovements')}</button>
          <button className="btn btn-primary" onClick={openAdd}>+ {t('inventory.addStock')}</button>
        </div>
      </div>

      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-label">{t('inventory.totalValue')}</div>
          <div className="stat-value">{totalValue.toLocaleString()} {currency}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">{t('inventory.lowStockProducts')}</div>
          <div className="stat-value" style={{ color: lowStockCount > 0 ? 'var(--error)' : 'var(--success)' }}>{lowStockCount}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">{t('products.title')}</div>
          <div className="stat-value">{products.length}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">{t('inventory.totalRecords')}</div>
          <div className="stat-value">{total}</div>
        </div>
      </div>

      {lowStockProducts.length > 0 && (
        <div className="card" style={{ borderColor: 'var(--error)', marginBottom: '16px' }}>
          <h3
            className="section-title accordion-header"
            style={{ color: 'var(--error)', cursor: 'pointer', userSelect: 'none', margin: 0, padding: '12px 16px' }}
            onClick={() => setLowStockOpen(!lowStockOpen)}
          >
            <span>{t('inventory.lowStockAlerts')}</span>
            <span className="accordion-chevron" style={{
              transform: lowStockOpen ? 'rotate(180deg)' : 'rotate(0deg)',
              transition: 'transform 0.3s ease'
            }}>▾</span>
          </h3>
          <div style={{
            maxHeight: lowStockOpen ? '2000px' : '0',
            overflow: 'hidden',
            transition: 'max-height 0.35s ease',
          }}>
            <table className="table" style={{ borderTop: '1px solid var(--border)' }}>
              <thead>
                <tr>
                  <th>{t('common.name')}</th>
                  <th>{t('common.category')}</th>
                  <th>{t('common.stock')}</th>
                  <th>{t('products.minStock')}</th>
                  <th>{t('inventory.totalValue')}</th>
                </tr>
              </thead>
              <tbody>
                {lowStockProducts.map(p => (
                  <tr key={p.id}>
                    <td>{p.name}</td>
                    <td>{p.category || '—'}</td>
                    <td style={{ color: 'var(--error)', fontWeight: 600 }}>{p.stock}</td>
                    <td>{p.min_stock}</td>
                    <td>{Number(p.value).toLocaleString()} {currency}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {valueByCategory.length > 0 && (
        <div className="card" style={{ marginBottom: '16px' }}>
          <h3
            className="section-title accordion-header"
            style={{ cursor: 'pointer', userSelect: 'none', margin: 0, padding: '12px 16px' }}
            onClick={() => setCategoryOpen(!categoryOpen)}
          >
            <span>{t('inventory.valueByCategory')}</span>
            <span className="accordion-chevron" style={{
              transform: categoryOpen ? 'rotate(180deg)' : 'rotate(0deg)',
              transition: 'transform 0.3s ease'
            }}>▾</span>
          </h3>
          <div style={{
            maxHeight: categoryOpen ? '2000px' : '0',
            overflow: 'hidden',
            transition: 'max-height 0.35s ease',
          }}>
            <table className="table" style={{ borderTop: '1px solid var(--border)' }}>
              <thead>
                <tr>
                  <th>{t('common.category')}</th>
                  <th>{t('inventory.totalValue')}</th>
                  <th>{t('common.quantity')}</th>
                </tr>
              </thead>
              <tbody>
                {valueByCategory.map(c => (
                  <tr key={c.category}>
                    <td>{c.category}</td>
                    <td>{Number(c.value).toLocaleString()} {currency}</td>
                    <td>{c.product_count}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div className="filter-bar">
        <select className="input" value={filterProduct} onChange={e => { setFilterProduct(e.target.value); setPage(1); }}>
          <option value="">{t('inventory.filterByProduct')}</option>
          {products.map(p => (
            <option key={p.id} value={p.id}>{p.name}</option>
          ))}
        </select>
        <select className="input" value={filterType} onChange={e => { setFilterType(e.target.value); setPage(1); }}>
          <option value="">{t('inventory.filterByType')} — {t('inventory.all')}</option>
          <option value="add">{t('inventory.stockIn')}</option>
          <option value="subtract">{t('inventory.stockOut')}</option>
          <option value="sale">{t('inventory.stockSale')}</option>
          <option value="return">{t('inventory.stockReturn')}</option>
          <option value="damage">{t('inventory.stockDamage')}</option>
          <option value="audit">{t('inventory.stockAudit')}</option>
          <option value="warehouse_transfer">{t('inventory.stockTransfer')}</option>
        </select>
        <span className="total-badge">{t('inventory.totalRecords')}: {total}</span>
      </div>

      <div className="card">
        {records.length === 0 ? (
          <div className="empty-state">{t('inventory.noRecords')}</div>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>{t('common.date')}</th>
                <th>{t('inventory.product')}</th>
                <th>{t('inventory.type')}</th>
                <th>{t('common.quantity')}</th>
                <th>{t('inventory.balanceBefore')}</th>
                <th>{t('inventory.balanceAfter')}</th>
                <th>{t('inventory.notes')}</th>
                <th>{t('common.actions')}</th>
              </tr>
            </thead>
            <tbody>
              {records.map(r => (
                <tr key={r.id}>
                  <td>{new Date(r.created_at).toLocaleString('ar')}</td>
                  <td>{r.product_name}</td>
                  <td style={{ color: ['add', 'return'].includes(r.type) ? 'var(--success)' : 'var(--error)' }}>
                    {typeLabel(r.type)}
                  </td>
                  <td>{r.quantity}</td>
                  <td>{r.balance_before}</td>
                  <td>{r.balance_after}</td>
                  <td>{r.notes || '—'}</td>
                  <td>
                    <button className="btn btn-sm btn-secondary" onClick={() => setViewing(r)}>{t('inventory.view')}</button>
                    <button className="btn btn-sm btn-secondary" onClick={() => openEdit(r)}>{t('inventory.edit')}</button>
                    <button className="btn btn-sm btn-danger" onClick={() => handleDelete(r.id)}>{t('inventory.delete')}</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        {totalPages > 1 && (
          <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '6px', padding: '12px 0 0' }}>
            <button className="btn btn-secondary" disabled={page <= 1} onClick={() => setPage(p => Math.max(1, p - 1))}>
              {t('common.previous')}
            </button>
            {Array.from({ length: totalPages }, (_, i) => i + 1)
              .filter(p => {
                if (totalPages <= 7) return true;
                if (p === 1 || p === totalPages) return true;
                if (Math.abs(p - page) <= 2) return true;
                return false;
              })
              .map((p, idx, arr) => {
                const showGap = idx > 0 && p - arr[idx - 1] > 1;
                return (
                  <span key={p} style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    {showGap && <span style={{ padding: '0 4px', color: 'var(--text-secondary)' }}>...</span>}
                    <button className={p === page ? 'btn btn-primary' : 'btn btn-secondary'} onClick={() => setPage(p)} style={{ minWidth: 36, padding: '6px 10px' }}>
                      {p}
                    </button>
                  </span>
                );
              })}
            <button className="btn btn-secondary" disabled={page >= totalPages} onClick={() => setPage(p => Math.min(totalPages, p + 1))}>
              {t('common.next')}
            </button>
          </div>
        )}
      </div>

      {showModal && (
        <div className="modal-overlay" onClick={() => { setShowModal(false); setEditing(null); }}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="modal-title">{editing ? t('inventory.editRecord') : t('inventory.addStock')}</h3>
            </div>
            <form onSubmit={handleSubmit}>
              <div className="form-group">
                <label className="form-label">{t('inventory.product')} *</label>
                <select className="input" value={form.product_id} onChange={e => setForm({...form, product_id: e.target.value})} required>
                  <option value="">Select product</option>
                  {products.map(p => (
                    <option key={p.id} value={p.id}>{p.name} (Stock: {p.stock})</option>
                  ))}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">{t('inventory.type')}</label>
                <select className="input" value={form.type} onChange={e => setForm({...form, type: e.target.value})}>
                  <option value="add">{t('inventory.stockIn')}</option>
                  <option value="subtract">{t('inventory.stockOut')}</option>
                  <option value="sale">{t('inventory.stockSale')}</option>
                  <option value="return">{t('inventory.stockReturn')}</option>
                  <option value="damage">{t('inventory.stockDamage')}</option>
                  <option value="audit">{t('inventory.stockAudit')}</option>
                  <option value="warehouse_transfer">{t('inventory.stockTransfer')}</option>
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">{t('common.quantity')} *</label>
                <input className="input" type="number" min="1" value={form.quantity} onChange={e => setForm({...form, quantity: e.target.value})} required />
              </div>
              <div className="form-group">
                <label className="form-label">{t('inventory.notes')}</label>
                <input className="input" value={form.notes} onChange={e => setForm({...form, notes: e.target.value})} />
              </div>
              <div className="form-actions">
                <button type="button" className="btn btn-secondary" onClick={() => { setShowModal(false); setEditing(null); }}>{t('common.cancel')}</button>
                <button type="submit" className="btn btn-primary">{t('common.save')}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {viewing && (
        <div className="modal-overlay" onClick={() => setViewing(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="modal-title">{t('inventory.view')}</h3>
            </div>
            <table className="table">
              <tbody>
                <tr><td><strong>{t('inventory.product')}</strong></td><td>{viewing.product_name}</td></tr>
                <tr><td><strong>{t('inventory.type')}</strong></td><td>{typeLabel(viewing.type)}</td></tr>
                <tr><td><strong>{t('common.quantity')}</strong></td><td>{viewing.quantity}</td></tr>
                <tr><td><strong>{t('inventory.balanceBefore')}</strong></td><td>{viewing.balance_before}</td></tr>
                <tr><td><strong>{t('inventory.balanceAfter')}</strong></td><td>{viewing.balance_after}</td></tr>
                <tr><td><strong>{t('inventory.notes')}</strong></td><td>{viewing.notes || '—'}</td></tr>
                <tr><td><strong>{t('common.date')}</strong></td><td>{new Date(viewing.created_at).toLocaleString('ar')}</td></tr>
              </tbody>
            </table>
            <div className="form-actions">
              <button className="btn btn-primary" onClick={() => setViewing(null)}>{t('common.close')}</button>
            </div>
          </div>
        </div>
      )}

      {showReconcile && (
        <div className="modal-overlay" onClick={() => setShowReconcile(false)}>
          <div className="modal modal-lg" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="modal-title">{t('inventory.reconcile')}</h3>
            </div>
            <div style={{ maxHeight: '400px', overflowY: 'auto' }}>
              <table className="table">
                <thead>
                  <tr>
                    <th>{t('inventory.product')}</th>
                    <th>{t('inventory.systemCount')}</th>
                    <th>{t('inventory.physicalCount')}</th>
                    <th>{t('inventory.difference')}</th>
                  </tr>
                </thead>
                <tbody>
                  {reconcileData.map((item, i) => (
                    <tr key={item.id}>
                      <td>{item.name}</td>
                      <td>{item.stock}</td>
                      <td>
                        <input
                          className="input"
                          type="number"
                          min="0"
                          style={{ width: '80px' }}
                          value={item.physical}
                          onChange={e => updatePhysical(i, e.target.value)}
                        />
                      </td>
                      <td style={{
                        color: item.diff > 0 ? 'var(--success)' : item.diff < 0 ? 'var(--error)' : 'var(--text-muted)',
                        fontWeight: 600
                      }}>
                        {item.diff === 0 ? t('inventory.noDifference') : `${item.diff > 0 ? '+' : ''}${item.diff}`}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="form-actions">
              <button className="btn btn-secondary" onClick={() => setShowReconcile(false)}>{t('common.cancel')}</button>
              <button className="btn btn-primary" onClick={settleReconciliation}>{t('inventory.settle')}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}