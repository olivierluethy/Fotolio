import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import './index.css';
import App from './App';
import { ThemeProvider } from './context/ThemeContext';
import { ToastProvider } from './context/ToastContext';
import { AuthProvider } from './context/AuthContext';
import { ErrorBoundary } from './components/ErrorBoundary';

// Opt in to React Router v7 behaviour now so the eventual upgrade is a no-op and
// the dev console stops printing the v7 migration warnings (which otherwise hide
// real errors). Both flags are safe with the current component-based router.
const routerFuture = { v7_startTransition: true, v7_relativeSplatPath: true };

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <ErrorBoundary label="app">
      <ThemeProvider>
        <ToastProvider>
          <AuthProvider>
            <BrowserRouter future={routerFuture}>
              <App />
            </BrowserRouter>
          </AuthProvider>
        </ToastProvider>
      </ThemeProvider>
    </ErrorBoundary>
  </React.StrictMode>
);
