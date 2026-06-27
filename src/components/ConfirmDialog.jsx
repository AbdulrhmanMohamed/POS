import { useTranslation } from 'react-i18next';
import { useConfirmStore } from '../stores/confirmStore';

export default function ConfirmDialog() {
  const { t } = useTranslation();
  const { visible, message, handleConfirm, handleCancel } = useConfirmStore();

  if (!visible) return null;

  return (
    <div className="modal-overlay" onClick={handleCancel}>
      <div className="modal confirm-modal" onClick={e => e.stopPropagation()} style={{ maxWidth: '420px' }}>
        <div style={{ textAlign: 'center', padding: '8px 0' }}>
          <div style={{
            width: '48px', height: '48px', borderRadius: '50%',
            background: '#FEF3C7', display: 'flex', alignItems: 'center',
            justifyContent: 'center', margin: '0 auto 16px', fontSize: '24px',
          }}>
            ⚠
          </div>
          <p style={{ fontSize: '15px', lineHeight: 1.6, marginBottom: '24px', color: 'var(--text-primary)' }}>
            {message}
          </p>
          <div style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
            <button className="btn btn-secondary" onClick={handleCancel} style={{ minWidth: '100px' }}>
              {t('common.cancel')}
            </button>
            <button className="btn btn-danger" onClick={handleConfirm} style={{ minWidth: '100px' }}>
              {t('common.confirm')}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
