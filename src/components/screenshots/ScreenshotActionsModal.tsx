import React from 'react';
import { ScreenshotEntry } from '@/types';
import { ConfirmationModal, Dialog, Button } from '@/components/ui';
import { Download, Copy, Trash2 } from 'lucide-react';
import { useApp } from '@/context';

export interface ScreenshotActionsModalProps {
  screenshot: ScreenshotEntry | null;
  isOpen: boolean;
  onClose: () => void;
}

export const ScreenshotActionsModal: React.FC<ScreenshotActionsModalProps> = ({
  screenshot,
  isOpen,
  onClose,
}) => {
  const { copyItem, deleteItem } = useApp();
  const [isConfirmDeleteOpen, setIsConfirmDeleteOpen] = React.useState(false);

  if (!screenshot) return null;

  const handleExport = () => {
    const a = document.createElement('a');
    a.href = screenshot.fullImageUrl;
    a.download = `LucidClip_${screenshot.id}_${Date.now()}.svg`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    onClose();
  };

  const handleCopy = async () => {
    await copyItem({ kind: 'screenshot', ...screenshot });
    onClose();
  };

  const handleDelete = async () => {
    await deleteItem({ kind: 'screenshot', ...screenshot });
    setIsConfirmDeleteOpen(false);
    onClose();
  };

  return (
    <>
      <Dialog
        isOpen={isOpen && !isConfirmDeleteOpen}
        onClose={onClose}
        title="Screenshot Options"
        description={`${screenshot.width} × ${screenshot.height} ${screenshot.captureType} screenshot`}
        maxWidth="sm"
      >
        <div className="flex flex-col gap-2">
          <Button
            variant="secondary"
            icon={<Copy className="h-4 w-4" />}
            onClick={handleCopy}
            className="justify-start text-left"
          >
            Copy Image to Clipboard
          </Button>

          <Button
            variant="secondary"
            icon={<Download className="h-4 w-4" />}
            onClick={handleExport}
            className="justify-start text-left"
          >
            Export Screenshot File
          </Button>

          <div className="my-1 h-[1px] bg-graphite-border-subtle" />

          <Button
            variant="danger"
            icon={<Trash2 className="h-4 w-4" />}
            onClick={() => setIsConfirmDeleteOpen(true)}
            className="justify-start text-left"
          >
            Delete Screenshot
          </Button>
        </div>
      </Dialog>

      <ConfirmationModal
        isOpen={isConfirmDeleteOpen}
        onClose={() => setIsConfirmDeleteOpen(false)}
        onConfirm={handleDelete}
        title="Delete Screenshot"
        description="Are you sure you want to delete this screenshot? Extracted OCR text will also be permanently removed."
        confirmText="Delete"
        isDestructive={true}
      />
    </>
  );
};
