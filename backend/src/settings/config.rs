//! LucidClip Application Configuration Management

use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ClipboardConfig {
    pub monitoring_enabled: bool,
    pub poll_interval_ms: u64,
    pub max_history_items: usize,
    pub deduplicate: bool,
    pub capture_images: bool,
    pub excluded_apps: Vec<String>,
}

impl Default for ClipboardConfig {
    fn default() -> Self {
        Self {
            monitoring_enabled: true,
            poll_interval_ms: 250,
            max_history_items: 2000,
            deduplicate: true,
            capture_images: false,
            excluded_apps: vec![
                "KeePass.exe".to_string(),
                "1Password.exe".to_string(),
                "Bitwarden.exe".to_string(),
            ],
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ScreenshotConfig {
    pub auto_ocr: bool,
    pub save_originals: bool,
    pub thumbnail_width: u32,
    pub thumbnail_height: u32,
    pub capture_sound: bool,
}

impl Default for ScreenshotConfig {
    fn default() -> Self {
        Self {
            auto_ocr: false,
            save_originals: true,
            thumbnail_width: 320,
            thumbnail_height: 180,
            capture_sound: false,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RetentionConfig {
    pub retention_days: u32,
    pub max_storage_bytes: u64,
    pub auto_purge_unpinned: bool,
}

impl Default for RetentionConfig {
    fn default() -> Self {
        Self {
            retention_days: 90,
            max_storage_bytes: 2 * 1024 * 1024 * 1024, // 2 GB
            auto_purge_unpinned: false,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PrivacyConfig {
    pub pause_monitoring: bool,
    pub local_only: bool,
    pub clear_on_exit: bool,
}

impl Default for PrivacyConfig {
    fn default() -> Self {
        Self {
            pause_monitoring: false,
            local_only: true,
            clear_on_exit: false,
        }
    }
}

#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct AppConfig {
    pub clipboard: ClipboardConfig,
    pub screenshots: ScreenshotConfig,
    pub retention: RetentionConfig,
    pub privacy: PrivacyConfig,
}
