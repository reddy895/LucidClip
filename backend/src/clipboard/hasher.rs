//! Cryptographic Content Hashing for Deduplication

use sha2::{Digest, Sha256};

/// Computes SHA-256 hash of normalized clipboard content.
/// Normalizes CRLF line endings to LF and trims trailing line endings for consistent deduplication.
pub fn hash_content(content: &str) -> String {
    let normalized = content
        .replace("\r\n", "\n")
        .trim_end_matches(['\r', '\n'])
        .to_string();
    hash_bytes(b"", normalized.as_bytes())
}

/// Hash bytes with a domain separator so distinct clipboard kinds cannot collide.
pub fn hash_bytes(domain: &[u8], bytes: &[u8]) -> String {
    let mut hasher = Sha256::new();
    hasher.update(domain);
    hasher.update(bytes);
    format!("{:x}", hasher.finalize())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn hashing_is_domain_separated_and_normalizes_line_endings() {
        assert_eq!(hash_content("one\r\ntwo\r\n"), hash_content("one\ntwo"));
        assert_ne!(hash_bytes(b"files\0", b"a"), hash_bytes(b"", b"a"));
    }
}
