//! Screenshot capture, thumbnail generation, and persistence.

use std::fs;
use std::path::Path;

use chrono::Utc;
use image::{DynamicImage, ImageFormat, RgbaImage};

use crate::database::{DbPool, DbScreenshotEntry, ScreenshotRepo};
use crate::errors::{AppError, Result};
use crate::platform::{self, CapturedImage, ScreenBounds};
use crate::storage::AppPaths;

/// Thumbnail bounding box. Aspect ratio is preserved.
const THUMBNAIL_WIDTH: u32 = 320;
const THUMBNAIL_HEIGHT: u32 = 180;

/// Maximum accepted capture dimension to reject obviously invalid input.
const MAX_CAPTURE_DIMENSION: u32 = 32_768;

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct CaptureRegion {
    pub x: i32,
    pub y: i32,
    pub width: u32,
    pub height: u32,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum CaptureMode {
    Fullscreen,
    Region(CaptureRegion),
}

impl CaptureMode {
    pub fn as_str(&self) -> &'static str {
        match self {
            CaptureMode::Fullscreen => "fullscreen",
            CaptureMode::Region(_) => "region",
        }
    }

    pub fn region(&self) -> Option<CaptureRegion> {
        match self {
            CaptureMode::Fullscreen => None,
            CaptureMode::Region(region) => Some(*region),
        }
    }
}

pub struct ScreenshotService<'a> {
    repo: ScreenshotRepo<'a>,
    paths: &'a AppPaths,
}

impl<'a> ScreenshotService<'a> {
    pub fn new(pool: &'a DbPool, paths: &'a AppPaths) -> Self {
        Self {
            repo: ScreenshotRepo::new(pool),
            paths,
        }
    }

    /// Capture from the operating system and persist the result.
    pub fn capture(&self, mode: CaptureMode) -> Result<DbScreenshotEntry> {
        let bounds = platform::virtual_screen_bounds()?;
        let region = match mode {
            CaptureMode::Fullscreen => CaptureRegion {
                x: bounds.x,
                y: bounds.y,
                width: bounds.width,
                height: bounds.height,
            },
            CaptureMode::Region(region) => {
                validate_region(&bounds, region)?;
                region
            }
        };

        let image = platform::capture_screen_region(
            region.x,
            region.y,
            region.width,
            region.height,
        )?;

        self.store(image, mode.as_str(), mode.region())
    }

    /// Persist an already captured image, generate a thumbnail, and insert metadata.
    pub fn store(
        &self,
        image: CapturedImage,
        capture_type: &str,
        region: Option<CaptureRegion>,
    ) -> Result<DbScreenshotEntry> {
        let rgba = RgbaImage::from_raw(image.width, image.height, image.rgba).ok_or_else(|| {
            AppError::Screenshot("Captured image buffer does not match its dimensions".into())
        })?;

        let id = format!("shot_{}", Utc::now().timestamp_micros());
        let original_path = self.paths.originals_dir.join(format!("{id}.png"));
        let thumbnail_path = self.paths.thumbnails_dir.join(format!("{id}.png"));

        let dynamic = DynamicImage::ImageRgba8(rgba);
        dynamic.save_with_format(&original_path, ImageFormat::Png)?;

        let thumbnail = dynamic.thumbnail(THUMBNAIL_WIDTH, THUMBNAIL_HEIGHT);
        if let Err(err) = thumbnail.save_with_format(&thumbnail_path, ImageFormat::Png) {
            remove_file_if_exists(&original_path);
            return Err(err.into());
        }

        let file_size = match fs::metadata(&original_path) {
            Ok(metadata) => metadata.len(),
            Err(err) => {
                remove_file_if_exists(&original_path);
                remove_file_if_exists(&thumbnail_path);
                return Err(err.into());
            }
        };

        let entry = DbScreenshotEntry {
            id,
            original_path: original_path.to_string_lossy().into_owned(),
            thumbnail_path: thumbnail_path.to_string_lossy().into_owned(),
            width: image.width,
            height: image.height,
            file_size,
            ocr_text: None,
            created_at: Utc::now().timestamp_millis(),
            pinned: false,
            favorite: false,
            capture_type: capture_type.to_string(),
            region_x: region.map(|r| r.x),
            region_y: region.map(|r| r.y),
            region_width: region.map(|r| r.width),
            region_height: region.map(|r| r.height),
        };

        if let Err(err) = self.repo.insert(&entry) {
            remove_file_if_exists(&original_path);
            remove_file_if_exists(&thumbnail_path);
            return Err(err);
        }

        Ok(entry)
    }

    pub fn list(&self) -> Result<Vec<DbScreenshotEntry>> {
        self.repo.list_all()
    }

    pub fn get(&self, id: &str) -> Result<Option<DbScreenshotEntry>> {
        self.repo.find_by_id(id)
    }

