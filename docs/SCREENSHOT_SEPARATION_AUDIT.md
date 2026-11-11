# Clipboard Text / Screenshot Separation & Rendering Audit

**Date:** 2026-11-11
**Scope:** Clipboard section, Screenshots section, screenshot file storage, and
the Tauri image rendering path.

## Symptoms reported

1. Clipboard text and screenshots appear in the same section.
2. Screenshot records are not visible in the dedicated Screenshots section.

## Data model inspected

LucidClip stores two independent kinds of image data:

| Source | SQLite table | File prefix | Written by |
|---|---|---|---|
| Clipboard text / files | `clipboard_entries` | none | clipboard monitor |
| Clipboard images | `clipboard_entries` (`content_type = 'image'`) | `clip_*.png` | clipboard monitor |
| LucidClip screenshots | `screenshots` | `shot_*.png` | screenshot service |

Files live in `<app-data>/screenshots/originals` and
`<app-data>/screenshots/thumbnails`.

## Root cause 1 — mixed section data

`ClipboardView` rendered every row returned by `get_clipboard_entries`,
including `content_type = 'image'` rows. Those rows are clipboard images (often
created by an operating-system screenshot tool), so they looked like
screenshots inside the text history. At the same time, `ScreenshotsView` read
only the `screenshots` table, which contains captures made by LucidClip itself.
An OS screenshot copied to the clipboard therefore appeared in Clipboard and
never in Screenshots.

The two sections were backed by different stores, but the text view did not
exclude image records, and the image gallery did not include clipboard images.

## Root cause 2 — brittle image delivery

Screenshot metadata is correct in SQLite, but the UI depended entirely on:

- `convertFileSrc(<absolute stored path>)`, and
- a single static `assetProtocol` scope entry.

If the stored path was not inside the exact scope string (case differences on
Linux, a moved data directory, or a stale row), or if the thumbnail file was
missing, the `<img>` element failed silently. There was no availability flag,
no thumbnail regeneration, no error placeholder, and no fallback loader.

In addition, `delete`, `crop`, `copy`, and `export` trusted paths read from
SQLite without re-validating that they were still inside the application data
directory.

## Fix strategy

1. Text view filters out `content_type = 'image'` records.
2. Screenshots view shows LucidClip captures and clipboard images in one
   gallery, with the origin labelled, while excluding all text records.
3. Image bytes are streamed through a Tauri command that:
   - looks the row up by ID,
   - rejects rows whose stored path is outside `<app-data>/screenshots`,
   - canonicalizes the resolved file to block symlink escapes,
   - returns a data URL only for an existing file.
4. Missing thumbnails are regenerated from the validated original.
5. The frontend loads thumbnails lazily per card and full-resolution images only
   for the selected preview.
6. Missing files render an explicit, non-crashing state.

No schema change is required and existing rows/files are preserved.

## Resolution status

Implemented:

- `ClipboardView` uses `selectTextEntries`, so image-only clipboard rows no longer
  appear in the text history.
- `ScreenshotsView` uses `buildGalleryItems` to merge LucidClip screenshots and
  clipboard images, with `screenshot`, `fullscreen`, `region`, and `clipboard`
  filters plus origin badges.
- `get_screenshots` returns availability flags and never serializes absolute
  screenshot paths.
- `get_screenshot_image` and `get_clipboard_image` validate the row and file
  before returning a data URL; thumbnails are regenerated when possible.
- Every thumbnail consumer (`ScreenshotGrid`, `ClipboardRow`,
  `UnifiedHistoryRow`, `QuickAccessItem`) loads images through
  `useMediaImageUrl`, not `convertFileSrc`.
- Full previews and region-capture sources load only when needed.
- Delete/crop re-validate stored paths before touching files.
- Regression coverage includes path ownership, gallery health, thumbnail
  regeneration, restart persistence, missing media, and text/gallery separation.

Limitation: native screenshot capture remains Windows-only, so actual desktop
capture could not be exercised on the Linux development host.
