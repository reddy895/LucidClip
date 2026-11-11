//! Screenshot capture and storage.

pub mod service;

pub use service::{
    CaptureMode, CaptureRegion, ScreenshotGalleryEntry, ScreenshotImageData, ScreenshotService,
    ScreenshotVariant,
};
