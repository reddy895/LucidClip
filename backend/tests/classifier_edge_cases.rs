use lucidclip_lib::clipboard::{
    classify_content, detect_programming_language, ClipboardContentType,
};

#[test]
fn test_url_classification_edge_cases() {
    let urls = [
        "https://lucidclip.dev/docs",
        "http://localhost:1420",
        "http://127.0.0.1:8080/dashboard",
        "ftp://files.example.com/archive.zip",
        "git://github.com/reddy895/LucidClip.git",
        "ssh://git@github.com:reddy895/LucidClip.git",
        "file:///home/user/document.pdf",
        "mailto:support@lucidclip.app",
        "vscode://file/path/to/code",
        "cursor://project/open",
        "www.lucidclip.app",
    ];

    for url in urls {
        assert_eq!(
            classify_content(url),
            ClipboardContentType::Url,
            "Failed for URL: {url}"
        );
    }
}

#[test]
fn test_color_code_classification() {
    let colors = [
        "#FFF",
        "#ffffff",
        "#8B9CF7",
        "#111315",
        "rgb(17, 19, 21)",
        "rgba(255, 255, 255, 0.8)",
        "hsl(220, 13%, 18%)",
        "hsla(220, 13%, 18%, 0.5)",
    ];

    for color in colors {
        assert_eq!(
            classify_content(color),
            ClipboardContentType::ColorCode,
            "Failed for color: {color}"
        );
    }
}

#[test]
fn test_file_path_classification() {
    let paths = [
        "/etc/hosts",
        "~/Downloads/LucidClip",
        "./src/main.rs",
        "../frontend/package.json",
        "C:\\Windows\\System32",
        "D:/Projects/LucidClip",
    ];

    for path in paths {
        assert_eq!(
            classify_content(path),
            ClipboardContentType::Path,
            "Failed for path: {path}"
        );
    }
}

#[test]
fn test_programming_language_detection() {
    assert_eq!(
        detect_programming_language("{\"name\": \"LucidClip\", \"version\": 1}"),
        Some("json")
    );
    assert_eq!(
        detect_programming_language("pub fn execute_instant_paste() -> Result<()> {\n    Ok(())\n}"),
        Some("rust")
    );
    assert_eq!(
        detect_programming_language("def calculate_metrics(data):\n    return sum(data)"),
        Some("python")
    );
    assert_eq!(
        detect_programming_language("interface UserProfile {\n    id: string;\n    name: string;\n}"),
        Some("typescript")
    );
    assert_eq!(
        detect_programming_language("SELECT id, content FROM clipboard_entries WHERE pinned = 1;"),
        Some("sql")
    );
    assert_eq!(
        detect_programming_language("<!DOCTYPE html><html><body><h1>LucidClip</h1></body></html>"),
        Some("html")
    );
}
