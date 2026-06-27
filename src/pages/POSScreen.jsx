import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { ProductRepository, InvoiceRepository, CustomerRepository, SettingsRepository } from '../database';
import { useToastStore } from '../stores/toastStore';
import { buildReceiptHTML } from '../printers/ReceiptTemplate';
import PrintPreviewModal from '../components/PrintPreviewModal';

const productRepo = ProductRepository;
const invoiceRepo = InvoiceRepository;
const customerRepo = CustomerRepository;
const settingsRepo = SettingsRepository;
const PAGE_SIZE = 20;

export default function POSScreen() {
  const { t } = useTranslation();
  const [products, setProducts] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [cart, setCart] = useState([]);
  const [currency, setCurrency] = useState('ر.س');
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [discountType, setDiscountType] = useState('percent');
  const [discountValue, setDiscountValue] = useState(0);
  const [showCustomerSearch, setShowCustomerSearch] = useState(false);
  const [customerSearch, setCustomerSearch] = useState('');
  const [creditWarning, setCreditWarning] = useState(null);
  const [lastInvoice, setLastInvoice] = useState(null);
  const [companyInfo, setCompanyInfo] = useState({});
  const [scannerReady, setScannerReady] = useState(true);
  const addToast = useToastStore((s) => s.addToast);
  const [taxRate, setTaxRate] = useState(0);
  const [defaultDiscount, setDefaultDiscount] = useState(0);
  const [page, setPage] = useState(1);
  const [selectedCategory, setSelectedCategory] = useState('');
  const searchRef = useRef(null);
  const [receiptPreviewHtml, setReceiptPreviewHtml] = useState(null);

  useEffect(() => {
    loadProducts();
    loadSettings();
    loadCustomers();
  }, []);

  const loadSettings = async () => {
    const settings = await settingsRepo.getAll();
    setCurrency(settings.currency_symbol || 'ر.س');
    setTaxRate(parseFloat(settings.tax_rate) || 0);
    const dd = parseFloat(settings.default_discount) || 0;
    setDefaultDiscount(dd);
    setDiscountValue(dd);
    setCompanyInfo({
      company_name: settings.company_name || 'متجر',
      company_phone: settings.company_phone || '',
      company_address: settings.company_address || '',
    });
  };

  const loadProducts = async () => {
    const all = await productRepo.findAll('name ASC');
    const db = window.electronAPI?.db;
    if (db) {
      const today = new Date().toISOString().slice(0, 10);
      for (const p of all) {
        const promo = await db.get(
          'SELECT promo_price FROM promo_periods WHERE product_id = ? AND start_date <= ? AND end_date >= ? ORDER BY start_date DESC LIMIT 1',
          [p.id, today, today]
        );
        if (promo) p.price = promo.promo_price;
      }
    }
    setProducts(all || []);
  };

  const loadCustomers = async () => {
    const all = await customerRepo.findAll('name ASC');
    setCustomers(all || []);
  };

  const categories = useMemo(() => {
    const cats = new Set(products.map((p) => p.category).filter(Boolean));
    return ['', ...Array.from(cats).sort()];
  }, [products]);

  const filteredProducts = useMemo(() => {
    let result = products;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      result = result.filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          (p.barcode && p.barcode.toLowerCase().includes(q))
      );
    }
    if (selectedCategory) {
      result = result.filter((p) => p.category === selectedCategory);
    }
    return result;
  }, [products, searchQuery, selectedCategory]);

  const totalPages = Math.ceil(filteredProducts.length / PAGE_SIZE) || 1;
  const paginatedProducts = filteredProducts.slice(
    (page - 1) * PAGE_SIZE,
    page * PAGE_SIZE
  );

  useEffect(() => {
    setPage(1);
  }, [searchQuery, selectedCategory]);

  const toNum = (v) => parseFloat(v) || 0;

  const addToCart = useCallback((product) => {
    const price = toNum(product.price);
    setCart((prev) => {
      const existing = prev.find((item) => item.id === product.id);
      if (existing) {
        return prev.map((item) =>
          item.id === product.id
            ? {
                ...item,
                quantity: item.quantity + 1,
                total: (item.quantity + 1) * price,
              }
            : item
        );
      }
      return [...prev, { ...product, price, quantity: 1, total: price }];
    });
  }, []);

  const updateQuantity = useCallback((id, qty) => {
    if (qty <= 0) {
      setCart((prev) => prev.filter((item) => item.id !== id));
    } else {
      setCart((prev) =>
        prev.map((item) =>
          item.id === id
            ? { ...item, quantity: qty, total: qty * item.price }
            : item
        )
      );
    }
  }, []);

  const removeFromCart = useCallback((id) => {
    setCart((prev) => prev.filter((item) => item.id !== id));
  }, []);

  const clearCart = useCallback(() => {
    setCart([]);
    setSelectedCustomer(null);
    setDiscountValue(defaultDiscount);
    setCreditWarning(null);
  }, [defaultDiscount]);

  const calculateTotal = useCallback(() => {
    const subtotal = cart.reduce((sum, item) => sum + toNum(item.total), 0);
    let discount = 0;
    if (discountType === 'percent') {
      discount = subtotal * (toNum(discountValue) / 100);
    } else {
      discount = toNum(discountValue);
    }
    const afterDiscount = subtotal - discount;
    const tax = afterDiscount * (taxRate / 100);
    return { subtotal, discount, tax, total: afterDiscount + tax };
  }, [cart, discountType, discountValue, taxRate]);

  const checkCreditLimit = useCallback(
    async (customerId, amount) => {
      const customer = customers.find((c) => c.id === customerId);
      if (!customer) return true;

      const currentBalance = parseFloat(customer.balance) || 0;
      const creditLimit = parseFloat(customer.credit_limit) || 0;
      const newBalance = currentBalance + amount;

      if (creditLimit > 0 && newBalance > creditLimit) {
        const remaining = creditLimit - currentBalance;
        setCreditWarning({
          message: `${t('customers.creditLimit')}: ${t('pos.creditExceeded')} (${remaining} ${currency})`,
          canProceed: true,
        });
        return true;
      }
      setCreditWarning(null);
      return true;
    },
    [customers, currency, t]
  );

  const checkout = useCallback(async () => {
    if (cart.length === 0) return;

    const openRegister = await window.electronAPI.db.get('SELECT id FROM cash_registers WHERE status = ?', ['open']);
    if (!openRegister) {
      addToast(t('pos.registerClosed'), 'error');
      return;
    }

    const { subtotal, discount, tax, total } = calculateTotal();
    const amount = total;

    if (selectedCustomer) {
      const canProceed = await checkCreditLimit(selectedCustomer.id, amount);
      if (!canProceed) return;
    }

    const items = cart.map((item) => ({
      product_id: item.id,
      product_name: item.name,
      barcode: item.barcode,
      quantity: item.quantity,
      unit_price: toNum(item.price),
      total_price: toNum(item.total),
    }));

    const invoiceNumber = invoiceRepo.generateInvoiceNumber();
    const invoiceData = {
      invoice_number: invoiceNumber,
      customer_id: selectedCustomer ? selectedCustomer.id : null,
      subtotal,
      discount,
      total,
      paid: total,
      due: 0,
      status: 'completed',
    };

    await invoiceRepo.createInvoiceWithItems(invoiceData, items);

    if (selectedCustomer) {
      const newBalance = (selectedCustomer.balance || 0) + total;
      await customerRepo.update(selectedCustomer.id, { balance: newBalance });
    }

    setLastInvoice({
      ...invoiceData,
      items: cart.map((item) => ({
        name: item.name,
        qty: item.quantity,
        price: item.price,
        total: item.total,
      })),
      date: new Date().toLocaleDateString('ar'),
    });
    setCart([]);
    setSelectedCustomer(null);
    setDiscountValue(defaultDiscount);
    setCreditWarning(null);
    loadProducts();
    loadCustomers();
  }, [cart, calculateTotal, selectedCustomer, checkCreditLimit, currency, products, t, defaultDiscount]);

  const handlePrint = useCallback(async () => {
    if (!lastInvoice) return;
    const html = buildReceiptHTML({
      ...lastInvoice,
      companyName: companyInfo?.company_name || 'متجر',
      companyPhone: companyInfo?.company_phone || '',
      companyAddress: companyInfo?.company_address || '',
      currency,
    });
    setReceiptPreviewHtml(html);
  }, [lastInvoice, companyInfo, currency, t]);

  const doPrintReceipt = useCallback(async () => {
    if (!receiptPreviewHtml) return;
    const printers = await window.electronAPI?.getPrinters?.();
    if (!printers || printers.length === 0) {
      addToast(t('printing.noPrinter'), 'error');
      setReceiptPreviewHtml(null);
      return;
    }
    const result = await window.electronAPI?.print(receiptPreviewHtml);
    setReceiptPreviewHtml(null);
    if (result?.success) {
      addToast(t('printing.success'), 'success');
    } else {
      addToast(t('printing.error', { error: result?.error || 'Unknown' }), 'error');
    }
  }, [receiptPreviewHtml, t]);

  const handleSearchKeyDown = useCallback(
    async (e) => {
      if (e.key === 'Enter' && searchQuery.length > 2) {
        const scannerSettings = await settingsRepo.getAll();
        const prefix = scannerSettings.scanner_prefix || '';
        const suffix = scannerSettings.scanner_suffix || '';
        let cleanQuery = searchQuery;
        if (prefix && cleanQuery.startsWith(prefix)) cleanQuery = cleanQuery.slice(prefix.length);
        if (suffix && cleanQuery.endsWith(suffix)) cleanQuery = cleanQuery.slice(0, -suffix.length);
        const q = cleanQuery.toLowerCase();
        const found = products.find(
          (p) =>
            p.name.toLowerCase().includes(q) ||
            (p.barcode && p.barcode.toLowerCase().includes(q))
        );
        if (found) {
          addToCart(found);
          setSearchQuery('');
        }
      }
    },
    [searchQuery, products, addToCart]
  );

  const { subtotal, discount, tax, total } = calculateTotal();

  const filteredCustomers = customerSearch
    ? customers.filter(
        (c) =>
          c.name.includes(customerSearch) ||
          (c.phone && c.phone.includes(customerSearch))
      )
    : customers;

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">{t('pos.title')}</h1>
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr minmax(350px, 420px)',
          gap: '20px',
        }}
      >
        <div>
          <div
            style={{
              display: 'flex',
              gap: '12px',
              marginBottom: '12px',
              alignItems: 'center',
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                fontSize: '13px',
                color: scannerReady
                  ? 'var(--success)'
                  : 'var(--text-secondary)',
              }}
            >
              <span
                style={{
                  width: 10,
                  height: 10,
                  borderRadius: '50%',
                  background: scannerReady
                    ? 'var(--success)'
                    : 'var(--text-secondary)',
                  display: 'inline-block',
                }}
              />
              <span>{t('settings.scannerReady')}</span>
            </div>

            <input
              ref={searchRef}
              type="text"
              className="input"
              placeholder={t('pos.searchProduct')}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={handleSearchKeyDown}
              style={{ flex: 1, maxWidth: 320 }}
              autoFocus
            />

            <select
              className="input"
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              style={{ width: 160 }}
            >
              <option value="">{t('common.all')}</option>
              {categories.slice(1).map((cat) => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
            </select>
          </div>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))',
              gap: '12px',
            }}
          >
            {paginatedProducts.length === 0 && (
              <div className="empty-state" style={{ gridColumn: '1 / -1' }}>
                {t('pos.noProducts')}
              </div>
            )}
            {paginatedProducts.map((product) => (
              <div
                key={product.id}
                className="card"
                style={{
                  cursor: 'pointer',
                  textAlign: 'center',
                  padding: '16px 12px',
                  border:
                    product.stock <= product.min_stock
                      ? '2px solid var(--error)'
                      : '1px solid var(--border)',
                }}
                onClick={() => addToCart(product)}
              >
                <div style={{ fontSize: '28px', marginBottom: '10px' }}>
                  📦
                </div>
                <div
                  style={{
                    fontWeight: '500',
                    fontSize: '14px',
                    marginBottom: '6px',
                    lineHeight: '1.3',
                  }}
                >
                  {product.name}
                </div>
                <div style={{ color: 'var(--accent)', fontWeight: '700', fontSize: '15px' }}>
                  {product.price} {currency}
                </div>
                <div
                  style={{
                    fontSize: '12px',
                    color:
                      product.stock <= product.min_stock
                        ? 'var(--error)'
                        : 'var(--text-secondary)',
                    marginTop: '4px',
                  }}
                >
                  {t('common.stock')}: {product.stock}
                  {product.stock <= product.min_stock && <span> ⚠️</span>}
                </div>
              </div>
            ))}
          </div>

          {totalPages > 1 && (
            <div
              style={{
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center',
                gap: '6px',
                marginTop: '16px',
              }}
            >
              <button
                className="btn btn-secondary"
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
              >
                {t('common.previous')}
              </button>
              {Array.from({ length: totalPages }, (_, i) => i + 1)
                .filter((p) => {
                  const range = 2;
                  if (totalPages <= 7) return true;
                  if (p === 1 || p === totalPages) return true;
                  if (Math.abs(p - page) <= range) return true;
                  return false;
                })
                .map((p, idx, arr) => {
                  const showGap = idx > 0 && p - arr[idx - 1] > 1;
                  return (
                    <span key={p} style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                      {showGap && (
                        <span style={{ padding: '0 4px', color: 'var(--text-secondary)' }}>
                          ...
                        </span>
                      )}
                      <button
                        className={p === page ? 'btn btn-primary' : 'btn btn-secondary'}
                        onClick={() => setPage(p)}
                        style={{ minWidth: 36, padding: '6px 10px' }}
                      >
                        {p}
                      </button>
                    </span>
                  );
                })}
              <button
                className="btn btn-secondary"
                disabled={page >= totalPages}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              >
                {t('common.next')}
              </button>
            </div>
          )}
        </div>

        <div className="card" style={{ display: 'flex', flexDirection: 'column', maxHeight: 'calc(100vh - 140px)' }}>
          <div
            style={{
              marginBottom: '16px',
              paddingBottom: '12px',
              borderBottom: '1px solid var(--border)',
            }}
          >
            <button
              className="btn btn-secondary"
              onClick={() => setShowCustomerSearch(!showCustomerSearch)}
              style={{ width: '100%', marginBottom: '8px' }}
            >
              {selectedCustomer
                ? `${t('pos.customer')}: ${selectedCustomer.name} (${selectedCustomer.balance || 0} ${currency})`
                : t('pos.selectCustomer')}
            </button>

            {showCustomerSearch && (
              <div style={{ maxHeight: '150px', overflow: 'auto' }}>
                <input
                  type="text"
                  className="input"
                  placeholder={t('common.search')}
                  value={customerSearch}
                  onChange={(e) => setCustomerSearch(e.target.value)}
                  style={{ marginBottom: '8px' }}
                />
                {filteredCustomers.slice(0, 5).map((c) => (
                  <div
                    key={c.id}
                    onClick={() => {
                      setSelectedCustomer(c);
                      setShowCustomerSearch(false);
                      setCustomerSearch('');
                    }}
                    style={{
                      padding: '8px',
                      cursor: 'pointer',
                      borderBottom: '1px solid var(--border)',
                      display: 'flex',
                      justifyContent: 'space-between',
                    }}
                  >
                    <span>{c.name}</span>
                    <span
                      style={{
                        color:
                          (c.balance || 0) > (c.credit_limit || 0) &&
                          (c.credit_limit || 0) > 0
                            ? 'var(--error)'
                            : 'var(--success)',
                      }}
                    >
                      {c.balance || 0}/{c.credit_limit || '\u221E'}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          <h3 style={{ marginBottom: '16px' }}>{t('pos.cart')}</h3>

          <div style={{ flex: 1, overflow: 'auto' }}>
            {cart.length === 0 ? (
              <div className="empty-state">{t('pos.emptyCart')}</div>
            ) : (
              <div>
                {cart.map((item) => (
                  <div
                    key={item.id}
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      padding: '12px 0',
                      borderBottom: '1px solid var(--border)',
                    }}
                  >
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: '500', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {item.name}
                      </div>
                      <div
                        style={{
                          fontSize: '13px',
                          color: 'var(--text-secondary)',
                        }}
                      >
                        {item.price} × {item.quantity}
                      </div>
                    </div>
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                      }}
                    >
                      <button
                        className="btn btn-secondary"
                        onClick={() => updateQuantity(item.id, item.quantity - 1)}
                        style={{ padding: '4px 10px' }}
                      >
                        -
                      </button>
                      <span style={{ minWidth: 20, textAlign: 'center' }}>
                        {item.quantity}
                      </span>
                      <button
                        className="btn btn-secondary"
                        onClick={() => updateQuantity(item.id, item.quantity + 1)}
                        style={{ padding: '4px 10px' }}
                      >
                        +
                      </button>
                      <span
                        style={{
                          fontWeight: '600',
                          minWidth: '60px',
                          textAlign: 'right',
                        }}
                      >
                        {toNum(item.total).toFixed(2)}
                      </span>
                      <button
                        className="btn btn-danger"
                        onClick={() => removeFromCart(item.id)}
                        style={{ padding: '4px 10px' }}
                      >
                        ×
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {cart.length > 0 && (
            <div
              style={{
                padding: '12px',
                background: 'var(--bg-secondary)',
                borderRadius: '8px',
                marginTop: '8px',
              }}
            >
              <div style={{ display: 'flex', gap: '8px', marginBottom: '12px' }}>
                <select
                  className="input"
                  value={discountType}
                  onChange={(e) => setDiscountType(e.target.value)}
                  style={{ width: '80px' }}
                >
                  <option value="percent">%</option>
                  <option value="fixed">{currency}</option>
                </select>
                <input
                  type="number"
                  className="input"
                  placeholder={t('invoices.discount')}
                  value={discountValue}
                  onChange={(e) => setDiscountValue(parseFloat(e.target.value) || 0)}
                  style={{ flex: 1 }}
                />
              </div>

              <div
                style={{
                  fontSize: '14px',
                  display: 'flex',
                  justifyContent: 'space-between',
                  marginBottom: '4px',
                }}
              >
                <span>{t('invoices.subtotal')}:</span>
                <span>
                  {subtotal} {currency}
                </span>
              </div>
              {discount > 0 && (
                <div
                  style={{
                    fontSize: '14px',
                    display: 'flex',
                    justifyContent: 'space-between',
                    marginBottom: '4px',
                    color: 'var(--success)',
                  }}
                >
                  <span>{t('invoices.discount')}:</span>
                  <span>
                    -{discount} {currency}
                  </span>
                </div>
              )}
              {tax > 0 && (
                <div
                  style={{
                    fontSize: '14px',
                    display: 'flex',
                    justifyContent: 'space-between',
                    marginBottom: '4px',
                    color: 'var(--text-secondary)',
                  }}
                >
                  <span>{t('invoices.tax')} ({taxRate}%):</span>
                  <span>
                    +{tax.toFixed(2)} {currency}
                  </span>
                </div>
              )}
              <div
                style={{
                  fontSize: '18px',
                  fontWeight: '600',
                  display: 'flex',
                  justifyContent: 'space-between',
                  borderTop: '1px solid var(--border)',
                  paddingTop: '8px',
                }}
              >
                <span>{t('common.total')}:</span>
                <span>
                  {total.toFixed(2)} {currency}
                </span>
              </div>
            </div>
          )}

          {creditWarning && (
            <div
              style={{
                marginTop: '12px',
                padding: '12px',
                background: 'var(--warning-bg, #fff3cd)',
                border: '1px solid var(--warning, #ffc107)',
                borderRadius: '4px',
                fontSize: '13px',
              }}
            >
              {creditWarning.message}
            </div>
          )}

          <div style={{ display: 'flex', gap: '12px', marginTop: '16px' }}>
            <button
              className="btn btn-secondary"
              onClick={clearCart}
              disabled={cart.length === 0}
              style={{ flex: 1 }}
            >
              {t('pos.clearCart')}
            </button>
            <button
              className="btn btn-primary"
              onClick={checkout}
              disabled={cart.length === 0}
              style={{ flex: 1 }}
            >
              {t('pos.checkout')}
            </button>
          </div>

          {lastInvoice && (
            <div style={{ display: 'flex', gap: '12px', marginTop: '12px' }}>
              <button
                className="btn btn-primary"
                onClick={handlePrint}
                style={{ flex: 1 }}
              >
                {t('pos.print')}
              </button>
              <button
                className="btn btn-secondary"
                onClick={() => setLastInvoice(null)}
                style={{ flex: 1 }}
              >
                {t('common.cancel')}
              </button>
            </div>
          )}
        </div>
      </div>

      {receiptPreviewHtml && (
        <PrintPreviewModal
          html={receiptPreviewHtml}
          title={t('printing.preview')}
          onPrint={doPrintReceipt}
          onClose={() => setReceiptPreviewHtml(null)}
        />
      )}
    </div>
  );
}
