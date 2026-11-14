import React, { useRef, useEffect } from 'react';
import { Search, X } from 'lucide-react';

export interface PopupHeaderProps {
  searchQuery: string;
  onSearchChange: (query: string) => void;
  totalCount: number;
  filteredCount: number;
  isMonitoring: boolean;
  inputRef?: React.RefObject<HTMLInputElement>;
}

export const PopupHeader: React.FC<PopupHeaderProps> = ({
  searchQuery,
  onSearchChange,
  totalCount,
  filteredCount,
  isMonitoring,
  inputRef: externalInputRef,
}) => {
  const localInputRef = useRef<HTMLInputElement>(null);
  const inputRef = externalInputRef || localInputRef;

  useEffect(() => {
    // Focus search on mount
    inputRef.current?.focus();
  }, [inputRef]);

  return (
    <div
      data-tauri-drag-region
      className="flex flex-col border-b border-[#30363D] bg-[#151719] px-3.5 pt-3 pb-2.5 gap-2 select-none"
    >
      {/* Top row: Brand & Status */}
      <div className="flex items-center justify-between text-xs" data-tauri-drag-region>
        <div className="flex items-center gap-2" data-tauri-drag-region>
          <div className="w-2 h-2 rounded-full bg-[#8B9CF7] shadow-[0_0_8px_rgba(139,156,247,0.6)]" />
          <span className="font-semibold tracking-wider text-[#F3F4F6] uppercase text-[11px]">
            LucidClip
          </span>
          <span className="text-[10px] text-[#A1A7B0] font-mono px-1.5 py-0.5 rounded bg-[#22262B]">
            {filteredCount === totalCount ? `${totalCount}` : `${filteredCount} / ${totalCount}`}
          </span>
        </div>

        <div className="flex items-center gap-1.5 text-[11px] text-[#A1A7B0]">
          <span
            className={`w-1.5 h-1.5 rounded-full ${
              isMonitoring ? 'bg-emerald-500' : 'bg-amber-500'
            }`}
          />
          <span className="text-[10px]">{isMonitoring ? 'Active' : 'Paused'}</span>
        </div>
      </div>

      {/* Bottom row: Search Box */}
      <div className="relative flex items-center">
        <Search className="absolute left-2.5 w-3.5 h-3.5 text-[#A1A7B0] pointer-events-none" />
        <input
          ref={inputRef}
          type="text"
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder="Search clipboard... (Ctrl+F)"
          className="w-full bg-[#191C20] border border-[#30363D] rounded-md pl-8 pr-7 py-1.5 text-xs text-[#F3F4F6] placeholder-[#6B7280] focus:outline-none focus:border-[#8B9CF7] transition-colors"
          data-testid="popup-search-input"
        />
        {searchQuery && (
          <button
            onClick={() => onSearchChange('')}
            className="absolute right-2 text-[#A1A7B0] hover:text-[#F3F4F6] p-0.5 rounded focus:outline-none"
            title="Clear search"
            type="button"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        )}
      </div>
    </div>
  );
};

export default PopupHeader;
