import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

function unpackImageDataUrl(response) {
  if (!response) return '';
  if (typeof response === 'string') return response;
  if (typeof response === 'object') {
    return response.data_url || response.dataUrl || '';
  }
  return '';
}

describe('Image Payload Unpacking Regression Tests', () => {
  test('unpacks plain data URL string directly', () => {
    const raw = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJ';
    assert.equal(unpackImageDataUrl(raw), raw);
  });

  test('unpacks snake_case data_url from backend ScreenshotImageData object', () => {
    const payload = {
      mime_type: 'image/png',
      data_url: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJ',
    };
    assert.equal(unpackImageDataUrl(payload), payload.data_url);
    assert.notEqual(unpackImageDataUrl(payload), '[object Object]');
  });

  test('unpacks camelCase dataUrl from frontend object', () => {
    const payload = {
      mimeType: 'image/jpeg',
      dataUrl: 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEASABIAAD',
    };
    assert.equal(unpackImageDataUrl(payload), payload.dataUrl);
  });

  test('handles missing or falsy payloads safely without returning [object Object]', () => {
    assert.equal(unpackImageDataUrl(null), '');
    assert.equal(unpackImageDataUrl(undefined), '');
    assert.equal(unpackImageDataUrl(''), '');
    assert.equal(unpackImageDataUrl({}), '');
  });
});
