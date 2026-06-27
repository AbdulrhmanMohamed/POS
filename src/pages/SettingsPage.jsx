import { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { useThemeStore } from '../stores/themeStore';
import { useSettingsStore, CURRENCY_MAP } from '../stores/settingsStore';
import { useToastStore } from '../stores/toastStore';
import LoadingSkeleton from '../components/LoadingSkeleton';

export default function SettingsPage() {
  const { t, i18n } = useTranslation();
  const addToast = useToastStore(s => s.addToast);
  const { theme, setTheme } = useThemeStore();
  const store = useSettingsStore();
  const [form, setForm] = useState({
    language: store.language,
    theme: store.theme,
    currency: store.currency,
    currency_symbol: store.currency_symbol,
    company_name: store.company_name,
    company_logo: store.company_logo || '',
    company_phone: store.company_phone,
    company_address: store.company_address,
    tax_rate: store.tax_rate,
    default_discount: store.default_discount || '0',
    invoice_prefix: store.invoice_prefix,
    barcode_format: store.barcode_format,
    scanner_prefix: store.scanner_prefix,
    scanner_suffix: store.scanner_suffix,
  });
  const [dirty, setDirty] = useState(false);
  const initialLoad = useRef(true);
  const debounceTimer = useRef(null);
  const [users, setUsers] = useState([]);
  const [showUserModal, setShowUserModal] = useState(false);
  const [userForm, setUserForm] = useState({ username: '', password: '', role: 'cashier' });
  const [editingUserId, setEditingUserId] = useState(null);
  const [activeTab, setActiveTab] = useState('company');

  const tabs = [
    { key: 'company', label: t('settings.company') },
    { key: 'financial', label: t('settings.financial') },
    { key: 'system', label: t('settings.system') },
    { key: 'scanner', label: t('settings.scannerSettings') },
    { key: 'users', label: t('users.title') },
  ];

  useEffect(() => {
    if (!store.loaded) store.load();
  }, []);

  useEffect(() => {
    if (store.loaded && initialLoad.current) {
      initialLoad.current = false;
      setForm({
        language: store.language,
        theme: store.theme,
        currency: store.currency,
        currency_symbol: store.currency_symbol,
        company_name: store.company_name,
        company_logo: store.company_logo || '',
        company_phone: store.company_phone,
        company_address: store.company_address,
        tax_rate: store.tax_rate,
        default_discount: store.default_discount || '0',
        invoice_prefix: store.invoice_prefix,
        barcode_format: store.barcode_format,
        scanner_prefix: store.scanner_prefix,
        scanner_suffix: store.scanner_suffix,
      });
    }
  }, [store.loaded]);

  useEffect(() => {
    loadUsers();
  }, []);

  useEffect(() => {
    if (initialLoad.current || !dirty) return;
    if (debounceTimer.current) clearTimeout(debounceTimer.current);
    debounceTimer.current = setTimeout(() => {
      store.save(form);
      setDirty(false);
    }, 1000);
    return () => {
      if (debounceTimer.current) clearTimeout(debounceTimer.current);
    };
  }, [form, dirty]);

  const loadUsers = async () => {
    try {
      const db = window.electronAPI?.db;
      if (!db) return;
      const all = await db.all('SELECT * FROM users ORDER BY username');
      setUsers(all || []);
    } catch (e) {
      console.error('Failed to load users:', e);
    }
  };

  const handleChange = (key, value) => {
    setForm(prev => {
      const patch = { ...prev, [key]: value };
      if (key === 'currency' && CURRENCY_MAP[value]) {
        patch.currency_symbol = CURRENCY_MAP[value].symbol;
      }
      return patch;
    });
    setDirty(true);
  };

  const handleUserSubmit = async () => {
    const db = window.electronAPI?.db;
    if (!db) return;
    try {
      if (editingUserId) {
        await db.run('UPDATE users SET username = ?, role = ? WHERE id = ?',
          [userForm.username, userForm.role, editingUserId]);
        if (userForm.password) {
          await db.run('UPDATE users SET password = ? WHERE id = ?',
            [userForm.password, editingUserId]);
        }
      } else {
        await db.run('INSERT INTO users (username, password, role) VALUES (?,?,?)',
          [userForm.username, userForm.password, userForm.role]);
      }
    } catch (e) {
      console.error('Failed to save user:', e);
    }
    setShowUserModal(false);
    setEditingUserId(null);
    setUserForm({ username: '', password: '', role: 'cashier' });
    loadUsers();
    addToast(t('common.saved'), 'success');
  };

  const handleEditUser = (user) => {
    setEditingUserId(user.id);
    setUserForm({ username: user.username, password: '', role: user.role });
    setShowUserModal(true);
  };

  const handleDeleteUser = async (id) => {
    const db = window.electronAPI?.db;
    if (!db) return;
    try {
      await db.run('DELETE FROM users WHERE id = ?', [id]);
      loadUsers();
    } catch (e) {
      console.error('Failed to delete user:', e);
    }
  };

  const handleSave = async () => {
    const oldLang = store.language;
    await store.setMultiple(form);
    setDirty(false);

    if (form.theme !== store.theme) {
      setTheme(form.theme);
    }
    if (form.language !== oldLang) {
      i18n.changeLanguage(form.language);
      document.documentElement.dir = form.language === 'ar' ? 'rtl' : 'ltr';
    }

    addToast(t('settings.saved'), 'success');
  };

  if (!store.loaded) {
    return (
      <div>
        <div className="page-header">
          <h1 className="page-title">{t('settings.title')}</h1>
        </div>
        <LoadingSkeleton rows={6} cols={2} />
      </div>
    );
  }

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">{t('settings.title')}</h1>
        {dirty && (
          <button className="btn btn-primary" onClick={handleSave}>
            {t('settings.save')}
          </button>
        )}
      </div>

      <div className="settings-container">
        <div style={{ display: 'flex', gap: '4px', marginBottom: '24px', borderBottom: '2px solid var(--border)', overflowX: 'auto' }}>
        {tabs.map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            style={{
              padding: '10px 20px',
              border: 'none',
              background: activeTab === tab.key ? 'var(--accent)' : 'transparent',
              color: activeTab === tab.key ? '#fff' : 'var(--text)',
              cursor: 'pointer',
              borderRadius: '8px 8px 0 0',
              fontWeight: activeTab === tab.key ? 600 : 400,
              whiteSpace: 'nowrap',
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === 'company' && (
        <div className="card">
          <div className="form-group">
            <label className="form-label">{t('settings.companyName')}</label>
            <input className="input" value={form.company_name} onChange={e => handleChange('company_name', e.target.value)} />
          </div>
          <div className="form-group">
            <label className="form-label">{t('settings.companyLogo')}</label>
            {form.company_logo && (
              <div style={{ marginBottom: '8px' }}>
                <img src={form.company_logo} alt="Logo" style={{ maxWidth: '150px', maxHeight: '80px', borderRadius: '4px' }} />
              </div>
            )}
            <input type="file" accept="image/*" onChange={(e) => {
              const file = e.target.files[0];
              if (!file) return;
              if (file.size > 500 * 1024) {
                addToast(t('settings.logoTooLarge'), 'error');
                return;
              }
              const reader = new FileReader();
              reader.onload = (ev) => {
                handleChange('company_logo', ev.target.result);
              };
              reader.readAsDataURL(file);
            }} />
          </div>
          <div className="form-group">
            <label className="form-label">{t('settings.companyPhone')}</label>
            <input className="input" value={form.company_phone} onChange={e => handleChange('company_phone', e.target.value)} />
          </div>
          <div className="form-group">
            <label className="form-label">{t('settings.companyAddress')}</label>
            <textarea className="input" rows={3} value={form.company_address} onChange={e => handleChange('company_address', e.target.value)} />
          </div>
        </div>
      )}

      {activeTab === 'financial' && (
        <div className="card">
          <div className="form-group">
            <label className="form-label">{t('settings.currency')}</label>
            <select className="input" value={form.currency} onChange={e => handleChange('currency', e.target.value)}>
              {Object.entries(CURRENCY_MAP).map(([code, info]) => (
                <option key={code} value={code}>{info.label}</option>
              ))}
            </select>
            <div style={{ fontSize: '13px', color: 'var(--text-secondary)', marginTop: '4px' }}>
              {t('settings.symbol')}: <strong>{form.currency_symbol}</strong>
            </div>
          </div>
          <div className="form-group">
            <label className="form-label">{t('settings.invoicePrefix')}</label>
            <input className="input" value={form.invoice_prefix} onChange={e => handleChange('invoice_prefix', e.target.value)} />
          </div>
          <div className="form-group">
            <label className="form-label">{t('settings.barcodeFormat')}</label>
            <select className="input" value={form.barcode_format} onChange={e => handleChange('barcode_format', e.target.value)}>
              <option value="numeric12">{t('settings.numeric12')}</option>
              <option value="ean13">{t('settings.ean13')}</option>
              <option value="upca">{t('settings.upca')}</option>
              <option value="code128">{t('settings.code128')}</option>
              <option value="pos">{t('settings.posFormat')}</option>
            </select>
          </div>
        </div>
      )}

      {activeTab === 'system' && (
        <div className="card">
          <div className="form-group">
            <label className="form-label">{t('settings.language')}</label>
            <div className="toggle-group">
              <button className={`toggle-btn ${form.language === 'ar' ? 'active' : ''}`} onClick={() => handleChange('language', 'ar')}>العربية</button>
              <button className={`toggle-btn ${form.language === 'en' ? 'active' : ''}`} onClick={() => handleChange('language', 'en')}>English</button>
            </div>
          </div>
          <div className="form-group">
            <label className="form-label">{t('settings.theme')}</label>
            <div className="toggle-group">
              <button className={`toggle-btn ${form.theme === 'light' ? 'active' : ''}`} onClick={() => handleChange('theme', 'light')}>☀️ {t('settings.light')}</button>
              <button className={`toggle-btn ${form.theme === 'dark' ? 'active' : ''}`} onClick={() => handleChange('theme', 'dark')}>🌙 {t('settings.dark')}</button>
            </div>
          </div>
          <div className="form-group">
            <label className="form-label">{t('settings.taxRate')} (%)</label>
            <input className="input" type="number" step="0.01" min="0" max="100" value={form.tax_rate} onChange={e => handleChange('tax_rate', e.target.value)} />
          </div>
          <div className="form-group">
            <label className="form-label">{t('settings.defaultDiscount')} (%)</label>
            <input className="input" type="number" step="0.01" min="0" max="100" value={form.default_discount} onChange={e => handleChange('default_discount', e.target.value)} />
          </div>
        </div>
      )}

      {activeTab === 'scanner' && (
        <div className="card">
          <div className="form-group">
            <label className="form-label">{t('settings.scannerPrefix')}</label>
            <input className="input" value={form.scanner_prefix} onChange={e => handleChange('scanner_prefix', e.target.value)} placeholder="e.g. %" />
          </div>
          <div className="form-group">
            <label className="form-label">{t('settings.scannerSuffix')}</label>
            <input className="input" value={form.scanner_suffix} onChange={e => handleChange('scanner_suffix', e.target.value)} placeholder="e.g. $ or Enter" />
          </div>
        </div>
      )}

      {activeTab === 'users' && (
        <div className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <h3 className="card-title" style={{ margin: 0 }}>{t('users.title')}</h3>
            <button className="btn btn-primary" onClick={() => { setEditingUserId(null); setUserForm({ username: '', password: '', role: 'cashier' }); setShowUserModal(true); }}>
              + {t('users.addUser')}
            </button>
          </div>
          {users.length === 0 ? (
            <div className="empty-state">{t('users.noUsers')}</div>
          ) : (
            <table className="table">
              <thead>
                <tr>
                  <th>{t('users.username')}</th>
                  <th>{t('users.role')}</th>
                  <th>{t('common.actions')}</th>
                </tr>
              </thead>
              <tbody>
                {users.map(u => (
                  <tr key={u.id}>
                    <td>{u.username}</td>
                    <td>{u.role === 'admin' ? t('users.admin') : t('users.cashier')}</td>
                    <td>
                      <button className="btn btn-secondary" onClick={() => handleEditUser(u)}>{t('common.edit')}</button>
                      <button className="btn btn-danger" onClick={() => handleDeleteUser(u.id)} style={{ marginRight: '8px' }}>{t('common.delete')}</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      </div>

      {showUserModal && (
        <div className="modal-overlay" onClick={() => setShowUserModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="modal-title">{editingUserId ? t('users.editUser') : t('users.addUser')}</h3>
              <button onClick={() => setShowUserModal(false)}>×</button>
            </div>
            <div className="form-group">
              <label className="form-label">{t('users.username')}</label>
              <input className="input" value={userForm.username} onChange={e => setUserForm({...userForm, username: e.target.value})} required />
            </div>
            <div className="form-group">
              <label className="form-label">{t('users.password')}</label>
              <input className="input" type="password" value={userForm.password} onChange={e => setUserForm({...userForm, password: e.target.value})} required={!editingUserId} />
            </div>
            <div className="form-group">
              <label className="form-label">{t('users.role')}</label>
              <select className="input" value={userForm.role} onChange={e => setUserForm({...userForm, role: e.target.value})}>
                <option value="admin">{t('users.admin')}</option>
                <option value="cashier">{t('users.cashier')}</option>
              </select>
            </div>
            <div className="form-actions">
              <button className="btn btn-secondary" onClick={() => setShowUserModal(false)}>{t('common.cancel')}</button>
              <button className="btn btn-primary" onClick={handleUserSubmit}>{t('common.save')}</button>
            </div>
          </div>
        </div>
      )}

      {dirty && (
        <div style={{ textAlign: 'center', marginTop: '24px' }}>
          <button className="btn btn-primary" onClick={handleSave} style={{ minWidth: '200px' }}>
            {t('settings.save')}
          </button>
        </div>
      )}
    </div>
  );
}