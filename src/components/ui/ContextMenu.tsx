import React, { useEffect, useRef } from 'react';
import { cn } from '@/utils';

export interface ContextMenuItem {
  id: string;
  label: string;
  icon?: React.ReactNode;
  shortcut?: string;
  isDanger?: boolean;
  isDivider?: boolean;
  disabled?: boolean;
  onClick?: () => void;
}

export interface ContextMenuProps {
  isOpen: boolean;
  position: { x: number; y: number };
  items: ContextMenuItem[];
  onClose: () => void;
  className?: string;
}

export const ContextMenu: React.FC<ContextMenuProps> = ({
  isOpen,
  position,
  items,
  onClose,
  className,
}) => {
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return;

    const handlePointerDown = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    window.addEventListener('mousedown', handlePointerDown);
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      window.removeEventListener('mousedown', handlePointerDown);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  // Screen bounds adjustment
  const screenWidth = typeof window !== 'undefined' ? window.innerWidth : 1280;
  const screenHeight = typeof window !== 'undefined' ? window.innerHeight : 800;
  const menuWidth = 180;
  const menuHeight = items.length * 30 + 16;

  const left = position.x + menuWidth > screenWidth ? Math.max(8, position.x - menuWidth) : position.x;
  const top = position.y + menuHeight > screenHeight ? Math.max(8, position.y - menuHeight) : position.y;

  return (
    <div
      ref={menuRef}
      role="menu"
      style={{ left: `${left}px`, top: `${top}px` }}
      className={cn(
        'fixed z-50 min-w-[170px] rounded-btn bg-[#22262B] p-1 shadow-modal border border-graphite-border text-graphite-text-primary text-[12px] animate-in fade-in zoom-in-95 duration-100',
        className
      )}
    >
      {items.map((item, index) => {
        if (item.isDivider) {
          return <div key={`div-${index}`} className="my-1 h-[1px] bg-graphite-border-subtle" />;
        }

        return (
          <button
            key={item.id}
            role="menuitem"
            disabled={item.disabled}
            onClick={() => {
              item.onClick?.();
              onClose();
            }}
            className={cn(
              'flex w-full items-center justify-between rounded-[4px] px-2 py-1.5 text-left transition-colors duration-micro outline-none select-none disabled:opacity-40 disabled:pointer-events-none',
              item.isDanger
                ? 'text-status-error hover:bg-status-error-bg'
                : 'text-graphite-text-secondary hover:text-graphite-text-primary hover:bg-graphite-hover'
            )}
          >
            <div className="flex items-center gap-2">
              {item.icon && <span className="h-3.5 w-3.5 shrink-0">{item.icon}</span>}
              <span>{item.label}</span>
            </div>
            {item.shortcut && (
              <span className="text-[10px] font-mono text-graphite-text-muted">
                {item.shortcut}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
};
