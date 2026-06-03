import { createContext, useContext, useState, useCallback } from 'react'

const ToastContext = createContext(null)

export function useToast() {
  return useContext(ToastContext)
}

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([])

  const showToast = useCallback((message, type = 'info') => {
    const id = Date.now() + Math.random().toString(36).substring(2, 9)
    setToasts(t => [...t, { id, message, type }])
    
    // Auto-remove after 4 seconds
    setTimeout(() => {
      setToasts(t => t.filter(toast => toast.id !== id))
    }, 4000)
  }, [])

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      <div className="toast-container">
        {toasts.map(toast => (
          <div key={toast.id} className={`toast toast-${toast.type}`}>
            <div className="toast-content">
              {toast.type === 'success' && (
                <svg className="toast-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
                  <path d="M20 6 9 17l-5-5"/>
                </svg>
              )}
              {toast.type === 'error' && (
                <svg className="toast-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
                  <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
                </svg>
              )}
              {toast.type === 'info' && (
                <svg className="toast-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
                  <circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="8" y1="12" x2="12" y2="12"/>
                </svg>
              )}
              <span className="toast-message">{toast.message}</span>
            </div>
            <button className="toast-close" onClick={() => setToasts(t => t.filter(x => x.id !== toast.id))}>✕</button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}
