//! Screenshot Repository for SQLite persistence

use crate::database::connection::DbPool;
use crate::errors::{AppError, Result};
use rusqlite::params;
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DbScreenshotEntry {
    pub id: String,
    pub original_path: String,
    pub thumbnail_path: String,
    pub width: u32,
    pub height: u32,
    pub file_size: u64,
    pub ocr_text: Option<String>,
    pub created_at: i64,
    pub pinned: bool,
    pub favorite: bool,
    pub capture_type: String,
    pub region_x: Option<i32>,
    pub region_y: Option<i32>,
    pub region_width: Option<u32>,
    pub region_height: Option<u32>,
}

pub struct ScreenshotRepo<'a> {
    pool: &'a DbPool,
}

impl<'a> ScreenshotRepo<'a> {
    pub fn new(pool: &'a DbPool) -> Self {
        Self { pool }
    }

    pub fn insert(&self, entry: &DbScreenshotEntry) -> Result<()> {
        self.pool.with_conn(|conn| {
            conn.execute(
                "INSERT INTO screenshots (id, original_path, thumbnail_path, width, height, file_size, ocr_text, created_at, pinned, favorite, capture_type, region_x, region_y, region_width, region_height)
                 VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15)",
                params![
                    entry.id,
                    entry.original_path,
                    entry.thumbnail_path,
                    entry.width,
                    entry.height,
                    entry.file_size as i64,
                    entry.ocr_text,
                    entry.created_at,
                    if entry.pinned { 1 } else { 0 },
                    if entry.favorite { 1 } else { 0 },
                    entry.capture_type,
                    entry.region_x,
                    entry.region_y,
                    entry.region_width,
                    entry.region_height,
                ],
            )?;
            Ok(())
        })
    }

    pub fn find_by_id(&self, id: &str) -> Result<Option<DbScreenshotEntry>> {
        self.pool.with_conn(|conn| {
            let mut stmt = conn.prepare(
                "SELECT id, original_path, thumbnail_path, width, height, file_size, ocr_text, created_at, pinned, favorite, capture_type, region_x, region_y, region_width, region_height
                 FROM screenshots WHERE id = ?1",
            )?;
            let mut rows = stmt.query([id])?;

            if let Some(row) = rows.next()? {
                Ok(Some(DbScreenshotEntry {
                    id: row.get(0)?,
                    original_path: row.get(1)?,
                    thumbnail_path: row.get(2)?,
                    width: row.get(3)?,
                    height: row.get(4)?,
                    file_size: row.get::<_, i64>(5)? as u64,
                    ocr_text: row.get(6)?,
                    created_at: row.get(7)?,
                    pinned: row.get::<_, i64>(8)? != 0,
                    favorite: row.get::<_, i64>(9)? != 0,
                    capture_type: row.get(10)?,
                    region_x: row.get(11)?,
                    region_y: row.get(12)?,
                    region_width: row.get(13)?,
                    region_height: row.get(14)?,
                }))
            } else {
                Ok(None)
            }
        })
    }

    pub fn list_all(&self) -> Result<Vec<DbScreenshotEntry>> {
        self.pool.with_conn(|conn| {
            let mut stmt = conn.prepare(
                "SELECT id, original_path, thumbnail_path, width, height, file_size, ocr_text, created_at, pinned, favorite, capture_type, region_x, region_y, region_width, region_height
                 FROM screenshots ORDER BY created_at DESC",
            )?;

            let entries = stmt
                .query_map([], |row| {
                    Ok(DbScreenshotEntry {
                        id: row.get(0)?,
                        original_path: row.get(1)?,
                        thumbnail_path: row.get(2)?,
                        width: row.get(3)?,
                        height: row.get(4)?,
                        file_size: row.get::<_, i64>(5)? as u64,
                        ocr_text: row.get(6)?,
                        created_at: row.get(7)?,
                        pinned: row.get::<_, i64>(8)? != 0,
                        favorite: row.get::<_, i64>(9)? != 0,
                        capture_type: row.get(10)?,
                        region_x: row.get(11)?,
                        region_y: row.get(12)?,
                        region_width: row.get(13)?,
                        region_height: row.get(14)?,
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
                    "SELECT pinned FROM screenshots WHERE id = ?1",
                    [id],
                    |row| row.get(0),
                )
                .map_err(|_| AppError::NotFound(format!("Screenshot entry not found: {id}")))?;

            let new_pin = if current_pin != 0 { 0 } else { 1 };
            conn.execute(
                "UPDATE screenshots SET pinned = ?1 WHERE id = ?2",
                params![new_pin, id],
            )?;

            Ok(new_pin != 0)
        })
    }

    pub fn toggle_favorite(&self, id: &str) -> Result<bool> {
        self.pool.with_conn(|conn| {
            let current_fav: i64 = conn
                .query_row(
                    "SELECT favorite FROM screenshots WHERE id = ?1",
                    [id],
                    |row| row.get(0),
                )
                .map_err(|_| AppError::NotFound(format!("Screenshot entry not found: {id}")))?;

            let new_fav = if current_fav != 0 { 0 } else { 1 };
            conn.execute(
                "UPDATE screenshots SET favorite = ?1 WHERE id = ?2",
                params![new_fav, id],
            )?;

            Ok(new_fav != 0)
        })
    }

    pub fn delete(&self, id: &str) -> Result<bool> {
        self.pool.with_conn(|conn| {
            let affected = conn.execute("DELETE FROM screenshots WHERE id = ?1", [id])?;
            Ok(affected > 0)
        })
    }

    pub fn count(&self) -> Result<usize> {
        self.pool.with_conn(|conn| {
            let count: usize =
                conn.query_row("SELECT COUNT(*) FROM screenshots", [], |row| row.get(0))?;
            Ok(count)
        })
    }
}
