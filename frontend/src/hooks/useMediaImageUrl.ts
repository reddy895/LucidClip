import { useEffect, useState } from 'react';
import { ImageVariant } from '@/types';
import { clipboardService, screenshotService } from '@/services';

export type MediaImageState = 'idle' | 'loading' | 'ready' | 'error';

export interface MediaImageResult {
  url?: string;
  state: MediaImageState;
}

/**
 * Load a clipboard or screenshot image through the validated backend command.
 * Components never receive a raw filesystem URL.
 */
export function useMediaImageUrl(
  kind: 'clipboard' | 'screenshot',
  id: string,
  variant: ImageVariant = 'thumbnail',
  enabled = true
): MediaImageResult {
  const [url, setUrl] = useState<string | undefined>();
  const [state, setState] = useState<MediaImageState>(enabled ? 'loading' : 'idle');

  useEffect(() => {
    if (!enabled) {
      setUrl(undefined);
      setState('idle');
      return;
    }

    let active = true;
    setState('loading');

    const request =
      kind === 'clipboard'
        ? clipboardService.getClipboardImageUrl(id, variant)
        : screenshotService.getScreenshotImageUrl(id, variant);

    request
      .then((dataUrl) => {
        if (!active) return;
        setUrl(dataUrl);
        setState('ready');
      })
      .catch(() => {
        if (!active) return;
        setUrl(undefined);
        setState('error');
      });

    return () => {
      active = false;
    };
  }, [kind, id, variant, enabled]);

  return { url, state };
}
