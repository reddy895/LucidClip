//! SQLite Database Connection Management

use crate::errors::{AppError, Result};
use rusqlite::Connection;
use std::path::Path;
use std::sync::Mutex;

pub struct DbPool {
    conn: Mutex<Connection>,
}

impl DbPool {
    /// Open SQLite database at the specified path and apply optimal desktop PRAGMAs
    pub fn open<P: AsRef<Path>>(path: P) -> Result<Self> {
        let conn = Connection::open(path)?;

        // Configure SQLite performance and concurrency settings
        conn.execute_batch(
            "PRAGMA journal_mode = WAL;
             PRAGMA synchronous = NORMAL;
             PRAGMA foreign_keys = ON;
             PRAGMA busy_timeout = 5000;
             PRAGMA cache_size = -2000;",
        )?;

        Ok(Self {
            conn: Mutex::new(conn),
        })
    }

    /// Open an in-memory SQLite database for testing
    pub fn open_in_memory() -> Result<Self> {
        let conn = Connection::open_in_memory()?;
        conn.execute_batch(
            "PRAGMA foreign_keys = ON;
             PRAGMA busy_timeout = 5000;",
        )?;

        Ok(Self {
            conn: Mutex::new(conn),
        })
    }

    /// Execute a closure with exclusive access to the database connection
    pub fn with_conn<F, T>(&self, f: F) -> Result<T>
    where
        F: FnOnce(&mut Connection) -> Result<T>,
    {
        let mut guard = self
            .conn
            .lock()
            .map_err(|e| AppError::Database(format!("Failed to acquire database lock: {e}")))?;
        f(&mut guard)
    }

    /// Check SQLite database integrity using PRAGMA integrity_check
    pub fn pragma_integrity_check(&self) -> Result<bool> {
        self.with_conn(|conn| {
            let result: String = conn.query_row("PRAGMA integrity_check;", [], |row| row.get(0))?;
            Ok(result == "ok")
        })
    }

    /// Run WAL checkpoint maintenance to truncate WAL journal and prevent file growth
    pub fn wal_checkpoint(&self) -> Result<()> {
        self.with_conn(|conn| {
            conn.execute_batch("PRAGMA wal_checkpoint(TRUNCATE);")?;
            Ok(())
        })
    }
}
