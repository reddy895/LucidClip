//! Clipboard Service coordinating classification, deduplication, and persistence

use crate::clipboard::classifier::classify_content;
use crate::clipboard::hasher::hash_content;
use crate::database::{ClipboardRepo, DbClipboardEntry, DbPool, SettingsRepo};
use crate::errors::Result;
use chrono::Utc;

const DEFAULT_MAX_HISTORY_ITEMS: usize = 500;
const DEFAULT_AUTO_CLEANUP_DAYS: u32 = 30;

pub struct ClipboardService<'a> {
    repo: ClipboardRepo<'a>,
    pool: &'a DbPool,
}

impl<'a> ClipboardService<'a> {
    pub fn new(pool: &'a DbPool) -> Self {
        Self {
            repo: ClipboardRepo::new(pool),
            pool,
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

    /// Apply the configured maximum item count and age policy to unpinned,
    /// non-favorite history.
    pub fn enforce_retention(&self) -> Result<usize> {
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

        Ok(removed)
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
        self.repo.delete(id)
    }

    pub fn clear_unpinned(&self) -> Result<usize> {
        self.repo.clear_unpinned()
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
