//! Clipboard Repository for SQLite persistence

use crate::database::connection::DbPool;
use crate::errors::{AppError, Result};
use rusqlite::{params, OptionalExtension};
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DbClipboardEntry {
    pub id: String,
    pub content: String,
    pub content_type: String,
    pub source_app: Option<String>,
    pub created_at: i64,
    pub content_hash: String,
    pub pinned: bool,
    pub favorite: bool,
    pub image_path: Option<String>,
    pub thumbnail_path: Option<String>,
    pub image_width: Option<u32>,
    pub image_height: Option<u32>,
    pub byte_size: u64,
    pub file_count: u32,
    pub last_used_at: Option<i64>,
    pub usage_count: u32,
}

const ENTRY_COLUMNS: &str = "id, content, content_type, source_app, created_at, content_hash, pinned, favorite, image_path, thumbnail_path, image_width, image_height, byte_size, file_count, last_used_at, usage_count";

fn row_to_entry(row: &rusqlite::Row<'_>) -> rusqlite::Result<DbClipboardEntry> {
    Ok(DbClipboardEntry {
        id: row.get(0)?,
        content: row.get(1)?,
        content_type: row.get(2)?,
        source_app: row.get(3)?,
        created_at: row.get(4)?,
        content_hash: row.get(5)?,
        pinned: row.get::<_, i64>(6)? != 0,
        favorite: row.get::<_, i64>(7)? != 0,
        image_path: row.get(8)?,
        thumbnail_path: row.get(9)?,
        image_width: row.get(10)?,
        image_height: row.get(11)?,
        byte_size: row.get::<_, i64>(12)? as u64,
        file_count: row.get::<_, i64>(13)? as u32,
        last_used_at: row.get(14)?,
        usage_count: row.get::<_, i64>(15)? as u32,
    })
}

pub struct ClipboardRepo<'a> {
    pool: &'a DbPool,
}

impl<'a> ClipboardRepo<'a> {
    pub fn new(pool: &'a DbPool) -> Self {
        Self { pool }
    }

