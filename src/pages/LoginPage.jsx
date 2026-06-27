import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuthStore } from '../stores/authStore';
import { useSettingsStore } from '../stores/settingsStore';

export default function LoginPage({ onLogin }) {
  const { t } = useTranslation();
  const login = useAuthStore(s => s.login);
  const store = useSettingsStore();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    if (!store.loaded) store.load();
  }, []);

  const companyName = store.company_name || t('app.title');
  const companyLogo = store.company_logo || '';

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    try {
      const db = window.electronAPI?.db;
      if (!db) return;
      const user = await db.get('SELECT * FROM users WHERE username = ? AND password = ?', [username, password]);
      if (user) {
        login(user);
        if (onLogin) onLogin(user);
      } else {
        setError(t('auth.invalidCredentials'));
      }
    } catch (err) {
      setError(t('auth.error'));
    }
  };

  return (
    <div className="splash-screen">
      <div className="splash-left">
        <div className="splash-brand">
          {companyLogo ? (
            <img src={companyLogo} alt={companyName} className="splash-logo" />
          ) : (
            <div className="splash-logo-placeholder">
              <svg width="100" height="100" viewBox="0 0 512 512" fill="none">
                <rect width="512" height="512" rx="96" fill="white" opacity="0.2"/>
                <path d="M140 200h232l-24 200H164l-24-200z" fill="white" stroke="white" strokeWidth="4"/>
                <path d="M196 200c0-40 30-80 60-80s60 40 60 80" fill="none" stroke="white" strokeWidth="16" strokeLinecap="round"/>
                <rect x="175" y="250" width="6" height="100" rx="2" fill="#2563eb"/>
                <rect x="190" y="250" width="14" height="100" rx="3" fill="#2563eb"/>
                <rect x="213" y="250" width="6" height="100" rx="2" fill="#2563eb"/>
                <rect x="228" y="270" width="10" height="80" rx="2" fill="#2563eb"/>
                <rect x="247" y="250" width="6" height="100" rx="2" fill="#2563eb"/>
                <rect x="262" y="255" width="14" height="95" rx="3" fill="#2563eb"/>
                <rect x="285" y="250" width="6" height="100" rx="2" fill="#2563eb"/>
                <rect x="300" y="265" width="10" height="85" rx="2" fill="#2563eb"/>
                <rect x="319" y="250" width="6" height="100" rx="2" fill="#2563eb"/>
                <circle cx="330" cy="420" r="36" fill="#f59e0b"/>
                <text x="330" y="428" fontFamily="Arial" fontSize="32" fontWeight="bold" fill="white" textAnchor="middle">$</text>
                <path d="M175 300l20 20 40-40" fill="none" stroke="#10b981" strokeWidth="8" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </div>
          )}
          <h1 className="splash-company-name">{companyName}</h1>
          <p className="splash-tagline">{t('app.subtitle')}</p>
        </div>
      </div>
      <div className="splash-right">
        <div className="splash-login-card">
          <h2 className="splash-welcome">{t('auth.welcome')}</h2>
          <p className="splash-login-hint">{t('auth.loginHint')}</p>
          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <label className="form-label">{t('auth.username')}</label>
              <input className="input" value={username} onChange={e => setUsername(e.target.value)} required autoFocus />
            </div>
            <div className="form-group">
              <label className="form-label">{t('auth.password')}</label>
              <input className="input" type="password" value={password} onChange={e => setPassword(e.target.value)} required />
            </div>
            {error && <div className="splash-error">{error}</div>}
            <button type="submit" className="btn btn-primary splash-login-btn">
              {t('auth.login')}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
