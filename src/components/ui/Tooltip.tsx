import React, { useState, useRef } from 'react';
import { cn } from '@/utils';

export interface TooltipProps {
  content: React.ReactNode;
  shortcut?: string;
  side?: 'top' | 'bottom' | 'left' | 'right';
  delay?: number;
  children: React.ReactElement;
  className?: string;
}

export const Tooltip: React.FC<TooltipProps> = ({
  content,
  shortcut,
  side = 'top',
  delay = 250,
  children,
  className,
}) => {
  const [isVisible, setIsVisible] = useState(false);
  const timeoutRef = useRef<number | null>(null);

  const show = () => {
    timeoutRef.current = window.setTimeout(() => setIsVisible(true), delay);
  };

  const hide = () => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    setIsVisible(false);
  };

  const sidePositions = {
    top: 'bottom-full left-1/2 -translate-x-1/2 mb-1.5',
    bottom: 'top-full left-1/2 -translate-x-1/2 mt-1.5',
    left: 'right-full top-1/2 -translate-y-1/2 mr-1.5',
    right: 'left-full top-1/2 -translate-y-1/2 ml-1.5',
  };

  return (
    <div
      className="relative inline-flex"
      onMouseEnter={show}
      onMouseLeave={hide}
      onFocus={show}
      onBlur={hide}
    >
      {children}
      {isVisible && content && (
        <div
          role="tooltip"
          className={cn(
            'pointer-events-none absolute z-50 whitespace-nowrap rounded-[5px] bg-[#22262B] px-2 py-1 text-[11px] font-medium text-[#F3F4F6] border border-[#30363D] shadow-tooltip flex items-center gap-1.5 animate-in fade-in zoom-in-95 duration-100',
            sidePositions[side],
            className
          )}
        >
          <span>{content}</span>
          {shortcut && (
            <kbd className="rounded bg-[#151719] px-1 py-0.5 text-[10px] font-mono text-[#A1A7B0] border border-[#30363D]">
              {shortcut}
            </kbd>
          )}
        </div>
      )}
    </div>
  );
};
