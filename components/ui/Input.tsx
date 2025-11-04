import React, { useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  icon?: React.ReactNode;
}

export const Input: React.FC<InputProps> = ({
  label,
  error,
  icon,
  type = 'text',
  className = '',
  ...props
}) => {
  const [showPassword, setShowPassword] = useState(false);
  const isPassword = type === 'password';

  return (
    <div className="w-full">
      {label && (
        <label className="block text-xs font-mono font-semibold text-accent mb-2 tracking-wider">
          &gt; {label.toUpperCase()}
        </label>
      )}
      <div className="relative">
        {icon && (
          <div className="absolute left-3 top-1/2 transform -translate-y-1/2 text-accent">
            {icon}
          </div>
        )}
        <input
          type={isPassword && showPassword ? 'text' : type}
          className={`
            w-full px-4 py-3 bg-secondary/20 border-2 font-mono text-sm
            text-text placeholder:text-secondary/50
            focus:outline-none focus:border-accent focus:bg-secondary/30
            transition-all duration-300
            ${icon ? 'pl-10' : ''}
            ${isPassword ? 'pr-10' : ''}
            ${error ? 'border-warning bg-warning/10' : 'border-secondary'}
            ${!error && 'hover:border-accent/50'}
            ${className}
            input-focus
          `}
          {...props}
        />
        {isPassword && (
          <button
            type="button"
            onClick={() => setShowPassword(!showPassword)}
            className="absolute right-3 top-1/2 transform -translate-y-1/2 text-secondary hover:text-accent transition-colors"
          >
            {showPassword ? (
              <EyeOff size={18} />
            ) : (
              <Eye size={18} />
            )}
          </button>
        )}
      </div>
      {error && (
        <div className="mt-2 p-2 bg-warning/10 border border-warning/50">
          <p className="text-xs text-warning font-mono">[ERROR] {error}</p>
        </div>
      )}
    </div>
  );
};

