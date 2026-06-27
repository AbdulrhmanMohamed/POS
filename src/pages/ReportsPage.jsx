import { useState, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { ReportRepository, SettingsRepository, ProductRepository, CustomerRepository } from '../database';
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell
} from 'recharts';

const reportRepo = ReportRepository;
const settingsRepo = SettingsRepository;
const productRepo = ProductRepository;
const customerRepo = CustomerRepository;

const PIE_COLORS = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899', '#14B8A6', '#F97316'];

const formatNum = (n) => (Number(n) || 0).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
const formatPct = (n) => (Number(n) || 0).toFixed(1);

export default function ReportsPage() {
  const { t } = useTranslation();
  const [tab, setTab] = useState('daily');
  const [loading, setLoading] = useState(true);
  const [currency, setCurrency] = useState('ر.س');

  const [daily, setDaily] = useState(null);
  const [period, setPeriod] = useState(null);
  const [perf, setPerf] = useState(null);
  const [kpis, setKpis] = useState(null);
  const [freqData, setFreqData] = useState([]);
  const [filteredKpis, setFilteredKpis] = useState(null);

  const [activity, setActivity] = useState([]);
  const [undoMsg, setUndoMsg] = useState('');

  const [customFrom, setCustomFrom] = useState(() => new Date().toISOString().slice(0, 10));
  const [customTo, setCustomTo] = useState(() => new Date().toISOString().slice(0, 10));
  const [customType, setCustomType] = useState('all');

  const [filterDateFrom, setFilterDateFrom] = useState('');
  const [filterDateTo, setFilterDateTo] = useState('');
  const [filterProduct, setFilterProduct] = useState('');
  const [filterCategory, setFilterCategory] = useState('');
  const [filterCustomer, setFilterCustomer] = useState('');
  const [products, setProducts] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [categories, setCategories] = useState([]);

  useEffect(() => {
    loadMeta();
    loadData(tab);
  }, [tab]);

  const loadMeta = async () => {
    const s = await settingsRepo.getAll();
    setCurrency(s.currency_symbol || 'ر.س');
    const allProducts = await productRepo.findAll();
    setProducts(allProducts || []);
    const allCustomers = await customerRepo.findAll();
    setCustomers(allCustomers || []);
    const cats = [...new Set((allProducts || []).map(p => p.category).filter(Boolean))];
    setCategories(cats);
  };

  const loadData = async (activeTab) => {
    setLoading(true);
    const t = activeTab || tab;

    try {
      if (t === 'daily') {
        setDaily(await reportRepo.dailyReport());
      } else if (t === 'sales') {
        setPerf(await reportRepo.performanceReport());
        setKpis(await reportRepo.kpis());
      } else if (t === 'profit') {
        setKpis(await reportRepo.kpis());
      } else if (t === 'products') {
        setKpis(await reportRepo.kpis());
        setPeriod(await reportRepo.reportByPeriod('custom', customFrom, customTo));
      } else if (t === 'customers') {
        setKpis(await reportRepo.kpis());
        setFreqData(await reportRepo.customerFrequency());
      } else if (t === 'trends') {
        setPerf(await reportRepo.performanceReport());
        setKpis(await reportRepo.kpis());
        setPeriod(await reportRepo.reportByPeriod('custom', customFrom, customTo));
      } else if (t === 'activity') {
        setActivity(await reportRepo.getRecentActivity(100));
      }
    } catch (e) {
      console.error('Report error:', e);
    }
    setLoading(false);
  };

  const handleCustomGenerate = async () => {
    setLoading(true);
    setPeriod(await reportRepo.reportByPeriod('custom', customFrom, customTo));
    setLoading(false);
  };

  const applyFilters = async () => {
    const filters = {};
    if (filterDateFrom && filterDateTo) { filters.dateFrom = filterDateFrom; filters.dateTo = filterDateTo; }
    if (filterProduct) filters.productId = filterProduct;
    if (filterCategory) filters.category = filterCategory;
    if (filterCustomer) filters.customerId = filterCustomer;
    setFilteredKpis(await reportRepo.filteredKpis(filters));
  };

  const Value = ({ val, color }) => (
    <span style={{ color: color || 'var(--text-primary)', fontWeight: 700, fontSize: 22 }}>
      {formatNum(val)} {currency}
    </span>
  );

  const statCards = (items) => (
    <div className="stats-grid">
      {items.map((item, i) => (
        <div className="stat-card" key={i}>
          <div className="stat-label">{item.label}</div>
          <div className="stat-value" style={{ color: item.color || 'var(--text-primary)' }}>
            {item.prefix || ''}{item.value}
          </div>
          {item.sub && <div className="stat-sub">{item.sub}</div>}
        </div>
      ))}
    </div>
  );

  const ProductsTable = ({ data, labelKey, valueKey, valueLabel, unit }) => (
    <table className="table">
      <thead><tr>
        <th>#</th>
        <th>{t('common.name')}</th>
        <th>{valueLabel}</th>
      </tr></thead>
      <tbody>
        {data.map((p, i) => (
          <tr key={p.id || i}>
            <td className="cell-faded">{i + 1}</td>
            <td>{p.name}</td>
            <td>{formatNum(unit === 'qty' ? p[valueKey] : p[valueKey])}{unit === 'qty' ? '' : ` ${currency}`}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );

  const renderDaily = () => {
    if (!daily) return null;
    const netColor = daily.net >= 0 ? 'var(--success)' : 'var(--error)';
    return (<>
      <h2 className="section-title">{t('reports.dailySales')}</h2>
      {statCards([
        { label: t('reports.totalSales'), value: <Value val={daily.sales} /> },
        { label: t('invoices.title'), value: <span className="stat-value">{daily.invoicesCount}</span> },
        { label: t('reports.totalReturns'), value: <Value val={daily.returns} color="var(--error)" /> },
        { label: t('reports.totalExpenses'), value: <Value val={daily.expenses} color="var(--warning)" /> },
        { label: t('reports.totalWages'), value: <Value val={daily.wages} color="var(--warning)" /> },
        { label: t('reports.supplierPayments'), value: <Value val={daily.supplierPayments} color="var(--text-muted)" /> },
        { label: `${t('reports.netProfit')} / ${t('reports.netLoss')}`, value: <Value val={Math.abs(daily.net)} color={netColor} />, sub: daily.net >= 0 ? t('reports.netProfit') : t('reports.netLoss') },
      ])}
    </>);
  };

  const renderSales = () => {
    if (!perf && !kpis) return null;
    return (<>
      <h2 className="section-title">{t('reports.sales')}</h2>
      {perf && (<>
        <div className="stats-grid">
          <div className="stat-card">
            <div className="stat-label">{t('reports.weekOverWeek')}</div>
            <div className="stat-value">{currency}{formatNum(perf.thisWeek)}</div>
            <div className="stat-sub" style={{ color: perf.lastWeek > 0 ? ((perf.thisWeek - perf.lastWeek) / perf.lastWeek * 100) >= 0 ? 'var(--success)' : 'var(--error)' : 'var(--text-secondary)' }}>
              {perf.lastWeek > 0 ? `${((perf.thisWeek - perf.lastWeek) / perf.lastWeek * 100) >= 0 ? '↑' : '↓'} ${formatPct(Math.abs((perf.thisWeek - perf.lastWeek) / perf.lastWeek * 100))}%` : '-'}
            </div>
          </div>
          <div className="stat-card">
            <div className="stat-label">{t('reports.monthOverMonth')}</div>
            <div className="stat-value">{currency}{formatNum(perf.thisMonth)}</div>
            <div className="stat-sub" style={{ color: perf.lastMonth > 0 ? ((perf.thisMonth - perf.lastMonth) / perf.lastMonth * 100) >= 0 ? 'var(--success)' : 'var(--error)' : 'var(--text-secondary)' }}>
              {perf.lastMonth > 0 ? `${((perf.thisMonth - perf.lastMonth) / perf.lastMonth * 100) >= 0 ? '↑' : '↓'} ${formatPct(Math.abs((perf.thisMonth - perf.lastMonth) / perf.lastMonth * 100))}%` : '-'}
            </div>
          </div>
          <div className="stat-card">
            <div className="stat-label">{t('reports.yearOverYear')}</div>
            <div className="stat-value">{currency}{formatNum(perf.thisYear)}</div>
            <div className="stat-sub" style={{ color: perf.lastYear > 0 ? ((perf.thisYear - perf.lastYear) / perf.lastYear * 100) >= 0 ? 'var(--success)' : 'var(--error)' : 'var(--text-secondary)' }}>
              {perf.lastYear > 0 ? `${((perf.thisYear - perf.lastYear) / perf.lastYear * 100) >= 0 ? '↑' : '↓'} ${formatPct(Math.abs((perf.thisYear - perf.lastYear) / perf.lastYear * 100))}%` : '-'}
            </div>
          </div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginTop: 20 }}>
          <div className="card">
            <div className="card-header"><h3 className="card-title">{t('reports.bestDays')}</h3></div>
            {(perf.bestDays || []).length === 0 ? <div className="empty-state"><div className="empty-text">{t('reports.noData')}</div></div>
              : <div>{perf.bestDays.map(d => {
                const pct = (d.total / Math.max(...perf.bestDays.map(x => x.total), 1)) * 100;
                return (<div key={d.day_name} style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                  <span style={{ width: 80, fontSize: 13, fontWeight: 500 }}>{d.day_name}</span>
                  <div style={{ flex: 1, height: 24, background: 'var(--bg-secondary)', borderRadius: 4, overflow: 'hidden' }}>
                    <div style={{ width: `${pct}%`, height: '100%', background: 'var(--accent)', borderRadius: 4 }} />
                  </div>
                  <span style={{ fontSize: 13, fontWeight: 600, minWidth: 80, textAlign: 'right' }}>{formatNum(d.total)} {currency}</span>
                </div>);
              })}</div>}
          </div>
          <div className="card">
            <div className="card-header"><h3 className="card-title">{t('reports.bestDays')} (Hours)</h3></div>
            {(perf.bestHours || []).length === 0 ? <div className="empty-state"><div className="empty-text">{t('reports.noData')}</div></div>
              : <div>{perf.bestHours.map(d => {
                const pct = (d.total / Math.max(...perf.bestHours.map(x => x.total), 1)) * 100;
                return (<div key={d.hour} style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                  <span style={{ width: 60, fontSize: 13, fontWeight: 500 }}>{String(d.hour).padStart(2,'0')}:00</span>
                  <div style={{ flex: 1, height: 24, background: 'var(--bg-secondary)', borderRadius: 4, overflow: 'hidden' }}>
                    <div style={{ width: `${pct}%`, height: '100%', background: 'var(--warning)', borderRadius: 4 }} />
                  </div>
                  <span style={{ fontSize: 13, fontWeight: 600, minWidth: 80, textAlign: 'right' }}>{formatNum(d.total)} {currency}</span>
                </div>);
              })}</div>}
          </div>
        </div>
      </>)}
      {kpis && kpis.salesOverTime && kpis.salesOverTime.length > 0 && <div className="card" style={{ marginTop: 20 }}>
        <div className="card-header"><h3 className="card-title">{t('reports.salesOverTime')}</h3></div>
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={kpis.salesOverTime}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
            <XAxis dataKey="date" tick={{ fontSize: 12, fill: 'var(--text-secondary)' }} />
            <YAxis tick={{ fontSize: 12, fill: 'var(--text-secondary)' }} />
            <Tooltip />
            <Line type="monotone" dataKey="total" stroke="var(--accent)" strokeWidth={2} dot={false} name={t('reports.totalSales')} />
          </LineChart>
        </ResponsiveContainer>
      </div>}
    </>);
  };

  const renderProfit = () => {
    if (!kpis) return null;
    const netColor = kpis.netProfit >= 0 ? 'var(--success)' : 'var(--error)';
    return (<>
      <h2 className="section-title">{t('reports.profit')}</h2>
      {statCards([
        { label: t('reports.totalSales'), value: <Value val={kpis.totalSales} /> },
        { label: t('reports.netProfit'), value: <Value val={kpis.netProfit} color={netColor} /> },
        { label: t('reports.invoiceCount'), value: <span className="stat-value">{kpis.totalInvoices}</span> },
        { label: t('reports.avgInvoiceValue'), value: <Value val={kpis.avgInvoiceValue} color="var(--accent)" /> },
        { label: t('reports.totalReturns'), value: <Value val={kpis.totalReturns} color="var(--error)" /> },
        { label: t('reports.totalExpenses'), value: <Value val={kpis.totalExpenses} color="var(--warning)" /> },
        { label: t('reports.returnRate'), value: <span className="stat-value">{formatPct(kpis.returnRate)}%</span> },
      ])}
      {kpis.profitTrend && kpis.profitTrend.length > 0 && <div className="card" style={{ marginTop: 20 }}>
        <div className="card-header"><h3 className="card-title">{t('reports.profitTrend')}</h3></div>
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={kpis.profitTrend}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
            <XAxis dataKey="date" tick={{ fontSize: 12, fill: 'var(--text-secondary)' }} />
            <YAxis tick={{ fontSize: 12, fill: 'var(--text-secondary)' }} />
            <Tooltip />
            <Line type="monotone" dataKey="profit" stroke="var(--success)" strokeWidth={2} dot={false} name={t('reports.netProfit')} />
          </LineChart>
        </ResponsiveContainer>
      </div>}
    </>);
  };

  const renderProducts = () => {
    if (!kpis && !period) return null;
    return (<>
      <h2 className="section-title">{t('reports.products')}</h2>
      {kpis && kpis.topProducts && kpis.topProducts.length > 0 && <div className="card" style={{ marginBottom: 20 }}>
        <div className="card-header"><h3 className="card-title">{t('reports.topProducts')}</h3></div>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={kpis.topProducts}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
            <XAxis dataKey="name" tick={{ fontSize: 11, fill: 'var(--text-secondary)' }} />
            <YAxis tick={{ fontSize: 12, fill: 'var(--text-secondary)' }} />
            <Tooltip />
            <Bar dataKey="total" fill="var(--accent)" name={t('reports.totalSales')} radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>}
      {period && period.topProducts && period.topProducts.length > 0 && <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginTop: 20 }}>
        <div className="card">
          <div className="card-header"><h3 className="card-title">{t('reports.topProducts')}</h3></div>
          <ProductsTable data={period.topProducts} valueKey="total" valueLabel={t('common.total')} />
        </div>
        <div className="card">
          <div className="card-header"><h3 className="card-title">{t('reports.leastProducts')}</h3></div>
          {period.leastProducts.length === 0 ? <div className="empty-state"><div className="empty-text">{t('reports.noData')}</div></div>
            : <ProductsTable data={period.leastProducts} valueKey="total" valueLabel={t('common.total')} />}
        </div>
      </div>}
      {kpis && kpis.stagnantProducts && kpis.stagnantProducts.length > 0 && <div className="card" style={{ marginTop: 20 }}>
        <div className="card-header"><h3 className="card-title">{t('reports.stagnantProducts')}</h3></div>
        <ProductsTable data={kpis.stagnantProducts} valueKey="stock" valueLabel={t('common.stock')} unit="qty" />
      </div>}
    </>);
  };

  const renderCustomers = () => {
    if (freqData.length === 0) return null;
    return (<>
      <h2 className="section-title">{t('reports.customers')}</h2>
      <div className="card">
        <div className="card-header"><h3 className="card-title">{t('reports.customerFrequency')}</h3></div>
        <table className="table">
          <thead><tr>
            <th>#</th>
            <th>{t('common.name')}</th>
            <th>{t('reports.invoiceCount')}</th>
            <th>{t('common.total')}</th>
            <th>{t('common.date')}</th>
          </tr></thead>
          <tbody>
            {freqData.map((c, i) => (
              <tr key={c.id}>
                <td className="cell-faded">{i + 1}</td>
                <td>{c.name}</td>
                <td>{c.orderCount}</td>
                <td>{formatNum(c.totalSpent)} {currency}</td>
                <td className="cell-faded">{c.lastPurchase ? new Date(c.lastPurchase).toLocaleDateString('ar') : '-'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {kpis && statCards([
        { label: t('reports.customerDebts'), value: <Value val={kpis.customerDebts} color="var(--error)" /> },
      ])}
    </>);
  };

  const renderTrends = () => {
    if (!period && !kpis && !perf) return null;
    return (<>
      <h2 className="section-title">{t('reports.trends')}</h2>
      <div className="card" style={{ marginBottom: 20 }}>
        <div className="toolbar" style={{ flexWrap: 'wrap' }}>
          <div className="form-group" style={{ margin: 0 }}>
            <label className="form-label">{t('reports.fromDate')}</label>
            <input type="date" className="input input-sm" value={customFrom} onChange={e => setCustomFrom(e.target.value)} />
          </div>
          <div className="form-group" style={{ margin: 0 }}>
            <label className="form-label">{t('reports.toDate')}</label>
            <input type="date" className="input input-sm" value={customTo} onChange={e => setCustomTo(e.target.value)} />
          </div>
          <div className="form-group" style={{ margin: 0 }}>
            <label className="form-label">{t('reports.filterByDate')}</label>
            <select className="input input-sm" value={customType} onChange={e => setCustomType(e.target.value)}>
              <option value="all">{t('common.all')}</option>
              <option value="sales">{t('reports.totalSales')}</option>
              <option value="expenses">{t('reports.totalExpenses')}</option>
              <option value="payments">{t('reports.supplierPayments')}</option>
            </select>
          </div>
          <button className="btn btn-primary" onClick={handleCustomGenerate} style={{ marginTop: 20 }}>
            {t('reports.generate')}
          </button>
        </div>
      </div>
      {period && (<>
        <div className="stats-grid">
          <div className="stat-card">
            <div className="stat-label">{t('reports.totalSales')}</div>
            <div className="stat-value">{formatNum(period.sales)} {currency}</div>
          </div>
          <div className="stat-card">
            <div className="stat-label">{t('invoices.title')}</div>
            <div className="stat-value">{period.invoicesCount}</div>
          </div>
          <div className="stat-card">
            <div className="stat-label">{t('reports.totalReturns')}</div>
            <div className="stat-value">{formatNum(period.returns)} {currency}</div>
          </div>
          <div className="stat-card">
            <div className="stat-label">{t('reports.totalExpenses')}</div>
            <div className="stat-value">{formatNum(period.expenses)} {currency}</div>
          </div>
          <div className="stat-card">
            <div className="stat-label">{t('reports.inventoryValue')}</div>
            <div className="stat-value">{formatNum(period.inventoryValue)} {currency}</div>
          </div>
          <div className="stat-card">
            <div className="stat-label">{t('reports.customerDebts')}</div>
            <div className="stat-value">{formatNum(period.customerDebts)} {currency}</div>
          </div>
          <div className="stat-card">
            <div className="stat-label">{t('reports.supplierDebts')}</div>
            <div className="stat-value">{formatNum(period.supplierDebts)} {currency}</div>
          </div>
        </div>
        {period.topProducts && period.topProducts.length > 0 && <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginTop: 20 }}>
          <div className="card">
            <div className="card-header"><h3 className="card-title">{t('reports.topProducts')}</h3></div>
            <ProductsTable data={period.topProducts} valueKey="total" valueLabel={t('common.total')} />
          </div>
          <div className="card">
            <div className="card-header"><h3 className="card-title">{t('reports.leastProducts')}</h3></div>
            {period.leastProducts.length === 0 ? <div className="empty-state"><div className="empty-text">{t('reports.noData')}</div></div>
              : <ProductsTable data={period.leastProducts} valueKey="total" valueLabel={t('common.total')} />}
          </div>
        </div>}
      </>)}
      {perf && perf.productTrends && perf.productTrends.length > 0 && <div className="card" style={{ marginTop: 20 }}>
        <div className="card-header"><h3 className="card-title">{t('reports.productTrends')}</h3></div>
        <ProductsTable data={perf.productTrends} valueKey="total" valueLabel={t('common.total')} />
      </div>}
      {kpis && kpis.stagnantProducts && kpis.stagnantProducts.length > 0 && <div className="card" style={{ marginTop: 20 }}>
        <div className="card-header"><h3 className="card-title">{t('reports.stagnantProducts')}</h3></div>
        <ProductsTable data={kpis.stagnantProducts} valueKey="stock" valueLabel={t('common.stock')} unit="qty" />
      </div>}
      {kpis && kpis.profitTrend && kpis.profitTrend.length > 0 && <div className="card" style={{ marginTop: 20 }}>
        <div className="card-header"><h3 className="card-title">{t('reports.profitTrend')}</h3></div>
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={kpis.profitTrend}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
            <XAxis dataKey="date" tick={{ fontSize: 12, fill: 'var(--text-secondary)' }} />
            <YAxis tick={{ fontSize: 12, fill: 'var(--text-secondary)' }} />
            <Tooltip />
            <Line type="monotone" dataKey="profit" stroke="var(--success)" strokeWidth={2} dot={false} name={t('reports.netProfit')} />
          </LineChart>
        </ResponsiveContainer>
      </div>}
    </>);
  };

  const handleUndo = async (item) => {
    const result = await reportRepo.undoEntity(item.entity_type, item.entity_id);
    if (result.success) {
      setUndoMsg(`${t('reports.undid')}: ${item.title}`);
      setActivity(await reportRepo.getRecentActivity(100));
      setTimeout(() => setUndoMsg(''), 3000);
    } else {
      alert(result.message);
    }
  };

  const entityIcon = (type) => {
    switch (type) {
      case 'product': return '📦';
      case 'account': return '📒';
      case 'journal_entry': return '📝';
      case 'invoice': return '🧾';
      case 'expense': return '💸';
      case 'customer': return '👤';
      case 'supplier': return '🏭';
      default: return '📌';
    }
  };

  const renderActivity = () => (
    <div>
      <h2 className="section-title">{t('reports.recentActivity')}</h2>
      {undoMsg && (
        <div className="badge badge-success" style={{ marginBottom: '16px', padding: '8px 16px', display: 'inline-block' }}>
          {undoMsg}
        </div>
      )}
      {activity.length === 0 ? (
        <div className="empty-state">{t('reports.noData')}</div>
      ) : (
        <table className="table">
          <thead>
            <tr>
              <th>#</th>
              <th>{t('reports.activity')}</th>
              <th>{t('accounting.accountType')}</th>
              <th>{t('accounting.description')}</th>
              <th>{t('common.date')}</th>
              <th>{t('common.actions')}</th>
            </tr>
          </thead>
          <tbody>
            {activity.map((item, i) => (
              <tr key={`${item.src}-${item.entity_id}`}>
                <td className="cell-faded">{i + 1}</td>
                <td>
                  <span style={{ fontSize: 18, marginRight: 8 }}>{entityIcon(item.entity_type)}</span>
                  {item.title}
                </td>
                <td>
                  <span className="badge badge-info">
                    {t(`reports.entityType_${item.entity_type}`)}
                  </span>
                </td>
                <td className="cell-faded">{item.action === 'create' ? t('common.add') : item.action}</td>
                <td className="cell-faded" style={{ direction: 'ltr', textAlign: 'right' }}>
                  {new Date(item.created_at + 'Z').toLocaleString('ar-EG')}
                </td>
                <td>
                  <button
                    className="btn btn-sm btn-secondary"
                    onClick={() => handleUndo(item)}
                  >
                    {t('reports.undo')}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );

  const tabs = [
    { key: 'daily', label: t('reports.daily') },
    { key: 'sales', label: t('reports.sales') },
    { key: 'profit', label: t('reports.profit') },
    { key: 'products', label: t('reports.products') },
    { key: 'customers', label: t('reports.customers') },
    { key: 'trends', label: t('reports.trends') },
    { key: 'activity', label: t('reports.activity') },
  ];

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">{t('reports.title')}</h1>
      </div>

      <div className="tabs">
        {tabs.map(t => (
          <button key={t.key} className={`tab${tab === t.key ? ' active' : ''}`} onClick={() => setTab(t.key)}>
            {t.label}
          </button>
        ))}
      </div>

      {(tab === 'products' || tab === 'trends') && (
        <div className="card" style={{ marginBottom: 20 }}>
          <div className="toolbar" style={{ flexWrap: 'wrap' }}>
            <div className="form-group" style={{ margin: 0 }}>
              <label className="form-label">{t('reports.fromDate')}</label>
              <input type="date" className="input input-sm" value={customFrom} onChange={e => setCustomFrom(e.target.value)} />
            </div>
            <div className="form-group" style={{ margin: 0 }}>
              <label className="form-label">{t('reports.toDate')}</label>
              <input type="date" className="input input-sm" value={customTo} onChange={e => setCustomTo(e.target.value)} />
            </div>
            <div className="form-group" style={{ margin: 0 }}>
              <label className="form-label">{t('reports.filterByDate')}</label>
              <select className="input input-sm" value={customType} onChange={e => setCustomType(e.target.value)}>
                <option value="all">{t('common.all')}</option>
                <option value="sales">{t('reports.totalSales')}</option>
                <option value="expenses">{t('reports.totalExpenses')}</option>
                <option value="payments">{t('reports.supplierPayments')}</option>
              </select>
            </div>
            <button className="btn btn-primary" onClick={(tab === 'trends') ? handleCustomGenerate : handleCustomGenerate} style={{ marginTop: 20 }}>
              {t('reports.generate')}
            </button>
          </div>
        </div>
      )}

      {loading ? (
        <div className="stats-grid">
          {[1,2,3,4,5,6].map(i => (
            <div key={i} className="stat-card" style={{ height: 100, animation: 'shimmer 1.5s infinite' }}>
              <div style={{ height: 14, width: '60%', background: 'var(--bg-tertiary)', borderRadius: 4, marginBottom: 8 }} />
              <div style={{ height: 28, width: '40%', background: 'var(--bg-tertiary)', borderRadius: 4 }} />
            </div>
          ))}
        </div>
      ) : (
        <>
          {tab === 'daily' && renderDaily()}
          {tab === 'sales' && renderSales()}
          {tab === 'profit' && renderProfit()}
          {tab === 'products' && renderProducts()}
          {tab === 'customers' && renderCustomers()}
          {tab === 'trends' && renderTrends()}
          {tab === 'activity' && renderActivity()}
        </>
      )}
    </div>
  );
}
