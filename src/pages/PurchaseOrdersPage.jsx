import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { PurchaseOrderRepository, ProductRepository, SupplierRepository, SettingsRepository, JournalEntryRepository } from '../database';

const poRepo = PurchaseOrderRepository;
const productRepo = ProductRepository;
const supplierRepo = SupplierRepository;
const settingsRepo = SettingsRepository;
const journalRepo = JournalEntryRepository;

export default function PurchaseOrdersPage() {
  const { t } = useTranslation();
  const [orders, setOrders] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [products, setProducts] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState({ supplier_id: '', items: [], notes: '', status: 'pending' });
  const [filteredProducts, setFilteredProducts] = useState([]);
  const [currency, setCurrency] = useState('ر.س');

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    if (form.supplier_id) {
      const sid = parseInt(form.supplier_id);
      setFilteredProducts(products.filter(p => Number(p.supplier_id) === sid));
    } else {
      setFilteredProducts([]);
    }
    setForm(f => ({ ...f, items: [] }));
  }, [form.supplier_id, products]);

  const loadData = async () => {
    const settings = await settingsRepo.getAll();
    setCurrency(settings.currency_symbol || 'ر.س');
    const allOrders = await poRepo.findAll();
    const allSuppliers = await supplierRepo.findAll();
    const allProducts = await productRepo.findAll();
    setOrders(allOrders || []);
    setSuppliers(allSuppliers || []);
    setProducts(allProducts || []);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.supplier_id || form.items.length === 0) return;

    const subtotal = form.items.reduce((sum, item) => sum + (item.quantity * item.unit_price), 0);
    const total = subtotal;

    const orderData = {
      po_number: `PO-${new Date().toISOString().slice(0,10).replace(/-/g,'')}-${String(Math.floor(Math.random()*1000)).padStart(3,'0')}`,
      supplier_id: parseInt(form.supplier_id),
      subtotal,
      discount: 0,
      total,
      notes: form.notes || null,
      status: 'pending'
    };

    if (editingId) {
      await poRepo.update(editingId, orderData);
    } else {
      await poRepo.createWithItems(orderData, form.items);
    }
    
    setShowModal(false);
    setEditingId(null);
    setForm({ supplier_id: '', items: [], notes: '', status: 'pending' });
    loadData();
  };

  const handleReceive = async (orderId) => {
    const order = orders.find(o => o.id === orderId);
    if (!order || order.status !== 'pending') {
      alert(t('purchaseOrders.alreadyReceived'));
      return;
    }
    if (confirm(t('purchaseOrders.receive') + '?')) {
      const supplier = suppliers.find(s => s.id === order.supplier_id);
      
      // Check credit limit
      if (supplier && supplier.credit_limit > 0) {
        const currentBalance = parseFloat(supplier.balance) || 0;
        const newBalance = currentBalance + order.total;
        if (newBalance > supplier.credit_limit) {
          alert(`${t('customers.creditLimit')} exceeded! Current: ${currentBalance}, Adding: ${order.total}, Limit: ${supplier.credit_limit}`);
        }
      }
      
      await poRepo.receiveOrder(orderId);
      
      // Update supplier balance
      if (supplier) {
        const newBalance = (supplier.balance || 0) + order.total;
        await supplierRepo.update(supplier.id, { balance: newBalance });
      }
      
      // Auto-create journal entry for purchase
      try {
        const entryNumber = `JE-PO-${new Date().toISOString().slice(0,10).replace(/-/g,'')}-${String(Math.floor(Math.random()*1000)).padStart(3,'0')}`;
        const journalItems = [
          // Debit: Inventory
          { account_id: 1310, debit: order.total, credit: 0, description: `PO Receipt: ${order.po_number}` },
          // Credit: Supplier
          { account_id: 2110, debit: 0, credit: order.total, description: `PO Receipt: ${order.po_number}` }
        ];
        
        await journalRepo.createWithItems({
          entry_number: entryNumber,
          date: new Date().toISOString().slice(0,10),
          description: `Purchase Order Received - ${order.po_number}`,
          reference: order.po_number,
          source_type: 'purchase_order',
          source_id: orderId,
          status: 'posted'
        }, journalItems);
      } catch (err) {
        console.error('Failed to create journal entry:', err);
      }
      
      loadData();
    }
  };

  const handleCancel = async (orderId) => {
    if (confirm(t('purchaseOrders.confirmCancel'))) {
      await poRepo.cancelOrder(orderId);
      addToast(t('purchaseOrders.orderCancelled'), 'info');
      loadData();
    }
  };

  const handleDelete = (id) => {
    if (confirm(t('common.confirmDelete'))) {
      poRepo.delete(id).then(loadData);
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'received': return 'var(--success)';
      case 'cancelled': return 'var(--error)';
      default: return 'var(--warning)';
    }
  };

  const getStatusLabel = (status) => {
    switch (status) {
      case 'received': return t('purchaseOrders.received');
      case 'cancelled': return t('purchaseOrders.cancelled');
      default: return t('purchaseOrders.pending');
    }
  };

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">{t('purchaseOrders.title')}</h1>
        <button className="btn btn-primary" onClick={() => { setEditingId(null); setForm({ supplier_id: '', items: [], notes: '', status: 'pending' }); setShowModal(true); }}>
          + {t('purchaseOrders.addOrder')}
        </button>
      </div>

      <div className="card">
        {orders.length === 0 ? (
          <div className="empty-state">{t('purchaseOrders.noOrders')}</div>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>{t('purchaseOrders.supplier')}</th>
                <th>{t('invoices.invoiceNumber')}</th>
                <th>{t('common.total')}</th>
                <th>{t('common.status')}</th>
                <th>{t('common.date')}</th>
                <th>{t('common.actions')}</th>
              </tr>
            </thead>
            <tbody>
              {orders.map(o => (
                <tr key={o.id}>
                  <td>{o.supplier_name}</td>
                  <td>{o.po_number}</td>
                  <td>{o.total} {currency}</td>
                  <td style={{ color: getStatusColor(o.status), fontWeight: 'bold' }}>
                    {getStatusLabel(o.status)}
                  </td>
                  <td>{new Date(o.created_at).toLocaleDateString('ar')}</td>
                  <td>
                    {o.status === 'pending' && (
                      <>
                        <button className="btn btn-primary" onClick={() => handleReceive(o.id)} style={{ marginRight: '8px' }}>
                          {t('purchaseOrders.receive')}
                        </button>
                        <button className="btn btn-danger" onClick={() => handleCancel(o.id)} style={{ marginRight: '8px' }}>
                          {t('purchaseOrders.cancelOrder')}
                        </button>
                      </>
                    )}
                    <button className="btn btn-danger" onClick={() => handleDelete(o.id)}>
                      {t('common.delete')}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: '600px' }}>
            <div className="modal-header">
              <h3 className="modal-title">{t('purchaseOrders.addOrder')}</h3>
            </div>
            <form onSubmit={handleSubmit}>
              <div className="form-group">
                <label className="form-label">{t('purchaseOrders.supplier')} *</label>
                <select className="input" value={form.supplier_id} onChange={e => setForm({...form, supplier_id: e.target.value})} required>
                  <option value="">Select supplier</option>
                  {suppliers.map(s => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label className="form-label">{t('products.title')}</label>
                {!form.supplier_id ? (
                  <div style={{ padding: '12px', color: 'var(--text-secondary)', textAlign: 'center' }}>
                    {t('purchaseOrders.selectSupplierFirst')}
                  </div>
                ) : (
                  <div style={{ maxHeight: '200px', overflow: 'auto', border: '1px solid var(--border)', padding: '8px', borderRadius: '4px' }}>
                    {filteredProducts.length === 0 ? (
                      <div style={{ padding: '12px', color: 'var(--text-secondary)', textAlign: 'center' }}>
                        {t('purchaseOrders.noProductsForSupplier')}
                      </div>
                    ) : (
                      filteredProducts.map(p => (
                        <div key={p.id} style={{ display: 'flex', gap: '8px', marginBottom: '8px', alignItems: 'center' }}>
                          <input
                            type="checkbox"
                            checked={form.items.some(i => i.product_id === p.id)}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setForm({
                                  ...form,
                                  items: [...form.items, { product_id: p.id, product_name: p.name, quantity: 1, unit_price: p.cost, total_price: p.cost }]
                                });
                              } else {
                                setForm({ ...form, items: form.items.filter(i => i.product_id !== p.id) });
                              }
                            }}
                          />
                          <span style={{ flex: 1 }}>{p.name}</span>
                          <input
                            type="number"
                            min="1"
                            value={form.items.find(i => i.product_id === p.id)?.quantity || 1}
                            onChange={(e) => {
                              const qty = parseInt(e.target.value) || 1;
                              const price = form.items.find(i => i.product_id === p.id)?.unit_price || p.cost;
                              setForm({
                                ...form,
                                items: form.items.map(i => i.product_id === p.id ? { ...i, quantity: qty, total_price: qty * price } : i)
                              });
                            }}
                            style={{ width: '60px' }}
                            className="input"
                          />
                          <input
                            type="number"
                            step="0.01"
                            value={form.items.find(i => i.product_id === p.id)?.unit_price || p.cost}
                            onChange={(e) => {
                              const price = parseFloat(e.target.value) || 0;
                              const qty = form.items.find(i => i.product_id === p.id)?.quantity || 1;
                              setForm({
                                ...form,
                                items: form.items.map(i => i.product_id === p.id ? { ...i, unit_price: price, total_price: qty * price } : i)
                              });
                            }}
                            style={{ width: '80px' }}
                            className="input"
                          />
                        </div>
                      ))
                    )}
                  </div>
                )}
              </div>

              <div className="form-group">
                <label className="form-label">{t('common.notes')}</label>
                <textarea className="input" value={form.notes} onChange={e => setForm({...form, notes: e.target.value})} rows={2} />
              </div>

              <div style={{ padding: '12px', background: 'var(--bg-secondary)', borderRadius: '8px', marginBottom: '12px' }}>
                <strong>{t('common.total')}: </strong>
                {form.items.reduce((sum, item) => sum + (item.quantity * item.unit_price), 0)} {currency}
              </div>

              <div className="form-actions">
                <button type="button" className="btn btn-secondary" onClick={() => setShowModal(false)}>{t('common.cancel')}</button>
                <button type="submit" className="btn btn-primary" disabled={!form.supplier_id || form.items.length === 0}>{t('common.save')}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}