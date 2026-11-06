import React from 'react';
import { cn } from '@/utils';
import { Tooltip } from '@/components/ui';

export interface SidebarItemProps {
  id: string;
  label: string;
  icon: React.ReactNode;
  count?: number;
  isActive: boolean;
  isCollapsed?: boolean;
  shortcut?: string;
  onClick: () => void;
}

export const SidebarItem: React.FC<SidebarItemProps> = ({
  label,
  icon,
  count,
  isActive,
  isCollapsed = false,
  shortcut,
  onClick,
}) => {
  const content = (
    <button
      type="button"
      onClick={onClick}
      aria-current={isActive ? 'page' : undefined}
      className={cn(
        'group flex h-8 w-full items-center rounded-btn px-2 text-[13px] font-normal transition-colors duration-micro outline-none select-none text-left',
        isCollapsed ? 'justify-center px-0' : 'justify-between',
        isActive
          ? 'bg-graphite-surface-elevated text-[#F3F4F6] font-medium border border-graphite-border shadow-sm'
          : 'text-graphite-text-secondary hover:text-graphite-text-primary hover:bg-graphite-hover border border-transparent'
      )}
    >
      <div className={cn('flex items-center gap-2.5 min-w-0', isCollapsed && 'justify-center')}>
        <span
          className={cn(
            'flex h-4 w-4 shrink-0 items-center justify-center transition-colors',
            isActive ? 'text-accent' : 'text-graphite-text-muted group-hover:text-graphite-text-secondary'
          )}
        >
          {icon}
        </span>
        {!isCollapsed && <span className="truncate">{label}</span>}
      </div>

      {!isCollapsed && count !== undefined && count > 0 && (
        <span
          className={cn(
            'ml-2 shrink-0 rounded px-1.5 py-0.2 text-[10px] font-mono leading-tight',
            isActive
              ? 'bg-[#151719] text-accent'
              : 'text-graphite-text-muted group-hover:text-graphite-text-secondary'
          )}
        >
          {count}
        </span>
      )}
    </button>
  );

  if (isCollapsed) {
    return (
      <Tooltip content={label} shortcut={shortcut} side="right">
        {content}
      </Tooltip>
    );
  }

  return content;
};
