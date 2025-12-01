import React from 'react';
import { CheckCircle } from 'lucide-react';

interface RadioOption {
  value: string;
  label: string;
  description?: string;
}

interface RadioGroupProps {
  label?: string;
  options: RadioOption[];
  value: string;
  onChange: (value: string) => void;
  error?: string;
}

export const RadioGroup: React.FC<RadioGroupProps> = ({
  label,
  options,
  value,
  onChange,
  error,
}) => {
  return (
    <div className="w-full">
      {label && (
        <label className="block text-sm font-semibold text-white/90 mb-3">
          {label}
        </label>
      )}
      <div className="space-y-3">
        {options.map((option) => (
          <button
            key={option.value}
            type="button"
            onClick={() => onChange(option.value)}
            className={`
              w-full flex items-start p-4 border-2 rounded-xl
              transition-all duration-300 text-left relative overflow-hidden
              ${
                value === option.value
                  ? 'border-neon-green/50 bg-neon-green/10 shadow-lg shadow-neon-green/20'
                  : 'border-neon-green/20 bg-cyber-800/30 hover:border-neon-green/40 hover:bg-cyber-800/50'
              }
            `}
          >
            {value === option.value && (
              <div className="absolute inset-0 bg-neon-green/5 animate-pulse" />
            )}
            <div className={`flex-shrink-0 w-5 h-5 rounded-full border-2 mr-3 mt-0.5 flex items-center justify-center relative z-10 ${
              value === option.value
                ? 'border-neon-green bg-neon-green'
                : 'border-white/40 bg-cyber-800/50'
            }`}>
              {value === option.value && (
                <div className="w-2 h-2 rounded-full bg-cyber-darker" />
              )}
            </div>
            <div className="flex-1 relative z-10">
              <div className={`text-sm font-semibold mb-1 ${
                value === option.value ? 'text-neon-green' : 'text-white'
              }`}>
                {option.label}
              </div>
              {option.description && (
                <div className="text-xs text-white/60">
                  {option.description}
                </div>
              )}
            </div>
            {value === option.value && (
              <CheckCircle className="text-neon-green flex-shrink-0 ml-2 relative z-10" size={20} />
            )}
          </button>
        ))}
      </div>
      {error && (
        <div className="mt-2 p-3 bg-neon-orange/10 border-2 border-neon-orange/30 rounded-xl">
          <p className="text-xs text-neon-orange font-medium">⚠ {error}</p>
        </div>
      )}
    </div>
  );
};
