//! LucidClip Application Storage Paths Management

use crate::errors::{AppError, Result};
use directories::ProjectDirs;
use std::fs;
use std::path::{Path, PathBuf};

#[derive(Debug, Clone)]
pub struct AppPaths {
    pub root_dir: PathBuf,
    pub database_path: PathBuf,
    pub screenshots_dir: PathBuf,
    pub originals_dir: PathBuf,
    pub thumbnails_dir: PathBuf,
    pub logs_dir: PathBuf,
}

impl AppPaths {
    /// Resolve default application data directory
    pub fn default_paths() -> Self {
        let base_dir = if let Ok(local_app_data) = std::env::var("LOCALAPPDATA") {
            PathBuf::from(local_app_data).join("LucidClip")
        } else if let Some(proj_dirs) = ProjectDirs::from("com", "lucidclip", "LucidClip") {
            proj_dirs.data_local_dir().to_path_buf()
        } else {
            PathBuf::from(".lucidclip_data")
        };

        Self::from_root(base_dir)
    }

    /// Initialize path structures relative to a given root directory
    pub fn from_root<P: AsRef<Path>>(root: P) -> Self {
        let root_dir = root.as_ref().to_path_buf();
        let database_path = root_dir.join("lucidclip.db");
        let screenshots_dir = root_dir.join("screenshots");
        let originals_dir = screenshots_dir.join("originals");
        let thumbnails_dir = screenshots_dir.join("thumbnails");
        let logs_dir = root_dir.join("logs");

        Self {
            root_dir,
            database_path,
            screenshots_dir,
            originals_dir,
            thumbnails_dir,
            logs_dir,
        }
    }

    /// Create all required directories if they do not exist
    pub fn ensure_dirs_exist(&self) -> Result<()> {
        fs::create_dir_all(&self.root_dir)
            .map_err(|e| AppError::Storage(format!("Failed to create root directory: {e}")))?;
        fs::create_dir_all(&self.originals_dir).map_err(|e| {
            AppError::Storage(format!(
                "Failed to create screenshots originals directory: {e}"
            ))
        })?;
        fs::create_dir_all(&self.thumbnails_dir).map_err(|e| {
            AppError::Storage(format!(
                "Failed to create screenshots thumbnails directory: {e}"
            ))
        })?;
        fs::create_dir_all(&self.logs_dir)
            .map_err(|e| AppError::Storage(format!("Failed to create logs directory: {e}")))?;

        Ok(())
    }

    /// Normalize a media path (relative or absolute) to a canonical target under the screenshots directory.
    pub fn normalize_media_path(&self, path: &Path) -> PathBuf {
        // Prevent path traversal attempts
        if path.components().any(|c| matches!(c, std::path::Component::ParentDir)) {
            return self.screenshots_dir.join(path);
        }

        if path.is_relative() {
            if path.starts_with("originals") || path.starts_with("thumbnails") {
                return self.screenshots_dir.join(path);
            }
            if let Some(file_name) = path.file_name() {
                let in_orig = self.originals_dir.join(file_name);
                if in_orig.exists() {
                    return in_orig;
                }
                let in_thumb = self.thumbnails_dir.join(file_name);
                if in_thumb.exists() {
                    return in_thumb;
                }
            }
            return self.screenshots_dir.join(path);
        }

        // If path is absolute and within screenshots_dir, return directly
        if path.starts_with(&self.screenshots_dir) {
            return path.to_path_buf();
        }

        // Fallback for paths saved under a previous app data directory prior to restart/relocation
        if let Some(file_name) = path.file_name() {
            let in_orig = self.originals_dir.join(file_name);
            if in_orig.is_file() {
                return in_orig;
            }
            let in_thumb = self.thumbnails_dir.join(file_name);
            if in_thumb.is_file() {
                return in_thumb;
            }
            if path.components().any(|c| c.as_os_str() == "originals") {
                return in_orig;
            }
            if path.components().any(|c| c.as_os_str() == "thumbnails") {
                return in_thumb;
            }
        }

        path.to_path_buf()
    }

