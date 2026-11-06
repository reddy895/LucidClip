import React from 'react';

export interface SettingsSectionProps {
  title: string;
  description?: string;
  children: React.ReactNode;
}

export const SettingsSection: React.FC<SettingsSectionProps> = ({
  title,
  description,
  children,
}) => {
  return (
    <div className="flex flex-col gap-3 py-4 border-b border-graphite-border-subtle last:border-b-0">
      <div>
        <h4 className="text-[14px] font-semibold text-graphite-text-primary tracking-tight">
          {title}
        </h4>
        {description && (
          <p className="mt-0.5 text-xs text-graphite-text-secondary leading-normal">
            {description}
          </p>
        )}
      </div>
      <div className="flex flex-col gap-3.5">{children}</div>
    </div>
  );
};
