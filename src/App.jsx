import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useThemeStore } from './stores/themeStore';
import { useSettingsStore } from './stores/settingsStore';
import { initDatabase } from './database';
import { useAuthStore, canAccess } from './stores/authStore';
import ToastContainer from './components/ToastContainer';
import ConfirmDialog from './components/ConfirmDialog';
import { IconPOS, IconPackage, IconUsers, IconTruck, IconClipboard, IconFileText, IconRotateCcw, IconBarChart, IconDollarSign, IconWrench, IconShield, IconSettings, IconCashRegister, IconLogOut, IconBookOpen } from './components/Icons';
import POSScreen from './pages/POSScreen';
import LoginPage from './pages/LoginPage';
import ProductsPage from './pages/ProductsPage';
import CustomersPage from './pages/CustomersPage';
import SuppliersPage from './pages/SuppliersPage';
import InventoryPage from './pages/InventoryPage';
import ReportsPage from './pages/ReportsPage';
import SettingsPage from './pages/SettingsPage';
import AuditLogsPage from './pages/AuditLogsPage';
import PurchaseOrdersPage from './pages/PurchaseOrdersPage';
import InvoicesPage from './pages/InvoicesPage';
import ReturnsPage from './pages/ReturnsPage';
import ExpensesPage from './pages/ExpensesPage';
import WorkersPage from './pages/WorkersPage';
import CashRegisterPage from './pages/CashRegisterPage';
import ChartOfAccountsPage from './pages/ChartOfAccountsPage';

const SIDEBAR_ICONS = {
  pos: IconPOS, products: IconPackage, customers: IconUsers,
  suppliers: IconTruck, purchaseOrders: IconClipboard, invoices: IconFileText,
  returns: IconRotateCcw, inventory: IconBarChart,
  expenses: IconDollarSign,
  workers: IconWrench, reports: IconBarChart, auditLogs: IconShield, settings: IconSettings,
  cashRegister: IconCashRegister, chartOfAccounts: IconBookOpen,
};

const TAB_GROUPS = [
  { key: 'sales', icon: IconPOS, labelKey: 'nav.pos', pages: ['pos'] },
  { key: 'stock', icon: IconPackage, labelKey: 'nav.products', pages: ['products', 'inventory', 'purchaseOrders'] },
  { key: 'people', icon: IconUsers, labelKey: 'nav.customers', pages: ['customers', 'suppliers', 'workers'] },
  { key: 'finance', icon: IconFileText, labelKey: 'nav.invoices', pages: ['invoices', 'returns', 'cashRegister', 'expenses', 'chartOfAccounts'] },
  { key: 'reports', icon: IconBarChart, labelKey: 'nav.reports', pages: ['reports', 'auditLogs'] },
  { key: 'settings', icon: IconSettings, labelKey: 'nav.settings', pages: ['settings'] },
];

const PAGE_LABEL_KEYS = {
  pos: 'nav.pos',
  products: 'nav.products',
  inventory: 'nav.inventory',
  purchaseOrders: 'nav.purchaseOrders',
  customers: 'nav.customers',
  suppliers: 'nav.suppliers',
  workers: 'nav.workers',
  invoices: 'nav.invoices',
  returns: 'nav.returns',
  cashRegister: 'nav.cashRegister',
  expenses: 'nav.expenses',
  chartOfAccounts: 'nav.chartOfAccounts',
  reports: 'nav.reports',
  auditLogs: 'nav.auditLogs',
  settings: 'nav.settings',
};

