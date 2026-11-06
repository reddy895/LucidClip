import React from 'react';
import { cn } from '@/utils';

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: 'default' | 'accent' | 'success' | 'warning' | 'error' | 'code' | 'subtle';
  size?: 'sm' | 'md';
}

export const Badge: React.FC<BadgeProps> = ({
  variant = 'default',
  size = 'md',
  className,
  children,
  ...props
}) => {
  const base =
    'inline-flex items-center justify-center font-medium rounded-badge transition-colors select-none shrink-0';

  const variants = {
    default:
      'bg-graphite-surface-elevated text-graphite-text-secondary border border-graphite-border',
    accent:
      'bg-accent-muted text-accent border border-accent-border font-semibold',
    success:
      'bg-status-success-bg text-status-success border border-status-success/30',
    warning:
      'bg-status-warning-bg text-status-warning border border-status-warning/30',
    error:
      'bg-status-error-bg text-status-error border border-status-error/30',
    code:
      'bg-[#151719] text-graphite-text-muted border border-graphite-border-subtle font-mono text-[11px]',
    subtle:
      'bg-transparent text-graphite-text-muted border border-transparent',
  };

  const sizes = {
    sm: 'text-[10px] px-1.5 py-0.5 leading-none',
    md: 'text-[11px] px-2 py-0.5 leading-tight',
  };

  return (
    <span className={cn(base, variants[variant], sizes[size], className)} {...props}>
      {children}
    </span>
  );
};

