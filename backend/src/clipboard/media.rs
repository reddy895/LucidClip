//! Storage for clipboard images captured from the operating system.

use std::fs;
use std::path::{Path, PathBuf};

use image::{DynamicImage, ImageFormat, RgbaImage};
use sha2::{Digest, Sha256};

use crate::database::DbClipboardEntry;
use crate::errors::{AppError, Result};
use crate::platform::CapturedImage;
use crate::storage::AppPaths;

const THUMBNAIL_WIDTH: u32 = 320;
const THUMBNAIL_HEIGHT: u32 = 180;

pub struct StoredImage {
    pub original_path: String,
    pub thumbnail_path: String,
    pub width: u32,
    pub height: u32,
    pub byte_size: u64,
}

/// Hash dimensions and pixel bytes so text and image hashes cannot collide.
pub fn hash_image(image: &CapturedImage) -> String {
    let mut hasher = Sha256::new();
    hasher.update(b"lucidclip-image\0");
    hasher.update(image.width.to_le_bytes());
    hasher.update(image.height.to_le_bytes());
    hasher.update(&image.rgba);
    format!("{:x}", hasher.finalize())
}

pub fn store(paths: &AppPaths, id: &str, image: &CapturedImage) -> Result<StoredImage> {
    let rgba =
        RgbaImage::from_raw(image.width, image.height, image.rgba.clone()).ok_or_else(|| {
            AppError::Clipboard("Captured image buffer does not match its dimensions".into())
        })?;

    let original_path = paths.originals_dir.join(format!("{id}.png"));
    let thumbnail_path = paths.thumbnails_dir.join(format!("{id}.png"));
    let dynamic = DynamicImage::ImageRgba8(rgba);

    dynamic.save_with_format(&original_path, ImageFormat::Png)?;
    let thumbnail = dynamic.thumbnail(THUMBNAIL_WIDTH, THUMBNAIL_HEIGHT);

    if let Err(err) = thumbnail.save_with_format(&thumbnail_path, ImageFormat::Png) {
        remove_file_if_exists(&original_path);
        return Err(err.into());
    }

    let byte_size = match fs::metadata(&original_path) {
        Ok(metadata) => metadata.len(),
        Err(err) => {
            remove_file_if_exists(&original_path);
            remove_file_if_exists(&thumbnail_path);
            return Err(err.into());
        }
    };

    Ok(StoredImage {
        original_path: original_path.to_string_lossy().into_owned(),
        thumbnail_path: thumbnail_path.to_string_lossy().into_owned(),
        width: image.width,
        height: image.height,
        byte_size,
    })
}

/// Resolve a clipboard image file, regenerating a missing thumbnail from the
/// original when possible.
pub fn resolve_image_file(
    paths: &AppPaths,
    entry: &DbClipboardEntry,
    thumbnail: bool,
) -> Result<PathBuf> {
    let stored = if thumbnail {
        entry.thumbnail_path.as_deref()
    } else {
        entry.image_path.as_deref()
    }
    .ok_or_else(|| {
        AppError::NotFound(format!(
            "Clipboard image {} has no {} file",
            entry.id,
            if thumbnail { "thumbnail" } else { "original" }
        ))
    })?;

    let candidate = Path::new(stored);
    paths.validate_media_path(candidate)?;

    if let Ok(existing) = paths.resolve_media_file(candidate) {
        return Ok(existing);
    }

    if !thumbnail {
        return paths.resolve_media_file(candidate);
    }

    let original = entry
        .image_path
        .as_deref()
        .ok_or_else(|| AppError::NotFound(format!("Clipboard image {} has no original file", entry.id)))?;
    let original = paths.resolve_media_file(Path::new(original))?;
    let source = image::open(&original)?;
    let generated = source.thumbnail(THUMBNAIL_WIDTH, THUMBNAIL_HEIGHT);

    if let Some(parent) = candidate.parent() {
        fs::create_dir_all(parent).map_err(|err| {
            AppError::Storage(format!(
                "Failed to create clipboard thumbnail directory {}: {err}",
                parent.display()
            ))
        })?;
    }

    generated.save_with_format(candidate, ImageFormat::Png)?;
    paths.resolve_media_file(candidate)
}

/// Remove media files owned by a clipboard entry.
///
/// Paths are only removed when they resolve inside the application screenshot
/// directory, so malformed database rows cannot delete arbitrary files.
pub fn remove(paths: &AppPaths, entry: &DbClipboardEntry) {
    for candidate in [&entry.image_path, &entry.thumbnail_path] {
        let Some(candidate) = candidate else {
            continue;
        };
        let path = Path::new(candidate);
        if !path.starts_with(&paths.screenshots_dir) {
            eprintln!(
                "[LucidClip Clipboard] Refusing to remove media outside the app data directory: {candidate}"
            );
            continue;
        }
        remove_file_if_exists(path);
    }
}

