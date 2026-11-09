import React, { useEffect, useRef } from 'react';
import { X } from 'lucide-react';
import { cn } from '@/utils';

export interface DialogProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  description?: string;
  children: React.ReactNode;
  className?: string;
  maxWidth?: 'sm' | 'md' | 'lg' | 'xl';
  showCloseButton?: boolean;
}

export const Dialog: React.FC<DialogProps> = ({
  isOpen,
  onClose,
  title,
  description,
  children,
  className,
  maxWidth = 'md',
  showCloseButton = true,
}) => {
  const dialogRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        e.preventDefault();
        onClose();
      }
    };

    if (isOpen) {
      window.addEventListener('keydown', handleKeyDown);
    }
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const maxWidths = {
    sm: 'max-w-sm',
    md: 'max-w-md',
    lg: 'max-w-lg',
    xl: 'max-w-xl',
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/60 transition-opacity duration-micro"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Modal Surface */}
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={title ? 'dialog-title' : undefined}
        aria-describedby={description ? 'dialog-desc' : undefined}
        className={cn(
          'relative z-10 w-full rounded-modal bg-graphite-surface-elevated border border-graphite-border shadow-modal p-5 text-graphite-text-primary transition-all duration-micro animate-in fade-in zoom-in-95',
          maxWidths[maxWidth],
          className
        )}
      >
        {(title || showCloseButton) && (
          <div className="mb-4 flex items-center justify-between">
            <div>
              {title && (
                <h3 id="dialog-title" className="text-base font-semibold text-graphite-text-primary">
                  {title}
                </h3>
              )}
              {description && (
                <p id="dialog-desc" className="mt-1 text-xs text-graphite-text-secondary">
                  {description}
                </p>
              )}
            </div>
            {showCloseButton && (
              <button
                type="button"
                onClick={onClose}
                aria-label="Close dialog"
                className="flex h-7 w-7 items-center justify-center rounded-btn text-graphite-text-secondary hover:text-graphite-text-primary hover:bg-graphite-hover transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
        )}

        <div>{children}</div>
      </div>
    </div>
  );
};

