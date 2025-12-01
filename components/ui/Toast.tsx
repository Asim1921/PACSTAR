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
    success: <CheckCircle className="text-neon-green" size={20} />,
    error: <XCircle className="text-neon-orange" size={20} />,
    info: <Info className="text-neon-cyan" size={20} />,
    warning: <AlertCircle className="text-neon-orange" size={20} />,
  };

  const bgColors = {
    success: 'bg-neon-green/10 border-neon-green/30',
    error: 'bg-neon-orange/10 border-neon-orange/30',
    info: 'bg-neon-cyan/10 border-neon-cyan/30',
    warning: 'bg-neon-orange/10 border-neon-orange/30',
  };

  const textColors = {
    success: 'text-neon-green',
    error: 'text-neon-orange',
    info: 'text-neon-cyan',
    warning: 'text-neon-orange',
  };

  return (
    <div
      className={`
        ${bgColors[toast.type]}
        bg-cyber-900/95 backdrop-blur-xl
        border-2 rounded-xl
        p-4 mb-3 min-w-[300px] max-w-[500px]
        flex items-start gap-3
        shadow-lg shadow-neon-green/20
        animate-slide-in
        terminal-border
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
        <p className="text-white/90 text-sm">
          {toast.message}
        </p>
      </div>
      <button
        onClick={() => onClose(toast.id)}
        className="flex-shrink-0 text-white/40 hover:text-white/80 transition-colors"
        aria-label="Close"
      >
        <X size={18} />
      </button>
    </div>
  );
};
