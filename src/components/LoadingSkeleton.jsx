export default function LoadingSkeleton({ rows = 5, cols = 4 }) {
  return (
    <div style={{ padding: '4px 0' }}>
      {Array.from({ length: rows }).map((_, r) => (
        <div key={r} style={{ display: 'flex', gap: '16px', padding: '12px 0', borderBottom: '1px solid var(--border)' }}>
          {Array.from({ length: cols }).map((_, c) => (
            <div key={c} style={{
              flex: 1, height: '16px', borderRadius: '6px',
              background: 'var(--bg-tertiary)',
              animation: 'shimmer 1.5s ease-in-out infinite',
              opacity: 0.7 - (c * 0.1),
            }} />
          ))}
        </div>
      ))}
    </div>
  );
}

export function CardSkeleton({ count = 4 }) {
  return (
    <div className="stats-grid" style={{ marginBottom: '20px' }}>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="stat-card" style={{ padding: '20px' }}>
          <div style={{
            height: '14px', width: '60%', borderRadius: '6px',
            background: 'var(--bg-tertiary)', marginBottom: '12px',
            animation: 'shimmer 1.5s ease-in-out infinite',
          }} />
          <div style={{
            height: '28px', width: '40%', borderRadius: '6px',
            background: 'var(--bg-tertiary)',
            animation: 'shimmer 1.5s ease-in-out infinite 0.2s',
          }} />
        </div>
      ))}
    </div>
  );
}
