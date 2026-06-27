import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import Pagination from '../components/Pagination';

export default function CashRegisterPage() {
  const { t } = useTranslation();
  const [registers, setRegisters] = useState([]);
  const [openRegister, setOpenRegister] = useState(null);
  const [showOpenModal, setShowOpenModal] = useState(false);
  const [showCloseModal, setShowCloseModal] = useState(false);
  const [showMovementModal, setShowMovementModal] = useState(false);
  const [movementType, setMovementType] = useState('in');
  const [openingAmount, setOpeningAmount] = useState('');
  const [closingAmount, setClosingAmount] = useState('');
  const [movementAmount, setMovementAmount] = useState('');
  const [movementReason, setMovementReason] = useState('');
  const [movements, setMovements] = useState([]);
  const [movementPage, setMovementPage] = useState(1);
  const movementPageSize = 10;

  useEffect(() => {
    loadRegisters();
  }, []);

  const loadRegisters = async () => {
    const all = await window.electronAPI.db.all('SELECT * FROM cash_registers ORDER BY id DESC');
    setRegisters(all || []);
    const open = all ? all.find(r => r.status === 'open') : null;
    setOpenRegister(open);
    if (open) loadMovements(open.id);
  };

  const loadMovements = async (registerId) => {
    const m = await window.electronAPI.db.all(
      'SELECT * FROM cashier_movements WHERE register_id = ? ORDER BY id',
      [registerId]
    );
    setMovements(m || []);
  };

  const calcCurrentBalance = () => {
    if (!openRegister) return 0;
    let bal = Number(openRegister.opening_balance);
    for (const m of movements) {
      bal += m.type === 'in' ? Number(m.amount) : -Number(m.amount);
    }
    return bal;
  };

  const handleOpenRegister = async () => {
    await window.electronAPI.db.run(
      'INSERT INTO cash_registers (opening_balance, status) VALUES (?, ?)',
      [parseFloat(openingAmount) || 0, 'open']
    );
    setShowOpenModal(false);
    setOpeningAmount('');
    loadRegisters();
  };

  const handleCloseRegister = async () => {
    if (!openRegister) return;
    const expected = calcCurrentBalance();
    const actual = parseFloat(closingAmount) || expected;
    const diff = Math.abs(actual - expected);
    if (diff > 0 && diff / (expected || 1) > 0.1) {
      if (!confirm(t('cashRegister.largeDifferenceWarning'))) return;
    }
    await window.electronAPI.db.run(
      "UPDATE cash_registers SET closing_balance = ?, status = ?, closed_at = datetime('now') WHERE id = ?",
      [parseFloat(closingAmount) || calcCurrentBalance(), 'closed', openRegister.id]
    );
    setShowCloseModal(false);
    setClosingAmount('');
    loadRegisters();
  };

  const handleAddMovement = async () => {
    if (!openRegister) return;
    await window.electronAPI.db.run(
      'INSERT INTO cashier_movements (register_id, type, amount, reason) VALUES (?, ?, ?, ?)',
      [openRegister.id, movementType, parseFloat(movementAmount) || 0, movementReason || '']
    );
    setShowMovementModal(false);
    setMovementAmount('');
    setMovementReason('');
    loadRegisters();
  };

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">{t('cashRegister.title')}</h1>
        {openRegister ? (
          <div style={{ display: 'flex', gap: '8px' }}>
            <button className="btn btn-secondary" onClick={() => { setMovementType('in'); setShowMovementModal(true); }}>{t('cashRegister.cashIn')}</button>
            <button className="btn btn-secondary" onClick={() => { setMovementType('out'); setShowMovementModal(true); }}>{t('cashRegister.cashOut')}</button>
            <button className="btn btn-danger" onClick={() => setShowCloseModal(true)}>{t('cashRegister.closeRegister')}</button>
          </div>
        ) : (
          <button className="btn btn-primary" onClick={() => setShowOpenModal(true)}>{t('cashRegister.openRegister')}</button>
        )}
      </div>

      {openRegister && (
        <div className="stats-grid">
          <div className="stat-card">
            <span className="stat-value">{Number(openRegister.opening_balance).toFixed(2)}</span>
            <span className="stat-label">{t('cashRegister.openingBalance')}</span>
          </div>
          <div className="stat-card" style={{ background: 'var(--success-light)' }}>
            <span className="stat-value" style={{ color: 'var(--success)' }}>{calcCurrentBalance().toFixed(2)}</span>
            <span className="stat-label">{t('cashRegister.currentBalance')}</span>
          </div>
          <div className="stat-card">
            <span className="stat-value" style={{ fontSize: '14px' }}>{new Date(openRegister.opened_at).toLocaleString('ar')}</span>
            <span className="stat-label">{t('cashRegister.shiftOpen')}</span>
          </div>
        </div>
      )}

      <div className="card">
        <h3 style={{ marginBottom: '12px' }}>{t('cashRegister.history')}</h3>
        {registers.length === 0 ? (
          <div className="empty-state">{t('common.noResults')}</div>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>{t('common.date')}</th>
                <th>{t('common.status')}</th>
                <th>{t('cashRegister.openingBalance')}</th>
                <th>{t('cashRegister.closingBalance')}</th>
                <th>{t('common.notes')}</th>
              </tr>
            </thead>
            <tbody>
              {registers.map(r => (
                <tr key={r.id}>
                  <td>{r.opened_at ? new Date(r.opened_at).toLocaleString('ar') : '-'}</td>
                  <td>{r.status === 'open' ? t('cashRegister.shiftOpen') : t('cashRegister.shiftClosed')}</td>
                  <td>{Number(r.opening_balance).toFixed(2)}</td>
                  <td>{r.closing_balance != null ? Number(r.closing_balance).toFixed(2) : '-'}</td>
                  <td>{r.notes || '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {openRegister && movements.length > 0 && (
        <div className="card" style={{ marginTop: '16px' }}>
          <h3 style={{ marginBottom: '12px' }}>{t('cashRegister.movements')}</h3>
          <table className="table">
            <thead>
              <tr>
                <th>{t('common.date')}</th>
                <th>{t('common.type')}</th>
                <th>{t('common.amount')}</th>
                <th>{t('cashRegister.movementReason')}</th>
              </tr>
            </thead>
            <tbody>
              {movements.slice((movementPage - 1) * movementPageSize, movementPage * movementPageSize).map(m => (
                <tr key={m.id}>
                  <td>{new Date(m.created_at).toLocaleString('ar')}</td>
                  <td style={{ color: m.type === 'in' ? 'var(--success)' : 'var(--error)' }}>{m.type === 'in' ? t('cashRegister.cashIn') : t('cashRegister.cashOut')}</td>
                  <td>{Number(m.amount).toFixed(2)}</td>
                  <td>{m.reason || '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {movements.length > movementPageSize && (
            <div style={{ display: 'flex', justifyContent: 'center', marginTop: '12px' }}>
              <button className="btn btn-secondary" disabled={movementPage <= 1} onClick={() => setMovementPage(p => p - 1)}>Previous</button>
              <span style={{ padding: '0 12px', alignSelf: 'center' }}>{movementPage} / {Math.ceil(movements.length / movementPageSize)}</span>
              <button className="btn btn-secondary" disabled={movementPage >= Math.ceil(movements.length / movementPageSize)} onClick={() => setMovementPage(p => p + 1)}>Next</button>
            </div>
          )}
        </div>
      )}

      {showOpenModal && (
        <div className="modal-overlay" onClick={() => setShowOpenModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="modal-title">{t('cashRegister.openRegister')}</h3>
              <button onClick={() => setShowOpenModal(false)}>×</button>
            </div>
            <div className="form-group">
              <label className="form-label">{t('cashRegister.openingBalance')}</label>
              <input className="input" type="number" step="0.01" value={openingAmount} onChange={e => setOpeningAmount(e.target.value)} placeholder="0" />
            </div>
            <div className="form-actions">
              <button className="btn btn-secondary" onClick={() => setShowOpenModal(false)}>{t('common.cancel')}</button>
              <button className="btn btn-primary" onClick={handleOpenRegister}>{t('cashRegister.openRegister')}</button>
            </div>
          </div>
        </div>
      )}

      {showCloseModal && (
        <div className="modal-overlay" onClick={() => setShowCloseModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="modal-title">{t('cashRegister.closeRegister')}</h3>
              <button onClick={() => setShowCloseModal(false)}>×</button>
            </div>
            <div className="form-group">
              <label className="form-label">{t('cashRegister.expectedBalance')}</label>
              <div style={{ padding: '12px', background: 'var(--bg-secondary)', borderRadius: '4px', fontSize: '18px', fontWeight: 'bold', textAlign: 'center' }}>
                {calcCurrentBalance().toFixed(2)}
              </div>
            </div>
            <div className="form-group">
              <label className="form-label">{t('cashRegister.actualBalance')}</label>
              <input className="input" type="number" step="0.01" value={closingAmount} onChange={e => setClosingAmount(e.target.value)} placeholder={String(calcCurrentBalance())} />
            </div>
            {closingAmount && (
              <div style={{
                padding: '12px',
                borderRadius: '4px',
                marginBottom: '12px',
                background: parseFloat(closingAmount) !== calcCurrentBalance() ? '#fff3cd' : '#d4edda',
                border: `1px solid ${parseFloat(closingAmount) !== calcCurrentBalance() ? '#ffc107' : '#28a745'}`,
                textAlign: 'center'
              }}>
                <strong>{t('cashRegister.difference')}: </strong>
                <span style={{
                  color: parseFloat(closingAmount) !== calcCurrentBalance() ? 'var(--error)' : 'var(--success)',
                  fontWeight: 'bold',
                  fontSize: '16px'
                }}>
                  {(parseFloat(closingAmount) - calcCurrentBalance()).toFixed(2)}
                </span>
              </div>
            )}
            <div className="form-actions">
              <button className="btn btn-secondary" onClick={() => setShowCloseModal(false)}>{t('common.cancel')}</button>
              <button className="btn btn-danger" onClick={handleCloseRegister}>{t('cashRegister.closeRegister')}</button>
            </div>
          </div>
        </div>
      )}

      {showMovementModal && (
        <div className="modal-overlay" onClick={() => setShowMovementModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="modal-title">{movementType === 'in' ? t('cashRegister.cashIn') : t('cashRegister.cashOut')}</h3>
              <button onClick={() => setShowMovementModal(false)}>×</button>
            </div>
            <div className="form-group">
              <label className="form-label">{t('common.amount')}</label>
              <input className="input" type="number" step="0.01" value={movementAmount} onChange={e => setMovementAmount(e.target.value)} placeholder="0" />
            </div>
            <div className="form-group">
              <label className="form-label">{t('cashRegister.movementReason')}</label>
              <input className="input" value={movementReason} onChange={e => setMovementReason(e.target.value)} placeholder={t('common.description')} />
            </div>
            <div className="form-actions">
              <button className="btn btn-secondary" onClick={() => setShowMovementModal(false)}>{t('common.cancel')}</button>
              <button className="btn btn-primary" onClick={handleAddMovement}>{t('common.save')}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