function App() {
  const { t, i18n } = useTranslation();
  const { theme, setTheme } = useThemeStore();
  const user = useAuthStore(s => s.user);
  const logout = useAuthStore(s => s.logout);
  const [currentPage, setCurrentPage] = useState('pos');
  const [dbReady, setDbReady] = useState(false);
  const [history, setHistory] = useState(['pos']);
  const [historyIndex, setHistoryIndex] = useState(0);

  useEffect(() => {
    initDatabase()
      .then(() => setDbReady(true))
      .catch((err) => {
        console.error('Database init failed:', err);
        setDbReady(true);
      });
  }, []);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    document.documentElement.dir = i18n.language === 'ar' ? 'rtl' : 'ltr';
  }, [theme, i18n.language]);

  if (!dbReady) {
    const companyName = useSettingsStore.getState().company_name || t('app.title');
    const companyLogo = useSettingsStore.getState().company_logo || '';
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
          <div style={{ textAlign: 'center' }}>
            <div style={{ width: '40px', height: '40px', border: '3px solid var(--border)', borderTopColor: 'var(--accent)', borderRadius: '50%', animation: 'spin 0.8s linear infinite', margin: '0 auto 16px' }} />
            <div style={{ color: 'var(--text-secondary)', fontSize: '14px' }}>{t('app.loading')}</div>
          </div>
        </div>
      </div>
    );
  }

  if (!user) return <LoginPage />;

  const navigate = (page) => {
    if (!canAccess(page)) return;
    const newHistory = history.slice(0, historyIndex + 1);
    newHistory.push(page);
    setHistory(newHistory);
    setHistoryIndex(newHistory.length - 1);
    setCurrentPage(page);
  };

  const goBack = () => {
    if (historyIndex > 0) {
      setHistoryIndex(historyIndex - 1);
      setCurrentPage(history[historyIndex - 1]);
    }
  };

  const goForward = () => {
    if (historyIndex < history.length - 1) {
      setHistoryIndex(historyIndex + 1);
      setCurrentPage(history[historyIndex + 1]);
    }
  };

  const renderPage = () => {
    if (!canAccess(currentPage)) {
      return (
        <div className="empty-state" style={{ marginTop: '40px' }}>
          {t('auth.unauthorized')}
        </div>
      );
    }
    const pages = {
      pos: <POSScreen />,
      products: <ProductsPage />,
      customers: <CustomersPage />,
      suppliers: <SuppliersPage />,
      inventory: <InventoryPage />,
      reports: <ReportsPage />,
      settings: <SettingsPage />,
      auditLogs: <AuditLogsPage />,
      purchaseOrders: <PurchaseOrdersPage />,
      invoices: <InvoicesPage />,
      returns: <ReturnsPage />,
      expenses: <ExpensesPage />,
      workers: <WorkersPage />,
      cashRegister: <CashRegisterPage />,
      chartOfAccounts: <ChartOfAccountsPage />,
    };
    return pages[currentPage] || <POSScreen />;
  };

  return (
    <div className="app-container">
      <ToastContainer />
      <ConfirmDialog />
      <aside className="sidebar">
        <div className="sidebar-logo">
          <svg width="28" height="28" viewBox="0 0 512 512" fill="none" style={{ flexShrink: 0 }}>
            <rect width="512" height="512" rx="96" fill="var(--accent)" opacity="0.15"/>
            <path d="M160 180h192l-20 160H180l-20-160z" fill="var(--accent)" stroke="var(--accent)" strokeWidth="3"/>
            <path d="M206 180c0-30 22-60 50-60s50 30 50 60" fill="none" stroke="var(--accent)" strokeWidth="12" strokeLinecap="round"/>
            <rect x="185" y="215" width="5" height="80" rx="2" fill="var(--accent)"/>
            <rect x="198" y="215" width="10" height="80" rx="2" fill="var(--accent)"/>
            <rect x="215" y="215" width="5" height="80" rx="2" fill="var(--accent)"/>
            <rect x="228" y="230" width="8" height="65" rx="2" fill="var(--accent)"/>
            <rect x="243" y="215" width="5" height="80" rx="2" fill="var(--accent)"/>
            <rect x="255" y="220" width="10" height="75" rx="2" fill="var(--accent)"/>
            <rect x="272" y="215" width="5" height="80" rx="2" fill="var(--accent)"/>
            <circle cx="310" cy="350" r="24" fill="#f59e0b" opacity="0.8"/>
            <text x="310" y="357" fontFamily="Arial" fontSize="20" fontWeight="bold" fill="white" textAnchor="middle">$</text>
          </svg>
          <span className="nav-label" style={{ fontSize: 16 }}>POS</span>
        </div>
        <nav>
          <ul className="nav-list">
            {TAB_GROUPS.map((group) => {
              const accessiblePages = group.pages.filter(p => canAccess(p));
              if (accessiblePages.length === 0) return null;
              return (
                <li key={group.key}>
                  <div className="nav-section-label">{t(group.labelKey)}</div>
                  {accessiblePages.map(pageId => {
                    const PageIcon = SIDEBAR_ICONS[pageId];
                    return (
                      <a
                        key={pageId}
                        className={`nav-link ${currentPage === pageId ? 'active' : ''}`}
                        onClick={() => navigate(pageId)}
                      >
                        <span className="nav-icon">{PageIcon && <PageIcon />}</span>
                        <span className="nav-label">{t(PAGE_LABEL_KEYS[pageId])}</span>
                      </a>
                    );
                  })}
                </li>
              );
            })}
          </ul>
        </nav>
        <div className="sidebar-footer">
          <button className="nav-link" onClick={goBack} disabled={historyIndex === 0}>
            <span className="nav-icon">←</span>
            <span className="nav-label">{t('common.back')}</span>
          </button>
          <button className="nav-link" onClick={goForward} disabled={historyIndex === history.length - 1}>
            <span className="nav-icon">→</span>
            <span className="nav-label">{t('common.forward')}</span>
          </button>
          <button className="nav-link nav-link-danger" onClick={logout}>
            <span className="nav-icon"><IconLogOut /></span>
            <span className="nav-label">{t('auth.logout')}</span>
          </button>
        </div>
      </aside>
      <div className="main-area">
        <div className="main-top-bar">
          <span className="user-badge">{user?.username}</span>
        </div>
        <main className="main-content">
          {renderPage()}
        </main>
      </div>
    </div>
  );
}

export default App;
