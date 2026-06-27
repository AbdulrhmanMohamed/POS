import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { WorkerRepository, SettingsRepository } from '../database';
import { useToastStore } from '../stores/toastStore';
import { useConfirmStore } from '../stores/confirmStore';
import Pagination from '../components/Pagination';
import LoadingSkeleton from '../components/LoadingSkeleton';

const workerRepo = WorkerRepository;
const settingsRepo = SettingsRepository;
const PAGE_SIZE = 10;

export default function WorkersPage() {
  const { t } = useTranslation();
  const addToast = useToastStore(s => s.addToast);
  const confirm = useConfirmStore(s => s.confirm);
  const [workers, setWorkers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [showPayModal, setShowPayModal] = useState(false);
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [selectedWorker, setSelectedWorker] = useState(null);
  const [payments, setPayments] = useState([]);
  const [form, setForm] = useState({ name: '', phone: '', salary: '', position: '' });
  const [payForm, setPayForm] = useState({ amount: '', month: new Date().toISOString().slice(0,7), notes: '' });
  const [currency, setCurrency] = useState('ر.س');

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    const settings = await settingsRepo.getAll();
    setCurrency(settings.currency_symbol || 'ر.س');
    const all = await workerRepo.findAll();
    setWorkers(all || []);
    setLoading(false);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const data = {
      name: form.name,
      phone: form.phone || null,
      salary: parseFloat(form.salary),
      position: form.position || null
    };

    try {
      if (editingId) {
        await workerRepo.update(editingId, data);
      } else {
        await workerRepo.create(data);
      }
      addToast(t('common.saved'), 'success');
      setShowModal(false);
      setEditingId(null);
      setForm({ name: '', phone: '', salary: '', position: '' });
      loadData();
    } catch (err) {
      addToast(err.message, 'error');
    }
  };

  const handleEdit = (worker) => {
    setEditingId(worker.id);
    setForm({
      name: worker.name,
      phone: worker.phone || '',
      salary: String(worker.salary),
      position: worker.position || ''
    });
    setShowModal(true);
  };

  const handleDelete = async (id) => {
    const ok = await confirm(t('common.confirmDelete'));
    if (!ok) return;
    try {
      await workerRepo.delete(id);
      addToast(t('common.deleted'), 'success');
      loadData();
    } catch (err) {
      addToast(err.message, 'error');
    }
  };

  const handlePay = async (e) => {
    e.preventDefault();
    const db = window.electronAPI?.db;
    const existing = await db.get(
      'SELECT id FROM worker_payments WHERE worker_id = ? AND month = ?',
      [selectedWorker.id, payForm.month]
    );
    if (existing) {
      addToast(t('workers.duplicateSalary'), 'error');
      return;
    }
    try {
      await workerRepo.addPayment({
        worker_id: selectedWorker.id,
        amount: parseFloat(payForm.amount),
        month: payForm.month,
        notes: payForm.notes || null
      });
      addToast(t('common.saved'), 'success');
      setShowPayModal(false);
      setPayForm({ amount: '', month: new Date().toISOString().slice(0,7), notes: '' });
    } catch (err) {
      addToast(err.message, 'error');
    }
  };

  const openPayModal = (worker) => {
    setSelectedWorker(worker);
    setPayForm({ amount: worker.salary, month: new Date().toISOString().slice(0,7), notes: '' });
    setShowPayModal(true);
  };

  const openHistory = async (worker) => {
    setSelectedWorker(worker);
    const history = await workerRepo.getPayments(worker.id);
    setPayments(history || []);
    setShowHistoryModal(true);
  };

  const totalSalaries = workers.reduce((sum, w) => sum + parseFloat(w.salary || 0), 0);

  const q = search.toLowerCase();
  const filteredWorkers = workers.filter(w => !q || w.name.toLowerCase().includes(q) || (w.phone && w.phone.includes(q)));
  const totalPages = Math.ceil(filteredWorkers.length / PAGE_SIZE);
  const paged = filteredWorkers.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">{t('workers.title')}</h1>
        <button className="btn btn-primary" onClick={() => { setEditingId(null); setForm({ name: '', phone: '', salary: '', position: '' }); setShowModal(true); }}>
          + {t('workers.addWorker')}
        </button>
      </div>

      <div className="stats-grid" style={{ marginBottom: '20px' }}>
        <div className="stat-card">
          <div className="stat-label">{t('workers.count')}</div>
          <div className="stat-value">{workers.length}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">{t('workers.totalSalaries')}</div>
          <div className="stat-value">{totalSalaries.toFixed(2)} {currency}</div>
        </div>
      </div>

      <div className="card">
        <div className="card-header">
          <input className="input input-sm" style={{ maxWidth: '280px' }}
            placeholder={`${t('common.search')}...`}
            value={search} onChange={e => { setSearch(e.target.value); setPage(1); }}
          />
        </div>
        {loading ? (
          <LoadingSkeleton rows={5} cols={4} />
        ) : paged.length === 0 ? (
          <div className="empty-state">{t(search ? 'common.noResults' : 'workers.noWorkers')}</div>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>{t('workers.name')}</th>
                <th>{t('workers.phone')}</th>
                <th>{t('workers.position')}</th>
                <th>{t('workers.salary')}</th>
                <th>{t('common.actions')}</th>
              </tr>
            </thead>
            <tbody>
              {paged.map(w => (
                <tr key={w.id}>
                  <td style={{ fontWeight: 'bold' }}>{w.name}</td>
                  <td>{w.phone || '-'}</td>
                  <td>{w.position || '-'}</td>
                  <td style={{ color: 'var(--accent)', fontWeight: 'bold' }}>{parseFloat(w.salary).toFixed(2)} {currency}</td>
                  <td>
                    <button className="btn btn-secondary" onClick={() => handleEdit(w)}>{t('common.edit')}</button>
                    <button className="btn btn-primary" onClick={() => openPayModal(w)} style={{ marginRight: '8px' }}>{t('workers.paySalary')}</button>
                    <button className="btn btn-secondary" onClick={() => openHistory(w)} style={{ marginRight: '8px' }}>{t('workers.paymentHistory')}</button>
                    <button className="btn btn-danger" onClick={() => handleDelete(w.id)} style={{ marginRight: '8px' }}>{t('common.delete')}</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        <Pagination page={page} totalPages={totalPages} onChange={setPage} />
      </div>

      {/* Add/Edit Worker Modal */}
      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="modal-title">{editingId ? t('common.edit') : t('workers.addWorker')}</h3>
            </div>
            <form onSubmit={handleSubmit}>
              <div className="form-group">
                <label className="form-label">{t('workers.name')} *</label>
                <input className="input" value={form.name} onChange={e => setForm({...form, name: e.target.value})} required />
              </div>
              <div className="form-group">
                <label className="form-label">{t('workers.phone')}</label>
                <input className="input" value={form.phone} onChange={e => setForm({...form, phone: e.target.value})} />
              </div>
              <div className="form-group">
                <label className="form-label">{t('workers.position')}</label>
                <input className="input" value={form.position} onChange={e => setForm({...form, position: e.target.value})} />
              </div>
              <div className="form-group">
                <label className="form-label">{t('workers.salary')} *</label>
                <input className="input" type="number" step="0.01" value={form.salary} onChange={e => setForm({...form, salary: e.target.value})} required />
              </div>
              <div className="form-actions">
                <button type="button" className="btn btn-secondary" onClick={() => setShowModal(false)}>{t('common.cancel')}</button>
                <button type="submit" className="btn btn-primary">{t('common.save')}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Pay Salary Modal */}
      {showPayModal && selectedWorker && (
        <div className="modal-overlay" onClick={() => setShowPayModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="modal-title">{t('workers.paySalary')} - {selectedWorker.name}</h3>
            </div>
            <form onSubmit={handlePay}>
              <div className="form-group">
                <label className="form-label">{t('common.amount')}</label>
                <input className="input" type="number" step="0.01" value={payForm.amount} onChange={e => setPayForm({...payForm, amount: e.target.value})} required />
              </div>
              <div className="form-group">
                <label className="form-label">{t('workers.month')}</label>
                <input className="input" type="month" value={payForm.month} onChange={e => setPayForm({...payForm, month: e.target.value})} required />
              </div>
              <div className="form-group">
                <label className="form-label">{t('common.notes')}</label>
                <input className="input" value={payForm.notes} onChange={e => setPayForm({...payForm, notes: e.target.value})} />
              </div>
              <div className="form-actions">
                <button type="button" className="btn btn-secondary" onClick={() => setShowPayModal(false)}>{t('common.cancel')}</button>
                <button type="submit" className="btn btn-primary">{t('common.save')}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Payment History Modal */}
      {showHistoryModal && selectedWorker && (
        <div className="modal-overlay" onClick={() => setShowHistoryModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: '600px' }}>
            <div className="modal-header">
              <h3 className="modal-title">{t('workers.paymentHistory')} - {selectedWorker.name}</h3>
            </div>
            {payments.length === 0 ? (
              <div className="empty-state">{t('workers.noPayments')}</div>
            ) : (
              <table className="table">
                <thead>
                  <tr>
                    <th>{t('common.amount')}</th>
                    <th>{t('workers.month')}</th>
                    <th>{t('common.notes')}</th>
                    <th>{t('common.date')}</th>
                  </tr>
                </thead>
                <tbody>
                  {payments.map(p => (
                    <tr key={p.id}>
                      <td style={{ color: 'var(--accent)', fontWeight: 'bold' }}>{parseFloat(p.amount).toFixed(2)} {currency}</td>
                      <td>{p.month}</td>
                      <td>{p.notes || '-'}</td>
                      <td>{new Date(p.created_at).toLocaleDateString('ar')}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
            <div className="form-actions">
              <button type="button" className="btn btn-secondary" onClick={() => setShowHistoryModal(false)}>{t('common.close')}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
