import React from 'react';
import { cn } from '@/utils';

export interface IconButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'subtle' | 'danger' | 'ghost';
  size?: 'xs' | 'sm' | 'md' | 'lg';
  active?: boolean;
  'aria-label': string;
}

export const IconButton = React.forwardRef<HTMLButtonElement, IconButtonProps>(
  (
    {
      className,
      variant = 'ghost',
      size = 'sm',
      active = false,
      disabled,
      children,
      ...props
    },
    ref
  ) => {
    const baseStyles =
      'inline-flex items-center justify-center rounded-btn transition-colors duration-micro select-none outline-none focus-visible:ring-2 focus-visible:ring-accent disabled:opacity-40 disabled:pointer-events-none shrink-0';

    const variants = {
      primary: 'bg-accent text-[#111315] hover:bg-accent-hover',
      secondary:
        'bg-graphite-surface-elevated text-graphite-text-secondary hover:text-graphite-text-primary border border-graphite-border hover:bg-graphite-hover hover:border-[#3d444d]',
      subtle:
        'bg-transparent text-graphite-text-secondary hover:text-graphite-text-primary hover:bg-graphite-hover',
      danger:
        'bg-transparent text-graphite-text-secondary hover:text-status-error hover:bg-status-error-bg',
      ghost: cn(
        'bg-transparent text-graphite-text-secondary hover:text-graphite-text-primary hover:bg-graphite-hover',
        active && 'bg-graphite-hover text-accent'
      ),
    };

    const sizes = {
      xs: 'h-6 w-6 text-xs p-1',
      sm: 'h-7 w-7 text-sm p-1.5',
      md: 'h-8 w-8 text-sm p-2',
      lg: 'h-9 w-9 text-base p-2.5',
    };

    return (
      <button
        ref={ref}
        disabled={disabled}
        className={cn(baseStyles, variants[variant], sizes[size], className)}
        {...props}
      >
        {children}
      </button>
    );
  }
);

IconButton.displayName = 'IconButton';

