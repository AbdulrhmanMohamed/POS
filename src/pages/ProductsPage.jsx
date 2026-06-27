import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { ProductRepository, SettingsRepository, SupplierRepository } from '../database';
import { generateBarcode } from '../utils/barcodeGenerator';
import { buildLabelHTML } from '../printers/LabelTemplate';
import { useToastStore } from '../stores/toastStore';
import PrintPreviewModal from '../components/PrintPreviewModal';

const productRepo = ProductRepository;
const settingsRepo = SettingsRepository;
const supplierRepo = SupplierRepository;
const PAGE_SIZE = 20;

export default function ProductsPage() {
  const { t } = useTranslation();
  const addToast = useToastStore(s => s.addToast);
  const [products, setProducts] = useState([]);
  const [page, setPage] = useState(1);
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [categorySummary, setCategorySummary] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [form, setForm] = useState({
    name: '', barcode: '', price: '', cost: '', stock: '', min_stock: '', category: '', unit: 'piece', supplier_id: '', status: 'available'
  });
  const [currency, setCurrency] = useState('ر.س');

  const [priceTiers, setPriceTiers] = useState([]);
  const [bulkDiscounts, setBulkDiscounts] = useState([]);
  const [promoPeriods, setPromoPeriods] = useState([]);
  const [tierForm, setTierForm] = useState({ tier_name: '', price: '' });
  const [bulkForm, setBulkForm] = useState({ min_quantity: '', discount_percent: '' });
  const [promoForm, setPromoForm] = useState({ promo_price: '', start_date: '', end_date: '' });
  const [printPreviewHtml, setPrintPreviewHtml] = useState(null);

  const loadAdvancedPricing = async (productId) => {
    const db = window.electronAPI?.db;
    if (!db) return;
    setPriceTiers(await db.all('SELECT * FROM price_tiers WHERE product_id = ?', [productId]) || []);
    setBulkDiscounts(await db.all('SELECT * FROM bulk_discounts WHERE product_id = ?', [productId]) || []);
    setPromoPeriods(await db.all('SELECT * FROM promo_periods WHERE product_id = ?', [productId]) || []);
  };

  useEffect(() => {
    loadProducts();
    loadSettings();
    loadSuppliers();
  }, []);

  const loadSettings = async () => {
    const settings = await settingsRepo.getAll();
    setCurrency(settings.currency_symbol || 'ر.س');
  };

  const loadSuppliers = async () => {
    const all = await supplierRepo.findAll();
    setSuppliers(all || []);
  };

  const loadProducts = async () => {
    const all = await productRepo.findAll('name ASC');
    setProducts(all);
    setPage(1);
    const cats = await productRepo.getCategorySummary();
    setCategorySummary(cats);
  };

  const totalPages = Math.ceil(products.length / PAGE_SIZE) || 1;
  const paginatedProducts = products.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const generateBarcodeFn = async () => {
    const settings = await settingsRepo.getAll();
    const format = settings.barcode_format || 'numeric12';
    setForm({ ...form, barcode: generateBarcode(format) });
  };

  const handlePrintLabel = async (product) => {
    const html = buildLabelHTML({
      productName: product.name,
      barcode: product.barcode || '',
      price: parseFloat(product.price) || 0,
      currency
    });
    setPrintPreviewHtml(html);
  };

  const doPrint = async (html) => {
    if (!html) return;
    const printers = await window.electronAPI?.getPrinters?.();
    if (!printers || printers.length === 0) {
      addToast(t('printing.noPrinter'), 'error');
      setPrintPreviewHtml(null);
      return;
    }
    const result = await window.electronAPI?.print(html);
    setPrintPreviewHtml(null);
    if (result?.success) {
      addToast(t('printing.labelSuccess'), 'success');
    } else {
      addToast(t('printing.error', { error: result?.error || 'Unknown' }), 'error');
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    const existingProduct = editingId ? products.find(p => p.id === editingId) : null;
    if (existingProduct && existingProduct.barcode && existingProduct.barcode !== form.barcode) {
      if (!window.confirm('تحذير: تغيير الباركود قد يؤثر على التتبع. هل أنت متأكد؟')) {
        return;
      }
    }

    const settings = await settingsRepo.getAll();
    const finalBarcode = form.barcode || generateBarcode(settings.barcode_format || 'numeric12');

    const data = {
      name: form.name,
      barcode: finalBarcode,
      price: parseFloat(form.price) || 0,
      cost: parseFloat(form.cost) || 0,
      stock: parseInt(form.stock) || 0,
      min_stock: parseInt(form.min_stock) || 0,
      category: form.category || null,
      unit: form.unit || 'piece',
      supplier_id: form.supplier_id ? parseInt(form.supplier_id) : null,
      status: form.status || 'available'
    };

    if (editingId) {
      await productRepo.update(editingId, data);
    } else {
      await productRepo.create(data);
    }

    await loadProducts();
    setShowModal(false);
    setEditingId(null);
    setForm({ name: '', barcode: '', price: '', cost: '', stock: '', min_stock: '', category: '', unit: 'piece', supplier_id: '', status: 'available' });
  };

  const handleEdit = (product) => {
    setEditingId(product.id);
    setForm({
      name: product.name,
      barcode: product.barcode || '',
      price: product.price,
      cost: product.cost,
      stock: product.stock,
      min_stock: product.min_stock,
      category: product.category || '',
      unit: product.unit,
      supplier_id: product.supplier_id ? String(product.supplier_id) : '',
      status: product.status || 'available'
    });
    setShowModal(true);
    loadAdvancedPricing(product.id);
  };

  const handleDelete = async (id) => {
    if (confirm(t('common.confirmDeleteProduct'))) {
      const hasPO = await productRepo.hasPendingPurchaseOrders(id);
      if (hasPO) {
        alert(t('products.cannotDeleteHasPO'));
        return;
      }
      await productRepo.delete(id);
      await loadProducts();
    }
  };

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">{t('products.title')}</h1>
        <button className="btn btn-primary" onClick={() => { setEditingId(null); setShowModal(true); }}>
          + {t('products.addProduct')}
        </button>
      </div>

      <div className="stats-grid">
        <div className="stat-card">
          <span className="stat-value">{products.length}</span>
          <span className="stat-label">{t('products.totalProducts')}</span>
        </div>
        <div className="stat-card">
          <span className="stat-value">{categorySummary.length}</span>
          <span className="stat-label">{t('products.totalCategories')}</span>
        </div>
        {categorySummary.length > 0 && (
          <div className="stat-card">
            <span className="stat-value">{categorySummary[0].category}</span>
            <span className="stat-label">{t('products.topCategory')} ({categorySummary[0].count})</span>
          </div>
        )}
      </div>

      <div className="card">
        {products.length === 0 ? (
          <div className="empty-state">{t('products.noProducts')}</div>
        ) : (
          <>
            <table className="table">
              <thead>
                <tr>
                  <th>{t('common.name')}</th>
                  <th>{t('common.barcode')}</th>
                  <th>{t('common.price')}</th>
                  <th>{t('common.cost')}</th>
                  <th>{t('common.stock')}</th>
                  <th>{t('common.status')}</th>
                  <th>{t('common.category')}</th>
                  <th>{t('products.supplier')}</th>
                  <th>{t('common.actions')}</th>
                </tr>
              </thead>
              <tbody>
                {paginatedProducts.map(p => (
                  <tr key={p.id}>
                    <td>{p.name}</td>
                    <td>{p.barcode || '-'}</td>
                    <td>{p.price} {currency}</td>
                    <td>{p.cost} {currency}</td>
                    <td style={{ color: p.stock <= p.min_stock ? 'var(--error)' : 'inherit' }}>{p.stock}</td>
                    <td>
                      <span className={`status-badge status-${p.status || 'available'}`}>
                        {t(`products.${p.status === 'under_review' ? 'underReview' : p.status || 'available'}`)}
                      </span>
                    </td>
                    <td>{p.category || '-'}</td>
                    <td>{p.supplier_name || '-'}</td>
                    <td>
                      <button className="btn btn-secondary" onClick={() => handleEdit(p)}>{t('common.edit')}</button>
                      <button className="btn btn-danger" onClick={() => handleDelete(p.id)} style={{ marginRight: '8px' }}>{t('common.delete')}</button>
                      <button className="btn btn-secondary" onClick={() => handlePrintLabel(p)} style={{ marginRight: '8px' }}>{t('products.printLabel')}</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
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
          </>
        )}
      </div>

      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="modal-title">{editingId ? t('products.editProduct') : t('products.addProduct')}</h3>
              <button onClick={() => setShowModal(false)}>×</button>
            </div>
            <form onSubmit={handleSubmit}>
              <div className="form-group">
                <label className="form-label">{t('products.productName')} *</label>
                <input className="input" value={form.name} onChange={e => setForm({...form, name: e.target.value})} required />
              </div>
              <div className="form-group">
                <label className="form-label">{t('common.barcode')}</label>
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                  <input className="input" name="barcode" value={form.barcode} onChange={e => setForm({...form, barcode: e.target.value})} style={{ flex: 1 }} />
                  <button type="button" className="btn btn-secondary" onClick={generateBarcodeFn} style={{ whiteSpace: 'nowrap' }}>{t('products.generateBarcode')}</button>
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div className="form-group">
                  <label className="form-label">{t('common.price')}</label>
                  <input className="input" type="number" step="0.01" value={form.price} onChange={e => setForm({...form, price: e.target.value})} />
                </div>
                <div className="form-group">
                  <label className="form-label">{t('common.cost')}</label>
                  <input className="input" type="number" step="0.01" value={form.cost} onChange={e => setForm({...form, cost: e.target.value})} />
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div className="form-group">
                  <label className="form-label">{t('common.stock')}</label>
                  <input className="input" type="number" value={form.stock} onChange={e => setForm({...form, stock: e.target.value})} />
                </div>
                <div className="form-group">
                  <label className="form-label">{t('products.minStock')}</label>
                  <input className="input" type="number" value={form.min_stock} onChange={e => setForm({...form, min_stock: e.target.value})} />
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div className="form-group">
                  <label className="form-label">{t('common.category')}</label>
                  <input className="input" value={form.category} onChange={e => setForm({...form, category: e.target.value})} />
                </div>
                <div className="form-group">
                  <label className="form-label">{t('common.unit')}</label>
                  <input className="input" value={form.unit} onChange={e => setForm({...form, unit: e.target.value})} />
                </div>
              </div>
              <div className="form-group">
                <label className="form-label">{t('products.supplier')}</label>
                <select className="input" value={form.supplier_id} onChange={e => setForm({...form, supplier_id: e.target.value})}>
                  <option value="">{t('common.none')}</option>
                  {suppliers.map(s => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">{t('common.status')}</label>
                <select className="input" value={form.status} onChange={e => setForm({...form, status: e.target.value})}>
                  <option value="available">{t('products.available')}</option>
                  <option value="damaged">{t('products.damaged')}</option>
                  <option value="under_review">{t('products.underReview')}</option>
                </select>
              </div>
              {editingId && (
                <div style={{ marginTop: '16px', borderTop: '1px solid var(--border)', paddingTop: '12px' }}>
                  <details>
                    <summary style={{ cursor: 'pointer', fontWeight: 'bold', marginBottom: '8px' }}>{t('products.priceTiers')}</summary>
                    <div style={{ marginBottom: '12px' }}>
                      <div style={{ display: 'flex', gap: '8px', marginBottom: '8px' }}>
                        <input className="input" placeholder={t('products.tierName')} value={tierForm.tier_name} onChange={e => setTierForm({...tierForm, tier_name: e.target.value})} style={{ flex: 1 }} />
                        <input className="input" type="number" placeholder={t('common.price')} value={tierForm.price} onChange={e => setTierForm({...tierForm, price: e.target.value})} style={{ width: 100 }} />
                        <button className="btn btn-primary" onClick={async () => {
                          if (!tierForm.tier_name || !tierForm.price) return;
                          await window.electronAPI.db.run('INSERT INTO price_tiers (product_id, tier_name, price) VALUES (?, ?, ?)', [editingId, tierForm.tier_name, parseFloat(tierForm.price)]);
                          setTierForm({ tier_name: '', price: '' });
                          const tiers = await window.electronAPI.db.all('SELECT * FROM price_tiers WHERE product_id = ?', [editingId]);
                          setPriceTiers(tiers || []);
                        }}>+</button>
                      </div>
                      {priceTiers.length > 0 && (
                        <table className="table" style={{ fontSize: '13px' }}>
                          <thead><tr><th>{t('products.tierName')}</th><th>{t('common.price')}</th><th></th></tr></thead>
                          <tbody>
                            {priceTiers.map(t => (
                              <tr key={t.id}>
                                <td>{t.tier_name}</td><td>{t.price}</td>
                                <td><button className="btn btn-danger btn-sm" onClick={async () => {
                                  await window.electronAPI.db.run('DELETE FROM price_tiers WHERE id = ?', [t.id]);
                                  setPriceTiers(priceTiers.filter(pt => pt.id !== t.id));
                                }}>×</button></td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      )}
                    </div>
                  </details>
                  <details>
                    <summary style={{ cursor: 'pointer', fontWeight: 'bold', marginBottom: '8px' }}>{t('products.bulkDiscounts')}</summary>
                    <div style={{ marginBottom: '12px' }}>
                      <div style={{ display: 'flex', gap: '8px', marginBottom: '8px' }}>
                        <input className="input" type="number" placeholder={t('products.minQuantity')} value={bulkForm.min_quantity} onChange={e => setBulkForm({...bulkForm, min_quantity: e.target.value})} style={{ width: 100 }} />
                        <input className="input" type="number" placeholder={t('products.discountPercent')} value={bulkForm.discount_percent} onChange={e => setBulkForm({...bulkForm, discount_percent: e.target.value})} style={{ width: 100 }} />
                        <button className="btn btn-primary" onClick={async () => {
                          if (!bulkForm.min_quantity || !bulkForm.discount_percent) return;
                          const dp = parseFloat(bulkForm.discount_percent);
                          if (dp < 0 || dp > 100) { alert(t('products.invalidDiscount')); return; }
                          if (parseInt(bulkForm.min_quantity) <= 0) { alert(t('products.invalidMinQty')); return; }
                          await window.electronAPI.db.run('INSERT INTO bulk_discounts (product_id, min_quantity, discount_percent) VALUES (?, ?, ?)', [editingId, parseInt(bulkForm.min_quantity), dp]);
                          setBulkForm({ min_quantity: '', discount_percent: '' });
                          const discounts = await window.electronAPI.db.all('SELECT * FROM bulk_discounts WHERE product_id = ?', [editingId]);
                          setBulkDiscounts(discounts || []);
                        }}>+</button>
                      </div>
                      {bulkDiscounts.length > 0 && (
                        <table className="table" style={{ fontSize: '13px' }}>
                          <thead><tr><th>{t('products.minQuantity')}</th><th>{t('products.discountPercent')}</th><th></th></tr></thead>
                          <tbody>
                            {bulkDiscounts.map(d => (
                              <tr key={d.id}>
                                <td>{d.min_quantity}</td><td>{d.discount_percent}%</td>
                                <td><button className="btn btn-danger btn-sm" onClick={async () => {
                                  await window.electronAPI.db.run('DELETE FROM bulk_discounts WHERE id = ?', [d.id]);
                                  setBulkDiscounts(bulkDiscounts.filter(bd => bd.id !== d.id));
                                }}>×</button></td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      )}
                    </div>
                  </details>
                  <details>
                    <summary style={{ cursor: 'pointer', fontWeight: 'bold', marginBottom: '8px' }}>{t('products.promoPeriods')}</summary>
                    <div>
                      <div style={{ display: 'flex', gap: '8px', marginBottom: '8px', flexWrap: 'wrap' }}>
                        <input className="input" type="number" placeholder={t('products.promoPrice')} value={promoForm.promo_price} onChange={e => setPromoForm({...promoForm, promo_price: e.target.value})} style={{ width: 100 }} />
                        <input className="input" type="date" value={promoForm.start_date} onChange={e => setPromoForm({...promoForm, start_date: e.target.value})} style={{ width: 140 }} />
                        <input className="input" type="date" value={promoForm.end_date} onChange={e => setPromoForm({...promoForm, end_date: e.target.value})} style={{ width: 140 }} />
                        <button className="btn btn-primary" onClick={async () => {
                          if (!promoForm.promo_price || !promoForm.start_date || !promoForm.end_date) return;
                          if (promoForm.start_date > promoForm.end_date) { alert(t('products.invalidDateRange')); return; }
                          await window.electronAPI.db.run('INSERT INTO promo_periods (product_id, promo_price, start_date, end_date) VALUES (?, ?, ?, ?)', [editingId, parseFloat(promoForm.promo_price), promoForm.start_date, promoForm.end_date]);
                          setPromoForm({ promo_price: '', start_date: '', end_date: '' });
                          const promos = await window.electronAPI.db.all('SELECT * FROM promo_periods WHERE product_id = ?', [editingId]);
                          setPromoPeriods(promos || []);
                        }}>+</button>
                      </div>
                      {promoPeriods.length > 0 && (
                        <table className="table" style={{ fontSize: '13px' }}>
                          <thead><tr><th>{t('products.promoPrice')}</th><th>{t('products.startDate')}</th><th>{t('products.endDate')}</th><th></th></tr></thead>
                          <tbody>
                            {promoPeriods.map(p => (
                              <tr key={p.id}>
                                <td>{p.promo_price}</td><td>{p.start_date}</td><td>{p.end_date}</td>
                                <td><button className="btn btn-danger btn-sm" onClick={async () => {
                                  await window.electronAPI.db.run('DELETE FROM promo_periods WHERE id = ?', [p.id]);
                                  setPromoPeriods(promoPeriods.filter(pp => pp.id !== p.id));
                                }}>×</button></td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      )}
                    </div>
                  </details>
                </div>
              )}
              <div className="form-actions">
                <button type="button" className="btn btn-secondary" onClick={() => setShowModal(false)}>{t('common.cancel')}</button>
                <button type="submit" className="btn btn-primary">{t('common.save')}</button>
              </div>
            </form>
          </div>
        </div>
      )}
      {printPreviewHtml && (
        <PrintPreviewModal
          html={printPreviewHtml}
          title={t('printing.preview')}
          onPrint={() => doPrint(printPreviewHtml)}
          onClose={() => setPrintPreviewHtml(null)}
        />
      )}
    </div>
  );
}