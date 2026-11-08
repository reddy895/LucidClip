//! Cryptographic Content Hashing for Deduplication

use sha2::{Digest, Sha256};

/// Computes SHA-256 hash of normalized clipboard content.
/// Normalizes CRLF line endings to LF and trims trailing line endings for consistent deduplication.
pub fn hash_content(content: &str) -> String {
    let normalized = content
        .replace("\r\n", "\n")
        .trim_end_matches(['\r', '\n'])
        .to_string();

    let mut hasher = Sha256::new();
    hasher.update(normalized.as_bytes());
    format!("{:x}", hasher.finalize())
}
