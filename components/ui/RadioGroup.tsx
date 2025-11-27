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
        <label className="block text-sm font-semibold text-brown-700 mb-3">
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
              transition-all duration-300 text-left
              ${
                value === option.value
                  ? 'border-green-500 bg-green-50 shadow-md'
                  : 'border-brown-200 bg-white hover:border-green-300 hover:shadow-sm'
              }
            `}
          >
            <div className={`flex-shrink-0 w-5 h-5 rounded-full border-2 mr-3 mt-0.5 flex items-center justify-center ${
              value === option.value
                ? 'border-green-500 bg-green-500'
                : 'border-brown-300 bg-white'
            }`}>
              {value === option.value && (
                <div className="w-2 h-2 rounded-full bg-white" />
              )}
            </div>
            <div className="flex-1">
              <div className={`text-sm font-semibold mb-1 ${
                value === option.value ? 'text-green-700' : 'text-brown-900'
              }`}>
                {option.label}
              </div>
              {option.description && (
                <div className="text-xs text-brown-600">
                  {option.description}
                </div>
              )}
            </div>
            {value === option.value && (
              <CheckCircle className="text-green-600 flex-shrink-0 ml-2" size={20} />
            )}
          </button>
        ))}
      </div>
      {error && (
        <div className="mt-2 p-3 bg-orange-50 border-2 border-orange-200 rounded-xl">
          <p className="text-xs text-orange-700 font-medium">⚠ {error}</p>
        </div>
      )}
    </div>
  );
};
