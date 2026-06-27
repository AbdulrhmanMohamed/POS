import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { AccountRepository, SettingsRepository } from '../database';

const accountRepo = AccountRepository;
const settingsRepo = SettingsRepository;

const INITIAL_FORM = { code: '', name: '', type: 'asset', is_active: 1, openingDebit: '', openingCredit: '' };

const ACCOUNT_TYPES = ['asset', 'liability', 'equity', 'revenue', 'expense'];

export default function ChartOfAccountsPage() {
  const { t } = useTranslation();
  const [accounts, setAccounts] = useState([]);
  const [balances, setBalances] = useState({});
  const [currency, setCurrency] = useState('ر.س');
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(INITIAL_FORM);
  const [formError, setFormError] = useState('');
  const [saving, setSaving] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const settings = await settingsRepo.getAll();
      setCurrency(settings.currency_symbol || 'ر.س');
      const allAccounts = await accountRepo.findAll();
      setAccounts(allAccounts || []);

      const balancesObj = {};
      for (const acc of allAccounts || []) {
        const bal = await accountRepo.getBalance(acc.id);
        balancesObj[acc.id] = bal;
      }
      setBalances(balancesObj);
    } catch (err) {
      console.error('ChartOfAccounts loadData error:', err);
    } finally {
      setLoading(false);
    }
  };

  const getTypeLabel = (type) => {
    switch (type) {
      case 'asset': return t('accounting.asset');
      case 'liability': return t('accounting.liability');
      case 'equity': return t('accounting.equity');
      case 'revenue': return t('accounting.revenue');
      case 'expense': return t('accounting.expense');
      default: return type;
    }
  };

  const getTypeColor = (type) => {
    switch (type) {
      case 'asset': return '#2563eb';
      case 'liability': return '#dc2626';
      case 'equity': return '#7c3aed';
      case 'revenue': return '#16a34a';
      case 'expense': return '#ea580c';
      default: return '#666';
    }
  };

  const groupedAccounts = accounts.reduce((acc, account) => {
    if (!acc[account.type]) acc[account.type] = [];
    acc[account.type].push(account);
    return acc;
  }, {});

  const handleAdd = () => {
    setEditingId(null);
    setForm(INITIAL_FORM);
    setFormError('');
    setShowModal(true);
  };

  const handleEdit = (account) => {
    setEditingId(account.id);
    setForm({ code: account.code, name: account.name, type: account.type, is_active: account.is_active, openingDebit: '', openingCredit: '' });
    setFormError('');
    setShowModal(true);
  };

  const handleDelete = async (account) => {
    const bal = balances[account.id];
    if (bal && (bal.debit > 0 || bal.credit > 0)) {
      alert(t('accounting.cannotDeleteWithTransactions'));
      return;
    }
    setDeleteConfirm(account);
  };

  const confirmDelete = async () => {
    if (!deleteConfirm) return;
    try {
      await accountRepo.delete(deleteConfirm.id);
      setDeleteConfirm(null);
      await loadData();
    } catch (err) {
      alert(err.message || t('accounting.cannotDeleteWithTransactions'));
      setDeleteConfirm(null);
    }
  };

  const handleSave = async () => {
    if (!form.code.trim()) {
      setFormError(t('accounting.accountCodeRequired'));
      return;
    }
    if (!form.name.trim()) {
      setFormError(t('accounting.accountNameRequired'));
      return;
    }

    try {
      setSaving(true);
      setFormError('');

      if (editingId) {
        const { openingDebit, openingCredit, ...updateData } = form;
        await accountRepo.update(editingId, updateData);
      } else {
        const existing = await accountRepo.findByCode(form.code.trim());
        if (existing) {
          setFormError(t('accounting.codeAlreadyExists'));
          setSaving(false);
          return;
        }

        const { openingDebit, openingCredit, ...accountData } = form;
        const newAccount = await accountRepo.create(accountData);

        const debit = parseFloat(openingDebit) || 0;
        const credit = parseFloat(openingCredit) || 0;

        if (debit > 0 || credit > 0) {
          const retained = await accountRepo.findByCode('3120');
          if (!retained) {
            setFormError(t('accounting.codeAlreadyExists') + ' (ربح محتجز)');
            setSaving(false);
            return;
          }

          const today = new Date().toISOString().slice(0, 10);
          const entryNum = `OP-${today.replace(/-/g, '')}-${Date.now()}`;
          const total = debit || credit;

          await accountRepo.run(
            'INSERT INTO journal_entries (entry_number, date, description, total_debit, total_credit, status) VALUES (?, ?, ?, ?, ?, ?)',
            [entryNum, today, t('accounting.openingBalanceDescription'), total, total, 'posted']
          );

          const entry = await accountRepo.get(
            'SELECT id FROM journal_entries WHERE entry_number = ?', [entryNum]
          );

          if (entry) {
            if (debit > 0) {
              await accountRepo.run(
                'INSERT INTO journal_items (entry_id, account_id, debit, credit, description) VALUES (?, ?, ?, ?, ?)',
                [entry.id, newAccount.id, debit, 0, t('accounting.openingBalanceDescription')]
              );
              await accountRepo.run(
                'INSERT INTO journal_items (entry_id, account_id, debit, credit, description) VALUES (?, ?, ?, ?, ?)',
                [entry.id, retained.id, 0, debit, t('accounting.openingBalanceDescription')]
              );
            } else {
              await accountRepo.run(
                'INSERT INTO journal_items (entry_id, account_id, debit, credit, description) VALUES (?, ?, ?, ?, ?)',
                [entry.id, retained.id, credit, 0, t('accounting.openingBalanceDescription')]
              );
              await accountRepo.run(
                'INSERT INTO journal_items (entry_id, account_id, debit, credit, description) VALUES (?, ?, ?, ?, ?)',
                [entry.id, newAccount.id, 0, credit, t('accounting.openingBalanceDescription')]
              );
            }
          }
        }
      }

      setShowModal(false);
      await loadData();
    } catch (err) {
      setFormError(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">{t('accounting.chartOfAccounts')}</h1>
        <button className="btn btn-primary" onClick={handleAdd}>
          {t('accounting.addAccount')}
        </button>
      </div>

      {loading ? (
        <div className="empty-state">{t('common.loading') || 'Loading...'}</div>
      ) : accounts.length === 0 ? (
        <div className="empty-state">{t('accounting.noEntries')}</div>
      ) : Object.entries(groupedAccounts).map(([type, typeAccounts]) => (
        <div key={type} className="card" style={{ marginBottom: '20px' }}>
          <h3 style={{ color: getTypeColor(type), marginBottom: '16px' }}>
            {getTypeLabel(type)} ({typeAccounts.length})
          </h3>
          <table className="table">
            <thead>
              <tr>
                <th>{t('accounting.accountCode')}</th>
                <th>{t('accounting.accountName')}</th>
                <th>{t('accounting.debit')}</th>
                <th>{t('accounting.credit')}</th>
                <th>{t('accounting.balance')}</th>
                <th>{t('common.actions')}</th>
              </tr>
            </thead>
            <tbody>
              {typeAccounts.map(acc => {
                const bal = balances[acc.id] || { debit: 0, credit: 0, balance: 0 };
                return (
                  <tr key={acc.id}>
                    <td style={{ fontFamily: 'monospace', fontWeight: 'bold' }}>{acc.code}</td>
                    <td>{acc.name}</td>
                    <td>{bal.debit?.toFixed(2) || 0}</td>
                    <td>{bal.credit?.toFixed(2) || 0}</td>
                    <td style={{
                      fontWeight: 'bold',
                      color: (type === 'asset' || type === 'expense')
                        ? (bal.balance >= 0 ? 'var(--error)' : 'var(--success)')
                        : (bal.balance >= 0 ? 'var(--success)' : 'var(--error)')
                    }}>
                      {bal.balance?.toFixed(2) || 0}
                    </td>
                    <td>
                      <div className="btn-group">
                        <button className="btn btn-sm btn-secondary" onClick={() => handleEdit(acc)}>
                          {t('common.edit')}
                        </button>
                        <button className="btn btn-sm btn-danger" onClick={() => handleDelete(acc)}>
                          {t('common.delete')}
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ))}

      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2 className="modal-title">{editingId ? t('accounting.editAccount') : t('accounting.addAccount')}</h2>
              <button className="btn btn-sm btn-secondary" onClick={() => setShowModal(false)}>
                {t('common.close') || 'X'}
              </button>
            </div>

            <div style={{ padding: '20px' }}>
              {formError && (
                <div className="badge badge-error" style={{ marginBottom: '16px', padding: '8px', width: '100%' }}>
                  {formError}
                </div>
              )}

              <div className="form-group">
                <label className="form-label">{t('accounting.accountCode')}</label>
                <input
                  className="input"
                  value={form.code}
                  onChange={e => setForm({ ...form, code: e.target.value })}
                  placeholder="1110"
                  dir="ltr"
                />
              </div>

              <div className="form-group">
                <label className="form-label">{t('accounting.accountName')}</label>
                <input
                  className="input"
                  value={form.name}
                  onChange={e => setForm({ ...form, name: e.target.value })}
                />
              </div>

              <div className="form-group">
                <label className="form-label">{t('accounting.accountType')}</label>
                <select className="input" value={form.type} onChange={e => setForm({ ...form, type: e.target.value })}>
                  {ACCOUNT_TYPES.map(type => (
                    <option key={type} value={type}>{getTypeLabel(type)}</option>
                  ))}
                </select>
              </div>

              <div className="form-group" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <input
                  type="checkbox"
                  id="isActive"
                  checked={form.is_active === 1}
                  onChange={e => setForm({ ...form, is_active: e.target.checked ? 1 : 0 })}
                />
                <label htmlFor="isActive" style={{ margin: 0 }}>
                  {form.is_active ? t('accounting.active') : t('accounting.inactive')}
                </label>
              </div>

              {!editingId && (
                <>
                  <h4 style={{ margin: '16px 0 8px', borderTop: '1px solid var(--border)', paddingTop: '16px' }}>
                    {t('accounting.openingBalance')}
                  </h4>
                  <div style={{ display: 'flex', gap: '12px' }}>
                    <div className="form-group" style={{ flex: 1 }}>
                      <label className="form-label">{t('accounting.openingDebit')}</label>
                      <input
                        className="input"
                        type="number"
                        step="0.01"
                        min="0"
                        value={form.openingDebit}
                        onChange={e => setForm({ ...form, openingDebit: e.target.value, openingCredit: '' })}
                        placeholder="0.00"
                        dir="ltr"
                      />
                    </div>
                    <div className="form-group" style={{ flex: 1 }}>
                      <label className="form-label">{t('accounting.openingCredit')}</label>
                      <input
                        className="input"
                        type="number"
                        step="0.01"
                        min="0"
                        value={form.openingCredit}
                        onChange={e => setForm({ ...form, openingCredit: e.target.value, openingDebit: '' })}
                        placeholder="0.00"
                        dir="ltr"
                      />
                    </div>
                  </div>
                </>
              )}

              <div className="form-actions">
                <button className="btn btn-secondary" onClick={() => setShowModal(false)}>
                  {t('common.cancel')}
                </button>
                <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
                  {saving ? t('common.saving') || '...' : t('common.save')}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {deleteConfirm && (
        <div className="modal-overlay" onClick={() => setDeleteConfirm(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2 className="modal-title">{t('accounting.deleteAccount')}</h2>
            </div>
            <div style={{ padding: '20px' }}>
              <p>{t('accounting.confirmDeleteAccount')}</p>
              <p style={{ fontWeight: 'bold', marginTop: '8px' }}>
                {deleteConfirm.code} - {deleteConfirm.name}
              </p>
              <div className="form-actions">
                <button className="btn btn-secondary" onClick={() => setDeleteConfirm(null)}>
                  {t('common.cancel')}
                </button>
                <button className="btn btn-danger" onClick={confirmDelete}>
                  {t('common.delete')}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
