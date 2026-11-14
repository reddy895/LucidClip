import React from 'react';
import { Trash2 } from 'lucide-react';

export interface PopupFooterProps {
  unpinnedCount: number;
  onClearUnpinned: () => void;
}

export const PopupFooter: React.FC<PopupFooterProps> = ({
  unpinnedCount,
  onClearUnpinned,
}) => {
  return (
    <div
      className="flex items-center justify-between px-3.5 py-2 border-t border-[#30363D] bg-[#151719] text-[11px] text-[#A1A7B0] select-none"
      data-testid="popup-footer"
    >
      {/* Keyboard hints */}
      <div className="flex items-center gap-3">
        <span className="flex items-center gap-1">
          <kbd className="px-1 py-0.5 rounded bg-[#22262B] text-[#F3F4F6] text-[10px] font-mono border border-[#30363D]">
            ↵
          </kbd>
          <span>Paste</span>
        </span>

        <span className="flex items-center gap-1">
          <kbd className="px-1 py-0.5 rounded bg-[#22262B] text-[#F3F4F6] text-[10px] font-mono border border-[#30363D]">
            ↑↓
          </kbd>
          <span>Navigate</span>
        </span>

        <span className="flex items-center gap-1">
          <kbd className="px-1 py-0.5 rounded bg-[#22262B] text-[#F3F4F6] text-[10px] font-mono border border-[#30363D]">
            Ctrl+P
          </kbd>
          <span>Pin</span>
        </span>

        <span className="flex items-center gap-1">
          <kbd className="px-1 py-0.5 rounded bg-[#22262B] text-[#F3F4F6] text-[10px] font-mono border border-[#30363D]">
            Del
          </kbd>
          <span>Remove</span>
        </span>

        <span className="flex items-center gap-1">
          <kbd className="px-1 py-0.5 rounded bg-[#22262B] text-[#F3F4F6] text-[10px] font-mono border border-[#30363D]">
            Esc
          </kbd>
          <span>Close</span>
        </span>
      </div>

      {/* Clear unpinned button */}
      {unpinnedCount > 0 && (
        <button
          type="button"
          onClick={onClearUnpinned}
          className="flex items-center gap-1 text-[#A1A7B0] hover:text-rose-400 hover:bg-[#22262B] px-1.5 py-0.5 rounded transition-colors"
          title="Clear all unpinned clipboard history"
        >
          <Trash2 className="w-3 h-3" />
          <span>Clear unpinned</span>
        </button>
      )}
    </div>
  );
};

export default PopupFooter;
