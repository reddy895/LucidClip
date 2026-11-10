//! Cryptographic Content Hashing for Deduplication

use sha2::{Digest, Sha256};

use crate::clipboard::normalize::canonical_text;

/// Computes SHA-256 hash of canonical clipboard text.
///
/// Canonicalization converts CRLF/CR to LF, removes NUL bytes, and ignores
/// trailing line endings so repeated copies deduplicate consistently.
pub fn hash_content(content: &str) -> String {
    hash_bytes(b"", canonical_text(content).as_bytes())
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
