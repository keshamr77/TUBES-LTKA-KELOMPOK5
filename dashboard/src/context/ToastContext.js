import { createContext, useContext, useState, useCallback } from 'react';

const ToastContext = createContext();

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);

  const addToast = useCallback((message, type = 'success') => {
    const id = Date.now();
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 3000);
  }, []);

  return (
    <ToastContext.Provider value={{ addToast }}>
      {children}
      <ToastContainer toasts={toasts} />
    </ToastContext.Provider>
  );
}

function ToastContainer({ toasts }) {
  const colors = {
    success: { bg: '#2e7d32', icon: '✓' },
    error:   { bg: '#c62828', icon: '✕' },
    info:    { bg: '#1565c0', icon: 'ℹ' },
  };

  return (
    <div style={{ position: 'fixed', bottom: '24px', right: '24px', zIndex: 9999, display: 'flex', flexDirection: 'column', gap: '8px' }}>
      {toasts.map(t => (
        <div key={t.id} style={{
          background: colors[t.type]?.bg || '#333',
          color: '#fff',
          padding: '12px 16px',
          borderRadius: '10px',
          fontSize: '13px',
          fontWeight: '500',
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          boxShadow: '0 4px 12px rgba(0,0,0,0.2)',
          animation: 'slideIn 0.2s ease',
        }}>
          <span style={{ fontSize: '16px' }}>{colors[t.type]?.icon}</span>
          {t.message}
        </div>
      ))}
    </div>
  );
}

export const useToast = () => useContext(ToastContext);