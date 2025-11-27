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
        <label className="block text-sm font-semibold text-brown-700 mb-2">
          {label}
        </label>
      )}
      <div className="relative">
        <select
          className={`
            w-full px-4 py-3.5 bg-brown-50 border-2 rounded-xl
            text-brown-900 appearance-none
            focus:outline-none focus:ring-2 focus:ring-green-500/20
            transition-all duration-300
            ${error ? 'border-orange-500 focus:border-orange-500' : 'border-brown-200 focus:border-green-500'}
            ${className}
          `}
          {...props}
        >
          {options.map((option) => (
            <option key={option.value} value={option.value} className="bg-white text-brown-900">
              {option.label}
            </option>
          ))}
        </select>
        <ChevronDown
          size={18}
          className="absolute right-4 top-1/2 transform -translate-y-1/2 text-brown-400 pointer-events-none"
        />
      </div>
      {error && (
        <p className="mt-2 text-sm text-orange-600 flex items-center gap-1">
          <span>⚠</span> {error}
        </p>
      )}
    </div>
  );
};
