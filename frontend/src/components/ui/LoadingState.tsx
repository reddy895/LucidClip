import React from 'react';
import { cn } from '@/utils';

export interface LoadingStateProps {
  message?: string;
  className?: string;
}

export const LoadingState: React.FC<LoadingStateProps> = ({
  message = 'Loading...',
  className,
}) => {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center py-16 px-6 text-center select-none text-graphite-text-muted',
        className
      )}
    >
      <div className="h-5 w-5 animate-spin rounded-full border-2 border-graphite-border border-t-accent" />
      <span className="mt-3 text-xs font-medium text-graphite-text-secondary">{message}</span>
    </div>
  );
};

