import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ReturnRepository, InvoiceRepository, ProductRepository,
  CustomerRepository, SettingsRepository, ExchangeRepository
} from '../database';
import { useToastStore } from '../stores/toastStore';
import { useConfirmStore } from '../stores/confirmStore';
import Pagination from '../components/Pagination';
import LoadingSkeleton from '../components/LoadingSkeleton';

const PAGE_SIZE = 10;

const returnRepo = ReturnRepository;
const exchangeRepo = ExchangeRepository;
const invoiceRepo = InvoiceRepository;
const productRepo = ProductRepository;
const customerRepo = CustomerRepository;
const settingsRepo = SettingsRepository;

export default function ReturnsPage() {
  const { t } = useTranslation();
  const addToast = useToastStore(s => s.addToast);
  const confirm = useConfirmStore(s => s.confirm);
  const [tab, setTab] = useState('returns');
  const [returns, setReturns] = useState([]);
  const [exchanges, setExchanges] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [invoices, setInvoices] = useState([]);
  const [products, setProducts] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [showReturnModal, setShowReturnModal] = useState(false);
  const [showExchangeModal, setShowExchangeModal] = useState(false);
  const [currency, setCurrency] = useState('ر.س');
  const [returnForm, setReturnForm] = useState({ invoice_id: '', customer_id: '', reason: '', items: [] });
  const [exchangeForm, setExchangeForm] = useState({
    invoice_id: '', customer_id: '', reason: '',
    returnedItems: [], replacementItems: []
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    const settings = await settingsRepo.getAll();
    setCurrency(settings.currency_symbol || 'ر.س');
    const [allReturns, allExchanges, allInvoices, allProducts, allCustomers] = await Promise.all([
      returnRepo.findAll(),
      exchangeRepo.findAll(),
      invoiceRepo.findAll(),
      productRepo.findAll(),
      customerRepo.findAll()
    ]);
    setReturns(allReturns || []);
    setExchanges(allExchanges || []);
    setInvoices(allInvoices || []);
    setProducts(allProducts || []);
    setCustomers(allCustomers || []);
  };

  const handleReturnInvoiceChange = (invoiceId) => {
    const invoice = invoices.find(i => i.id === parseInt(invoiceId));
    setReturnForm({
      ...returnForm,
      invoice_id: invoiceId,
      customer_id: invoice?.customer_id || ''
    });
  };

  const handleReturnSubmit = async (e) => {
    e.preventDefault();
    if (!returnForm.invoice_id || returnForm.items.length === 0) return;

    const total = returnForm.items.reduce((sum, item) => sum + (item.quantity * item.unit_price), 0);

    await returnRepo.createWithItems({
      return_number: `RET-${new Date().toISOString().slice(0,10).replace(/-/g,'')}-${String(Math.floor(Math.random()*1000)).padStart(3,'0')}`,
      invoice_id: parseInt(returnForm.invoice_id),
      customer_id: returnForm.customer_id ? parseInt(returnForm.customer_id) : null,
      total,
      reason: returnForm.reason || null,
      status: 'processed'
    }, returnForm.items);

    setShowReturnModal(false);
    setReturnForm({ invoice_id: '', customer_id: '', reason: '', items: [] });
    loadData();
  };

  const handleExchangeInvoiceChange = (invoiceId) => {
    const invoice = invoices.find(i => i.id === parseInt(invoiceId));
    setExchangeForm({
      ...exchangeForm,
      invoice_id: invoiceId,
      customer_id: invoice?.customer_id || '',
      returnedItems: [],
      replacementItems: []
    });
  };

  const handleExchangeSubmit = async (e) => {
    e.preventDefault();
    if (!exchangeForm.invoice_id || exchangeForm.returnedItems.length === 0) return;

    const totalReturned = exchangeForm.returnedItems.reduce((s, i) => s + (i.quantity * i.unit_price), 0);
    const totalReplacement = exchangeForm.replacementItems.reduce((s, i) => s + (i.quantity * i.unit_price), 0);

    await exchangeRepo.createWithItems({
      exchange_number: `EXC-${new Date().toISOString().slice(0,10).replace(/-/g,'')}-${String(Math.floor(Math.random()*1000)).padStart(3,'0')}`,
      invoice_id: parseInt(exchangeForm.invoice_id),
      customer_id: exchangeForm.customer_id ? parseInt(exchangeForm.customer_id) : null,
      total_returned: totalReturned,
      total_replacement: totalReplacement,
      difference: totalReturned - totalReplacement,
      reason: exchangeForm.reason || null,
      status: 'completed'
    }, exchangeForm.returnedItems, exchangeForm.replacementItems);

    setShowExchangeModal(false);
    setExchangeForm({ invoice_id: '', customer_id: '', reason: '', returnedItems: [], replacementItems: [] });
    loadData();
  };

  const toggleReturnItem = (product, checked) => {
    if (checked) {
      setExchangeForm({
        ...exchangeForm,
        returnedItems: [...exchangeForm.returnedItems, { product_id: product.id, product_name: product.name, quantity: 1, unit_price: product.price, total: product.price }]
      });
    } else {
      setExchangeForm({ ...exchangeForm, returnedItems: exchangeForm.returnedItems.filter(i => i.product_id !== product.id) });
    }
  };

  const updateReturnItemQty = (productId, qty) => {
    const q = parseInt(qty) || 1;
    setExchangeForm({
      ...exchangeForm,
      returnedItems: exchangeForm.returnedItems.map(i =>
        i.product_id === productId ? { ...i, quantity: q, total: q * i.unit_price } : i
      )
    });
  };

  const toggleReplacementItem = (product, checked) => {
    if (checked) {
      setExchangeForm({
        ...exchangeForm,
        replacementItems: [...exchangeForm.replacementItems, { product_id: product.id, product_name: product.name, quantity: 1, unit_price: product.price, total: product.price }]
      });
    } else {
      setExchangeForm({ ...exchangeForm, replacementItems: exchangeForm.replacementItems.filter(i => i.product_id !== product.id) });
    }
  };

  const updateReplacementItemQty = (productId, qty) => {
    const q = parseInt(qty) || 1;
    setExchangeForm({
      ...exchangeForm,
      replacementItems: exchangeForm.replacementItems.map(i =>
        i.product_id === productId ? { ...i, quantity: q, total: q * i.unit_price } : i
      )
    });
  };

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">{tab === 'returns' ? t('returns.title') : t('returns.exchanges')}</h1>
        {tab === 'returns' ? (
          <button className="btn btn-primary" onClick={() => setShowReturnModal(true)}>
            + {t('returns.addReturn')}
          </button>
        ) : (
          <button className="btn btn-primary" onClick={() => setShowExchangeModal(true)}>
            + {t('returns.addExchange')}
          </button>
        )}
      </div>

      <div style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
        <button
          className={`btn ${tab === 'returns' ? 'btn-primary' : 'btn-secondary'}`}
          onClick={() => setTab('returns')}
        >
          {t('returns.title')}
        </button>
        <button
          className={`btn ${tab === 'exchanges' ? 'btn-primary' : 'btn-secondary'}`}
          onClick={() => setTab('exchanges')}
        >
          {t('returns.exchanges')}
        </button>
      </div>

      {tab === 'returns' ? (
        <div className="card">
          {returns.length === 0 ? (
            <div className="empty-state">{t('returns.noReturns')}</div>
          ) : (
            <table className="table">
              <thead>
                <tr>
                  <th>#</th>
                  <th>{t('invoices.invoiceNumber')}</th>
                  <th>{t('invoices.customer')}</th>
                  <th>{t('common.total')}</th>
                  <th>{t('common.status')}</th>
                  <th>{t('returns.reason')}</th>
                  <th>{t('common.date')}</th>
                </tr>
              </thead>
              <tbody>
                {returns.map(r => (
                  <tr key={r.id}>
                    <td>{r.return_number}</td>
                    <td>{r.invoice_number || '-'}</td>
                    <td>{r.customer_name || '-'}</td>
                    <td>{r.total} {currency}</td>
                    <td>
                      <span style={{
                        padding: '4px 8px', borderRadius: '4px',
                        background: r.status === 'processed' ? 'var(--success)' : r.status === 'pending' ? 'orange' : 'var(--warning)',
                        color: 'white', fontSize: '12px'
                      }}>
                        {r.status === 'processed' ? t('returns.processed') : r.status === 'pending' ? t('returns.pending') : t('returns.pending')}
                      </span>
                    </td>
                    <td>{r.reason || '-'}</td>
                    <td>{new Date(r.created_at).toLocaleDateString('ar')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      ) : (
        <div className="card">
          {exchanges.length === 0 ? (
            <div className="empty-state">{t('returns.noExchanges')}</div>
          ) : (
            <table className="table">
              <thead>
                <tr>
                  <th>{t('returns.exchangeNumber')}</th>
                  <th>{t('invoices.invoiceNumber')}</th>
                  <th>{t('invoices.customer')}</th>
                  <th>{t('returns.returnItem')}</th>
                  <th>{t('returns.replacement')}</th>
                  <th>{t('returns.difference')}</th>
                  <th>{t('common.date')}</th>
                </tr>
              </thead>
              <tbody>
                {exchanges.map(e => (
                  <tr key={e.id}>
                    <td>{e.exchange_number}</td>
                    <td>{e.invoice_number || '-'}</td>
                    <td>{e.customer_name || '-'}</td>
                    <td>{parseFloat(e.total_returned).toFixed(2)} {currency}</td>
                    <td>{parseFloat(e.total_replacement).toFixed(2)} {currency}</td>
                    <td style={{
                      color: parseFloat(e.difference) > 0 ? 'var(--error)' : 'var(--success)',
                      fontWeight: 'bold'
                    }}>
                      {parseFloat(e.difference).toFixed(2)} {currency}
                    </td>
                    <td>{new Date(e.created_at).toLocaleDateString('ar')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* Return Modal */}
      {showReturnModal && (
        <div className="modal-overlay" onClick={() => setShowReturnModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: '600px' }}>
            <div className="modal-header">
              <h3 className="modal-title">{t('returns.addReturn')}</h3>
            </div>
            <form onSubmit={handleReturnSubmit}>
              <div className="form-group">
                <label className="form-label">{t('returns.selectInvoice')} *</label>
                <select className="input" value={returnForm.invoice_id} onChange={(e) => handleReturnInvoiceChange(e.target.value)} required>
                  <option value="">--</option>
                  {invoices.map(inv => (
                    <option key={inv.id} value={inv.id}>{inv.invoice_number} - {inv.total} {currency}</option>
                  ))}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">{t('returns.reason')}</label>
                <textarea className="input" value={returnForm.reason} onChange={e => setReturnForm({...returnForm, reason: e.target.value})} rows={2} />
              </div>
              <div className="form-group">
                <label className="form-label">{t('returns.selectProduct')}</label>
                <div style={{ maxHeight: '200px', overflow: 'auto', border: '1px solid var(--border)', padding: '8px', borderRadius: '4px' }}>
                  {products.map(p => (
                    <div key={p.id} style={{ display: 'flex', gap: '8px', marginBottom: '8px', alignItems: 'center' }}>
                      <input type="checkbox" checked={returnForm.items.some(i => i.product_id === p.id)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setReturnForm({ ...returnForm, items: [...returnForm.items, { product_id: p.id, product_name: p.name, quantity: 1, unit_price: p.price, total_price: p.price }] });
                          } else {
                            setReturnForm({ ...returnForm, items: returnForm.items.filter(i => i.product_id !== p.id) });
                          }
                        }}
                      />
                      <span style={{ flex: 1 }}>{p.name}</span>
                      <input type="number" min="1"
                        value={returnForm.items.find(i => i.product_id === p.id)?.quantity || 1}
                        onChange={(e) => {
                          const qty = parseInt(e.target.value) || 1;
                          const price = returnForm.items.find(i => i.product_id === p.id)?.unit_price || p.price;
                          setReturnForm({ ...returnForm, items: returnForm.items.map(i => i.product_id === p.id ? { ...i, quantity: qty, total_price: qty * price } : i) });
                        }}
                        style={{ width: '60px' }} className="input"
                      />
                    </div>
                  ))}
                </div>
              </div>
              <div style={{ padding: '12px', background: 'var(--bg-secondary)', borderRadius: '8px', marginBottom: '12px' }}>
                <strong>{t('common.total')}: </strong>
                {returnForm.items.reduce((sum, item) => sum + (item.quantity * item.unit_price), 0)} {currency}
              </div>
              <div className="form-actions">
                <button type="button" className="btn btn-secondary" onClick={() => setShowReturnModal(false)}>{t('common.cancel')}</button>
                <button type="submit" className="btn btn-primary" disabled={!returnForm.invoice_id || returnForm.items.length === 0}>{t('common.save')}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Exchange Modal */}
      {showExchangeModal && (
        <div className="modal-overlay" onClick={() => setShowExchangeModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: '700px' }}>
            <div className="modal-header">
              <h3 className="modal-title">{t('returns.addExchange')}</h3>
            </div>
            <form onSubmit={handleExchangeSubmit}>
              <div className="form-group">
                <label className="form-label">{t('returns.selectInvoice')} *</label>
                <select className="input" value={exchangeForm.invoice_id} onChange={(e) => handleExchangeInvoiceChange(e.target.value)} required>
                  <option value="">--</option>
                  {invoices.map(inv => (
                    <option key={inv.id} value={inv.id}>{inv.invoice_number} - {inv.total} {currency}</option>
                  ))}
                </select>
              </div>

              {exchangeForm.invoice_id && (
                <>
                  <div className="form-group">
                    <label className="form-label">{t('returns.returnedItems')}</label>
                    <div style={{ maxHeight: '200px', overflow: 'auto', border: '1px solid var(--border)', padding: '8px', borderRadius: '4px' }}>
                      {products.map(p => (
                        <div key={p.id} style={{ display: 'flex', gap: '8px', marginBottom: '8px', alignItems: 'center' }}>
                          <input type="checkbox"
                            checked={exchangeForm.returnedItems.some(i => i.product_id === p.id)}
                            onChange={(e) => toggleReturnItem(p, e.target.checked)}
                          />
                          <span style={{ flex: 1 }}>{p.name}</span>
                          <input type="number" min="1"
                            value={exchangeForm.returnedItems.find(i => i.product_id === p.id)?.quantity || 1}
                            onChange={(e) => updateReturnItemQty(p.id, e.target.value)}
                            style={{ width: '60px' }} className="input"
                          />
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="form-group">
                    <label className="form-label">{t('returns.replacementItems')}</label>
                    <div style={{ maxHeight: '200px', overflow: 'auto', border: '1px solid var(--border)', padding: '8px', borderRadius: '4px' }}>
                      {products.map(p => (
                        <div key={p.id} style={{ display: 'flex', gap: '8px', marginBottom: '8px', alignItems: 'center' }}>
                          <input type="checkbox"
                            checked={exchangeForm.replacementItems.some(i => i.product_id === p.id)}
                            onChange={(e) => toggleReplacementItem(p, e.target.checked)}
                          />
                          <span style={{ flex: 1 }}>{p.name}</span>
                          <input type="number" min="1"
                            value={exchangeForm.replacementItems.find(i => i.product_id === p.id)?.quantity || 1}
                            onChange={(e) => updateReplacementItemQty(p.id, e.target.value)}
                            style={{ width: '60px' }} className="input"
                          />
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="form-group">
                    <label className="form-label">{t('returns.reason')}</label>
                    <textarea className="input" value={exchangeForm.reason} onChange={e => setExchangeForm({...exchangeForm, reason: e.target.value})} rows={2} />
                  </div>

                  <div style={{ padding: '12px', background: 'var(--bg-secondary)', borderRadius: '8px', marginBottom: '12px' }}>
                    <div><strong>{t('returns.returnItem')}: </strong>
                      {exchangeForm.returnedItems.reduce((s, i) => s + (i.quantity * i.unit_price), 0)} {currency}
                    </div>
                    <div><strong>{t('returns.replacement')}: </strong>
                      {exchangeForm.replacementItems.reduce((s, i) => s + (i.quantity * i.unit_price), 0)} {currency}
                    </div>
                    <div><strong>{t('returns.difference')}: </strong>
                      {Math.abs(exchangeForm.returnedItems.reduce((s, i) => s + (i.quantity * i.unit_price), 0) - exchangeForm.replacementItems.reduce((s, i) => s + (i.quantity * i.unit_price), 0))} {currency}
                    </div>
                  </div>
                </>
              )}

              <div className="form-actions">
                <button type="button" className="btn btn-secondary" onClick={() => setShowExchangeModal(false)}>{t('common.cancel')}</button>
                <button type="submit" className="btn btn-primary"
                  disabled={!exchangeForm.invoice_id || exchangeForm.returnedItems.length === 0}>
                  {t('common.save')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
