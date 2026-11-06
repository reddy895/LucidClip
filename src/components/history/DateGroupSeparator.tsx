import React from 'react';

export interface DateGroupSeparatorProps {
  label: string;
}

export const DateGroupSeparator: React.FC<DateGroupSeparatorProps> = ({ label }) => {
  return (
    <div className="flex items-center gap-2.5 py-2.5 my-1 select-none">
      <span className="text-[11px] font-medium text-graphite-text-muted uppercase tracking-wider">
        {label}
      </span>
      <div className="h-[1px] flex-1 bg-graphite-border-subtle" />
    </div>
  );
};
