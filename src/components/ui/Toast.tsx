import React from 'react';
import { CheckCircle2, AlertCircle, Info, X } from 'lucide-react';
import { cn } from '@/utils';

export type ToastType = 'success' | 'info' | 'warning' | 'error';

export interface ToastMessage {
  id: string;
  type: ToastType;
  message: string;
}

export interface ToastProps {
  toast: ToastMessage;
  onDismiss: (id: string) => void;
}

export const Toast: React.FC<ToastProps> = ({ toast, onDismiss }) => {
  const icons = {
    success: <CheckCircle2 className="h-4 w-4 text-status-success shrink-0" />,
    error: <AlertCircle className="h-4 w-4 text-status-error shrink-0" />,
    warning: <AlertCircle className="h-4 w-4 text-status-warning shrink-0" />,
    info: <Info className="h-4 w-4 text-accent shrink-0" />,
  };

  return (
    <div
      role="status"
      className={cn(
        'flex items-center gap-2.5 rounded-btn bg-[#22262B] px-3 py-2 text-xs text-graphite-text-primary border border-graphite-border shadow-modal transition-all duration-micro animate-in slide-in-from-bottom-2'
      )}
    >
      {icons[toast.type]}
      <span className="font-medium">{toast.message}</span>
      <button
        type="button"
        onClick={() => onDismiss(toast.id)}
        aria-label="Dismiss notification"
        className="ml-2 flex h-4 w-4 items-center justify-center rounded text-graphite-text-muted hover:text-graphite-text-primary transition-colors"
      >
        <X className="h-3 w-3" />
      </button>
    </div>
  );
};

