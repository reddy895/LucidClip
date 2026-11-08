//! Clipboard Content Classification Engine

use regex::Regex;
use std::sync::LazyLock;

static URL_REGEX: LazyLock<Regex> = LazyLock::new(|| {
    Regex::new(r"^(https?://|www\.)[^\s/$.?#].[^\s]*$").unwrap()
});

static COLOR_HEX_REGEX: LazyLock<Regex> = LazyLock::new(|| {
    Regex::new(r"^#(?:[0-9a-fA-F]{3}){1,2}$").unwrap()
});

static COLOR_FUNC_REGEX: LazyLock<Regex> = LazyLock::new(|| {
    Regex::new(r"^(rgb|rgba|hsl|hsla)\(\s*\d+\s*,\s*\d+\s*,\s*\d+(?:\s*,\s*[\d.]+\s*)?\)$").unwrap()
});

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum ClipboardContentType {
    Plain,
    Multiline,
    Url,
    Code,
    Json,
    ColorCode,
    Path,
}

impl ClipboardContentType {
    pub fn as_str(&self) -> &'static str {
        match self {
            ClipboardContentType::Plain => "plain",
            ClipboardContentType::Multiline => "multiline",
            ClipboardContentType::Url => "url",
            ClipboardContentType::Code => "code",
            ClipboardContentType::Json => "json",
            ClipboardContentType::ColorCode => "color_code",
            ClipboardContentType::Path => "path",
        }
    }
}

/// Classify text content into appropriate LucidClip content type
pub fn classify_content(raw: &str) -> ClipboardContentType {
    let text = raw.trim();

    if text.is_empty() {
        return ClipboardContentType::Plain;
    }

    // 1. URL detection
    if URL_REGEX.is_match(text) {
        return ClipboardContentType::Url;
    }

    // 2. Color code detection
    if COLOR_HEX_REGEX.is_match(text) || COLOR_FUNC_REGEX.is_match(text) {
        return ClipboardContentType::ColorCode;
    }

    // 3. File path detection
    if is_file_path(text) && !text.contains('\n') {
        return ClipboardContentType::Path;
    }

    // 4. JSON detection
    if (text.starts_with('{') && text.ends_with('}')) || (text.starts_with('[') && text.ends_with(']')) {
        if serde_json::from_str::<serde_json::Value>(text).is_ok() {
            return ClipboardContentType::Json;
        }
    }

    // 5. Code snippet detection
    if is_code_snippet(text) {
        return ClipboardContentType::Code;
    }

    // 6. Multiline text
    if text.contains('\n') {
        return ClipboardContentType::Multiline;
    }

    ClipboardContentType::Plain
}

fn is_file_path(text: &str) -> bool {
    if text.starts_with('/') || text.starts_with("~/") || text.starts_with("./") || text.starts_with("../") {
        return true;
    }
    let chars: Vec<char> = text.chars().take(3).collect();
    if chars.len() >= 3 && chars[0].is_ascii_alphabetic() && chars[1] == ':' && (chars[2] == '\\' || chars[2] == '/') {
        return true;
    }
    false
}

fn is_code_snippet(text: &str) -> bool {
    let code_keywords = [
        "const ", "let ", "var ", "function ", "return ", "import ", "export ", "from ",
        "class ", "pub fn ", "fn ", "def ", "impl ", "struct ", "enum ", "interface ",
        "SELECT ", "INSERT INTO ", "UPDATE ", "DELETE FROM ", "WHERE ",
        "public class ", "private ", "protected ", "namespace ",
    ];

    let has_keyword = code_keywords.iter().any(|&kw| text.contains(kw));
    let has_code_syntax = (text.contains('{') && text.contains('}'))
        || (text.contains("=>") || text.contains("->"))
        || (text.contains(';') && text.contains('\n'));

    has_keyword || (has_code_syntax && text.contains('\n'))
}