    /// Convert an absolute path within screenshots_dir to a portable relative path.
    pub fn to_relative_media_path(&self, path: &Path) -> PathBuf {
        if path.is_relative() {
            return path.to_path_buf();
        }
        if let Ok(rel) = path.strip_prefix(&self.screenshots_dir) {
            rel.to_path_buf()
        } else {
            path.to_path_buf()
        }
    }

    /// Whether a stored path is lexically inside the screenshots directory.
    ///
    /// This is a cheap boundary check for paths that may not exist yet (for
    /// example a thumbnail that will be regenerated).
    pub fn owns_media_path(&self, path: &Path) -> bool {
        if path.components().any(|c| matches!(c, std::path::Component::ParentDir)) {
            return false;
        }

        let normalized = self.normalize_media_path(path);
        normalized.starts_with(&self.screenshots_dir)
    }

    /// Reject paths outside the application's screenshot storage.
    pub fn validate_media_path(&self, path: &Path) -> Result<()> {
        if !self.owns_media_path(path) {
            return Err(AppError::InvalidInput(format!(
                "Refusing to access media outside the application data directory: {}",
                path.display()
            )));
        }
        Ok(())
    }

    /// Resolve an existing media file and guarantee it cannot escape the
    /// screenshot directory through a symlink.
    pub fn resolve_media_file(&self, path: &Path) -> Result<PathBuf> {
        self.validate_media_path(path)?;
        let normalized = self.normalize_media_path(path);

        let canonical_root = fs::canonicalize(&self.screenshots_dir).map_err(|err| {
            AppError::Storage(format!(
                "Failed to resolve the screenshots directory {}: {err}",
                self.screenshots_dir.display()
            ))
        })?;

        let canonical = fs::canonicalize(&normalized).map_err(|err| match err.kind() {
            std::io::ErrorKind::NotFound => AppError::NotFound(format!(
                "Media file is missing: {}",
                normalized.display()
            )),
            _ => AppError::Storage(format!(
                "Failed to resolve media file {}: {err}",
                normalized.display()
            )),
        })?;

        if !canonical.starts_with(&canonical_root) {
            return Err(AppError::InvalidInput(format!(
                "Refusing to follow media outside the application data directory: {}",
                normalized.display()
            )));
        }

        if !canonical.is_file() {
            return Err(AppError::NotFound(format!(
                "Media file is missing: {}",
                normalized.display()
            )));
        }

        Ok(canonical)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn test_paths() -> (PathBuf, AppPaths) {
        let root = std::env::temp_dir().join(format!(
            "lucidclip-paths-{}-{}",
            std::process::id(),
            std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .unwrap()
                .as_nanos()
        ));
        let paths = AppPaths::from_root(&root);
        paths.ensure_dirs_exist().unwrap();
        (root, paths)
    }

    #[test]
    fn media_paths_outside_the_screenshot_root_are_rejected() {
        let (root, paths) = test_paths();
        let outside = root.parent().unwrap().join(format!(
            "lucidclip-outside-{}.png",
            std::process::id()
        ));
        fs::write(&outside, b"outside").unwrap();

        assert!(!paths.owns_media_path(&outside));
        assert!(paths.validate_media_path(&outside).is_err());
        assert!(paths.resolve_media_file(&outside).is_err());

        let _ = fs::remove_file(outside);
        let _ = fs::remove_dir_all(root);
    }

    #[test]
    fn existing_media_files_resolve_inside_the_screenshot_root() {
        let (root, paths) = test_paths();
        let original = paths.originals_dir.join("shot_test.png");
        fs::write(&original, b"image").unwrap();

        assert!(paths.owns_media_path(&original));
        assert!(paths.validate_media_path(&original).is_ok());
        assert_eq!(
            paths.resolve_media_file(&original).unwrap(),
            fs::canonicalize(&original).unwrap()
        );

        let _ = fs::remove_dir_all(root);
    }

    #[test]
    fn missing_media_files_report_not_found() {
        let (root, paths) = test_paths();
        let missing = paths.thumbnails_dir.join("shot_missing.png");

        let error = paths.resolve_media_file(&missing).unwrap_err();
        assert!(matches!(error, AppError::NotFound(_)));

        let _ = fs::remove_dir_all(root);
    }
}
