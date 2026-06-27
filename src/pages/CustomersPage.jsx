import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { CustomerRepository, SettingsRepository, CustomerPaymentRepository, InvoiceRepository, ReturnRepository } from '../database';
import { useToastStore } from '../stores/toastStore';
import { useConfirmStore } from '../stores/confirmStore';
import Pagination from '../components/Pagination';
import LoadingSkeleton from '../components/LoadingSkeleton';

const customerRepo = CustomerRepository;
const settingsRepo = SettingsRepository;
const paymentRepo = CustomerPaymentRepository;
const invoiceRepo = InvoiceRepository;
const returnRepo = ReturnRepository;
const PAGE_SIZE = 10;

export default function CustomersPage() {
  const { t } = useTranslation();
  const addToast = useToastStore(s => s.addToast);
  const confirm = useConfirmStore(s => s.confirm);
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState({ name: '', phone: '', email: '', address: '', notes: '', credit_limit: '' });
  const [currency, setCurrency] = useState('ر.س');

  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [paymentCustomer, setPaymentCustomer] = useState(null);
  const [paymentForm, setPaymentForm] = useState({ amount: '', date: new Date().toISOString().slice(0, 10), method: 'cash', notes: '' });
  const [showPaymentHistory, setShowPaymentHistory] = useState(false);
  const [paymentHistory, setPaymentHistory] = useState([]);
  const [historyCustomer, setHistoryCustomer] = useState(null);

  const [showStatement, setShowStatement] = useState(false);
  const [statementCustomer, setStatementCustomer] = useState(null);
  const [statementData, setStatementData] = useState([]);

  useEffect(() => {
    loadCustomers();
    loadSettings();
  }, []);

  const loadSettings = async () => {
    const settings = await settingsRepo.getAll();
    setCurrency(settings.currency_symbol || 'ر.س');
  };

  const loadCustomers = async () => {
    setLoading(true);
    const all = await customerRepo.findAll('name ASC');
    setCustomers(all || []);
    setLoading(false);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const data = {
      name: form.name,
      phone: form.phone || null,
      email: form.email || null,
      address: form.address || null,
      notes: form.notes || null,
      credit_limit: parseFloat(form.credit_limit) || 0,
      balance: editingId ? customers.find(c => c.id === editingId)?.balance || 0 : 0
    };

    try {
      if (editingId) {
        await customerRepo.update(editingId, data);
        addToast(t('common.saved'), 'success');
      } else {
        await customerRepo.create(data);
        addToast(t('common.saved'), 'success');
      }
      loadCustomers();
    } catch (err) {
      addToast(err.message, 'error');
    }
    setShowModal(false);
    setEditingId(null);
    setForm({ name: '', phone: '', email: '', address: '', notes: '', credit_limit: '' });
  };

  const handleEdit = (customer) => {
    setEditingId(customer.id);
    setForm({ 
      name: customer.name, 
      phone: customer.phone || '', 
      email: customer.email || '', 
      address: customer.address || '', 
      notes: customer.notes || '',
      credit_limit: customer.credit_limit || ''
    });
    setShowModal(true);
  };

  const handleDelete = async (id) => {
    const hasInvoices = await customerRepo.hasInvoices(id);
    if (hasInvoices) {
      alert(t('customers.cannotDeleteHasInvoices'));
      return;
    }
    if (!confirm(t('common.confirmDelete'))) return;
    await customerRepo.delete(id);
    loadCustomers();
  };

  const openPaymentModal = (customer) => {
    setPaymentCustomer(customer);
    setPaymentForm({ amount: '', date: new Date().toISOString().slice(0, 10), method: 'cash', notes: '' });
    setShowPaymentModal(true);
  };

  const submitPayment = async (e) => {
    e.preventDefault();
    if (!paymentCustomer || !paymentForm.amount) return;

    const amount = parseFloat(paymentForm.amount);
    if (amount <= 0) return;

    try {
      const db = window.electronAPI?.db;
      await db.run(
        'UPDATE customers SET balance = balance - ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
        [amount, paymentCustomer.id]
      );

      await paymentRepo.create({
        customer_id: paymentCustomer.id,
        amount,
        payment_method: paymentForm.method,
        date: paymentForm.date,
        notes: paymentForm.notes || null,
      });

      addToast(t('common.saved'), 'success');
      setShowPaymentModal(false);
      setPaymentCustomer(null);
      loadCustomers();
    } catch (err) {
      addToast(err.message, 'error');
    }
  };

  const openPaymentHistory = async (customer) => {
    setHistoryCustomer(customer);
    const payments = await paymentRepo.findByCustomer(customer.id);
    setPaymentHistory(payments || []);
    setShowPaymentHistory(true);
  };

  const openStatement = async (customer) => {
    setStatementCustomer(customer);

    const [invoices, payments, returnsData] = await Promise.all([
      invoiceRepo.findInvoicedByCustomer(customer.id),
      paymentRepo.findByCustomer(customer.id),
      returnRepo.findByCustomer(customer.id)
    ]);

    const entries = [];
    let balance = parseFloat(customer.balance) || 0;
    balance = -balance;

    entries.push({
      date: null,
      type: t('customers.statement'),
      description: 'الرصيد الافتتاحي',
      debit: 0,
      credit: 0,
      balance
    });

    (invoices || []).forEach(inv => {
      balance += parseFloat(inv.total);
      entries.push({
        date: inv.created_at,
        type: t('customers.statementInvoice'),
        description: inv.invoice_number,
        debit: parseFloat(inv.total),
        credit: 0,
        balance
      });
    });

    (returnsData || []).forEach(ret => {
      balance -= parseFloat(ret.total);
      entries.push({
        date: ret.created_at,
        type: t('customers.statementReturn'),
        description: `${ret.invoice_number || ''} - ${ret.reason || ''}`,
        debit: 0,
        credit: parseFloat(ret.total),
        balance
      });
    });

    (payments || []).forEach(p => {
      balance -= parseFloat(p.amount);
      entries.push({
        date: p.created_at,
        type: t('customers.statementPayment'),
        description: p.notes || p.payment_method,
        debit: 0,
        credit: parseFloat(p.amount),
        balance
      });
    });

    entries.sort((a, b) => {
      if (!a.date) return -1;
      if (!b.date) return 1;
      return new Date(a.date) - new Date(b.date);
    });

    let runningBalance = 0;
    entries.forEach(e => {
      runningBalance += e.debit - e.credit;
      e.balance = runningBalance;
    });

    setStatementData(entries);
    setShowStatement(true);
  };

  const filteredCustomers = customers.filter(c => {
    const q = search.toLowerCase();
    return !q || c.name.toLowerCase().includes(q) || (c.phone && c.phone.includes(q)) || (c.email && c.email.toLowerCase().includes(q));
  });

  const totalPages = Math.ceil(filteredCustomers.length / PAGE_SIZE);
  const paged = filteredCustomers.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">{t('customers.title')}</h1>
        <button className="btn btn-primary" onClick={() => { setEditingId(null); setShowModal(true); }}>+ {t('customers.addCustomer')}</button>
      </div>

      <div className="card">
        <div className="card-header">
          <input className="input input-sm" style={{ maxWidth: '280px' }}
            placeholder={`${t('common.search')}...`}
            value={search} onChange={e => { setSearch(e.target.value); setPage(1); }}
          />
        </div>
        {loading ? (
          <LoadingSkeleton rows={5} cols={5} />
        ) : paged.length === 0 ? (
          <div className="empty-state">{t('customers.noCustomers')}</div>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>{t('common.name')}</th>
                <th>{t('common.phone')}</th>
                <th>{t('common.email')}</th>
                <th>{t('common.address')}</th>
                <th>{t('customers.balance')}</th>
                <th>{t('customers.creditLimit')}</th>
                <th>{t('common.actions')}</th>
              </tr>
            </thead>
            <tbody>
              {paged.map(c => (
                <tr key={c.id}>
                  <td>{c.name}</td>
                  <td>{c.phone || '-'}</td>
                  <td>{c.email || '-'}</td>
                  <td>{c.address || '-'}</td>
                  <td style={{ color: c.balance > 0 ? 'var(--error)' : 'var(--success)' }}>
                    {c.balance || 0} {currency}
                  </td>
                  <td>{c.credit_limit || 0} {currency}</td>
                  <td>
                    <button className="btn btn-success" onClick={() => openPaymentModal(c)} style={{ marginLeft: '4px' }}>
                      {t('suppliers.recordPayment')}
                    </button>
                    <button className="btn btn-secondary" onClick={() => openPaymentHistory(c)} style={{ marginLeft: '4px' }}>
                      {t('suppliers.paymentHistory')}
                    </button>
                    <button className="btn btn-secondary" onClick={() => openStatement(c)} style={{ marginLeft: '4px' }}>{t('customers.statement')}</button>
                    <button className="btn btn-secondary" onClick={() => handleEdit(c)}>{t('common.edit')}</button>
                    <button className="btn btn-danger" onClick={() => handleDelete(c.id)} style={{ marginRight: '8px' }}>{t('common.delete')}</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        <Pagination page={page} totalPages={totalPages} onChange={setPage} />
      </div>

      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="modal-title">{editingId ? t('customers.editCustomer') : t('customers.addCustomer')}</h3>
            </div>
            <form onSubmit={handleSubmit}>
              <div className="form-group">
                <label className="form-label">{t('common.name')} *</label>
                <input className="input" value={form.name} onChange={e => setForm({...form, name: e.target.value})} required />
              </div>
              <div className="form-group">
                <label className="form-label">{t('common.phone')}</label>
                <input className="input" value={form.phone} onChange={e => setForm({...form, phone: e.target.value})} />
              </div>
              <div className="form-group">
                <label className="form-label">{t('common.email')}</label>
                <input className="input" type="email" value={form.email} onChange={e => setForm({...form, email: e.target.value})} />
              </div>
              <div className="form-group">
                <label className="form-label">{t('common.address')}</label>
                <input className="input" value={form.address} onChange={e => setForm({...form, address: e.target.value})} />
              </div>
              <div className="form-group">
                <label className="form-label">{t('customers.creditLimit')} ({currency})</label>
                <input className="input" type="number" step="0.01" value={form.credit_limit} onChange={e => setForm({...form, credit_limit: e.target.value})} placeholder="0" />
              </div>
              <div className="form-group">
                <label className="form-label">{t('common.notes')}</label>
                <textarea className="input" value={form.notes} onChange={e => setForm({...form, notes: e.target.value})} rows={3} />
              </div>
              <div className="form-actions">
                <button type="button" className="btn btn-secondary" onClick={() => setShowModal(false)}>{t('common.cancel')}</button>
                <button type="submit" className="btn btn-primary">{t('common.save')}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showPaymentModal && paymentCustomer && (
        <div className="modal-overlay" onClick={() => setShowPaymentModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="modal-title">{t('suppliers.recordPayment')} - {paymentCustomer.name}</h3>
            </div>
            <form onSubmit={submitPayment}>
              <div className="form-group">
                <label className="form-label">{t('suppliers.paymentAmount')} ({currency})</label>
                <input className="input" type="number" step="0.01" min="0.01" required
                  value={paymentForm.amount}
                  onChange={e => setPaymentForm({...paymentForm, amount: e.target.value})}
                  placeholder="0.00" />
              </div>
              <div className="form-group">
                <label className="form-label">{t('suppliers.paymentDate')}</label>
                <input className="input" type="date"
                  value={paymentForm.date}
                  onChange={e => setPaymentForm({...paymentForm, date: e.target.value})} />
              </div>
              <div className="form-group">
                <label className="form-label">{t('suppliers.paymentMethod')}</label>
                <select className="input"
                  value={paymentForm.method}
                  onChange={e => setPaymentForm({...paymentForm, method: e.target.value})}>
                  <option value="cash">{t('payments.cash')}</option>
                  <option value="bank">{t('payments.bank')}</option>
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">{t('suppliers.paymentNotes')}</label>
                <textarea className="input" rows={2}
                  value={paymentForm.notes}
                  onChange={e => setPaymentForm({...paymentForm, notes: e.target.value})} />
              </div>
              <div className="form-actions">
                <button type="button" className="btn btn-secondary" onClick={() => setShowPaymentModal(false)}>{t('common.cancel')}</button>
                <button type="submit" className="btn btn-primary">{t('common.save')}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showStatement && statementCustomer && (
        <div className="modal-overlay" onClick={() => setShowStatement(false)}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: '800px' }}>
            <div className="modal-header">
              <h3 className="modal-title">{t('customers.statement')} - {statementCustomer.name}</h3>
            </div>
            {statementData.length === 0 ? (
              <div className="empty-state" style={{ padding: '20px' }}>{t('suppliers.noPayments')}</div>
            ) : (
              <table className="table">
                <thead>
                  <tr>
                    <th>{t('common.date')}</th>
                    <th>{t('common.description')}</th>
                    <th>{t('accounting.debit')}</th>
                    <th>{t('accounting.credit')}</th>
                    <th>{t('customers.statementRunningBalance')}</th>
                  </tr>
                </thead>
                <tbody>
                  {statementData.map((e, idx) => (
                    <tr key={idx} style={{ fontWeight: idx === 0 ? 'bold' : 'normal' }}>
                      <td>{e.date ? new Date(e.date).toLocaleDateString('ar') : '-'}</td>
                      <td>{e.description}</td>
                      <td style={{ color: 'var(--error)' }}>{e.debit > 0 ? `${e.debit} ${currency}` : '-'}</td>
                      <td style={{ color: 'var(--success)' }}>{e.credit > 0 ? `${e.credit} ${currency}` : '-'}</td>
                      <td style={{ fontWeight: 'bold' }}>{e.balance.toFixed(2)} {currency}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
            <div className="form-actions">
              <button type="button" className="btn btn-secondary" onClick={() => setShowStatement(false)}>{t('common.close')}</button>
            </div>
          </div>
        </div>
      )}

      {showPaymentHistory && historyCustomer && (
        <div className="modal-overlay" onClick={() => setShowPaymentHistory(false)}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: '600px' }}>
            <div className="modal-header">
              <h3 className="modal-title">{t('suppliers.paymentHistory')} - {historyCustomer.name}</h3>
            </div>
            {paymentHistory.length === 0 ? (
              <div className="empty-state" style={{ padding: '20px' }}>{t('suppliers.noPayments')}</div>
            ) : (
              <table className="table">
                <thead>
                  <tr>
                    <th>{t('suppliers.paymentDate')}</th>
                    <th>{t('suppliers.paymentAmount')}</th>
                    <th>{t('suppliers.paymentMethod')}</th>
                    <th>{t('suppliers.paymentNotes')}</th>
                  </tr>
                </thead>
                <tbody>
                  {paymentHistory.map(p => (
                    <tr key={p.id}>
                      <td>{p.date ? new Date(p.date).toLocaleDateString('ar') : '-'}</td>
                      <td>{p.amount} {currency}</td>
                      <td>{p.payment_method === 'bank' ? t('payments.bank') : t('payments.cash')}</td>
                      <td>{p.notes || '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
            <div className="form-actions">
              <button type="button" className="btn btn-secondary" onClick={() => setShowPaymentHistory(false)}>{t('common.close')}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}