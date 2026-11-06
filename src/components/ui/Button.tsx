import React from 'react';
import { cn } from '@/utils';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'subtle' | 'danger' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  icon?: React.ReactNode;
  iconPosition?: 'left' | 'right';
  isLoading?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      className,
      variant = 'secondary',
      size = 'md',
      icon,
      iconPosition = 'left',
      isLoading = false,
      disabled,
      children,
      ...props
    },
    ref
  ) => {
    const baseStyles =
      'inline-flex items-center justify-center font-medium rounded-btn transition-colors duration-micro select-none outline-none focus-visible:ring-2 focus-visible:ring-accent disabled:opacity-50 disabled:pointer-events-none active:scale-[0.98]';

    const variants = {
      primary: 'bg-accent text-[#111315] hover:bg-accent-hover active:bg-accent-hover font-semibold',
      secondary:
        'bg-graphite-surface-elevated text-graphite-text-primary border border-graphite-border hover:bg-graphite-hover hover:border-[#3d444d]',
      subtle:
        'bg-transparent text-graphite-text-secondary hover:text-graphite-text-primary hover:bg-graphite-hover',
      danger:
        'bg-status-error-bg text-status-error border border-status-error/30 hover:bg-status-error/25 hover:border-status-error/50',
      ghost: 'bg-transparent text-graphite-text-primary hover:bg-graphite-hover',
    };

    const sizes = {
      sm: 'h-7 px-2.5 text-xs gap-1.5',
      md: 'h-8 px-3 text-[13px] gap-2',
      lg: 'h-9 px-4 text-sm gap-2',
    };

    return (
      <button
        ref={ref}
        disabled={disabled || isLoading}
        className={cn(baseStyles, variants[variant], sizes[size], className)}
        {...props}
      >
        {isLoading ? (
          <span className="h-3.5 w-3.5 border-2 border-current border-t-transparent rounded-full animate-spin" />
        ) : (
          icon && iconPosition === 'left' && <span className="shrink-0">{icon}</span>
        )}
        {children && <span>{children}</span>}
        {!isLoading && icon && iconPosition === 'right' && <span className="shrink-0">{icon}</span>}
      </button>
    );
  }
);

Button.displayName = 'Button';

