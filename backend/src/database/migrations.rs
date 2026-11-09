//! SQLite Database Migrations System

use chrono::Utc;
use crate::database::connection::DbPool;
use crate::errors::Result;

pub struct Migration {
    pub version: i64,
    pub description: &'static str,
    pub sql: &'static str,
}

pub const MIGRATIONS: &[Migration] = &[
    Migration {
        version: 1,
        description: "create clipboard_entries table",
        sql: "CREATE TABLE IF NOT EXISTS clipboard_entries (
            id TEXT PRIMARY KEY,
            content TEXT NOT NULL,
            content_type TEXT NOT NULL,
            source_app TEXT,
            created_at INTEGER NOT NULL,
            content_hash TEXT NOT NULL UNIQUE,
            pinned INTEGER NOT NULL DEFAULT 0,
            favorite INTEGER NOT NULL DEFAULT 0
        );",
    },
    Migration {
        version: 2,
        description: "create screenshots table",
        sql: "CREATE TABLE IF NOT EXISTS screenshots (
            id TEXT PRIMARY KEY,
            original_path TEXT NOT NULL,
            thumbnail_path TEXT NOT NULL,
            width INTEGER NOT NULL,
            height INTEGER NOT NULL,
            file_size INTEGER NOT NULL,
            ocr_text TEXT,
            created_at INTEGER NOT NULL,
            pinned INTEGER NOT NULL DEFAULT 0,
            favorite INTEGER NOT NULL DEFAULT 0
        );",
    },
    Migration {
        version: 3,
        description: "create settings table",
        sql: "CREATE TABLE IF NOT EXISTS settings (
            key TEXT PRIMARY KEY,
            value TEXT NOT NULL,
            updated_at INTEGER NOT NULL
        );",
    },
    Migration {
        version: 4,
        description: "create indexes for performance and search",
        sql: "CREATE INDEX IF NOT EXISTS idx_clipboard_created ON clipboard_entries(created_at DESC);
              CREATE INDEX IF NOT EXISTS idx_clipboard_pinned ON clipboard_entries(pinned);
              CREATE INDEX IF NOT EXISTS idx_clipboard_fav ON clipboard_entries(favorite);
              CREATE INDEX IF NOT EXISTS idx_clipboard_type ON clipboard_entries(content_type);
              CREATE INDEX IF NOT EXISTS idx_screenshots_created ON screenshots(created_at DESC);
              CREATE INDEX IF NOT EXISTS idx_screenshots_pinned ON screenshots(pinned);
              CREATE INDEX IF NOT EXISTS idx_screenshots_fav ON screenshots(favorite);",
    },
    Migration {
        version: 5,
        description: "persist screenshot capture metadata",
        sql: "ALTER TABLE screenshots ADD COLUMN capture_type TEXT NOT NULL DEFAULT 'fullscreen';
              ALTER TABLE screenshots ADD COLUMN region_x INTEGER;
              ALTER TABLE screenshots ADD COLUMN region_y INTEGER;
              ALTER TABLE screenshots ADD COLUMN region_width INTEGER;
              ALTER TABLE screenshots ADD COLUMN region_height INTEGER;",
    },
];

pub fn run_migrations(pool: &DbPool) -> Result<()> {
    pool.with_conn(|conn| {
        // Initialize migrations tracking table
        conn.execute_batch(
            "CREATE TABLE IF NOT EXISTS schema_migrations (
                version INTEGER PRIMARY KEY,
                applied_at INTEGER NOT NULL,
                description TEXT NOT NULL
            );"
        )?;

        for m in MIGRATIONS {
            let already_applied: bool = conn.query_row(
                "SELECT EXISTS(SELECT 1 FROM schema_migrations WHERE version = ?1)",
                [m.version],
                |row| row.get(0),
            )?;

            if !already_applied {
                let tx = conn.transaction()?;
                tx.execute_batch(m.sql)?;
                let now = Utc::now().timestamp_millis();
                tx.execute(
                    "INSERT INTO schema_migrations (version, applied_at, description) VALUES (?1, ?2, ?3)",
                    (m.version, now, m.description),
                )?;
                tx.commit()?;
                println!("[LucidClip DB] Applied migration {} - {}", m.version, m.description);
            }
        }

        Ok(())
    })
}
