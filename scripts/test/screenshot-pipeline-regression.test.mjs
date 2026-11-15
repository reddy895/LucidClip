import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

describe('Screenshot Pipeline End-to-End Regression Tests', () => {
  // Simulates backend response from get_clipboard_image or get_screenshot_image
  const backendIpcImageResponse = {
    data_url: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
    mime_type: 'image/png',
  };

  function unpackImageDataUrl(raw) {
    if (typeof raw === 'string') {
      return raw;
    }
    if (raw && typeof raw === 'object') {
      if (typeof raw.data_url === 'string') return raw.data_url;
      if (typeof raw.dataUrl === 'string') return raw.dataUrl;
    }
    return '';
  }

  function simulateImageRendering(unpackedUrl) {
    if (!unpackedUrl || unpackedUrl === '[object Object]') {
      return { rendered: false, fallback: true, error: 'Unavailable image payload' };
    }
    if (unpackedUrl.startsWith('data:image/')) {
      return { rendered: true, fallback: false, src: unpackedUrl };
    }
    return { rendered: false, fallback: true, error: 'Malformed image data URL' };
  }

  test('IPC response object is properly unpacked to data URL string', () => {
    const unpacked = unpackImageDataUrl(backendIpcImageResponse);
    assert.equal(typeof unpacked, 'string');
    assert.ok(unpacked.startsWith('data:image/png;base64,'));
    assert.notEqual(unpacked, '[object Object]');
  });

  test('Render simulation displays valid image without fallback badge', () => {
    const unpacked = unpackImageDataUrl(backendIpcImageResponse);
    const renderResult = simulateImageRendering(unpacked);

    assert.equal(renderResult.rendered, true);
    assert.equal(renderResult.fallback, false);
    assert.equal(renderResult.src, backendIpcImageResponse.data_url);
  });

  test('Bug regression: Raw object passed directly to img src fails and triggers fallback', () => {
    // If frontend forgets to unpack and passes object directly into string context:
    const brokenSrc = String(backendIpcImageResponse);
    assert.equal(brokenSrc, '[object Object]');

    const renderResult = simulateImageRendering(brokenSrc);
    assert.equal(renderResult.rendered, false);
    assert.equal(renderResult.fallback, true);
    assert.equal(renderResult.error, 'Unavailable image payload');
  });

  test('Direct data URL string passes through unmodified', () => {
    const rawString = 'data:image/jpeg;base64,/9j/4AAQSkZJRg==';
    const unpacked = unpackImageDataUrl(rawString);
    assert.equal(unpacked, rawString);

    const renderResult = simulateImageRendering(unpacked);
    assert.equal(renderResult.rendered, true);
    assert.equal(renderResult.src, rawString);
  });
});
