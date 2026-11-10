//! Clipboard environment detection and user-facing diagnostics.
//!
//! Detection is intentionally separate from clipboard access. It answers the
//! questions the UI needs in order to tell the truth about monitoring:
//! which session are we in, which backend will be used, and what is missing.

use serde::Serialize;
use std::path::Path;

/// The graphical session that owns the clipboard.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "lowercase")]
pub enum ClipboardSession {
    Wayland,
    X11,
    Unsupported,
}

impl ClipboardSession {
    pub fn as_str(self) -> &'static str {
        match self {
            ClipboardSession::Wayland => "wayland",
            ClipboardSession::X11 => "x11",
            ClipboardSession::Unsupported => "unsupported",
        }
    }

    /// Resolve the session from the standard environment variables.
    ///
    /// `XDG_SESSION_TYPE` wins when it is set. Otherwise a live
    /// `WAYLAND_DISPLAY` or `DISPLAY` value is used. This deliberately does not
    /// assume Wayland or X11 from the host OS alone.
    pub fn detect(
        session_type: Option<&str>,
        wayland_display: Option<&str>,
        display: Option<&str>,
    ) -> Self {
        let declared = session_type.unwrap_or("").trim().to_ascii_lowercase();
        match declared.as_str() {
            "wayland" => return Self::Wayland,
            "x11" => return Self::X11,
            _ => {}
        }

        if wayland_display.is_some_and(|value| !value.trim().is_empty()) {
            Self::Wayland
        } else if display.is_some_and(|value| !value.trim().is_empty()) {
            Self::X11
        } else {
            Self::Unsupported
        }
    }
}

/// Optional command-line clipboard tools found on `PATH`.
///
/// LucidClip does not require these on Linux because it talks to GTK directly,
/// but they are useful diagnostics and are reported in the UI.
#[derive(Debug, Clone, Default, PartialEq, Eq, Serialize)]
pub struct ClipboardUtilities {
    pub wl_paste: bool,
    pub wl_copy: bool,
    pub xclip: bool,
    pub xsel: bool,
}

impl ClipboardUtilities {
    pub fn any_wayland(&self) -> bool {
        self.wl_paste || self.wl_copy
    }

    pub fn any_x11(&self) -> bool {
        self.xclip || self.xsel
    }
}

/// Serializable description of the active clipboard environment.
#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
pub struct ClipboardEnvironment {
    pub os: String,
    pub session: ClipboardSession,
    pub session_type: Option<String>,
    pub wayland_display: Option<String>,
    pub display: Option<String>,
    pub desktop: Option<String>,
    pub backend: String,
    pub monitoring_supported: bool,
    pub supports_text: bool,
    pub supports_images: bool,
    pub supports_files: bool,
    pub utilities: ClipboardUtilities,
    pub diagnostics: Vec<String>,
}

fn non_empty(value: Option<&str>) -> Option<String> {
    value
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .map(str::to_string)
}

/// Check whether `name` exists as an executable on `PATH`.
pub fn command_in_path(name: &str, path: Option<&str>) -> bool {
    let Some(path) = path else {
        return false;
    };

    path.split(if cfg!(windows) { ';' } else { ':' })
        .filter(|directory| !directory.is_empty())
        .any(|directory| {
            let candidate = Path::new(directory).join(name);
            candidate.is_file()
        })
}

#[cfg(target_os = "linux")]
fn linux_backend_ready() -> bool {
    crate::platform::clipboard_linux::is_ready()
}

#[cfg(not(target_os = "linux"))]
fn linux_backend_ready() -> bool {
    false
}

#[cfg(target_os = "linux")]
fn gtk_runtime_diagnostic() -> Option<String> {
    if linux_backend_ready() {
        None
    } else if std::env::var_os("DISPLAY").is_none()
        && std::env::var_os("WAYLAND_DISPLAY").is_none()
    {
        Some(
            "No graphical clipboard session was detected. Set DISPLAY or WAYLAND_DISPLAY before launching LucidClip."
                .to_string(),
        )
    } else {
        Some(
            "The GTK clipboard backend could not be initialized. Ensure a GTK 3 runtime and an active graphical session are available."
                .to_string(),
        )
    }
}

#[cfg(not(target_os = "linux"))]
fn gtk_runtime_diagnostic() -> Option<String> {
    None
}

