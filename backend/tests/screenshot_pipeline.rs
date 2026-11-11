//! End-to-end regression tests for screenshot persistence and gallery health.

use std::fs;
use std::path::{Path, PathBuf};

use lucidclip_lib::database::{run_migrations, DbPool};
use lucidclip_lib::platform::CapturedImage;
use lucidclip_lib::screenshots::{ScreenshotService, ScreenshotVariant};
use lucidclip_lib::storage::AppPaths;

fn test_root(label: &str) -> PathBuf {
    std::env::temp_dir().join(format!(
        "lucidclip-{label}-{}-{}",
        std::process::id(),
        std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap()
            .as_nanos()
    ))
}

fn test_image(width: u32, height: u32) -> CapturedImage {
    let mut rgba = Vec::with_capacity((width * height * 4) as usize);
    for _ in 0..width * height {
        rgba.extend_from_slice(&[24, 32, 48, 255]);
    }
    CapturedImage {
        width,
        height,
        rgba,
    }
}

#[test]
fn screenshots_survive_a_database_reopen_and_delete_cleans_files() {
    let root = test_root("pipeline-reopen");
    let paths = AppPaths::from_root(&root);
    paths.ensure_dirs_exist().unwrap();
    let database_path = paths.database_path.clone();

    let (id, original, thumbnail);
    {
        let pool = DbPool::open(&database_path).unwrap();
        run_migrations(&pool).unwrap();
        let service = ScreenshotService::new(&pool, &paths);

        let entry = service
            .store(test_image(48, 32), "fullscreen", None)
            .unwrap();
        id = entry.id.clone();
        original = entry.original_path.clone();
        thumbnail = entry.thumbnail_path.clone();

        // Listing must not create duplicate metadata rows.
        assert_eq!(service.list_gallery().unwrap().len(), 1);
        assert_eq!(service.list_gallery().unwrap().len(), 1);
        assert!(Path::new(&original).is_file());
        assert!(Path::new(&thumbnail).is_file());
    }

    {
        let pool = DbPool::open(&database_path).unwrap();
        run_migrations(&pool).unwrap();
        let service = ScreenshotService::new(&pool, &paths);

        let gallery = service.list_gallery().unwrap();
        assert_eq!(gallery.len(), 1, "record must survive a restart");
        assert_eq!(gallery[0].entry.id, id);
        assert!(gallery[0].thumbnail_available);
        assert!(gallery[0].original_available);

        let loaded = service
            .load_image(&id, ScreenshotVariant::Thumbnail)
            .unwrap();
        assert!(loaded.data_url.starts_with("data:image/png;base64,"));

        assert!(service.delete(&id).unwrap());
        assert!(service.list_gallery().unwrap().is_empty());
        assert!(!Path::new(&original).exists());
        assert!(!Path::new(&thumbnail).exists());
    }

    let _ = fs::remove_dir_all(root);
}

#[test]
fn missing_screenshot_files_are_reported_and_do_not_block_deletion() {
    let root = test_root("pipeline-missing");
    let paths = AppPaths::from_root(&root);
    paths.ensure_dirs_exist().unwrap();

    let pool = DbPool::open_in_memory().unwrap();
    run_migrations(&pool).unwrap();
    let service = ScreenshotService::new(&pool, &paths);

    let entry = service
        .store(test_image(16, 12), "region", None)
        .unwrap();
    fs::remove_file(&entry.original_path).unwrap();
    fs::remove_file(&entry.thumbnail_path).unwrap();

    let gallery = service.list_gallery().unwrap();
    assert_eq!(gallery.len(), 1);
    assert!(!gallery[0].original_available);
    assert!(!gallery[0].thumbnail_available);

    assert!(matches!(
        service.load_image(&entry.id, ScreenshotVariant::Original),
        Err(lucidclip_lib::errors::AppError::NotFound(_))
    ));
    assert!(service.delete(&entry.id).unwrap());
    assert!(service.list_gallery().unwrap().is_empty());

    let _ = fs::remove_dir_all(root);
}
