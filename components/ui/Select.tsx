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
        <label className="block text-xs font-mono font-semibold text-accent mb-2 tracking-wider">
          &gt; {label.toUpperCase()}
        </label>
      )}
      <div className="relative">
        <select
          className={`
            w-full px-4 py-3 bg-secondary/20 border-2 font-mono text-sm
            text-text appearance-none
            focus:outline-none focus:border-accent focus:bg-secondary/30
            transition-all duration-300
            ${error ? 'border-warning bg-warning/10' : 'border-secondary'}
            ${!error && 'hover:border-accent/50'}
            ${className}
            input-focus
          `}
          {...props}
        >
          {options.map((option) => (
            <option key={option.value} value={option.value} className="bg-secondary font-mono">
              {option.label}
            </option>
          ))}
        </select>
        <ChevronDown
          size={18}
          className="absolute right-3 top-1/2 transform -translate-y-1/2 text-accent pointer-events-none"
        />
      </div>
      {error && (
        <div className="mt-2 p-2 bg-warning/10 border border-warning/50">
          <p className="text-xs text-warning font-mono">[ERROR] {error}</p>
        </div>
      )}
    </div>
  );
};

