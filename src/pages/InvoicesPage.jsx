import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { InvoiceRepository, CustomerRepository, SettingsRepository, ProductRepository } from '../database';
import { useToastStore } from '../stores/toastStore';
import { useConfirmStore } from '../stores/confirmStore';
import Pagination from '../components/Pagination';
import LoadingSkeleton from '../components/LoadingSkeleton';

const PAGE_SIZE = 10;

const invoiceRepo = InvoiceRepository;
const customerRepo = CustomerRepository;
const settingsRepo = SettingsRepository;
const productRepo = ProductRepository;

const STATUS_COLORS = {
  paid: 'var(--success)',
  partial: 'var(--warning)',
  credit: 'var(--accent)',
  cancelled: 'var(--error)',
  returned: 'var(--error)'
};

export default function InvoicesPage() {
  const { t } = useTranslation();
  const addToast = useToastStore(s => s.addToast);
  const confirm = useConfirmStore(s => s.confirm);
  const [invoices, setInvoices] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCustomer, setSelectedCustomer] = useState('');
  const [currency, setCurrency] = useState('ر.س');
  const [selectedInvoice, setSelectedInvoice] = useState(null);
  const [invoiceItems, setInvoiceItems] = useState([]);
  const [showStatusModal, setShowStatusModal] = useState(false);
  const [statusTarget, setStatusTarget] = useState(null);
  const [newStatus, setNewStatus] = useState('');
  const [paymentAmount, setPaymentAmount] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [products, setProducts] = useState([]);
  const [form, setForm] = useState({ customer_id: '', items: [], discount: 0 });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    const settings = await settingsRepo.getAll();
    setCurrency(settings.currency_symbol || 'ر.س');
    const [allInvoices, allCustomers, allProducts] = await Promise.all([
      invoiceRepo.findAll(),
      customerRepo.findAll(),
      productRepo.findAll()
    ]);
    setInvoices(allInvoices || []);
    setCustomers(allCustomers || []);
    setProducts(allProducts || []);
  };

  const getCustomerName = (customerId) => {
    const customer = customers.find(c => c.id === customerId);
    return customer?.name || '-';
  };

  const filteredInvoices = invoices.filter(inv => {
    const matchesSearch = !searchQuery || inv.invoice_number.includes(searchQuery);
    const matchesCustomer = !selectedCustomer || inv.customer_id == selectedCustomer;
    return matchesSearch && matchesCustomer;
  });

  const viewInvoiceDetails = async (invoice) => {
    setSelectedInvoice(invoice);
    const items = await invoiceRepo.findById(invoice.id);
    if (items && items.id) {
      const allItems = await window.electronAPI.db.all('SELECT * FROM invoice_items WHERE invoice_id = ?', [invoice.id]);
      setInvoiceItems(allItems || []);
    }
  };

  const closeModal = () => {
    setSelectedInvoice(null);
    setInvoiceItems([]);
  };

  const openStatusModal = (invoice) => {
    setStatusTarget(invoice);
    setNewStatus(invoice.status || 'paid');
    setPaymentAmount('');
    setShowStatusModal(true);
  };

  const handleStatusChange = async (e) => {
    e.preventDefault();
    if (!statusTarget) return;

    if (newStatus === 'cancelled' || newStatus === 'returned') {
      if (!confirm(t('common.confirmDelete'))) return;
    }

    const paid = newStatus === 'paid' ? statusTarget.total : (newStatus === 'partial' ? parseFloat(paymentAmount) || 0 : 0);
    await invoiceRepo.updateStatus(statusTarget.id, newStatus, paid);
    setShowStatusModal(false);
    setStatusTarget(null);
    loadData();
  };

  const handleAddInvoice = async (e) => {
    e.preventDefault();
    if (form.items.length === 0) return;

    const subtotal = form.items.reduce((sum, i) => sum + (i.quantity * i.unit_price), 0);
    const total = subtotal - form.discount;
    const invoiceNumber = invoiceRepo.generateInvoiceNumber();

    const invoiceData = {
      invoice_number: invoiceNumber,
      customer_id: parseInt(form.customer_id) || null,
      subtotal,
      discount: form.discount,
      total,
      paid: total,
      due: 0,
      status: 'paid'
    };

    await invoiceRepo.createInvoiceWithItems(invoiceData, form.items);
    setShowAddModal(false);
    setForm({ customer_id: '', items: [], discount: 0 });
    addToast(t('invoices.newInvoice') + ': ' + invoiceNumber);
    loadData();
  };

  const getStatusLabel = (status) => {
    const key = `invoices.status_${status}`;
    const label = t(key);
    return label !== key ? label : status;
  };

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">{t('invoices.title')}</h1>
        <button className="btn btn-primary" onClick={() => setShowAddModal(true)}>
          + {t('invoices.newInvoice')}
        </button>
      </div>

      <div className="card" style={{ marginBottom: '20px' }}>
        <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
          <input
            type="text"
            className="input"
            placeholder={t('invoices.search')}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{ flex: 1, minWidth: '200px' }}
          />
          <select
            className="input"
            value={selectedCustomer}
            onChange={(e) => setSelectedCustomer(e.target.value)}
            style={{ minWidth: '200px' }}
          >
            <option value="">{t('invoices.allCustomers')}</option>
            {customers.map(c => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="card">
        {filteredInvoices.length === 0 ? (
          <div className="empty-state">{t('invoices.noInvoices')}</div>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>{t('invoices.invoiceNumber')}</th>
                <th>{t('invoices.customer')}</th>
                <th>{t('invoices.subtotal')}</th>
                <th>{t('invoices.discount')}</th>
                <th>{t('invoices.total')}</th>
                <th>{t('invoices.paidAmount')}</th>
                <th>{t('invoices.dueAmount')}</th>
                <th>{t('common.status')}</th>
                <th>{t('common.date')}</th>
                <th>{t('common.actions')}</th>
              </tr>
            </thead>
            <tbody>
              {filteredInvoices.map(inv => (
                <tr key={inv.id}>
                  <td style={{ fontWeight: 'bold' }}>{inv.invoice_number}</td>
                  <td>{getCustomerName(inv.customer_id)}</td>
                  <td>{inv.subtotal} {currency}</td>
                  <td>{inv.discount || 0} {currency}</td>
                  <td style={{ fontWeight: 'bold' }}>{inv.total} {currency}</td>
                  <td>{inv.paid || 0} {currency}</td>
                  <td>{(inv.total - (inv.paid || 0)).toFixed(2)} {currency}</td>
                  <td>
                    <span style={{
                      padding: '4px 8px',
                      borderRadius: '4px',
                      background: STATUS_COLORS[inv.status] || 'var(--warning)',
                      color: 'white',
                      fontSize: '12px'
                    }}>
                      {getStatusLabel(inv.status)}
                    </span>
                  </td>
                  <td>{new Date(inv.created_at).toLocaleDateString('ar')}</td>
                  <td>
                    <button className="btn btn-secondary" onClick={() => viewInvoiceDetails(inv)} style={{ marginLeft: '4px' }}>
                      {t('invoices.viewDetails')}
                    </button>
                    <button className="btn btn-secondary" onClick={() => openStatusModal(inv)}>
                      {t('invoices.changeStatus')}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {selectedInvoice && (
        <div className="modal-overlay" onClick={closeModal}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: '500px' }}>
            <div className="modal-header">
              <h3 className="modal-title">{selectedInvoice.invoice_number}</h3>
            </div>
            <div style={{ padding: '16px' }}>
              <div style={{ marginBottom: '16px' }}>
                <strong>{t('invoices.customer')}:</strong> {getCustomerName(selectedInvoice.customer_id)}
              </div>
              <div style={{ marginBottom: '16px' }}>
                <strong>{t('common.date')}:</strong> {new Date(selectedInvoice.created_at).toLocaleString('ar')}
              </div>
              
              <h4 style={{ marginBottom: '12px' }}>{t('invoices.items')}</h4>
              <table className="table" style={{ fontSize: '14px' }}>
                <thead>
                  <tr>
                    <th>{t('common.name')}</th>
                    <th>{t('common.quantity')}</th>
                    <th>{t('common.price')}</th>
                    <th>{t('common.total')}</th>
                  </tr>
                </thead>
                <tbody>
                  {invoiceItems.map((item, idx) => (
                    <tr key={idx}>
                      <td>{item.product_name}</td>
                      <td>{item.quantity}</td>
                      <td>{item.unit_price}</td>
                      <td>{item.total_price}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              
              <div style={{ marginTop: '16px', padding: '12px', background: 'var(--bg-secondary)', borderRadius: '8px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                  <span>{t('invoices.subtotal')}:</span>
                  <span>{selectedInvoice.subtotal} {currency}</span>
                </div>
                {selectedInvoice.discount > 0 && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px', color: 'var(--success)' }}>
                    <span>{t('invoices.discount')}:</span>
                    <span>-{selectedInvoice.discount} {currency}</span>
                  </div>
                )}
                <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 'bold', fontSize: '18px', borderTop: '1px solid var(--border)', paddingTop: '8px' }}>
                  <span>{t('invoices.total')}:</span>
                  <span>{selectedInvoice.total} {currency}</span>
                </div>
              </div>
              
              <button className="btn btn-secondary" onClick={closeModal} style={{ width: '100%', marginTop: '16px' }}>
                {t('common.cancel')}
              </button>
            </div>
          </div>
        </div>
      )}

      {showStatusModal && statusTarget && (
        <div className="modal-overlay" onClick={() => setShowStatusModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: '400px' }}>
            <div className="modal-header">
              <h3 className="modal-title">{t('invoices.changeStatus')} - {statusTarget.invoice_number}</h3>
            </div>
            <form onSubmit={handleStatusChange}>
              <div className="form-group">
                <label className="form-label">{t('common.status')}</label>
                <select className="input" value={newStatus} onChange={e => setNewStatus(e.target.value)}>
                  <option value="paid">{t('invoices.status_paid')}</option>
                  <option value="partial">{t('invoices.status_partial')}</option>
                  <option value="credit">{t('invoices.status_credit')}</option>
                  <option value="cancelled">{t('invoices.status_cancelled')}</option>
                  <option value="returned">{t('invoices.status_returned')}</option>
                </select>
              </div>

              {newStatus === 'partial' && (
                <div className="form-group">
                  <label className="form-label">{t('invoices.paidAmount')}</label>
                  <input className="input" type="number" step="0.01" value={paymentAmount}
                    onChange={e => setPaymentAmount(e.target.value)} required
                    max={statusTarget.total}
                  />
                </div>
              )}

              <div style={{ padding: '12px', background: 'var(--bg-secondary)', borderRadius: '8px', marginBottom: '12px' }}>
                <div><strong>{t('invoices.total')}:</strong> {statusTarget.total} {currency}</div>
                <div><strong>{t('invoices.paidAmount')}:</strong> {statusTarget.paid || 0} {currency}</div>
                <div><strong>{t('invoices.dueAmount')}:</strong> {(statusTarget.total - (statusTarget.paid || 0)).toFixed(2)} {currency}</div>
              </div>

              <div className="form-actions">
                <button type="button" className="btn btn-secondary" onClick={() => setShowStatusModal(false)}>{t('common.cancel')}</button>
                <button type="submit" className="btn btn-primary">{t('common.save')}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showAddModal && (
        <div className="modal-overlay" onClick={() => setShowAddModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: '600px' }}>
            <div className="modal-header">
              <h3 className="modal-title">{t('invoices.newInvoice')}</h3>
            </div>
            <form onSubmit={handleAddInvoice}>
              <div className="form-group">
                <label className="form-label">{t('invoices.customer')}</label>
                <select className="input" value={form.customer_id} onChange={e => setForm({...form, customer_id: e.target.value})}>
                  <option value="">{t('pos.selectCustomer')}</option>
                  {customers.map(c => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label className="form-label">{t('invoices.items')}</label>
                <div style={{ maxHeight: '200px', overflow: 'auto', border: '1px solid var(--border)', padding: '8px', borderRadius: '4px' }}>
                  {products.map(p => (
                    <div key={p.id} style={{ display: 'flex', gap: '8px', marginBottom: '8px', alignItems: 'center' }}>
                      <input
                        type="checkbox"
                        checked={form.items.some(i => i.product_id === p.id)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setForm({
                              ...form,
                              items: [...form.items, { product_id: p.id, product_name: p.name, barcode: p.barcode, quantity: 1, unit_price: parseFloat(p.price) || 0, total_price: parseFloat(p.price) || 0 }]
                            });
                          } else {
                            setForm({ ...form, items: form.items.filter(i => i.product_id !== p.id) });
                          }
                        }}
                      />
                      <span style={{ flex: 1, fontSize: '13px' }}>{p.name}</span>
                      <input
                        type="number"
                        min="1"
                        value={form.items.find(i => i.product_id === p.id)?.quantity || 1}
                        onChange={(e) => {
                          const qty = parseInt(e.target.value) || 1;
                          const price = form.items.find(i => i.product_id === p.id)?.unit_price || p.price;
                          setForm({
                            ...form,
                            items: form.items.map(i => i.product_id === p.id ? { ...i, quantity: qty, total_price: qty * price } : i)
                          });
                        }}
                        style={{ width: '50px' }}
                        className="input"
                      />
                      <input
                        type="number"
                        step="0.01"
                        value={form.items.find(i => i.product_id === p.id)?.unit_price || p.price}
                        onChange={(e) => {
                          const price = parseFloat(e.target.value) || 0;
                          const qty = form.items.find(i => i.product_id === p.id)?.quantity || 1;
                          setForm({
                            ...form,
                            items: form.items.map(i => i.product_id === p.id ? { ...i, unit_price: price, total_price: qty * price } : i)
                          });
                        }}
                        style={{ width: '70px' }}
                        className="input"
                      />
                    </div>
                  ))}
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">{t('invoices.discount')}</label>
                <input className="input" type="number" min="0" step="0.01" value={form.discount}
                  onChange={e => setForm({...form, discount: parseFloat(e.target.value) || 0})} />
              </div>

              <div style={{ padding: '12px', background: 'var(--bg-secondary)', borderRadius: '8px', marginBottom: '12px' }}>
                <strong>{t('invoices.subtotal')}: </strong>
                {form.items.reduce((sum, i) => sum + (i.quantity * i.unit_price), 0).toFixed(2)} {currency}
                <br />
                <strong>{t('invoices.total')}: </strong>
                {(form.items.reduce((sum, i) => sum + (i.quantity * i.unit_price), 0) - form.discount).toFixed(2)} {currency}
              </div>

              <div className="form-actions">
                <button type="button" className="btn btn-secondary" onClick={() => setShowAddModal(false)}>{t('common.cancel')}</button>
                <button type="submit" className="btn btn-primary" disabled={form.items.length === 0}>{t('common.save')}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
