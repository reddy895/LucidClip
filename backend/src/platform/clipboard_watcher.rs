//! Native Windows clipboard-change notifications.
//!
//! A dedicated thread owns a message-only window registered with
//! `AddClipboardFormatListener`. Windows posts `WM_CLIPBOARDUPDATE` when any
//! process changes the clipboard, so LucidClip does not need to poll clipboard
//! contents. The thread exits when the shared stop flag is set.

use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::mpsc::{self, SyncSender};
use std::sync::{Arc, Mutex, OnceLock};
use std::thread;
use std::time::Duration;

use windows_sys::Win32::Foundation::{HINSTANCE, HWND, LPARAM, LRESULT, WPARAM};
use windows_sys::Win32::System::DataExchange::{
    AddClipboardFormatListener, RemoveClipboardFormatListener,
};
use windows_sys::Win32::System::LibraryLoader::GetModuleHandleW;
use windows_sys::Win32::UI::WindowsAndMessaging::{
    CreateWindowExW, DefWindowProcW, DestroyWindow, DispatchMessageW, PeekMessageW,
    PostQuitMessage, RegisterClassW, TranslateMessage, UnregisterClassW, HWND_MESSAGE, MSG,
    PM_REMOVE, WM_CLIPBOARDUPDATE, WM_DESTROY, WM_QUIT, WNDCLASSW,
};

const CLASS_NAME: &str = "LucidClipClipboardListener";
const STOP_POLL_INTERVAL: Duration = Duration::from_millis(50);
const STARTUP_TIMEOUT: Duration = Duration::from_secs(2);

static NOTIFY_SENDER: OnceLock<Mutex<Option<SyncSender<()>>>> = OnceLock::new();

fn sender_slot() -> &'static Mutex<Option<SyncSender<()>>> {
    NOTIFY_SENDER.get_or_init(|| Mutex::new(None))
}

fn notify_clipboard_changed() {
    let sender = sender_slot()
        .lock()
        .ok()
        .and_then(|guard| guard.as_ref().cloned());

    if let Some(sender) = sender {
        // Capacity is one, so bursts collapse into a single pending wake-up.
        let _ = sender.try_send(());
    }
}

unsafe extern "system" fn window_proc(
    hwnd: HWND,
    message: u32,
    wparam: WPARAM,
    lparam: LPARAM,
) -> LRESULT {
    match message {
        WM_CLIPBOARDUPDATE => {
            notify_clipboard_changed();
            0
        }
        WM_DESTROY => {
            PostQuitMessage(0);
            0
        }
        _ => DefWindowProcW(hwnd, message, wparam, lparam),
    }
}

fn wide(value: &str) -> Vec<u16> {
    value.encode_utf16().chain(std::iter::once(0)).collect()
}

/// Start the Windows clipboard listener.
///
/// Returns after the hidden message window has registered for notifications.
/// A returned error means the caller should fall back to polling.
pub fn spawn(notify: SyncSender<()>, stop: Arc<AtomicBool>) -> Result<(), String> {
    let (ready_tx, ready_rx) = mpsc::channel::<Result<(), String>>();

    let spawned = thread::Builder::new()
        .name("lucidclip-clipboard-watcher".into())
        .spawn(move || run(notify, stop, ready_tx));

    if let Err(err) = spawned {
        return Err(format!("failed to spawn clipboard watcher: {err}"));
    }

    match ready_rx.recv_timeout(STARTUP_TIMEOUT) {
        Ok(result) => result,
        Err(err) => Err(format!("clipboard watcher did not initialize: {err}")),
    }
}

fn run(notify: SyncSender<()>, stop: Arc<AtomicBool>, ready: mpsc::Sender<Result<(), String>>) {
    let class_name = wide(CLASS_NAME);
    let instance = unsafe { GetModuleHandleW(std::ptr::null()) };
    let instance: HINSTANCE = instance;
    if instance.is_null() {
        let _ = ready.send(Err("could not resolve the module handle".into()));
        return;
    }

    let class = WNDCLASSW {
        lpfnWndProc: Some(window_proc),
        hInstance: instance,
        lpszClassName: class_name.as_ptr(),
        ..unsafe { std::mem::zeroed() }
    };

    if unsafe { RegisterClassW(&class) } == 0 {
        let _ = ready.send(Err("could not register the clipboard window class".into()));
        return;
    }

    let hwnd = unsafe {
        CreateWindowExW(
            0,
            class_name.as_ptr(),
            class_name.as_ptr(),
            0,
            0,
            0,
            0,
            0,
            HWND_MESSAGE,
            std::ptr::null_mut(),
            instance,
            std::ptr::null(),
        )
    };

    if hwnd.is_null() {
        unsafe {
            UnregisterClassW(class_name.as_ptr(), instance);
        }
        let _ = ready.send(Err("could not create the clipboard message window".into()));
        return;
    }

    if let Ok(mut slot) = sender_slot().lock() {
        *slot = Some(notify);
    }

    if unsafe { AddClipboardFormatListener(hwnd) } == 0 {
        if let Ok(mut slot) = sender_slot().lock() {
            *slot = None;
        }
        unsafe {
            DestroyWindow(hwnd);
            UnregisterClassW(class_name.as_ptr(), instance);
        }
        let _ = ready.send(Err(
            "could not register for clipboard format notifications".into()
        ));
        return;
    }

    let _ = ready.send(Ok(()));
    println!("[LucidClip Monitor] Native clipboard listener started.");

    let mut message: MSG = unsafe { std::mem::zeroed() };
    'pump: loop {
        while unsafe { PeekMessageW(&mut message, std::ptr::null_mut(), 0, 0, PM_REMOVE) } != 0 {
            if message.message == WM_QUIT {
                break 'pump;
            }
            unsafe {
                TranslateMessage(&message);
                DispatchMessageW(&message);
            }
        }

        if stop.load(Ordering::Relaxed) {
            break;
        }

        thread::sleep(STOP_POLL_INTERVAL);
    }

    unsafe {
        RemoveClipboardFormatListener(hwnd);
    }
    if let Ok(mut slot) = sender_slot().lock() {
        *slot = None;
    }
    unsafe {
        DestroyWindow(hwnd);
        UnregisterClassW(class_name.as_ptr(), instance);
    }
    println!("[LucidClip Monitor] Native clipboard listener stopped.");
}
