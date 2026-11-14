import React from 'react';
import { SearchX, Inbox, Loader2 } from 'lucide-react';

export interface PopupEmptyStateProps {
  isLoading?: boolean;
  searchQuery?: string;
  onClearSearch?: () => void;
}

export const PopupEmptyState: React.FC<PopupEmptyStateProps> = ({
  isLoading,
  searchQuery,
  onClearSearch,
}) => {
  if (isLoading) {
    return (
      <div
        className="flex-1 flex flex-col items-center justify-center p-6 text-center text-[#A1A7B0]"
        data-testid="popup-empty-loading"
      >
        <Loader2 className="w-5 h-5 text-[#8B9CF7] animate-spin mb-2" />
        <p className="text-xs font-medium text-[#F3F4F6]">Loading clipboard history...</p>
      </div>
    );
  }

  if (searchQuery && searchQuery.trim().length > 0) {
    return (
      <div
        className="flex-1 flex flex-col items-center justify-center p-6 text-center text-[#A1A7B0]"
        data-testid="popup-empty-no-results"
      >
        <div className="w-10 h-10 rounded-full bg-[#191C20] flex items-center justify-center mb-2.5 text-[#A1A7B0] border border-[#30363D]">
          <SearchX className="w-5 h-5" />
        </div>
        <p className="text-xs font-medium text-[#F3F4F6]">No matches found</p>
        <p className="text-[11px] text-[#6B7280] mt-1 max-w-[200px] truncate">
          No entries match &ldquo;{searchQuery}&rdquo;
        </p>
        {onClearSearch && (
          <button
            type="button"
            onClick={onClearSearch}
            className="mt-3 text-[11px] text-[#8B9CF7] hover:underline"
          >
            Clear search (Esc)
          </button>
        )}
      </div>
    );
  }

  return (
    <div
      className="flex-1 flex flex-col items-center justify-center p-6 text-center text-[#A1A7B0]"
      data-testid="popup-empty-history"
    >
      <div className="w-10 h-10 rounded-full bg-[#191C20] flex items-center justify-center mb-2.5 text-[#A1A7B0] border border-[#30363D]">
        <Inbox className="w-5 h-5" />
      </div>
      <p className="text-xs font-medium text-[#F3F4F6]">Clipboard history is empty</p>
      <p className="text-[11px] text-[#6B7280] mt-1 max-w-[220px]">
        Copy text, URLs, code, or images in any application to populate history.
      </p>
    </div>
  );
};

export default PopupEmptyState;
