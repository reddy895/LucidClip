//! Manual probe for the native clipboard backend.
//!
//! Usage:
//!   cargo run --example clipboard_probe
//!   cargo run --example clipboard_probe -- --read
//!   cargo run --example clipboard_probe -- --watch
//!
//! The probe never prints clipboard contents. It only reports the backend
//! environment and whether a round-trip write/read or a change notification
//! succeeded. `--watch` writes a marker and waits for the backend to report
//! an owner change.

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

    if std::env::args().any(|arg| arg == "--watch") {
        watch_for_change();
        return;
    }

    if std::env::args().any(|arg| arg == "--read") {
        match platform::read_clipboard_snapshot() {
            Ok(Some(platform::ClipboardSnapshot::Text(text))) => {
                println!(
                    "clipboard contains text ({} characters)",
                    text.chars().count()
                );
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

#[cfg(target_os = "linux")]
fn watch_for_change() {
    use std::sync::atomic::{AtomicBool, Ordering};
    use std::sync::mpsc::{self, TryRecvError};
    use std::sync::Arc;
    use std::time::{Duration, Instant};

    let (notify_tx, notify_rx) = mpsc::sync_channel::<()>(1);
    if let Err(err) = platform::spawn_clipboard_watcher(notify_tx) {
        eprintln!("clipboard watcher unavailable: {err}");
        std::process::exit(1);
    }

    let marker = format!(
        "LucidClip watch probe {}-{}",
        std::process::id(),
        std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .map(|value| value.as_millis())
            .unwrap_or_default()
    );

    let writer = std::thread::spawn(move || {
        std::thread::sleep(Duration::from_millis(700));
        if let Err(err) = platform::set_clipboard_text(&marker) {
            eprintln!("probe write failed: {err}");
        }
    });

    let main_loop = gtk::glib::MainLoop::new(None, false);
    let loop_for_timeout = main_loop.clone();
    let observed = Arc::new(AtomicBool::new(false));
    let observed_for_poll = Arc::clone(&observed);
    let deadline = Instant::now() + Duration::from_secs(6);

    gtk::glib::timeout_add_local(Duration::from_millis(50), move || {
        match notify_rx.try_recv() {
            Ok(()) => {
                observed_for_poll.store(true, Ordering::SeqCst);
                println!("owner-change: observed");
                loop_for_timeout.quit();
                gtk::glib::ControlFlow::Break
            }
            Err(TryRecvError::Empty) if Instant::now() < deadline => {
                gtk::glib::ControlFlow::Continue
            }
            Err(TryRecvError::Empty) | Err(TryRecvError::Disconnected) => {
                eprintln!("owner-change: not observed within 6s");
                loop_for_timeout.quit();
                gtk::glib::ControlFlow::Break
            }
        }
    });

    main_loop.run();
    let _ = writer.join();

    if observed.load(Ordering::SeqCst) {
        println!("watch-round-trip: ok");
    } else {
        eprintln!("watch-round-trip: failed");
        std::process::exit(1);
    }
}

#[cfg(not(target_os = "linux"))]
fn watch_for_change() {
    eprintln!("--watch is only implemented for the Linux GTK backend");
    std::process::exit(1);
}

fn describe(snapshot: &Option<platform::ClipboardSnapshot>) -> &'static str {
    match snapshot {
        Some(platform::ClipboardSnapshot::Text(_)) => "text",
        Some(platform::ClipboardSnapshot::Image(_)) => "image",
        Some(platform::ClipboardSnapshot::Files(_)) => "files",
        None => "none",
    }
}
