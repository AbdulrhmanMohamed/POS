import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { ExpenseRepository, SettingsRepository } from '../database';
import { useToastStore } from '../stores/toastStore';
import { useConfirmStore } from '../stores/confirmStore';
import Pagination from '../components/Pagination';
import LoadingSkeleton from '../components/LoadingSkeleton';

const expenseRepo = ExpenseRepository;
const settingsRepo = SettingsRepository;
const PAGE_SIZE = 10;

export default function ExpensesPage() {
  const { t } = useTranslation();
  const addToast = useToastStore(s => s.addToast);
  const confirm = useConfirmStore(s => s.confirm);
  const [expenses, setExpenses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState({ category: '', amount: '', description: '', date: new Date().toISOString().slice(0,10) });
  const [currency, setCurrency] = useState('ر.س');
  const [categoryTotal, setCategoryTotal] = useState({});
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    const settings = await settingsRepo.getAll();
    setCurrency(settings.currency_symbol || 'ر.س');
    const all = await expenseRepo.findAll();
    setExpenses(all || []);
    
    const totals = {};
    (all || []).forEach(e => {
      totals[e.category] = (totals[e.category] || 0) + parseFloat(e.amount);
    });
    setCategoryTotal(totals);
  };

  const loadFiltered = async () => {
    const settings = await settingsRepo.getAll();
    setCurrency(settings.currency_symbol || 'ر.س');
    const all = dateFrom && dateTo
      ? await expenseRepo.findByDateRange(dateFrom, dateTo)
      : await expenseRepo.findAll();
    setExpenses(all || []);
    
    const totals = {};
    (all || []).forEach(e => {
      totals[e.category] = (totals[e.category] || 0) + parseFloat(e.amount);
    });
    setCategoryTotal(totals);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const data = {
      category: form.category,
      amount: parseFloat(form.amount),
      description: form.description || null,
      date: form.date
    };

    if (parseFloat(data.amount) <= 0) {
      addToast(t('expenses.amountMustBePositive'), 'error');
      return;
    }

    if (!form.category) {
      addToast(t('expenses.categoryRequired'), 'error');
      return;
    }

    if (editingId) {
      const db = window.electronAPI?.db;
      await db.run(
        'UPDATE expenses SET category = ?, amount = ?, description = ?, date = ? WHERE id = ?',
        [data.category, data.amount, data.description, data.date, editingId]
      );
    } else {
      await expenseRepo.create(data);
    }

    setShowModal(false);
    setEditingId(null);
    setForm({ category: '', amount: '', description: '', date: new Date().toISOString().slice(0,10) });
    loadData();
  };

  const handleEdit = (expense) => {
    setEditingId(expense.id);
    setForm({
      category: expense.category,
      amount: String(expense.amount),
      description: expense.description || '',
      date: expense.date ? expense.date.slice(0,10) : new Date().toISOString().slice(0,10)
    });
    setShowModal(true);
  };

  const handleDelete = async (id) => {
    if (!confirm(t('common.confirmDelete'))) return;
    const db = window.electronAPI?.db;
    await db.run('DELETE FROM expenses WHERE id = ?', [id]);
    loadData();
  };

  const categories = ['إيجار', 'كهرباء', 'مياه', 'إنترنت', 'صيانة', 'أخرى'];
  const categoryLabels = { 'إيجار': 'Rent', 'كهرباء': 'Electricity', 'مياه': 'Water', 'إنترنت': 'Internet', 'صيانة': 'Maintenance', 'أخرى': 'Other' };

  const totalExpenses = expenses.reduce((sum, e) => sum + parseFloat(e.amount), 0);

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">{t('expenses.title')}</h1>
        <button className="btn btn-primary" onClick={() => { setEditingId(null); setForm({ category: '', amount: '', description: '', date: new Date().toISOString().slice(0,10) }); setShowModal(true); }}>
          + {t('expenses.addExpense')}
        </button>
      </div>

      <div className="stats-grid" style={{ marginBottom: '20px' }}>
        {categories.map(cat => (
          <div key={cat} className="stat-card">
            <div className="stat-label">{categoryLabels[cat]}</div>
            <div className="stat-value">{(categoryTotal[cat] || 0).toFixed(2)} {currency}</div>
          </div>
        ))}
        <div className="stat-card" style={{ background: 'var(--error)', color: 'white' }}>
          <div className="stat-label">{t('expenses.total')}</div>
          <div className="stat-value">{totalExpenses.toFixed(2)} {currency}</div>
        </div>
      </div>

      <div className="card" style={{ marginBottom: '16px' }}>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'end', flexWrap: 'wrap' }}>
          <div className="form-group" style={{ margin: 0 }}>
            <label className="form-label">{t('reports.fromDate')}</label>
            <input className="input" type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} />
          </div>
          <div className="form-group" style={{ margin: 0 }}>
            <label className="form-label">{t('reports.toDate')}</label>
            <input className="input" type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} />
          </div>
          <button className="btn btn-primary" onClick={loadFiltered}>{t('reports.generate')}</button>
          <button className="btn btn-secondary" onClick={() => { setDateFrom(''); setDateTo(''); loadData(); }}>{t('common.reset')}</button>
        </div>
      </div>

      <div className="card">
        {expenses.length === 0 ? (
          <div className="empty-state">{t('expenses.noExpenses')}</div>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>{t('expenses.category')}</th>
                <th>{t('common.amount')}</th>
                <th>{t('common.description')}</th>
                <th>{t('common.date')}</th>
                <th>{t('common.actions')}</th>
              </tr>
            </thead>
            <tbody>
              {expenses.map(e => (
                <tr key={e.id}>
                  <td style={{ fontWeight: 'bold' }}>{categoryLabels[e.category] || e.category}</td>
                  <td style={{ color: 'var(--error)', fontWeight: 'bold' }}>{parseFloat(e.amount).toFixed(2)}</td>
                  <td>{e.description || '-'}</td>
                  <td>{new Date(e.date).toLocaleDateString('ar')}</td>
                  <td>
                    <button className="btn btn-secondary" onClick={() => handleEdit(e)}>{t('common.edit')}</button>
                    <button className="btn btn-danger" onClick={() => handleDelete(e.id)} style={{ marginRight: '8px' }}>{t('common.delete')}</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="modal-title">{editingId ? t('common.edit') : t('expenses.addExpense')}</h3>
            </div>
            <form onSubmit={handleSubmit}>
              <div className="form-group">
                <label className="form-label">{t('expenses.category')} *</label>
                <select className="input" value={form.category} onChange={e => setForm({...form, category: e.target.value})} required>
                  <option value="">Select category</option>
                  {categories.map(cat => (
                    <option key={cat} value={cat}>{categoryLabels[cat]}</option>
                  ))}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">{t('common.amount')} *</label>
                <input className="input" type="number" step="0.01" value={form.amount} onChange={e => setForm({...form, amount: e.target.value})} required />
              </div>
              <div className="form-group">
                <label className="form-label">{t('common.description')}</label>
                <input className="input" value={form.description} onChange={e => setForm({...form, description: e.target.value})} />
              </div>
              <div className="form-group">
                <label className="form-label">{t('common.date')} *</label>
                <input className="input" type="date" value={form.date} onChange={e => setForm({...form, date: e.target.value})} required />
              </div>
              <div className="form-actions">
                <button type="button" className="btn btn-secondary" onClick={() => setShowModal(false)}>{t('common.cancel')}</button>
                <button type="submit" className="btn btn-primary">{t('common.save')}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}