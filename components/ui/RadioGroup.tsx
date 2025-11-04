import React from 'react';

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
        <label className="block text-xs font-mono font-semibold text-accent mb-3 tracking-wider">
          &gt; {label.toUpperCase()}
        </label>
      )}
      <div className="space-y-2">
        {options.map((option) => (
          <label
            key={option.value}
            className={`
              flex items-start p-3 border-2 cursor-pointer data-panel
              transition-all duration-300 font-mono
              ${
                value === option.value
                  ? 'border-accent bg-accent/10 glow-accent'
                  : 'border-secondary bg-secondary/20 hover:border-accent/50'
              }
            `}
          >
            <input
              type="radio"
              value={option.value}
              checked={value === option.value}
              onChange={(e) => onChange(e.target.value)}
              className="mt-1 mr-3 w-4 h-4 text-accent focus:ring-accent focus:ring-2 accent-accent"
            />
            <div className="flex-1">
              <div className={`text-sm font-semibold ${value === option.value ? 'text-accent' : 'text-text'}`}>
                [{option.value.toUpperCase()}] {option.label}
              </div>
              {option.description && (
                <div className="text-xs text-secondary mt-1 font-normal">
                  {option.description}
                </div>
              )}
            </div>
          </label>
        ))}
      </div>
      {error && (
        <div className="mt-2 p-2 bg-warning/10 border border-warning/50">
          <p className="text-xs text-warning font-mono">[ERROR] {error}</p>
        </div>
      )}
    </div>
  );
};

