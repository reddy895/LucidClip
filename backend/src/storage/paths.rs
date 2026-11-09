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
}
