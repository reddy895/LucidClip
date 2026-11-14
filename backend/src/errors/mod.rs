//! LucidClip Structured Error Handling

use serde::Serialize;
use thiserror::Error;

pub type Result<T> = std::result::Result<T, AppError>;

#[derive(Error, Debug, Clone, Serialize)]
#[serde(tag = "type", content = "message")]
pub enum AppError {
    #[error("Database error: {0}")]
    Database(String),

    #[error("Clipboard access error: {0}")]
    Clipboard(String),

    #[error("Screenshot capture error: {0}")]
    Screenshot(String),

    #[error("Storage I/O error: {0}")]
    Storage(String),

    #[error("Settings error: {0}")]
    Settings(String),

    #[error("Invalid input or parameter: {0}")]
    InvalidInput(String),

    #[error("Resource not found: {0}")]
    NotFound(String),

    #[error("System or OS error: {0}")]
    System(String),

    #[error("Global shortcut error: {0}")]
    GlobalShortcut(String),

    #[error("Instant paste error: {0}")]
    InstantPaste(String),

    #[error("Focus restoration error: {0}")]
    FocusRestoration(String),
}

impl From<rusqlite::Error> for AppError {
    fn from(err: rusqlite::Error) -> Self {
        AppError::Database(err.to_string())
    }
}

impl From<std::io::Error> for AppError {
    fn from(err: std::io::Error) -> Self {
        AppError::Storage(err.to_string())
    }
}

impl From<image::ImageError> for AppError {
    fn from(err: image::ImageError) -> Self {
        AppError::Screenshot(format!("Image encoding/decoding failed: {err}"))
    }
}
