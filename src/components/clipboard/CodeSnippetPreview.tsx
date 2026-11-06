import React from 'react';
import { Badge } from '@/components/ui';

export interface CodeSnippetPreviewProps {
  code: string;
  language?: string;
  maxLines?: number;
}

export const CodeSnippetPreview: React.FC<CodeSnippetPreviewProps> = ({
  code,
  language = 'text',
  maxLines,
}) => {
  const lines = code.split('\n');
  const displayLines = maxLines ? lines.slice(0, maxLines) : lines;

  return (
    <div className="relative rounded-btn bg-[#151719] border border-graphite-border overflow-hidden select-text">
      {/* Code Header */}
      <div className="flex items-center justify-between border-b border-graphite-border-subtle bg-graphite-surface/60 px-3 py-1.5 select-none">
        <Badge variant="code" size="sm">
          {language.toUpperCase()}
        </Badge>
        <span className="text-[10px] font-mono text-graphite-text-muted">
          {lines.length} {lines.length === 1 ? 'line' : 'lines'}
        </span>
      </div>

      {/* Code block with line numbers */}
      <div className="overflow-x-auto p-2.5 font-mono text-[12px] leading-relaxed">
        <table className="w-full border-collapse">
          <tbody>
            {displayLines.map((line, idx) => (
              <tr key={idx} className="hover:bg-graphite-hover/40 transition-colors">
                <td className="w-8 select-none pr-3 text-right text-[11px] text-graphite-text-muted/60 align-top">
                  {idx + 1}
                </td>
                <td className="whitespace-pre font-mono text-[#F3F4F6] align-top">{line || ' '}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {maxLines && lines.length > maxLines && (
          <div className="mt-2 text-center text-[11px] text-graphite-text-muted border-t border-graphite-border-subtle pt-1 select-none">
            +{lines.length - maxLines} more lines...
          </div>
        )}
      </div>
    </div>
  );
};
