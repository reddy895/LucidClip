import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

function renderImageSlot(entry, clipboardImage) {
  if (entry.contentType !== 'image') {
    return { type: 'text', content: entry.content };
  }

  const isDataUrl = typeof clipboardImage.url === 'string' && clipboardImage.url.startsWith('data:');

  if (clipboardImage.state === 'ready' && isDataUrl) {
    return {
      type: 'image',
      src: clipboardImage.url,
      label: `${entry.imageWidth} × ${entry.imageHeight} px`,
    };
  }

  if (clipboardImage.state === 'loading') {
    return { type: 'loading' };
  }

  return { type: 'placeholder', label: 'Image' };
}

describe('Popup Image Rendering Unit Tests', () => {
  const imageEntry = {
    id: 'clip_img_1',
    contentType: 'image',
    content: '[Image: 800 × 600 px]',
    imageWidth: 800,
    imageHeight: 600,
    createdAt: new Date().toISOString(),
  };

  test('renders image tag when clipboardImage is ready with valid data URL', () => {
    const readyState = {
      state: 'ready',
      url: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJ',
    };

    const rendered = renderImageSlot(imageEntry, readyState);
    assert.equal(rendered.type, 'image');
    assert.equal(rendered.src, readyState.url);
    assert.equal(rendered.label, '800 × 600 px');
  });

  test('rejects object payload and prevents [object Object] rendering', () => {
    const corruptObjectState = {
      state: 'ready',
      url: { mime_type: 'image/png', data_url: 'data:image/png;base64,abc' },
    };

    const rendered = renderImageSlot(imageEntry, corruptObjectState);
    assert.notEqual(rendered.type, 'image');
    assert.equal(rendered.type, 'placeholder');
  });

  test('displays loading placeholder while image is resolving', () => {
    const loadingState = { state: 'loading', url: undefined };
    const rendered = renderImageSlot(imageEntry, loadingState);
    assert.equal(rendered.type, 'loading');
  });

  test('displays fallback icon placeholder on image error', () => {
    const errorState = { state: 'error', url: undefined };
    const rendered = renderImageSlot(imageEntry, errorState);
    assert.equal(rendered.type, 'placeholder');
    assert.equal(rendered.label, 'Image');
  });
});
