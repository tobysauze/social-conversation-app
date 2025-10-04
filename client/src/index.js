import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import App from './App';

// Suppress ResizeObserver loop error in development
const originalConsoleError = console.error;
const originalConsoleWarn = console.warn;
const originalConsoleLog = console.log;

// Override all console methods
console.error = (...args) => {
  const message = args.join(' ');
  if (message.includes('ResizeObserver loop completed with undelivered notifications')) {
    return;
  }
  originalConsoleError.apply(console, args);
};

console.warn = (...args) => {
  const message = args.join(' ');
  if (message.includes('ResizeObserver loop completed with undelivered notifications')) {
    return;
  }
  originalConsoleWarn.apply(console, args);
};

console.log = (...args) => {
  const message = args.join(' ');
  if (message.includes('ResizeObserver loop completed with undelivered notifications')) {
    return;
  }
  originalConsoleLog.apply(console, args);
};

// Override global error handlers
window.addEventListener('error', (e) => {
  if (e.message && e.message.includes('ResizeObserver loop completed with undelivered notifications')) {
    e.stopImmediatePropagation();
    e.preventDefault();
    return false;
  }
}, true);

window.addEventListener('unhandledrejection', (e) => {
  if (e.reason && e.reason.message && e.reason.message.includes('ResizeObserver loop completed with undelivered notifications')) {
    e.preventDefault();
    return false;
  }
}, true);

// Override the global error handler
window.onerror = function(message, source, lineno, colno, error) {
  if (message && message.includes('ResizeObserver loop completed with undelivered notifications')) {
    return true; // Prevent default error handling
  }
  return false;
};

// Override React's error boundary
const originalAddEventListener = EventTarget.prototype.addEventListener;
EventTarget.prototype.addEventListener = function(type, listener, options) {
  if (type === 'error' && typeof listener === 'function') {
    const wrappedListener = function(e) {
      if (e.message && e.message.includes('ResizeObserver loop completed with undelivered notifications')) {
        e.stopImmediatePropagation();
        e.preventDefault();
        return false;
      }
      return listener.call(this, e);
    };
    return originalAddEventListener.call(this, type, wrappedListener, options);
  }
  return originalAddEventListener.call(this, type, listener, options);
};

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
