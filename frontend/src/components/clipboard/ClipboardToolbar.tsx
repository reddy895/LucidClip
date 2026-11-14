import React, { useState } from 'react';
import { Button, Dialog, Input, ConfirmationModal } from '@/components/ui';
import { Plus, Download, Trash2 } from 'lucide-react';
import { clipboardService } from '@/services';
import { useApp } from '@/context';
import { useToast } from '@/context/ToastContext';

export const ClipboardToolbar: React.FC = () => {
  const { refreshData, clearClipboardHistory, clipboardItems } = useApp();
  const toast = useToast();
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isClearModalOpen, setIsClearModalOpen] = useState(false);
  const [newText, setNewText] = useState('');
  const [newApp, setNewApp] = useState('Manual');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const unpinnedCount = clipboardItems.filter((i) => !i.isPinned && !i.isFavorite).length;

  const handleCreate = async () => {
    if (!newText.trim()) return;
    setIsSubmitting(true);
    try {
      await clipboardService.addEntry(newText, newApp || 'Manual');
      setNewText('');
      setNewApp('Manual');
      setIsAddModalOpen(false);
      await refreshData();
    } catch (err) {
      toast.error(
        `Failed to save snippet: ${err instanceof Error ? err.message : String(err)}`
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleExport = async () => {
    const list = await clipboardService.getHistory();
    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(list, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute('href', dataStr);
    downloadAnchor.setAttribute('download', `lucidclip_clipboard_export_${Date.now()}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  return (
    <>
      <div className="flex items-center gap-1.5">
        <Button
          variant="secondary"
          size="sm"
          icon={<Plus className="h-3.5 w-3.5" />}
          onClick={() => setIsAddModalOpen(true)}
        >
          Add Snippet
        </Button>
        <Button
          variant="subtle"
          size="sm"
          icon={<Download className="h-3.5 w-3.5" />}
          onClick={handleExport}
        >
          Export
        </Button>
        {unpinnedCount > 0 && (
          <Button
            variant="ghost"
            size="sm"
            icon={<Trash2 className="h-3.5 w-3.5 text-graphite-text-muted hover:text-status-error" />}
            onClick={() => setIsClearModalOpen(true)}
          >
            Clear ({unpinnedCount})
          </Button>
        )}
      </div>

      <ConfirmationModal
        isOpen={isClearModalOpen}
        onClose={() => setIsClearModalOpen(false)}
        onConfirm={async () => {
          await clearClipboardHistory();
          setIsClearModalOpen(false);
        }}
        title="Clear Unpinned History"
        description={`Are you sure you want to delete ${unpinnedCount} unpinned entries? Pinned entries, favorites, and screenshots will be preserved.`}
        confirmText="Clear Unpinned"
        isDestructive={true}
      />

      <Dialog
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        title="Add Clipboard Snippet"
        description="Manually create a persistent clipboard entry or code snippet."
        maxWidth="md"
      >
        <div className="flex flex-col gap-3">
          <div>
            <label className="block text-xs font-medium text-graphite-text-secondary mb-1">
              Source / Tag (Optional)
            </label>
            <Input
              value={newApp}
              onChange={(e) => setNewApp(e.target.value)}
              placeholder="e.g. Snippet, Documentation, VS Code"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-graphite-text-secondary mb-1">
              Content
            </label>
            <textarea
              value={newText}
              onChange={(e) => setNewText(e.target.value)}
              placeholder="Paste or type text, code, JSON, or URL..."
              rows={5}
              className="w-full rounded-input bg-graphite-surface p-2.5 font-mono text-[12px] text-graphite-text-primary placeholder:text-graphite-text-muted border border-graphite-border transition-colors duration-micro outline-none focus:border-accent select-text"
            />
          </div>

          <div className="flex items-center justify-end gap-2 pt-2 border-t border-graphite-border-subtle">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setIsAddModalOpen(false)}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={handleCreate}
              isLoading={isSubmitting}
              disabled={!newText.trim()}
            >
              Save Snippet
            </Button>
          </div>
        </div>
      </Dialog>
    </>
  );
};