    pub fn toggle_pin(&self, id: &str) -> Result<bool> {
        self.repo.toggle_pin(id)
    }

    pub fn toggle_favorite(&self, id: &str) -> Result<bool> {
        self.repo.toggle_favorite(id)
    }

    /// Delete the database row first, then best-effort remove the image files.
    ///
    /// Removing files after the row means a failed unlink can only leave an
    /// orphaned file behind; it can never leave a gallery record pointing at
    /// missing images.
    pub fn delete(&self, id: &str) -> Result<bool> {
        let entry = self.repo.find_by_id(id)?;
        let Some(entry) = entry else {
            return Ok(false);
        };

        let deleted = self.repo.delete(id)?;
        if deleted {
            if let Err(err) = fs::remove_file(&entry.original_path) {
                if err.kind() != std::io::ErrorKind::NotFound {
                    eprintln!(
                        "[LucidClip Screenshots] Failed to remove original image: {err}"
                    );
                }
            }
            if let Err(err) = fs::remove_file(&entry.thumbnail_path) {
                if err.kind() != std::io::ErrorKind::NotFound {
                    eprintln!(
                        "[LucidClip Screenshots] Failed to remove thumbnail image: {err}"
                    );
                }
            }
        }

        Ok(deleted)
    }
}

fn remove_file_if_exists(path: &Path) {
    if let Err(err) = fs::remove_file(path) {
        if err.kind() != std::io::ErrorKind::NotFound {
            eprintln!("[LucidClip Screenshots] Failed to clean up image file: {err}");
        }
    }
}

pub fn validate_region(bounds: &ScreenBounds, region: CaptureRegion) -> Result<()> {
    if region.width == 0 || region.height == 0 {
        return Err(AppError::InvalidInput(
            "Screenshot region must have a positive width and height".into(),
        ));
    }

    if region.width > MAX_CAPTURE_DIMENSION || region.height > MAX_CAPTURE_DIMENSION {
        return Err(AppError::InvalidInput(
            "Screenshot region is larger than the supported maximum".into(),
        ));
    }

    let right = region.x as i64 + region.width as i64;
    let bottom = region.y as i64 + region.height as i64;
    let bounds_right = bounds.x as i64 + bounds.width as i64;
    let bounds_bottom = bounds.y as i64 + bounds.height as i64;

    if region.x < bounds.x
        || region.y < bounds.y
        || right > bounds_right
        || bottom > bounds_bottom
    {
        return Err(AppError::InvalidInput(
            "Screenshot region is outside the visible desktop".into(),
        ));
    }

    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::database::run_migrations;
    use crate::storage::AppPaths;

    fn test_image(width: u32, height: u32) -> CapturedImage {
        let mut rgba = Vec::with_capacity((width * height * 4) as usize);
        for _ in 0..width * height {
            rgba.extend_from_slice(&[32, 48, 64, 255]);
        }
        CapturedImage {
            width,
            height,
            rgba,
        }
    }

    #[test]
    fn region_validation_rejects_empty_and_out_of_bounds_requests() {
        let bounds = ScreenBounds {
            x: 0,
            y: 0,
            width: 1920,
            height: 1080,
        };

        assert!(validate_region(
            &bounds,
            CaptureRegion {
                x: 0,
                y: 0,
                width: 1920,
                height: 1080
            }
        )
        .is_ok());

        assert!(validate_region(
            &bounds,
            CaptureRegion {
                x: 0,
                y: 0,
                width: 0,
                height: 10
            }
        )
        .is_err());

        assert!(validate_region(
            &bounds,
            CaptureRegion {
                x: 1900,
                y: 0,
                width: 100,
                height: 100
            }
        )
        .is_err());
    }

    #[test]
    fn store_persists_original_thumbnail_and_metadata() {
        let root = std::env::temp_dir().join(format!(
            "lucidclip-shot-test-{}",
            Utc::now().timestamp_nanos_opt().unwrap_or_default()
        ));
        let paths = AppPaths::from_root(&root);
        paths.ensure_dirs_exist().unwrap();

        let pool = DbPool::open_in_memory().unwrap();
        run_migrations(&pool).unwrap();
        let service = ScreenshotService::new(&pool, &paths);

        let entry = service
            .store(test_image(64, 48), "fullscreen", None)
            .unwrap();

        assert_eq!(entry.width, 64);
        assert_eq!(entry.height, 48);
        assert_eq!(entry.capture_type, "fullscreen");
        assert!(Path::new(&entry.original_path).is_file());
        assert!(Path::new(&entry.thumbnail_path).is_file());
        assert_eq!(service.list().unwrap().len(), 1);

        assert!(service.delete(&entry.id).unwrap());
        assert!(!Path::new(&entry.original_path).exists());
        assert!(!Path::new(&entry.thumbnail_path).exists());
        assert!(service.list().unwrap().is_empty());

        fs::remove_dir_all(&root).ok();
    }
}
