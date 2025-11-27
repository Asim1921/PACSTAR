import React from 'react';
import { Info, Lightbulb, AlertCircle, CheckCircle } from 'lucide-react';

interface InfoBoxProps {
  type?: 'info' | 'warning' | 'success';
  icon?: React.ReactNode;
  children?: React.ReactNode;
  message?: string;
  className?: string;
}

export const InfoBox: React.FC<InfoBoxProps> = ({
  type = 'info',
  icon,
  children,
  message,
  className = '',
}) => {
  const icons = {
    info: <Lightbulb size={20} />,
    warning: <AlertCircle size={20} />,
    success: <CheckCircle size={20} />,
  };

  const styles = {
    info: 'bg-green-50 border-green-200 text-green-700',
    warning: 'bg-orange-50 border-orange-200 text-orange-700',
    success: 'bg-green-50 border-green-200 text-green-700',
  };

  const iconColors = {
    info: 'text-green-600',
    warning: 'text-orange-600',
    success: 'text-green-600',
  };

  return (
    <div
      className={`
        flex items-start gap-3 p-4 border-2 rounded-xl
        ${styles[type]}
        ${className}
      `}
    >
      <div className={`flex-shrink-0 mt-0.5 ${iconColors[type]}`}>
        {icon || icons[type]}
      </div>
      <div className="flex-1 text-sm leading-relaxed">
        {message || children}
      </div>
    </div>
  );
};