fn remove_file_if_exists(path: &Path) {
    match fs::remove_file(path) {
        Ok(()) => {}
        Err(err) if err.kind() == std::io::ErrorKind::NotFound => {}
        Err(err) => eprintln!(
            "[LucidClip Clipboard] Failed to remove media file {}: {err}",
            path.display()
        ),
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::path::PathBuf;

    fn sample_image() -> CapturedImage {
        CapturedImage {
            rgba: vec![
                255, 0, 0, 255, 0, 255, 0, 255, 0, 0, 255, 255, 255, 255, 255, 255,
            ],
            width: 2,
            height: 2,
        }
    }

    #[test]
    fn remove_refuses_paths_outside_the_app_data_directory() {
        let root = std::env::temp_dir().join(format!(
            "lucidclip-media-boundary-{}-{}",
            std::process::id(),
            std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .unwrap()
                .as_nanos()
        ));
        let paths = AppPaths::from_root(&root);
        paths.ensure_dirs_exist().unwrap();

        let outside = root
            .parent()
            .unwrap()
            .join(format!("lucidclip-outside-{}.png", std::process::id()));
        fs::write(&outside, b"keep").unwrap();
        let entry = DbClipboardEntry {
            id: "clip_outside".into(),
            content: String::new(),
            content_type: "image".into(),
            source_app: None,
            created_at: 0,
            content_hash: "hash".into(),
            pinned: false,
            favorite: false,
            image_path: Some(outside.to_string_lossy().into_owned()),
            thumbnail_path: None,
            image_width: Some(1),
            image_height: Some(1),
            byte_size: 4,
            file_count: 0,
            last_used_at: None,
            usage_count: 0,
        };

        remove(&paths, &entry);
        assert!(outside.exists());
        let _ = fs::remove_file(outside);
        let _ = fs::remove_dir_all(root);
    }

    #[test]
    fn resolve_image_file_regenerates_a_missing_thumbnail() {
        let root = std::env::temp_dir().join(format!(
            "lucidclip-media-thumb-{}-{}",
            std::process::id(),
            std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .unwrap()
                .as_nanos()
        ));
        let paths = AppPaths::from_root(&root);
        paths.ensure_dirs_exist().unwrap();

        let image = sample_image();
        let stored = store(&paths, "clip_thumb_test", &image).unwrap();
        let entry = DbClipboardEntry {
            id: "clip_thumb_test".into(),
            content: String::new(),
            content_type: "image".into(),
            source_app: None,
            created_at: 0,
            content_hash: hash_image(&image),
            pinned: false,
            favorite: false,
            image_path: Some(stored.original_path.clone()),
            thumbnail_path: Some(stored.thumbnail_path.clone()),
            image_width: Some(2),
            image_height: Some(2),
            byte_size: stored.byte_size,
            file_count: 0,
            last_used_at: None,
            usage_count: 0,
        };

        fs::remove_file(&stored.thumbnail_path).unwrap();
        assert!(!PathBuf::from(&stored.thumbnail_path).exists());

        let resolved = resolve_image_file(&paths, &entry, true).unwrap();
        assert!(resolved.is_file());
        assert_eq!(resolved, fs::canonicalize(&stored.thumbnail_path).unwrap());

        let _ = fs::remove_dir_all(root);
    }

    #[test]
    fn resolve_image_file_rejects_paths_outside_the_app_data_directory() {
        let root = std::env::temp_dir().join(format!(
            "lucidclip-media-outside-{}-{}",
            std::process::id(),
            std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .unwrap()
                .as_nanos()
        ));
        let paths = AppPaths::from_root(&root);
        paths.ensure_dirs_exist().unwrap();

        let outside = root.parent().unwrap().join(format!(
            "lucidclip-clip-outside-{}.png",
            std::process::id()
        ));
        fs::write(&outside, b"keep").unwrap();

        let entry = DbClipboardEntry {
            id: "clip_outside".into(),
            content: String::new(),
            content_type: "image".into(),
            source_app: None,
            created_at: 0,
            content_hash: "outside".into(),
            pinned: false,
            favorite: false,
            image_path: Some(outside.to_string_lossy().into_owned()),
            thumbnail_path: Some(outside.to_string_lossy().into_owned()),
            image_width: Some(1),
            image_height: Some(1),
            byte_size: 4,
            file_count: 0,
            last_used_at: None,
            usage_count: 0,
        };

        assert!(resolve_image_file(&paths, &entry, false).is_err());
        assert!(resolve_image_file(&paths, &entry, true).is_err());
        assert!(outside.is_file());

        let _ = fs::remove_file(outside);
        let _ = fs::remove_dir_all(root);
    }

    #[test]
    fn image_hash_includes_dimensions_and_pixels() {
        let image = sample_image();
        let mut changed = sample_image();
        changed.rgba[0] = 0;

        assert_eq!(hash_image(&image), hash_image(&sample_image()));
        assert_ne!(hash_image(&image), hash_image(&changed));
    }

    #[test]
    fn store_writes_png_and_thumbnail() {
        let root = std::env::temp_dir().join(format!(
            "lucidclip-media-{}-{}",
            std::process::id(),
            std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .unwrap()
                .as_nanos()
        ));
        let paths = AppPaths::from_root(&root);
        paths.ensure_dirs_exist().unwrap();

        let image = sample_image();
        let stored = store(&paths, "clip_test", &image).unwrap();

        assert!(PathBuf::from(&stored.original_path).is_file());
        assert!(PathBuf::from(&stored.thumbnail_path).is_file());
        assert_eq!(stored.width, 2);
        assert_eq!(stored.height, 2);
        assert!(stored.byte_size > 0);

        let entry = DbClipboardEntry {
            id: "clip_test".into(),
            content: String::new(),
            content_type: "image".into(),
            source_app: None,
            created_at: 0,
            content_hash: hash_image(&image),
            pinned: false,
            favorite: false,
            image_path: Some(stored.original_path.clone()),
            thumbnail_path: Some(stored.thumbnail_path.clone()),
            image_width: Some(2),
            image_height: Some(2),
            byte_size: stored.byte_size,
            file_count: 0,
            last_used_at: None,
            usage_count: 0,
        };
        remove(&paths, &entry);
        assert!(!PathBuf::from(&stored.original_path).exists());
        assert!(!PathBuf::from(&stored.thumbnail_path).exists());
        let _ = fs::remove_dir_all(root);
    }
}
