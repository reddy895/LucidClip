//! Settings Repository for SQLite persistence

use crate::database::connection::DbPool;
use crate::errors::Result;
use chrono::Utc;
use rusqlite::params;
use std::collections::HashMap;

pub struct SettingsRepo<'a> {
    pool: &'a DbPool,
}

impl<'a> SettingsRepo<'a> {
    pub fn new(pool: &'a DbPool) -> Self {
        Self { pool }
    }

    pub fn get(&self, key: &str) -> Result<Option<String>> {
        self.pool.with_conn(|conn| {
            let mut stmt = conn.prepare("SELECT value FROM settings WHERE key = ?1")?;
            let mut rows = stmt.query([key])?;

            if let Some(row) = rows.next()? {
                Ok(Some(row.get(0)?))
            } else {
                Ok(None)
            }
        })
    }

    pub fn set(&self, key: &str, value: &str) -> Result<()> {
        let now = Utc::now().timestamp_millis();
        self.pool.with_conn(|conn| {
            conn.execute(
                "INSERT INTO settings (key, value, updated_at) VALUES (?1, ?2, ?3)
                 ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at",
                params![key, value, now],
            )?;
            Ok(())
        })
    }

    pub fn get_all(&self) -> Result<HashMap<String, String>> {
        self.pool.with_conn(|conn| {
            let mut stmt = conn.prepare("SELECT key, value FROM settings")?;
            let rows = stmt.query_map([], |row| {
                Ok((row.get::<_, String>(0)?, row.get::<_, String>(1)?))
            })?;

            let mut map = HashMap::new();
            for item in rows {
                let (k, v) = item?;
                map.insert(k, v);
            }

            Ok(map)
        })
    }
}
