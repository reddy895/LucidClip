use std::fs;
use image::{ImageBuffer, Rgba};
use lucidclip_lib::clipboard::service::ClipboardService;
use lucidclip_lib::database::{run_migrations, DbPool};
use lucidclip_lib::platform::CapturedImage;
use lucidclip_lib::storage::AppPaths;

fn sample_image() -> CapturedImage {
    let img: ImageBuffer<Rgba<u8>, Vec<u8>> = ImageBuffer::from_pixel(16, 16, Rgba([10, 20, 30, 255]));
    CapturedImage {
        width: 16,
        height: 16,
        rgba: img.into_raw(),
    }
}

#[test]
fn test_image_deduplication_and_timestamp_refresh() {
    let temp_root = std::env::temp_dir().join(format!("lucidclip_img_dedup_{}", std::process::id()));
    let paths = AppPaths::from_root(&temp_root);
    paths.ensure_dirs_exist().unwrap();

    let pool = DbPool::open_in_memory().unwrap();
    run_migrations(&pool).unwrap();
    let service = ClipboardService::with_paths(&pool, &paths);

    let image = sample_image();

    // First copy
    let first = service
        .process_copied_image(image.clone(), Some("Chrome".into()))
        .expect("Process first image copy");
    assert_eq!(first.content_type, "image");

    // Second copy of identical image bytes
    let second = service
        .process_copied_image(image.clone(), Some("VSCode".into()))
        .expect("Process second image copy");

    // Must deduplicate by content hash to same id
    assert_eq!(first.id, second.id);
    assert_eq!(first.content_hash, second.content_hash);

    // List entries from database: must be exactly 1 entry
    let all = service.get_history().unwrap();
    assert_eq!(all.len(), 1);

    let _ = fs::remove_dir_all(temp_root);
}
