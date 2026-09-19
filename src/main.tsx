import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import { ErrorBoundary } from './components/common/ErrorBoundary';
import './index.css';

// Global uncaught error shields for Mobile APKs & WebViews
if (typeof window !== 'undefined') {
  window.addEventListener('error', (event) => {
    console.warn('[Motoride Mobile Global Error Handled]:', event.message, event.error);
  });

  window.addEventListener('unhandledrejection', (event) => {
    console.warn('[Motoride Mobile Promise Rejection Handled]:', event.reason);
  });
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>,
);

