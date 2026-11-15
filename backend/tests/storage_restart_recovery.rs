use std::fs;
use std::path::Path;
use lucidclip_lib::storage::AppPaths;

#[test]
fn test_relative_media_path_resolution() {
    let temp_root = std::env::temp_dir().join(format!("lucidclip_test_rel_{}", std::process::id()));
    let paths = AppPaths::from_root(&temp_root);
    paths.ensure_dirs_exist().unwrap();

    let test_file = paths.originals_dir.join("test_img.png");
    fs::write(&test_file, b"\x89PNG\r\n\x1a\nfakeimagebytes").unwrap();

    // 1. Relative path prefixed with "originals/"
    let rel_path = Path::new("originals/test_img.png");
    let resolved = paths.resolve_media_file(rel_path).expect("Resolve originals/ relative path");
    assert_eq!(resolved, fs::canonicalize(&test_file).unwrap());

    // 2. Basename resolution
    let base_path = Path::new("test_img.png");
    let resolved_base = paths.resolve_media_file(base_path).expect("Resolve basename");
    assert_eq!(resolved_base, fs::canonicalize(&test_file).unwrap());

    // 3. Path traversal rejection
    let traversal = Path::new("../outside.png");
    assert!(paths.resolve_media_file(traversal).is_err());

    let _ = fs::remove_dir_all(temp_root);
}

#[test]
fn test_restart_relocation_fallback() {
    let old_root = std::env::temp_dir().join(format!("lucidclip_old_root_{}", std::process::id()));
    let new_root = std::env::temp_dir().join(format!("lucidclip_new_root_{}", std::process::id()));

    let old_paths = AppPaths::from_root(&old_root);
    let new_paths = AppPaths::from_root(&new_root);

    old_paths.ensure_dirs_exist().unwrap();
    new_paths.ensure_dirs_exist().unwrap();

    // Imagine the user copied or migrated their data to new_paths
    let old_file_path = old_paths.originals_dir.join("migrated.png");
    let new_file_path = new_paths.originals_dir.join("migrated.png");
    fs::write(&new_file_path, b"\x89PNG\r\n\x1a\nvalidmigratedpng").unwrap();

    // Database still has old_file_path from before restart
    let resolved = new_paths.resolve_media_file(&old_file_path).expect("Fallback to new location by filename");
    assert_eq!(resolved, fs::canonicalize(&new_file_path).unwrap());

    let _ = fs::remove_dir_all(old_root);
    let _ = fs::remove_dir_all(new_root);
}
