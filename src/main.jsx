import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import ErrorBoundary from './components/ErrorBoundary'
import { useToastStore } from './stores/toastStore'
import './i18n'
import './styles/index.css'

window.addEventListener('unhandledrejection', (event) => {
  console.error('Unhandled rejection:', event.reason);
  const msg = event.reason?.message || event.reason || 'Unknown error';
  useToastStore.getState().addToast(msg, 'error');
  event.preventDefault();
});

window.addEventListener('error', (event) => {
  console.error('Global error:', event.error || event.message);
  const msg = event.error?.message || event.message || 'Unknown error';
  useToastStore.getState().addToast(msg, 'error');
});

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </React.StrictMode>,
)
