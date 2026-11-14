import React from 'react';
import { Layers, FileText, Image as ImageIcon, Paperclip, Pin } from 'lucide-react';

export type PopupFilterType = 'all' | 'text' | 'image' | 'files' | 'pinned';

export interface PopupFilterChipsProps {
  activeFilter: PopupFilterType;
  onFilterChange: (filter: PopupFilterType) => void;
  counts: Record<PopupFilterType, number>;
}

export const PopupFilterChips: React.FC<PopupFilterChipsProps> = ({
  activeFilter,
  onFilterChange,
  counts,
}) => {
  const filters: { type: PopupFilterType; label: string; icon: React.ReactNode }[] = [
    { type: 'all', label: 'All', icon: <Layers className="w-3 h-3" /> },
    { type: 'text', label: 'Text', icon: <FileText className="w-3 h-3" /> },
    { type: 'image', label: 'Images', icon: <ImageIcon className="w-3 h-3" /> },
    { type: 'files', label: 'Files', icon: <Paperclip className="w-3 h-3" /> },
    { type: 'pinned', label: 'Pinned', icon: <Pin className="w-3 h-3" /> },
  ];

  return (
    <div
      className="flex items-center gap-1.5 px-3.5 py-1.5 border-b border-[#30363D] bg-[#111315] overflow-x-auto no-scrollbar select-none"
      data-testid="popup-filter-chips"
    >
      {filters.map(({ type, label, icon }) => {
        const isActive = activeFilter === type;
        const count = counts[type] || 0;

        return (
          <button
            key={type}
            type="button"
            onClick={() => onFilterChange(type)}
            className={`flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium transition-colors ${
              isActive
                ? 'bg-[#22262B] text-[#8B9CF7] border border-[#8B9CF7]/40 shadow-sm'
                : 'text-[#A1A7B0] hover:text-[#F3F4F6] hover:bg-[#191C20] border border-transparent'
            }`}
          >
            {icon}
            <span>{label}</span>
            <span
              className={`text-[9px] px-1 rounded-full ${
                isActive ? 'bg-[#8B9CF7]/20 text-[#8B9CF7]' : 'text-[#6B7280]'
              }`}
            >
              {count}
            </span>
          </button>
        );
      })}
    </div>
  );
};

export default PopupFilterChips;
