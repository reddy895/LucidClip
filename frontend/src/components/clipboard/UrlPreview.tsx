import React from 'react';
import { ExternalLink, Globe } from 'lucide-react';
import { Button } from '@/components/ui';

export interface UrlPreviewProps {
  url: string;
}

export const UrlPreview: React.FC<UrlPreviewProps> = ({ url }) => {
  let hostname = '';
  try {
    const parsed = new URL(url.startsWith('http') ? url : `https://${url}`);
    hostname = parsed.hostname;
  } catch {
    hostname = url;
  }

  return (
    <div className="flex flex-col gap-2 rounded-btn bg-[#151719] border border-graphite-border p-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-xs text-graphite-text-secondary">
          <Globe className="h-3.5 w-3.5 text-accent" />
          <span className="font-medium text-graphite-text-primary">{hostname}</span>
        </div>
        <Button
          variant="subtle"
          size="sm"
          icon={<ExternalLink className="h-3 w-3" />}
          onClick={() => window.open(url, '_blank')}
        >
          Open Link
        </Button>
      </div>

      <div className="rounded bg-graphite-surface px-2.5 py-1.5 font-mono text-[11px] text-accent truncate border border-graphite-border-subtle select-text">
        {url}
      </div>
    </div>
  );
};

