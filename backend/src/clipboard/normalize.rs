//! Clipboard text normalization.
//!
//! Platform clipboards disagree about line endings and can include stray NUL
//! terminators. LucidClip normalizes once at the capture boundary so hashing,
//! classification, classification display, and persistence all agree.

/// Convert CRLF and lone CR line endings to LF and drop embedded NUL bytes.
///
/// Leading and trailing content is otherwise preserved so code snippets and
/// intentional indentation survive round-trips.
pub fn normalize_text(raw: &str) -> String {
    if !raw.contains('\r') && !raw.contains('\0') {
        return raw.to_string();
    }

    let mut normalized = String::with_capacity(raw.len());
    let mut chars = raw.chars().peekable();
    while let Some(character) = chars.next() {
        match character {
            '\0' => {}
            '\r' => {
                if chars.peek() == Some(&'\n') {
                    chars.next();
                }
                normalized.push('\n');
            }
            other => normalized.push(other),
        }
    }
    normalized
}

/// Canonical text used for content hashing.
///
/// Trailing line endings are ignored so copying the same text with or without
/// a final newline resolves to one history entry.
pub fn canonical_text(raw: &str) -> String {
    normalize_text(raw)
        .trim_end_matches(['\r', '\n'])
        .to_string()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn normalizes_crlf_and_lone_cr() {
        assert_eq!(normalize_text("a\r\nb\rc\nd"), "a\nb\nc\nd");
    }

    #[test]
    fn removes_embedded_nul_terminators() {
        assert_eq!(normalize_text("hello\0world\0"), "helloworld");
    }

    #[test]
    fn preserves_indentation_and_unicode() {
        let input = "fn main() {\n    println!(\"héllo 🌍\");\n}";
        assert_eq!(normalize_text(input), input);
    }

    #[test]
    fn canonical_text_ignores_trailing_line_endings() {
        assert_eq!(canonical_text("one\ntwo\r\n\r\n"), "one\ntwo");
        assert_eq!(canonical_text("one\ntwo"), "one\ntwo");
    }

    #[test]
    fn empty_content_normalizes_to_empty() {
        assert_eq!(normalize_text(""), "");
        assert_eq!(canonical_text("\r\n\r\n"), "");
    }
}
