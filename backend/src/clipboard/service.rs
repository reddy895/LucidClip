//! Clipboard Service coordinating classification, deduplication, and persistence

use std::collections::HashSet;

use crate::clipboard::classifier::classify_content;
use crate::clipboard::hasher::hash_content;
use crate::clipboard::media;
use crate::database::{ClipboardRepo, DbClipboardEntry, DbPool, SettingsRepo};
use crate::errors::{AppError, Result};
use crate::platform::CapturedImage;
use crate::storage::AppPaths;
use chrono::Utc;

const DEFAULT_MAX_HISTORY_ITEMS: usize = 500;
const DEFAULT_AUTO_CLEANUP_DAYS: u32 = 30;

pub struct ClipboardService<'a> {
    repo: ClipboardRepo<'a>,
    pool: &'a DbPool,
    paths: Option<&'a AppPaths>,
}

impl<'a> ClipboardService<'a> {
    pub fn new(pool: &'a DbPool) -> Self {
        Self {
            repo: ClipboardRepo::new(pool),
            pool,
            paths: None,
        }
    }

    pub fn with_paths(pool: &'a DbPool, paths: &'a AppPaths) -> Self {
        Self {
            repo: ClipboardRepo::new(pool),
            pool,
            paths: Some(paths),
        }
    }

    /// Process a captured text change from the system clipboard.
    /// Deduplicates content: if already present, updates timestamp without creating duplicate rows.
    pub fn process_copied_text(
        &self,
        raw_text: &str,
        source_app: Option<String>,
    ) -> Result<DbClipboardEntry> {
        let content_hash = hash_content(raw_text);
        let now = Utc::now().timestamp_millis();

        // Check if an entry with this hash already exists
        if let Some(mut existing) = self.repo.find_by_hash(&content_hash)? {
            self.repo.update_timestamp(&existing.id, now)?;
            existing.created_at = now;
            return Ok(existing);
        }

        // Generate unique entry ID
        let entry_id = format!("clip_{}_{}", now, &content_hash[..8]);
        let content_type = classify_content(raw_text).as_str().to_string();

        let new_entry = DbClipboardEntry {
            id: entry_id,
            content: raw_text.to_string(),
            content_type,
            source_app,
            created_at: now,
            content_hash,
            pinned: false,
            favorite: false,
            image_path: None,
            thumbnail_path: None,
            image_width: None,
            image_height: None,
            byte_size: raw_text.len() as u64,
            file_count: 0,
        };

        self.repo.insert(&new_entry)?;

        // Retention must never discard a successful capture, so a failure is
        // reported to the log rather than failing the clipboard operation.
        if let Err(err) = self.enforce_retention() {
            eprintln!("[LucidClip Clipboard] Retention cleanup failed: {err}");
        }

        Ok(new_entry)
    }

    /// Process a copied image from the system clipboard.
    pub fn process_copied_image(
        &self,
        image: CapturedImage,
        source_app: Option<String>,
    ) -> Result<DbClipboardEntry> {
        let paths = self.paths.ok_or_else(|| {
            AppError::Clipboard("Clipboard image storage is not configured".into())
        })?;

        let content_hash = media::hash_image(&image);
        let now = Utc::now().timestamp_millis();

        if let Some(mut existing) = self.repo.find_by_hash(&content_hash)? {
            self.repo.update_timestamp(&existing.id, now)?;
            existing.created_at = now;
            return Ok(existing);
        }

        let entry_id = format!("clip_{}_{}", now, &content_hash[..8]);
        let stored = media::store(paths, &entry_id, &image)?;

        let new_entry = DbClipboardEntry {
            id: entry_id,
            content: String::new(),
            content_type: "image".into(),
            source_app,
            created_at: now,
            content_hash,
            pinned: false,
            favorite: false,
            image_path: Some(stored.original_path),
            thumbnail_path: Some(stored.thumbnail_path),
            image_width: Some(stored.width),
            image_height: Some(stored.height),
            byte_size: stored.byte_size,
            file_count: 0,
        };

        if let Err(err) = self.repo.insert(&new_entry) {
            media::remove(paths, &new_entry);
            return Err(err);
        }

        if let Err(err) = self.enforce_retention() {
            eprintln!("[LucidClip Clipboard] Retention cleanup failed: {err}");
        }

        Ok(new_entry)
    }

    /// Apply the configured maximum item count and age policy to unpinned,
    /// non-favorite history.
    pub fn enforce_retention(&self) -> Result<usize> {
        let before = self.repo.list_all()?;
        let settings = SettingsRepo::new(self.pool);
        let policy = settings
            .get("app_settings")?
            .and_then(|raw| serde_json::from_str::<serde_json::Value>(&raw).ok());

        let max_items = policy
            .as_ref()
            .and_then(|value| value.pointer("/clipboard/maxHistoryItems"))
            .and_then(serde_json::Value::as_u64)
            .map(|value| value.clamp(10, 100_000) as usize)
            .unwrap_or(DEFAULT_MAX_HISTORY_ITEMS);

        let cleanup_days = policy
            .as_ref()
            .and_then(|value| value.pointer("/clipboard/autoCleanupDays"))
            .and_then(serde_json::Value::as_u64)
            .map(|value| value.min(3_650) as u32)
            .unwrap_or(DEFAULT_AUTO_CLEANUP_DAYS);

        let mut removed = self.repo.enforce_max_items(max_items)?;

        if cleanup_days > 0 {
            let cutoff =
                Utc::now().timestamp_millis() - i64::from(cleanup_days) * 24 * 60 * 60 * 1_000;
            removed += self.repo.purge_older_than(cutoff)?;
        }

        self.remove_deleted_media(before, removed);
        Ok(removed)
    }

