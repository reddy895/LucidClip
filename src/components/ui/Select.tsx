import React from 'react';
import { ChevronDown } from 'lucide-react';
import { cn } from '@/utils';

export interface SelectOption {
  value: string;
  label: string;
}

export interface SelectProps extends Omit<React.SelectHTMLAttributes<HTMLSelectElement>, 'onChange'> {
  options: SelectOption[];
  value: string;
  onChange: (value: string) => void;
  className?: string;
}

export const Select = React.forwardRef<HTMLSelectElement, SelectProps>(
  ({ options, value, onChange, className, disabled, ...props }, ref) => {
    return (
      <div className="relative inline-flex items-center">
        <select
          ref={ref}
          value={value}
          disabled={disabled}
          onChange={(e) => onChange(e.target.value)}
          className={cn(
            'h-8 w-full appearance-none rounded-input bg-graphite-surface pl-3 pr-8 text-[13px] text-graphite-text-primary border border-graphite-border transition-colors duration-micro outline-none focus:border-accent focus:bg-graphite-surface-elevated disabled:opacity-40 disabled:pointer-events-none cursor-pointer',
            className
          )}
          {...props}
        >
          {options.map((option) => (
            <option
              key={option.value}
              value={option.value}
              className="bg-[#22262B] text-[#F3F4F6] py-1"
            >
              {option.label}
            </option>
          ))}
        </select>
        <ChevronDown className="pointer-events-none absolute right-2.5 h-3.5 w-3.5 text-graphite-text-muted" />
      </div>
    );
  }
);

Select.displayName = 'Select';
