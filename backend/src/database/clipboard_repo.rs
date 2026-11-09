//! Clipboard Repository for SQLite persistence

use crate::database::connection::DbPool;
use crate::errors::{AppError, Result};
use rusqlite::params;
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
                "INSERT INTO clipboard_entries (id, content, content_type, source_app, created_at, content_hash, pinned, favorite)
                 VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)",
                params![
                    entry.id,
                    entry.content,
                    entry.content_type,
                    entry.source_app,
                    entry.created_at,
                    entry.content_hash,
                    if entry.pinned { 1 } else { 0 },
                    if entry.favorite { 1 } else { 0 },
                ],
            )?;
            Ok(())
        })
    }

    pub fn find_by_hash(&self, hash: &str) -> Result<Option<DbClipboardEntry>> {
        self.pool.with_conn(|conn| {
            let mut stmt = conn.prepare(
                "SELECT id, content, content_type, source_app, created_at, content_hash, pinned, favorite
                 FROM clipboard_entries WHERE content_hash = ?1",
            )?;
            let mut rows = stmt.query([hash])?;

            if let Some(row) = rows.next()? {
                Ok(Some(DbClipboardEntry {
                    id: row.get(0)?,
                    content: row.get(1)?,
                    content_type: row.get(2)?,
                    source_app: row.get(3)?,
                    created_at: row.get(4)?,
                    content_hash: row.get(5)?,
                    pinned: row.get::<_, i64>(6)? != 0,
                    favorite: row.get::<_, i64>(7)? != 0,
                }))
            } else {
                Ok(None)
            }
        })
    }

    pub fn find_by_id(&self, id: &str) -> Result<Option<DbClipboardEntry>> {
        self.pool.with_conn(|conn| {
            let mut stmt = conn.prepare(
                "SELECT id, content, content_type, source_app, created_at, content_hash, pinned, favorite
                 FROM clipboard_entries WHERE id = ?1",
            )?;
            let mut rows = stmt.query([id])?;

            if let Some(row) = rows.next()? {
                Ok(Some(DbClipboardEntry {
                    id: row.get(0)?,
                    content: row.get(1)?,
                    content_type: row.get(2)?,
                    source_app: row.get(3)?,
                    created_at: row.get(4)?,
                    content_hash: row.get(5)?,
                    pinned: row.get::<_, i64>(6)? != 0,
                    favorite: row.get::<_, i64>(7)? != 0,
                }))
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

    pub fn list_all(&self) -> Result<Vec<DbClipboardEntry>> {
        self.pool.with_conn(|conn| {
            let mut stmt = conn.prepare(
                "SELECT id, content, content_type, source_app, created_at, content_hash, pinned, favorite
                 FROM clipboard_entries ORDER BY created_at DESC",
            )?;

            let entries = stmt
                .query_map([], |row| {
                    Ok(DbClipboardEntry {
                        id: row.get(0)?,
                        content: row.get(1)?,
                        content_type: row.get(2)?,
                        source_app: row.get(3)?,
                        created_at: row.get(4)?,
                        content_hash: row.get(5)?,
                        pinned: row.get::<_, i64>(6)? != 0,
                        favorite: row.get::<_, i64>(7)? != 0,
                    })
                })?
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

    pub fn clear_unpinned(&self) -> Result<usize> {
        self.pool.with_conn(|conn| {
            let affected = conn.execute(
                "DELETE FROM clipboard_entries WHERE pinned = 0 AND favorite = 0",
                [],
            )?;
            Ok(affected)
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
