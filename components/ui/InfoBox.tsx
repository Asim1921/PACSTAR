import React from 'react';
import { Info, Lightbulb, AlertCircle } from 'lucide-react';

interface InfoBoxProps {
  type?: 'info' | 'warning' | 'success';
  icon?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}

export const InfoBox: React.FC<InfoBoxProps> = ({
  type = 'info',
  icon,
  children,
  className = '',
}) => {
  const icons = {
    info: <Info size={20} />,
    warning: <AlertCircle size={20} />,
    success: <Lightbulb size={20} />,
  };

  const styles = {
    info: 'bg-primary/20 border-primary/50 text-text',
    warning: 'bg-warning/20 border-warning/50 text-warning',
    success: 'bg-accent/20 border-accent/50 text-accent',
  };

  return (
    <div
      className={`
        flex items-start gap-3 p-3 border-2 data-panel font-mono
        ${styles[type]}
        ${className}
      `}
    >
      <div className="flex-shrink-0 mt-0.5">
        {icon || icons[type]}
      </div>
      <div className="flex-1 text-xs leading-relaxed">
        <span className={`font-semibold ${
          type === 'info' ? 'text-accent' :
          type === 'warning' ? 'text-warning' :
          'text-accent'
        }`}>
          [{type.toUpperCase()}]
        </span>{' '}
        {children}
      </div>
    </div>
  );
};

