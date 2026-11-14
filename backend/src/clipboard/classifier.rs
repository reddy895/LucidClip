//! Clipboard Content Classification Engine

use regex::Regex;
use std::sync::LazyLock;

static URL_REGEX: LazyLock<Regex> = LazyLock::new(|| {
    Regex::new(r"^(?:(?:https?|ftp|git|ssh|file)://|vscode://|cursor://|mailto:|www\.)[^\s]+$")
        .unwrap()
});

static COLOR_HEX_REGEX: LazyLock<Regex> =
    LazyLock::new(|| Regex::new(r"^#(?:[0-9a-fA-F]{3}){1,2}$").unwrap());

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
    if ((text.starts_with('{') && text.ends_with('}'))
        || (text.starts_with('[') && text.ends_with(']')))
        && serde_json::from_str::<serde_json::Value>(text).is_ok()
    {
        return ClipboardContentType::Json;
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
    if text.starts_with('/')
        || text.starts_with("~/")
        || text.starts_with("./")
        || text.starts_with("../")
    {
        return true;
    }
    let chars: Vec<char> = text.chars().take(3).collect();
    if chars.len() >= 3
        && chars[0].is_ascii_alphabetic()
        && chars[1] == ':'
        && (chars[2] == '\\' || chars[2] == '/')
    {
        return true;
    }
    false
}

fn is_code_snippet(text: &str) -> bool {
    let code_keywords = [
        "const ",
        "let ",
        "var ",
        "function ",
        "return ",
        "import ",
        "export ",
        "from ",
        "class ",
        "pub fn ",
        "fn ",
        "def ",
        "impl ",
        "struct ",
        "enum ",
        "interface ",
        "type ",
        "async ",
        "await ",
        "match ",
        "SELECT ",
        "INSERT INTO ",
        "UPDATE ",
        "DELETE FROM ",
        "WHERE ",
        "CREATE TABLE ",
        "public class ",
        "private ",
        "protected ",
        "namespace ",
        "<!DOCTYPE ",
        "<html",
        "<div",
        "console.log",
        "println!",
    ];

    let has_keyword = code_keywords.iter().any(|&kw| text.contains(kw));
    let has_code_syntax = (text.contains('{') && text.contains('}'))
        || (text.contains("=>") || text.contains("->"))
        || (text.contains("::") && text.contains('('))
        || (text.contains(';') && text.contains('\n'));

    has_keyword || (has_code_syntax && text.contains('\n'))
}

/// Detect the likely programming language of a code or structured text snippet.
pub fn detect_programming_language(text: &str) -> Option<&'static str> {
    let t = text.trim();
    if (t.starts_with('{') && t.ends_with('}')) || (t.starts_with('[') && t.ends_with(']')) {
        if serde_json::from_str::<serde_json::Value>(t).is_ok() {
            return Some("json");
        }
    }

    if t.contains("fn ") || t.contains("impl ") || t.contains("pub struct ") || t.contains("println!") {
        return Some("rust");
    }

    if t.contains("def ") || t.contains("import numpy") || t.contains("import os") || t.contains("print(") {
        return Some("python");
    }

    if t.contains("interface ") || t.contains(": string") || t.contains(": number") || t.contains("export default") {
        return Some("typescript");
    }

    if t.contains("const ") || t.contains("let ") || t.contains("console.log") || t.contains("function(") {
        return Some("javascript");
    }

    if t.contains("SELECT ") || t.contains("FROM ") || t.contains("INSERT INTO ") {
        return Some("sql");
    }

    if t.starts_with("<!DOCTYPE") || t.starts_with("<html") || (t.contains("<div") && t.contains("</div>")) {
        return Some("html");
    }

    None
}