    pub fn insert(&self, entry: &DbClipboardEntry) -> Result<()> {
        self.pool.with_conn(|conn| {
            conn.execute(
                "INSERT INTO clipboard_entries (id, content, content_type, source_app, created_at, content_hash, pinned, favorite, image_path, thumbnail_path, image_width, image_height, byte_size, file_count, last_used_at, usage_count)
                 VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15, ?16)",
                params![
                    entry.id,
                    entry.content,
                    entry.content_type,
                    entry.source_app,
                    entry.created_at,
                    entry.content_hash,
                    if entry.pinned { 1 } else { 0 },
                    if entry.favorite { 1 } else { 0 },
                    entry.image_path,
                    entry.thumbnail_path,
                    entry.image_width,
                    entry.image_height,
                    entry.byte_size as i64,
                    entry.file_count as i64,
                    entry.last_used_at,
                    entry.usage_count as i64,
                ],
            )?;
            Ok(())
        })
    }

    pub fn find_by_hash(&self, hash: &str) -> Result<Option<DbClipboardEntry>> {
        self.pool.with_conn(|conn| {
            let mut stmt = conn.prepare(&format!(
                "SELECT {ENTRY_COLUMNS} FROM clipboard_entries WHERE content_hash = ?1"
            ))?;
            let mut rows = stmt.query([hash])?;

            if let Some(row) = rows.next()? {
                Ok(Some(row_to_entry(row)?))
            } else {
                Ok(None)
            }
        })
    }

    pub fn find_by_id(&self, id: &str) -> Result<Option<DbClipboardEntry>> {
        self.pool.with_conn(|conn| {
            let mut stmt = conn.prepare(&format!(
                "SELECT {ENTRY_COLUMNS} FROM clipboard_entries WHERE id = ?1"
            ))?;
            let mut rows = stmt.query([id])?;

            if let Some(row) = rows.next()? {
                Ok(Some(row_to_entry(row)?))
            } else {
                Ok(None)
            }
        })
    }

    pub fn update_timestamp(&self, id: &str, new_timestamp: i64) -> Result<()> {
        self.pool.with_conn(|conn| {
            conn.execute(
                "UPDATE clipboard_entries SET created_at = ?1 WHERE id = ?2",
                params![new_timestamp, id],
            )?;
            Ok(())
        })
    }

    pub fn touch(&self, id: &str) -> Result<()> {
        let now = chrono::Utc::now().timestamp_millis();
        self.pool.with_conn(|conn| {
            conn.execute(
                "UPDATE clipboard_entries
                 SET last_used_at = ?1, usage_count = usage_count + 1
                 WHERE id = ?2",
                params![now, id],
            )?;
            Ok(())
        })
    }

    pub fn list_all(&self) -> Result<Vec<DbClipboardEntry>> {
        self.pool.with_conn(|conn| {
            let mut stmt = conn.prepare(&format!(
                "SELECT {ENTRY_COLUMNS} FROM clipboard_entries ORDER BY created_at DESC, id DESC"
            ))?;

            let entries = stmt
                .query_map([], row_to_entry)?
                .collect::<std::result::Result<Vec<_>, _>>()?;

            Ok(entries)
        })
    }

    pub fn list_paginated(&self, limit: usize, offset: usize) -> Result<Vec<DbClipboardEntry>> {
        self.pool.with_conn(|conn| {
            let mut stmt = conn.prepare(&format!(
                "SELECT {ENTRY_COLUMNS} FROM clipboard_entries ORDER BY created_at DESC, id DESC LIMIT ?1 OFFSET ?2"
            ))?;

            let entries = stmt
                .query_map(params![limit as i64, offset as i64], row_to_entry)?
                .collect::<std::result::Result<Vec<_>, _>>()?;

            Ok(entries)
        })
    }

    pub fn search_entries(&self, query: &str, limit: usize) -> Result<Vec<DbClipboardEntry>> {
        let pattern = format!("%{}%", query.trim());
        self.pool.with_conn(|conn| {
            let mut stmt = conn.prepare(&format!(
                "SELECT {ENTRY_COLUMNS} FROM clipboard_entries
                 WHERE content LIKE ?1 OR source_app LIKE ?1 OR content_type LIKE ?1
                 ORDER BY pinned DESC, favorite DESC, created_at DESC, id DESC
                 LIMIT ?2"
            ))?;

            let entries = stmt
                .query_map(params![pattern, limit as i64], row_to_entry)?
                .collect::<std::result::Result<Vec<_>, _>>()?;

            Ok(entries)
        })
    }

    pub fn list_by_type(
        &self,
        content_type: &str,
        limit: usize,
        offset: usize,
    ) -> Result<Vec<DbClipboardEntry>> {
        self.pool.with_conn(|conn| {
            let mut stmt = conn.prepare(&format!(
                "SELECT {ENTRY_COLUMNS} FROM clipboard_entries
                 WHERE content_type = ?1
                 ORDER BY created_at DESC, id DESC
                 LIMIT ?2 OFFSET ?3"
            ))?;

            let entries = stmt
                .query_map(
                    params![content_type, limit as i64, offset as i64],
                    row_to_entry,
                )?
                .collect::<std::result::Result<Vec<_>, _>>()?;

            Ok(entries)
        })
    }

    pub fn toggle_pin(&self, id: &str) -> Result<bool> {
        self.pool.with_conn(|conn| {
            let current_pin: i64 = conn
                .query_row(
                    "SELECT pinned FROM clipboard_entries WHERE id = ?1",
                    [id],
                    |row| row.get(0),
                )
                .map_err(|_| AppError::NotFound(format!("Clipboard entry not found: {id}")))?;

            let new_pin = if current_pin != 0 { 0 } else { 1 };
            conn.execute(
                "UPDATE clipboard_entries SET pinned = ?1 WHERE id = ?2",
                params![new_pin, id],
            )?;

            Ok(new_pin != 0)
        })
    }

    pub fn toggle_favorite(&self, id: &str) -> Result<bool> {
        self.pool.with_conn(|conn| {
            let current_fav: i64 = conn
                .query_row(
                    "SELECT favorite FROM clipboard_entries WHERE id = ?1",
                    [id],
                    |row| row.get(0),
                )
                .map_err(|_| AppError::NotFound(format!("Clipboard entry not found: {id}")))?;

            let new_fav = if current_fav != 0 { 0 } else { 1 };
            conn.execute(
                "UPDATE clipboard_entries SET favorite = ?1 WHERE id = ?2",
                params![new_fav, id],
            )?;

            Ok(new_fav != 0)
        })
    }

    pub fn delete(&self, id: &str) -> Result<bool> {
        self.pool.with_conn(|conn| {
            let affected = conn.execute("DELETE FROM clipboard_entries WHERE id = ?1", [id])?;
            Ok(affected > 0)
        })
    }

    pub fn delete_entry_transactional(&self, id: &str) -> Result<Option<DbClipboardEntry>> {
        self.pool.with_conn(|conn| {
            let tx = conn.transaction()?;
            let entry = {
                let mut stmt = tx.prepare(&format!(
                    "SELECT {ENTRY_COLUMNS} FROM clipboard_entries WHERE id = ?1"
                ))?;
                stmt.query_row([id], row_to_entry).optional()?
            };

            if entry.is_some() {
                tx.execute("DELETE FROM clipboard_entries WHERE id = ?1", [id])?;
            }
            tx.commit()?;
            Ok(entry)
        })
    }

    pub fn clear_unpinned(&self) -> Result<usize> {
        self.pool.with_conn(|conn| {
            let affected = conn.execute(
                "DELETE FROM clipboard_entries WHERE pinned = 0 AND favorite = 0",
                [],
            )?;
            Ok(affected)
        })
    }

    pub fn clear_unpinned_transactional(&self) -> Result<Vec<DbClipboardEntry>> {
        self.pool.with_conn(|conn| {
            let tx = conn.transaction()?;
            let unpinned: Vec<DbClipboardEntry> = {
                let mut stmt = tx.prepare(&format!(
                    "SELECT {ENTRY_COLUMNS} FROM clipboard_entries WHERE pinned = 0 AND favorite = 0"
                ))?;
                let rows = stmt.query_map([], row_to_entry)?
                    .collect::<std::result::Result<Vec<_>, _>>()?;
                rows
            };

            if !unpinned.is_empty() {
                tx.execute(
                    "DELETE FROM clipboard_entries WHERE pinned = 0 AND favorite = 0",
                    [],
                )?;
            }
            tx.commit()?;
            Ok(unpinned)
        })
    }

    /// Remove unpinned, non-favorite entries older than the cutoff timestamp.
    pub fn purge_older_than(&self, cutoff_millis: i64) -> Result<usize> {
        self.pool.with_conn(|conn| {
            let affected = conn.execute(
                "DELETE FROM clipboard_entries
                 WHERE created_at < ?1 AND pinned = 0 AND favorite = 0",
                [cutoff_millis],
            )?;
            Ok(affected)
        })
    }

    /// Keep only the newest `max_items` rows, preserving pinned and favorite
    /// entries even when they fall outside the window.
    pub fn enforce_max_items(&self, max_items: usize) -> Result<usize> {
        self.pool.with_conn(|conn| {
            let affected = conn.execute(
                "DELETE FROM clipboard_entries
                 WHERE pinned = 0 AND favorite = 0
                   AND id NOT IN (
                     SELECT id FROM clipboard_entries
                     ORDER BY created_at DESC LIMIT ?1
                   )",
                [max_items as i64],
            )?;
            Ok(affected)
        })
    }

    pub fn count(&self) -> Result<usize> {
        self.pool.with_conn(|conn| {
            let count: usize =
                conn.query_row("SELECT COUNT(*) FROM clipboard_entries", [], |row| {
                    row.get(0)
                })?;
            Ok(count)
        })
    }
}
