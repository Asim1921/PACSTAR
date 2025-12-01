import React from 'react';
import { ChevronDown } from 'lucide-react';

interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  error?: string;
  options: { value: string; label: string }[];
}

export const Select: React.FC<SelectProps> = ({
  label,
  error,
  options,
  className = '',
  ...props
}) => {
  return (
    <div className="w-full">
      {label && (
        <label className="block text-sm font-semibold text-white/90 mb-2">
          {label}
        </label>
      )}
      <div className="relative group">
        <select
          className={`
            w-full px-4 py-3.5 bg-cyber-800/50 border-2 rounded-xl
            text-white appearance-none
            focus:outline-none focus:ring-4 focus:ring-neon-green/20
            transition-all duration-300
            ${error ? 'border-neon-orange/50 focus:border-neon-orange' : 'border-neon-green/20 focus:border-neon-green'}
            ${className}
          `}
          {...props}
        >
          {options.map((option) => (
            <option key={option.value} value={option.value} className="bg-cyber-900 text-white">
              {option.label}
            </option>
          ))}
        </select>
        <ChevronDown
          size={18}
          className="absolute right-4 top-1/2 transform -translate-y-1/2 text-white/40 pointer-events-none"
        />
      </div>
      {error && (
        <p className="mt-2 text-sm text-neon-orange flex items-center gap-1">
          <span>⚠</span> {error}
        </p>
      )}
    </div>
  );
};
