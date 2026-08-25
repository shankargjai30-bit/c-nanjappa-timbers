import React from 'react';
import { useApp } from '../../context/AppContext';
import { CheckCircle2, AlertCircle, AlertTriangle, Info, X } from 'lucide-react';
import './ToastContainer.css';

export const ToastContainer: React.FC = () => {
  const { toasts, removeToast } = useApp();

  if (!toasts || toasts.length === 0) return null;

  const getIcon = (type: string) => {
    switch (type) {
      case 'success':
        return <CheckCircle2 className="global-toast-icon success" size={20} />;
      case 'error':
        return <AlertCircle className="global-toast-icon error" size={20} />;
      case 'warning':
        return <AlertTriangle className="global-toast-icon warning" size={20} />;
      case 'info':
      default:
        return <Info className="global-toast-icon info" size={20} />;
    }
  };

  return (
    <div className="global-toast-viewport" role="region" aria-label="Notifications" aria-live="polite">
      {toasts.map((toast) => (
        <div 
          key={toast.id} 
          className={`global-toast-card ${toast.type}`}
          role="alert"
        >
          <div className="global-toast-icon-wrapper">
            {getIcon(toast.type)}
          </div>
          <div className="global-toast-content">
            <span className="global-toast-message">{toast.message}</span>
          </div>
          <button 
            type="button"
            className="global-toast-close"
            onClick={() => removeToast(toast.id)}
            aria-label="Close notification"
          >
            <X size={16} />
          </button>
        </div>
      ))}
    </div>
  );
};
