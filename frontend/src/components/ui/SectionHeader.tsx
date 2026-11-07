import React from 'react';
import { cn } from '@/utils';

export interface SectionHeaderProps {
  title: string;
  description?: string;
  actions?: React.ReactNode;
  badge?: React.ReactNode;
  className?: string;
}

export const SectionHeader: React.FC<SectionHeaderProps> = ({
  title,
  description,
  actions,
  badge,
  className,
}) => {
  return (
    <div
      className={cn(
        'flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 pb-3 mb-3 border-b border-graphite-border-subtle',
        className
      )}
    >
      <div>
        <div className="flex items-center gap-2">
          <h2 className="text-[20px] font-semibold text-graphite-text-primary tracking-tight">
            {title}
          </h2>
          {badge}
        </div>
        {description && (
          <p className="mt-0.5 text-xs text-graphite-text-secondary leading-normal">
            {description}
          </p>
        )}
      </div>
      {actions && <div className="flex items-center gap-2 self-start sm:self-auto">{actions}</div>}
    </div>
  );
};

