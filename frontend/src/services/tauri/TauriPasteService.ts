import { invoke } from '@tauri-apps/api/core';
import {
  InstantPasteRequest,
  InstantPasteResult,
  PasteCapabilities,
} from '@/types/paste';
import { isTauri } from '../index';

export class TauriPasteService {
  async executeInstantPaste(request: InstantPasteRequest): Promise<InstantPasteResult> {
    if (!isTauri()) {
      // Browser fallback: copy to browser clipboard
      try {
        await navigator.clipboard.writeText(request.content);
        return {
          success: true,
          targetRestored: false,
          method: 'clipboard_only',
          fallbackUsed: true,
          message: 'Copied to clipboard. Press Ctrl+V to paste.',
        };
      } catch (err) {
        return {
          success: false,
          targetRestored: false,
          method: 'clipboard_only',
          fallbackUsed: true,
          message: `Browser clipboard error: ${err}`,
        };
      }
    }

    try {
      const res = await invoke<InstantPasteResult>('execute_instant_paste', {
        entryId: request.entryId,
        content: request.content,
        contentType: request.contentType,
      });
      return res;
    } catch (err) {
      return {
        success: false,
        targetRestored: false,
        method: 'clipboard_only',
        fallbackUsed: true,
        message: String(err),
      };
    }
  }

  async getPasteCapabilities(): Promise<PasteCapabilities> {
    if (!isTauri()) {
      return {
        os: 'web',
        session: 'web',
        globalShortcutsSupported: false,
        focusRestorationSupported: false,
        syntheticPasteSupported: false,
        diagnostics: ['Running in browser environment outside Tauri desktop container.'],
      };
    }

    return await invoke<PasteCapabilities>('get_paste_capabilities');
  }

  async showClipboardPopup(): Promise<void> {
    if (!isTauri()) return;
    await invoke('show_clipboard_popup');
  }

  async hideClipboardPopup(): Promise<void> {
    if (!isTauri()) return;
    await invoke('hide_clipboard_popup');
  }
}

export const pasteService = new TauriPasteService();
export default pasteService;
