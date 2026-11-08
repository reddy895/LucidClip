//! Clipboard Service coordinating classification, deduplication, and persistence

use chrono::Utc;
use crate::clipboard::classifier::classify_content;
use crate::clipboard::hasher::hash_content;
use crate::database::{ClipboardRepo, DbClipboardEntry, DbPool};
use crate::errors::Result;

pub struct ClipboardService<'a> {
    repo: ClipboardRepo<'a>,
}

impl<'a> ClipboardService<'a> {
    pub fn new(pool: &'a DbPool) -> Self {
        Self {
            repo: ClipboardRepo::new(pool),
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
        };

        self.repo.insert(&new_entry)?;
        Ok(new_entry)
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
