import React from 'react';
import { cn } from '@/utils';

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  error?: string;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, leftIcon, rightIcon, error, disabled, ...props }, ref) => {
    return (
      <div className="relative flex w-full items-center">
        {leftIcon && (
          <span className="absolute left-2.5 flex items-center justify-center text-graphite-text-muted pointer-events-none">
            {leftIcon}
          </span>
        )}
        <input
          ref={ref}
          disabled={disabled}
          className={cn(
            'h-8 w-full rounded-input bg-graphite-surface px-3 text-[13px] text-graphite-text-primary placeholder:text-graphite-text-muted border border-graphite-border transition-colors duration-micro outline-none focus:border-accent focus:bg-graphite-surface-elevated disabled:opacity-50 disabled:pointer-events-none',
            leftIcon && 'pl-8',
            rightIcon && 'pr-8',
            error && 'border-status-error focus:border-status-error',
            className
          )}
          {...props}
        />
        {rightIcon && (
          <span className="absolute right-2.5 flex items-center justify-center text-graphite-text-muted">
            {rightIcon}
          </span>
        )}
      </div>
    );
  }
);

Input.displayName = 'Input';
