//! Manual probe for the native clipboard backend.
//!
//! Usage:
//!   cargo run --example clipboard_probe
//!   cargo run --example clipboard_probe -- --read
//!
//! The probe never prints clipboard contents. It only reports the backend
//! environment and whether a round-trip write/read succeeded.

use lucidclip_lib::platform;

fn main() {
    if let Err(err) = platform::initialize_clipboard_backend() {
        eprintln!("clipboard backend unavailable: {err}");
        std::process::exit(1);
    }

    let environment = platform::clipboard_environment();
    println!(
        "backend={} session={} monitoring_supported={} text={} images={} files={}",
        environment.backend,
        environment.session.as_str(),
        environment.monitoring_supported,
        environment.supports_text,
        environment.supports_images,
        environment.supports_files
    );
    for diagnostic in &environment.diagnostics {
        println!("diagnostic: {diagnostic}");
    }

    if std::env::args().any(|arg| arg == "--read") {
        match platform::read_clipboard_snapshot() {
            Ok(Some(platform::ClipboardSnapshot::Text(text))) => {
                println!("clipboard contains text ({} characters)", text.chars().count());
            }
            Ok(Some(platform::ClipboardSnapshot::Image(image))) => {
                println!(
                    "clipboard contains an image ({}x{})",
                    image.width, image.height
                );
            }
            Ok(Some(platform::ClipboardSnapshot::Files(files))) => {
                println!("clipboard contains {} file reference(s)", files.len());
            }
            Ok(None) => println!("clipboard contains no supported value"),
            Err(err) => {
                eprintln!("clipboard read failed: {err}");
                std::process::exit(1);
            }
        }
        return;
    }

    let marker = format!(
        "LucidClip clipboard probe {}-{}",
        std::process::id(),
        std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .map(|value| value.as_millis())
            .unwrap_or_default()
    );

    if let Err(err) = platform::set_clipboard_text(&marker) {
        eprintln!("clipboard write failed: {err}");
        std::process::exit(1);
    }

    match platform::read_clipboard_snapshot() {
        Ok(Some(platform::ClipboardSnapshot::Text(text))) if text == marker => {
            println!("round-trip: ok");
        }
        Ok(Some(platform::ClipboardSnapshot::Text(text))) => {
            eprintln!(
                "round-trip: mismatch (wrote {} characters, read {} characters)",
                marker.chars().count(),
                text.chars().count()
            );
            std::process::exit(1);
        }
        Ok(other) => {
            eprintln!(
                "round-trip: unexpected clipboard kind: {}",
                describe(&other)
            );
            std::process::exit(1);
        }
        Err(err) => {
            eprintln!("clipboard read failed: {err}");
            std::process::exit(1);
        }
    }
}

fn describe(snapshot: &Option<platform::ClipboardSnapshot>) -> &'static str {
    match snapshot {
        Some(platform::ClipboardSnapshot::Text(_)) => "text",
        Some(platform::ClipboardSnapshot::Image(_)) => "image",
        Some(platform::ClipboardSnapshot::Files(_)) => "files",
        None => "none",
    }
}
