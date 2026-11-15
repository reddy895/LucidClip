use std::fs;
use image::{ImageBuffer, Rgba};
use lucidclip_lib::clipboard::media::{resolve_image_file, store};
use lucidclip_lib::database::DbClipboardEntry;
use lucidclip_lib::platform::CapturedImage;
use lucidclip_lib::screenshots::service::image_data_url;
use lucidclip_lib::storage::AppPaths;

fn create_test_captured_image(width: u32, height: u32) -> CapturedImage {
    let img: ImageBuffer<Rgba<u8>, Vec<u8>> = ImageBuffer::from_pixel(width, height, Rgba([255, 0, 0, 255]));
    CapturedImage {
        width,
        height,
        rgba: img.into_raw(),
    }
}

#[test]
fn test_missing_and_corrupt_thumbnail_regeneration() {
    let temp_root = std::env::temp_dir().join(format!("lucidclip_thumb_regen_{}", std::process::id()));
    let paths = AppPaths::from_root(&temp_root);
    paths.ensure_dirs_exist().unwrap();

    let captured = create_test_captured_image(64, 64);
    let id = "clip_regen_test";
    let stored = store(&paths, id, &captured).expect("Store original & thumbnail");

    let entry = DbClipboardEntry {
        id: id.to_string(),
        content: String::new(),
        content_type: "image".to_string(),
        source_app: None,
        created_at: 0,
        content_hash: "test_hash".to_string(),
        pinned: false,
        favorite: false,
        image_path: Some(stored.original_path.clone()),
        thumbnail_path: Some(stored.thumbnail_path.clone()),
        image_width: Some(64),
        image_height: Some(64),
        byte_size: stored.byte_size,
        file_count: 0,
        last_used_at: None,
        usage_count: 0,
    };

    // 1. Delete thumbnail
    let thumb_file = paths.normalize_media_path(std::path::Path::new(&stored.thumbnail_path));
    fs::remove_file(&thumb_file).unwrap();
    assert!(!thumb_file.exists());

    // Resolve thumbnail -> must regenerate
    let resolved = resolve_image_file(&paths, &entry, true).expect("Regenerate missing thumbnail");
    assert!(resolved.is_file());
    assert!(fs::metadata(&resolved).unwrap().len() > 0);

    // 2. Corrupt thumbnail by truncating to 0 bytes
    fs::write(&thumb_file, b"").unwrap();
    assert_eq!(fs::metadata(&thumb_file).unwrap().len(), 0);

    // Resolve thumbnail -> must detect corruption (>0 check) and regenerate
    let resolved_regen = resolve_image_file(&paths, &entry, true).expect("Regenerate corrupt 0-byte thumbnail");
    assert!(resolved_regen.is_file());
    assert!(fs::metadata(&resolved_regen).unwrap().len() > 0);

    // Verify it generates a valid data URL
    let data_url_res = image_data_url(&resolved_regen).expect("Read regenerated data URL");
    assert_eq!(data_url_res.mime_type, "image/png");
    assert!(data_url_res.data_url.starts_with("data:image/png;base64,"));

    let _ = fs::remove_dir_all(temp_root);
}

#[test]
fn test_corrupt_empty_original_returns_error() {
    let temp_root = std::env::temp_dir().join(format!("lucidclip_corrupt_{}", std::process::id()));
    let paths = AppPaths::from_root(&temp_root);
    paths.ensure_dirs_exist().unwrap();

    let empty_file = paths.originals_dir.join("empty.png");
    fs::write(&empty_file, b"").unwrap();

    let res = image_data_url(&empty_file);
    assert!(res.is_err(), "Empty image file must return an error");

    let _ = fs::remove_dir_all(temp_root);
}
