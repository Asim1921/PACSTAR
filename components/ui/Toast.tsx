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
    success: <CheckCircle className="text-green-600" size={20} />,
    error: <XCircle className="text-orange-600" size={20} />,
    info: <Info className="text-green-600" size={20} />,
    warning: <AlertCircle className="text-orange-600" size={20} />,
  };

  const bgColors = {
    success: 'bg-green-50 border-green-200',
    error: 'bg-orange-50 border-orange-200',
    info: 'bg-green-50 border-green-200',
    warning: 'bg-orange-50 border-orange-200',
  };

  const textColors = {
    success: 'text-green-700',
    error: 'text-orange-700',
    info: 'text-green-700',
    warning: 'text-orange-700',
  };

  return (
    <div
      className={`
        ${bgColors[toast.type]}
        border-2 rounded-xl
        p-4 mb-3 min-w-[300px] max-w-[500px]
        flex items-start gap-3
        shadow-lg
        animate-slide-in
        bg-white
      `}
    >
      <div className="flex-shrink-0 mt-0.5">{icons[toast.type]}</div>
      <div className="flex-1">
        <p className={`${textColors[toast.type]} font-semibold mb-1 text-sm`}>
          {toast.type === 'success' && 'Success'}
          {toast.type === 'error' && 'Error'}
          {toast.type === 'info' && 'Info'}
          {toast.type === 'warning' && 'Warning'}
        </p>
        <p className={`${textColors[toast.type]} text-sm`}>
          {toast.message}
        </p>
      </div>
      <button
        onClick={() => onClose(toast.id)}
        className="flex-shrink-0 text-brown-400 hover:text-brown-600 transition-colors"
        aria-label="Close"
      >
        <X size={18} />
      </button>
    </div>
  );
};
