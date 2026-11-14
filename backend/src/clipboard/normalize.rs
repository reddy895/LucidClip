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

/// Generate a clean, truncated preview for clipboard history UI rows and popups.
pub fn format_text_preview(raw: &str, max_lines: usize, max_chars: usize) -> String {
    let normalized = normalize_text(raw);
    let trimmed = normalized.trim();
    if trimmed.is_empty() {
        return String::new();
    }

    let lines: Vec<&str> = trimmed
        .lines()
        .map(str::trim_end)
        .take(max_lines)
        .collect();

    let total_lines = trimmed.lines().count();
    let mut preview = lines.join("\n");
    if preview.chars().count() > max_chars {
        let truncated: String = preview.chars().take(max_chars).collect();
        preview = format!("{}...", truncated.trim_end());
    } else if total_lines > max_lines {
        preview.push_str("...");
    }

    preview
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

    #[test]
    fn format_text_preview_truncates_lines_and_chars() {
        let multiline = "Line 1\nLine 2\nLine 3\nLine 4\nLine 5";
        let preview = format_text_preview(multiline, 2, 50);
        assert_eq!(preview, "Line 1\nLine 2...");

        let long_line = "This is a very long line that exceeds the maximum preview length of twenty characters";
        let char_preview = format_text_preview(long_line, 5, 20);
        assert_eq!(char_preview, "This is a very long...");
    }
}
