import { Component } from 'react';

export default class ErrorBoundary extends Component {
  state = { error: null };

  static getDerivedStateFromError(error) {
    return { error };
  }

  render() {
    if (this.state.error) {
      return (
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          minHeight: '100vh', background: 'var(--bg-secondary)',
          padding: '40px', textAlign: 'center',
        }}>
          <div style={{ maxWidth: '480px' }}>
            <div style={{ fontSize: '48px', marginBottom: '16px' }}>⚠</div>
            <h2 style={{ marginBottom: '12px', color: 'var(--text-primary)' }}>
              Something went wrong
            </h2>
            <p style={{ color: 'var(--text-secondary)', marginBottom: '24px', fontSize: '14px', lineHeight: 1.6, direction: 'ltr' }}>
              {this.state.error?.message || 'An unexpected error occurred'}
            </p>
            <button
              className="btn btn-primary"
              onClick={() => { this.setState({ error: null }); window.location.reload(); }}
            >
              Reload App
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
