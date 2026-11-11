import React, { useEffect, useRef, useState } from 'react';
import { useApp } from '@/context';
import { Dialog, Button } from '@/components/ui';
import { Crop, ImageOff, Loader2 } from 'lucide-react';
import { screenshotService } from '@/services';

interface NormalizedPoint {
  x: number;
  y: number;
}

interface NormalizedRect {
  left: number;
  top: number;
  width: number;
  height: number;
}

function toNormalizedRect(a: NormalizedPoint, b: NormalizedPoint): NormalizedRect {
  return {
    left: Math.min(a.x, b.x),
    top: Math.min(a.y, b.y),
    width: Math.abs(a.x - b.x),
    height: Math.abs(a.y - b.y),
  };
}

export const RegionCaptureDialog: React.FC = () => {
  const { regionCaptureSource, cancelRegionCapture, confirmRegionCapture } = useApp();
  const wrapperRef = useRef<HTMLDivElement>(null);
  const [anchor, setAnchor] = useState<NormalizedPoint | null>(null);
  const [cursor, setCursor] = useState<NormalizedPoint | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sourceUrl, setSourceUrl] = useState<string | undefined>(
    regionCaptureSource?.fullImageUrl
  );
  const [sourceState, setSourceState] = useState<'loading' | 'ready' | 'error'>(
    regionCaptureSource?.fullImageUrl ? 'ready' : 'loading'
  );

  const isOpen = regionCaptureSource !== null;

  useEffect(() => {
    let active = true;
    const source = regionCaptureSource;

    if (!source) {
      setSourceUrl(undefined);
      return () => {
        active = false;
      };
    }

    if (source.originalAvailable === false) {
      setSourceUrl(undefined);
      setSourceState('error');
      return () => {
        active = false;
      };
    }

    setSourceState('loading');
    screenshotService
      .getScreenshotImageUrl(source.id, 'original')
      .then((url) => {
        if (!active) return;
        setSourceUrl(url);
        setSourceState('ready');
      })
      .catch(() => {
        if (!active) return;
        setSourceUrl(undefined);
        setSourceState('error');
      });

    return () => {
      active = false;
    };
  }, [regionCaptureSource]);
  const selection = anchor && cursor ? toNormalizedRect(anchor, cursor) : null;

  const pointFromEvent = (event: React.PointerEvent): NormalizedPoint | null => {
    const wrapper = wrapperRef.current;
    if (!wrapper) return null;

    const rect = wrapper.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return null;

    return {
      x: Math.min(1, Math.max(0, (event.clientX - rect.left) / rect.width)),
      y: Math.min(1, Math.max(0, (event.clientY - rect.top) / rect.height)),
    };
  };

  const handlePointerDown = (event: React.PointerEvent) => {
    if (event.button !== 0) return;
    const point = pointFromEvent(event);
    if (!point) return;

    event.currentTarget.setPointerCapture(event.pointerId);
    setAnchor(point);
    setCursor(point);
    setIsDragging(true);
    setError(null);
  };

  const handlePointerMove = (event: React.PointerEvent) => {
    if (!isDragging) return;
    const point = pointFromEvent(event);
    if (point) setCursor(point);
  };

  const handlePointerUp = (event: React.PointerEvent) => {
    if (!isDragging) return;
    const point = pointFromEvent(event);
    if (point) setCursor(point);
    setIsDragging(false);
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  };

  const handleClose = () => {
    if (isSaving) return;
    void cancelRegionCapture();
  };

  const handleConfirm = async () => {
    const source = regionCaptureSource;
    if (!source || !selection) {
      setError('Drag over the image to select a region.');
      return;
    }

    const x = Math.round(selection.left * source.width);
    const y = Math.round(selection.top * source.height);
    const width = Math.round(selection.width * source.width);
    const height = Math.round(selection.height * source.height);

    if (width < 1 || height < 1) {
      setError('Drag over the image to select a region.');
      return;
    }

    setIsSaving(true);
    setError(null);
    try {
      await confirmRegionCapture({ x, y, width, height });
    } catch {
      setError('Failed to save the selected region.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog
      isOpen={isOpen}
      onClose={handleClose}
      title="Capture Region"
      description="Drag across the captured desktop to choose the area to keep."
      maxWidth="xl"
    >
      {regionCaptureSource && (
        <div className="flex flex-col gap-3">
          <div className="flex justify-center overflow-auto rounded-btn border border-graphite-border-subtle bg-black/30 p-2">
            <div
              ref={wrapperRef}
              className="relative inline-block max-w-full touch-none select-none"
              onPointerDown={handlePointerDown}
              onPointerMove={handlePointerMove}
              onPointerUp={handlePointerUp}
              onPointerCancel={() => setIsDragging(false)}
            >
              {sourceState === 'ready' && sourceUrl ? (
                <img
                  src={sourceUrl}
                  alt="Captured desktop for region selection"
                  className="block max-h-[60vh] w-auto max-w-full cursor-crosshair rounded-btn"
                  draggable={false}
                />
              ) : sourceState === 'loading' ? (
                <div className="flex min-h-[220px] w-[420px] max-w-full flex-col items-center justify-center gap-2 text-graphite-text-muted">
                  <Loader2 className="h-5 w-5 animate-spin" />
                  <span className="text-[11px]">Loading captured desktop...</span>
                </div>
              ) : (
                <div className="flex min-h-[220px] w-[420px] max-w-full flex-col items-center justify-center gap-2 px-4 text-center text-graphite-text-muted">
                  <ImageOff className="h-6 w-6" />
                  <span className="text-xs font-medium text-graphite-text-secondary">
                    The captured desktop image is unavailable.
                  </span>
                  <span className="text-[11px]">Close this dialog and try the capture again.</span>
                </div>
              )}
              {sourceState === 'ready' && selection && selection.width > 0 && selection.height > 0 && (
                <div
                  className="pointer-events-none absolute border border-accent bg-accent/20"
                  style={{
                    left: `${selection.left * 100}%`,
                    top: `${selection.top * 100}%`,
                    width: `${selection.width * 100}%`,
                    height: `${selection.height * 100}%`,
                  }}
                />
              )}
            </div>
          </div>

          <div className="flex items-center justify-between gap-3">
            <p className="text-xs text-graphite-text-secondary">
              {selection
                ? `${Math.round(selection.width * regionCaptureSource.width)} × ${Math.round(
                    selection.height * regionCaptureSource.height
                  )} px selected`
                : 'Click and drag to select a region.'}
            </p>
            <div className="flex items-center gap-2">
              <Button variant="secondary" size="sm" onClick={handleClose} disabled={isSaving}>
                Cancel
              </Button>
              <Button
                variant="primary"
                size="sm"
                icon={<Crop className="h-3.5 w-3.5" />}
                onClick={handleConfirm}
                disabled={!selection || isSaving || sourceState !== 'ready'}
                isLoading={isSaving}
              >
                Save Region
              </Button>
            </div>
          </div>

          {error && <p className="text-xs text-status-error">{error}</p>}
        </div>
      )}
    </Dialog>
  );
};