/// Build the environment description from raw inputs.
///
/// This is a pure function so the detection rules can be unit tested without a
/// display server.
pub fn describe(
    os: &str,
    session_type: Option<&str>,
    wayland_display: Option<&str>,
    display: Option<&str>,
    desktop: Option<&str>,
    utilities: ClipboardUtilities,
    backend_ready: bool,
) -> ClipboardEnvironment {
    let session = ClipboardSession::detect(session_type, wayland_display, display);
    let mut diagnostics = Vec::new();

    let (backend, monitoring_supported, supports_text, supports_images, supports_files) = if os
        == "windows"
    {
        ("windows-native", true, true, true, true)
    } else if os == "linux" {
        (
            "linux-gtk",
            backend_ready,
            backend_ready,
            backend_ready,
            backend_ready,
        )
    } else {
        ("unsupported", false, false, false, false)
    };

    if os == "linux" {
        if let Some(diagnostic) = gtk_runtime_diagnostic() {
            if !backend_ready {
                diagnostics.push(diagnostic);
            }
        }

        if session == ClipboardSession::Wayland {
            if !utilities.any_wayland() {
                diagnostics.push(
                    "wl-clipboard (wl-paste/wl-copy) is not installed. LucidClip uses GTK directly, so this is informational only."
                        .to_string(),
                );
            }
            diagnostics.push(
                "Wayland clipboard access depends on the compositor. If captures stop while another window is focused, use the manual Capture now action."
                    .to_string(),
            );
        } else if session == ClipboardSession::X11 && !utilities.any_x11() {
            diagnostics.push(
                "xclip/xsel are not installed. LucidClip uses the GTK CLIPBOARD selection directly, so this is informational only."
                    .to_string(),
            );
        }

        if session == ClipboardSession::Unsupported {
            diagnostics.push(
                "Neither a Wayland nor an X11 clipboard session is active.".to_string(),
            );
        }
    } else if os != "windows" {
        diagnostics.push(
            "Clipboard monitoring is not implemented for this operating system.".to_string(),
        );
    }

    ClipboardEnvironment {
        os: os.to_string(),
        session,
        session_type: non_empty(session_type),
        wayland_display: non_empty(wayland_display),
        display: non_empty(display),
        desktop: non_empty(desktop),
        backend: backend.to_string(),
        monitoring_supported,
        supports_text,
        supports_images,
        supports_files,
        utilities,
        diagnostics,
    }
}

/// Read the current process environment and detect clipboard capabilities.
pub fn clipboard_environment() -> ClipboardEnvironment {
    let session_type = std::env::var("XDG_SESSION_TYPE").ok();
    let wayland_display = std::env::var("WAYLAND_DISPLAY").ok();
    let display = std::env::var("DISPLAY").ok();
    let desktop = std::env::var("XDG_CURRENT_DESKTOP")
        .ok()
        .or_else(|| std::env::var("DESKTOP_SESSION").ok());
    let path = std::env::var("PATH").ok();

    let utilities = ClipboardUtilities {
        wl_paste: command_in_path("wl-paste", path.as_deref()),
        wl_copy: command_in_path("wl-copy", path.as_deref()),
        xclip: command_in_path("xclip", path.as_deref()),
        xsel: command_in_path("xsel", path.as_deref()),
    };

    describe(
        std::env::consts::OS,
        session_type.as_deref(),
        wayland_display.as_deref(),
        display.as_deref(),
        desktop.as_deref(),
        utilities,
        linux_backend_ready(),
    )
}

#[cfg(test)]
mod tests {
    use super::*;

    fn no_utilities() -> ClipboardUtilities {
        ClipboardUtilities::default()
    }

    #[test]
    fn detects_session_from_declared_type_first() {
        assert_eq!(
            ClipboardSession::detect(Some("wayland"), None, Some(":0")),
            ClipboardSession::Wayland
        );
        assert_eq!(
            ClipboardSession::detect(Some("X11"), Some("wayland-0"), None),
            ClipboardSession::X11
        );
        assert_eq!(
            ClipboardSession::detect(None, Some("wayland-0"), Some(":0")),
            ClipboardSession::Wayland
        );
        assert_eq!(
            ClipboardSession::detect(None, None, Some(":0")),
            ClipboardSession::X11
        );
        assert_eq!(
            ClipboardSession::detect(None, None, None),
            ClipboardSession::Unsupported
        );
    }

    #[test]
    fn describes_ready_linux_wayland_without_requiring_cli_tools() {
        let environment = describe(
            "linux",
            Some("wayland"),
            Some("wayland-0"),
            Some(":0"),
            Some("ubuntu:GNOME"),
            no_utilities(),
            true,
        );

        assert_eq!(environment.backend, "linux-gtk");
        assert!(environment.monitoring_supported);
        assert!(environment.supports_text);
        assert!(environment.supports_images);
        assert!(environment.supports_files);
        assert!(environment
            .diagnostics
            .iter()
            .any(|item| item.contains("wl-clipboard")));
    }

    #[test]
    fn describes_uninitialized_linux_backend_as_unsupported() {
        let environment = describe(
            "linux",
            Some("wayland"),
            Some("wayland-0"),
            None,
            None,
            no_utilities(),
            false,
        );

        assert!(!environment.monitoring_supported);
        assert!(!environment.supports_text);
        assert!(environment
            .diagnostics
            .iter()
            .any(|item| item.contains("GTK clipboard backend")));
    }

    #[test]
    fn describes_windows_native_backend() {
        let environment = describe(
            "windows",
            Some("x11"),
            None,
            None,
            None,
            no_utilities(),
            false,
        );

        assert_eq!(environment.backend, "windows-native");
        assert!(environment.monitoring_supported);
        assert!(environment.diagnostics.is_empty());
    }

    #[test]
    fn path_lookup_uses_the_supplied_path_only() {
        let unique = format!("lucidclip-path-{}", std::process::id());
        let root = std::env::temp_dir().join(unique);
        std::fs::create_dir_all(&root).unwrap();
        let tool = root.join(if cfg!(windows) {
            "lucidclip-tool.exe"
        } else {
            "lucidclip-tool"
        });
        std::fs::write(&tool, b"#!/bin/sh\nexit 0\n").unwrap();

        let path = std::env::join_paths([&root]).unwrap();
        let path = path.to_string_lossy();
        assert!(command_in_path(
            tool.file_name().unwrap().to_str().unwrap(),
            Some(&path)
        ));
        assert!(!command_in_path(
            "definitely-not-a-real-tool-lucidclip",
            Some(&path)
        ));

        let _ = std::fs::remove_dir_all(root);
    }
}
