export default function Pagination({ page, totalPages, onChange }) {
  if (totalPages <= 1) return null;

  const pages = [];
  const start = Math.max(1, page - 2);
  const end = Math.min(totalPages, page + 2);

  for (let i = start; i <= end; i++) {
    pages.push(i);
  }

  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      gap: '6px', padding: '16px 0', direction: 'ltr',
    }}>
      <button
        className="btn btn-secondary"
        disabled={page <= 1}
        onClick={() => onChange(page - 1)}
        style={{ padding: '6px 12px', fontSize: '13px' }}
      >
        ‹
      </button>
      {start > 1 && (
        <>
          <button className="btn btn-secondary" onClick={() => onChange(1)} style={{ padding: '6px 12px', fontSize: '13px' }}>1</button>
          {start > 2 && <span style={{ color: 'var(--text-secondary)', padding: '0 4px' }}>...</span>}
        </>
      )}
      {pages.map(i => (
        <button
          key={i}
          className={i === page ? 'btn-primary' : 'btn-secondary'}
          onClick={() => onChange(i)}
          style={{
            padding: '6px 12px', fontSize: '13px',
            background: i === page ? 'var(--accent)' : undefined,
            color: i === page ? '#fff' : undefined,
            border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: i === page ? 600 : 400,
          }}
        >
          {i}
        </button>
      ))}
      {end < totalPages && (
        <>
          {end < totalPages - 1 && <span style={{ color: 'var(--text-secondary)', padding: '0 4px' }}>...</span>}
          <button className="btn btn-secondary" onClick={() => onChange(totalPages)} style={{ padding: '6px 12px', fontSize: '13px' }}>{totalPages}</button>
        </>
      )}
      <button
        className="btn btn-secondary"
        disabled={page >= totalPages}
        onClick={() => onChange(page + 1)}
        style={{ padding: '6px 12px', fontSize: '13px' }}
      >
        ›
      </button>
    </div>
  );
}
