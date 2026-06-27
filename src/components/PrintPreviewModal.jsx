import { useRef } from 'react';
import { useTranslation } from 'react-i18next';

export default function PrintPreviewModal({ html, title, printLabel, onPrint, onClose }) {
  const { t } = useTranslation();
  const iframeRef = useRef(null);

  if (!html) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal modal-lg" onClick={e => e.stopPropagation()} style={{ maxWidth: '500px' }}>
        <div className="modal-header">
          <h3 className="modal-title">{title || t('printing.preview')}</h3>
        </div>
        <div
          style={{
            background: '#fff',
            borderRadius: '4px',
            margin: '8px 0',
            overflow: 'auto',
            maxHeight: '480px',
            display: 'flex',
            justifyContent: 'center',
          }}
        >
          <iframe
            ref={iframeRef}
            srcDoc={html}
            title={title || 'Preview'}
            style={{ width: '100%', border: 'none', background: '#fff', maxWidth: '400px' }}
            onLoad={(e) => {
              const doc = e.target.contentDocument;
              if (doc && doc.body) {
                e.target.style.height = Math.min(doc.body.scrollHeight, 460) + 'px';
              }
            }}
          />
        </div>
        <div className="form-actions">
          <button className="btn btn-secondary" onClick={onClose}>{t('common.cancel')}</button>
          <button className="btn btn-primary" onClick={onPrint}>🖨️ {printLabel || t('pos.print')}</button>
        </div>
      </div>
    </div>
  );
}