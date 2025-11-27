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
        <label className="block text-sm font-semibold text-brown-700 mb-2">
          {label}
        </label>
      )}
      <div className="relative">
        {icon && (
          <div className="absolute left-4 top-1/2 transform -translate-y-1/2 text-brown-400">
            {icon}
          </div>
        )}
        <input
          type={isPassword && showPassword ? 'text' : type}
          className={`
            w-full px-4 py-3.5 bg-brown-50 border-2 rounded-xl
            text-brown-900 placeholder:text-brown-400
            focus:outline-none focus:ring-2 focus:ring-green-500/20
            transition-all duration-300
            ${icon ? 'pl-12' : ''}
            ${isPassword ? 'pr-12' : ''}
            ${error ? 'border-orange-500 focus:border-orange-500' : 'border-brown-200 focus:border-green-500'}
            ${className}
          `}
          {...props}
        />
        {isPassword && (
          <button
            type="button"
            onClick={() => setShowPassword(!showPassword)}
            className="absolute right-4 top-1/2 transform -translate-y-1/2 text-brown-400 hover:text-brown-600 transition-colors"
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
        <p className="mt-2 text-sm text-orange-600 flex items-center gap-1">
          <span>⚠</span> {error}
        </p>
      )}
    </div>
  );
};
