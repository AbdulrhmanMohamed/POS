import { useToastStore } from '../stores/toastStore';

const ICONS = {
  success: '✓',
  error: '✕',
  warning: '⚠',
  info: 'ℹ',
};

const COLORS = {
  success: { bg: '#059669', icon: '#fff' },
  error: { bg: '#DC2626', icon: '#fff' },
  warning: { bg: '#D97706', icon: '#fff' },
  info: { bg: '#2563EB', icon: '#fff' },
};

export default function ToastContainer() {
  const { toasts, removeToast } = useToastStore();

  if (toasts.length === 0) return null;

  return (
    <div style={{
      position: 'fixed', top: '16px', left: '50%', transform: 'translateX(-50%)',
      zIndex: 9999, display: 'flex', flexDirection: 'column', gap: '8px',
      maxWidth: '420px', width: '100%', pointerEvents: 'none',
    }}>
      {toasts.map((toast) => {
        const colors = COLORS[toast.type] || COLORS.info;
        return (
          <div key={toast.id} style={{
            pointerEvents: 'auto',
            display: 'flex', alignItems: 'center', gap: '12px',
            padding: '14px 18px', borderRadius: '10px',
            background: colors.bg, color: '#fff',
            boxShadow: '0 8px 24px rgba(0,0,0,0.18)',
            fontSize: '14px', fontWeight: 500,
            animation: 'slideDown 0.3s ease',
            direction: 'ltr',
          }}>
            <span style={{
              width: '22px', height: '22px', borderRadius: '50%',
              background: 'rgba(255,255,255,0.2)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: '12px', fontWeight: 'bold', flexShrink: 0,
            }}>
              {ICONS[toast.type] || ICONS.info}
            </span>
            <span style={{ flex: 1 }}>{toast.message}</span>
            <button onClick={() => removeToast(toast.id)} style={{
              background: 'none', border: 'none', color: 'rgba(255,255,255,0.7)',
              cursor: 'pointer', fontSize: '16px', padding: '2px', lineHeight: 1,
            }}>✕</button>
          </div>
        );
      })}
    </div>
  );
}