    fn remove_deleted_media(&self, before: Vec<DbClipboardEntry>, removed: usize) {
        let Some(paths) = self.paths else {
            return;
        };
        if removed == 0 {
            return;
        }

        let Ok(remaining) = self.repo.list_all() else {
            eprintln!("[LucidClip Clipboard] Could not reconcile deleted media files.");
            return;
        };
        let remaining_ids: HashSet<String> = remaining.into_iter().map(|entry| entry.id).collect();

        for entry in before {
            if !remaining_ids.contains(&entry.id) {
                media::remove(paths, &entry);
            }
        }
    }

    pub fn get_history(&self) -> Result<Vec<DbClipboardEntry>> {
        self.repo.list_all()
    }

    pub fn get_entry_by_id(&self, id: &str) -> Result<Option<DbClipboardEntry>> {
        self.repo.find_by_id(id)
    }

    pub fn toggle_pin(&self, id: &str) -> Result<bool> {
        self.repo.toggle_pin(id)
    }

    pub fn toggle_favorite(&self, id: &str) -> Result<bool> {
        self.repo.toggle_favorite(id)
    }

    pub fn delete_entry(&self, id: &str) -> Result<bool> {
        let entry = self.repo.find_by_id(id)?;
        let deleted = self.repo.delete(id)?;
        if deleted {
            if let (Some(paths), Some(entry)) = (self.paths, entry) {
                media::remove(paths, &entry);
            }
        }
        Ok(deleted)
    }

    pub fn clear_unpinned(&self) -> Result<usize> {
        let before = self.repo.list_all()?;
        let removed = self.repo.clear_unpinned()?;
        if removed > 0 {
            if let Some(paths) = self.paths {
                for entry in before {
                    if !entry.pinned && !entry.favorite {
                        media::remove(paths, &entry);
                    }
                }
            }
        }
        Ok(removed)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::database::run_migrations;

    #[test]
    fn retention_limits_unpinned_history_and_preserves_marks() {
        let pool = DbPool::open_in_memory().unwrap();
        run_migrations(&pool).unwrap();
        let settings = SettingsRepo::new(&pool);
        settings
            .set(
                "app_settings",
                r#"{"clipboard":{"maxHistoryItems":10,"autoCleanupDays":0}}"#,
            )
            .unwrap();

        let service = ClipboardService::new(&pool);
        for index in 0..12 {
            service
                .process_copied_text(&format!("entry {index}"), None)
                .unwrap();
        }

        let repo = ClipboardRepo::new(&pool);
        assert_eq!(repo.count().unwrap(), 10);

        let oldest = repo.list_all().unwrap().last().cloned().unwrap();
        repo.toggle_pin(&oldest.id).unwrap();
        service.process_copied_text("entry 12", None).unwrap();
        assert!(repo.find_by_id(&oldest.id).unwrap().is_some());
    }

    #[test]
    fn copied_images_are_persisted_deduplicated_and_deleted_with_files() {
        let root = std::env::temp_dir().join(format!(
            "lucidclip-service-image-{}-{}",
            std::process::id(),
            std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .unwrap()
                .as_nanos()
        ));
        let paths = AppPaths::from_root(&root);
        paths.ensure_dirs_exist().unwrap();

        let pool = DbPool::open_in_memory().unwrap();
        run_migrations(&pool).unwrap();
        let service = ClipboardService::with_paths(&pool, &paths);
        let image = CapturedImage {
            rgba: vec![
                255, 0, 0, 255, 0, 255, 0, 255, 0, 0, 255, 255, 255, 255, 255, 255,
            ],
            width: 2,
            height: 2,
        };

        let first = service
            .process_copied_image(image.clone(), Some("Chrome.exe".into()))
            .unwrap();
        assert_eq!(first.content_type, "image");
        assert_eq!(first.image_width, Some(2));
        assert!(std::path::Path::new(first.image_path.as_ref().unwrap()).is_file());
        assert!(std::path::Path::new(first.thumbnail_path.as_ref().unwrap()).is_file());

        let second = service
            .process_copied_image(image, Some("Chrome.exe".into()))
            .unwrap();
        assert_eq!(first.id, second.id);
        assert_eq!(service.get_history().unwrap().len(), 1);

        let original = first.image_path.clone().unwrap();
        let thumbnail = first.thumbnail_path.clone().unwrap();
        assert!(service.delete_entry(&first.id).unwrap());
        assert!(!std::path::Path::new(&original).exists());
        assert!(!std::path::Path::new(&thumbnail).exists());
        let _ = std::fs::remove_dir_all(root);
    }

    #[test]
    fn retention_purges_old_unpinned_entries() {
        let pool = DbPool::open_in_memory().unwrap();
        run_migrations(&pool).unwrap();
        let settings = SettingsRepo::new(&pool);
        settings
            .set(
                "app_settings",
                r#"{"clipboard":{"maxHistoryItems":500,"autoCleanupDays":7}}"#,
            )
            .unwrap();

        let repo = ClipboardRepo::new(&pool);
        let now = Utc::now().timestamp_millis();
        repo.insert(&DbClipboardEntry {
            id: "old-entry".into(),
            content: "old".into(),
            content_type: "plain".into(),
            source_app: None,
            created_at: now - 10 * 24 * 60 * 60 * 1_000,
            content_hash: "old-hash".into(),
            pinned: false,
            favorite: false,
            image_path: None,
            thumbnail_path: None,
            image_width: None,
            image_height: None,
            byte_size: 3,
            file_count: 0,
        })
        .unwrap();

        let service = ClipboardService::new(&pool);
        assert_eq!(service.enforce_retention().unwrap(), 1);
        assert!(repo.find_by_id("old-entry").unwrap().is_none());
    }
}
