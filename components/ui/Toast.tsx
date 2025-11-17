'use client';

import React, { useEffect } from 'react';
import { CheckCircle, XCircle, Info, AlertCircle, X } from 'lucide-react';

export type ToastType = 'success' | 'error' | 'info' | 'warning';

export interface Toast {
  id: string;
  message: string;
  type: ToastType;
  duration?: number;
}

interface ToastProps {
  toast: Toast;
  onClose: (id: string) => void;
}

export const ToastComponent: React.FC<ToastProps> = ({ toast, onClose }) => {
  useEffect(() => {
    const timer = setTimeout(() => {
      onClose(toast.id);
    }, toast.duration || 5000);

    return () => clearTimeout(timer);
  }, [toast.id, toast.duration, onClose]);

  const icons = {
    success: <CheckCircle className="text-accent" size={20} />,
    error: <XCircle className="text-warning" size={20} />,
    info: <Info className="text-accent" size={20} />,
    warning: <AlertCircle className="text-warning" size={20} />,
  };

  const bgColors = {
    success: 'bg-accent/20 border-accent',
    error: 'bg-warning/20 border-warning',
    info: 'bg-accent/20 border-accent',
    warning: 'bg-warning/20 border-warning',
  };

  return (
    <div
      className={`
        ${bgColors[toast.type]}
        border-2 data-panel terminal-border
        p-4 mb-3 min-w-[300px] max-w-[500px]
        flex items-start gap-3
        animate-slide-in
        font-mono text-sm
      `}
    >
      <div className="flex-shrink-0 mt-0.5">{icons[toast.type]}</div>
      <div className="flex-1">
        <p className={`${toast.type === 'success' || toast.type === 'info' ? 'text-accent' : 'text-warning'} font-semibold mb-1`}>
          {toast.type === 'success' && '[SUCCESS]'}
          {toast.type === 'error' && '[ERROR]'}
          {toast.type === 'info' && '[INFO]'}
          {toast.type === 'warning' && '[WARNING]'}
        </p>
        <p className={toast.type === 'success' || toast.type === 'info' ? 'text-text' : 'text-warning'}>
          {toast.message}
        </p>
      </div>
      <button
        onClick={() => onClose(toast.id)}
        className="flex-shrink-0 text-secondary hover:text-text transition-colors"
        aria-label="Close"
      >
        <X size={18} />
      </button>
    </div>
  );
};

