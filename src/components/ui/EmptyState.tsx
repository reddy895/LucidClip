import React from 'react';
import { cn } from '@/utils';

export interface EmptyStateProps {
  icon?: React.ReactNode;
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  icon,
  title,
  description,
  action,
  className,
}) => {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center py-16 px-6 text-center select-none',
        className
      )}
    >
      {icon && (
        <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-btn bg-graphite-surface border border-graphite-border text-graphite-text-muted">
          {icon}
        </div>
      )}
      <h4 className="text-sm font-medium text-graphite-text-primary">{title}</h4>
      {description && (
        <p className="mt-1 max-w-sm text-xs text-graphite-text-secondary leading-relaxed">
          {description}
        </p>
      )}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
};
