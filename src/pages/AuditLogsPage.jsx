import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { AuditLogRepository } from '../database';

const auditRepo = AuditLogRepository;

export default function AuditLogsPage() {
  const { t } = useTranslation();
  const [logs, setLogs] = useState([]);

  useEffect(() => {
    loadLogs();
  }, []);

  const loadLogs = async () => {
    const all = await auditRepo.findAll(100);
    setLogs(all || []);
  };

  const getActionLabel = (action) => {
    const labels = {
      'create': 'إضافة',
      'update': 'تعديل',
      'delete': 'حذف',
      'stock_change': 'تغيير مخزون',
      'balance_change': 'تغيير رصيد',
      'inventory_add': 'إضافة مخزون',
      'inventory_subtract': 'سحب مخزون'
    };
    return labels[action] || action;
  };

  const getEntityLabel = (type) => {
    const labels = {
      'product': 'المنتج',
      'customer': 'العميل',
      'supplier': 'المورد',
      'invoice': 'الفاتورة'
    };
    return labels[type] || type;
  };

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">{t('audit.title')}</h1>
      </div>

      <div className="card">
        {logs.length === 0 ? (
          <div className="empty-state">{t('audit.noLogs')}</div>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>{t('common.date')}</th>
                <th>{t('audit.action')}</th>
                <th>{t('audit.entity')}</th>
                <th>ID</th>
                <th>{t('audit.oldValue')}</th>
                <th>{t('audit.newValue')}</th>
              </tr>
            </thead>
            <tbody>
              {logs.map(log => (
                <tr key={log.id}>
                  <td style={{ fontSize: '12px' }}>{new Date(log.created_at).toLocaleString('ar')}</td>
                  <td>
                    <span style={{
                      padding: '4px 8px',
                      borderRadius: '4px',
                      background: log.action === 'delete' ? 'var(--error)' : log.action === 'create' ? 'var(--success)' : 'var(--accent)',
                      color: 'white',
                      fontSize: '12px'
                    }}>
                      {getActionLabel(log.action)}
                    </span>
                  </td>
                  <td>{getEntityLabel(log.entity_type)}</td>
                  <td>{log.entity_id || '-'}</td>
                  <td style={{ fontSize: '12px', maxWidth: '150px', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {log.old_value ? JSON.stringify(JSON.parse(log.old_value)).slice(0, 50) : '-'}
                  </td>
                  <td style={{ fontSize: '12px', maxWidth: '150px', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {log.new_value ? JSON.stringify(JSON.parse(log.new_value)).slice(0, 50) : '-'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}