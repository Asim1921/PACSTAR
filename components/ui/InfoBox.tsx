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
    info: 'bg-neon-cyan/10 border-neon-cyan/30 text-neon-cyan',
    warning: 'bg-neon-orange/10 border-neon-orange/30 text-neon-orange',
    success: 'bg-neon-green/10 border-neon-green/30 text-neon-green',
  };

  const iconColors = {
    info: 'text-neon-cyan',
    warning: 'text-neon-orange',
    success: 'text-neon-green',
  };

  return (
    <div
      className={`
        flex items-start gap-3 p-4 border-2 rounded-xl backdrop-blur-sm
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
