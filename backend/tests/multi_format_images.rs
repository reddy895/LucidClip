use std::fs;
use image::{DynamicImage, ImageBuffer, ImageFormat, Rgba};
use lucidclip_lib::clipboard::media::{hash_image, store};
use lucidclip_lib::platform::CapturedImage;
use lucidclip_lib::storage::AppPaths;

#[test]
fn test_png_and_jpeg_memory_ingestion() {
    let temp_root = std::env::temp_dir().join(format!("lucidclip_multi_fmt_{}", std::process::id()));
    let paths = AppPaths::from_root(&temp_root);
    paths.ensure_dirs_exist().unwrap();

    // 1. Create a 32x32 test image buffer
    let img: ImageBuffer<Rgba<u8>, Vec<u8>> = ImageBuffer::from_pixel(32, 32, Rgba([0, 128, 255, 255]));
    let dynamic = DynamicImage::ImageRgba8(img);

    // 2. Encode to PNG memory stream
    let mut png_bytes = Vec::new();
    dynamic.write_to(&mut std::io::Cursor::new(&mut png_bytes), ImageFormat::Png).unwrap();
    assert!(!png_bytes.is_empty());

    // Decode from PNG memory stream
    let decoded_png = image::load_from_memory(&png_bytes).expect("Decode PNG memory");
    let rgba_png = decoded_png.to_rgba8();
    let captured_png = CapturedImage {
        width: rgba_png.width(),
        height: rgba_png.height(),
        rgba: rgba_png.into_raw(),
    };

    let hash_png = hash_image(&captured_png);
    let stored_png = store(&paths, "clip_test_png", &captured_png).expect("Store PNG image");
    assert_eq!(stored_png.width, 32);
    assert_eq!(stored_png.height, 32);
    assert!(!hash_png.is_empty());

    // 3. Encode to JPEG memory stream
    let mut jpeg_bytes = Vec::new();
    dynamic.write_to(&mut std::io::Cursor::new(&mut jpeg_bytes), ImageFormat::Jpeg).unwrap();
    assert!(!jpeg_bytes.is_empty());

    // Decode from JPEG memory stream
    let decoded_jpeg = image::load_from_memory(&jpeg_bytes).expect("Decode JPEG memory");
    let rgba_jpeg = decoded_jpeg.to_rgba8();
    let captured_jpeg = CapturedImage {
        width: rgba_jpeg.width(),
        height: rgba_jpeg.height(),
        rgba: rgba_jpeg.into_raw(),
    };

    let stored_jpeg = store(&paths, "clip_test_jpeg", &captured_jpeg).expect("Store JPEG image");
    assert_eq!(stored_jpeg.width, 32);
    assert_eq!(stored_jpeg.height, 32);

    // 4. Verify stored originals on disk are readable
    let png_resolved = paths.resolve_media_file(std::path::Path::new(&stored_png.original_path)).unwrap();
    assert!(png_resolved.is_file());

    let jpeg_resolved = paths.resolve_media_file(std::path::Path::new(&stored_jpeg.original_path)).unwrap();
    assert!(jpeg_resolved.is_file());

    let _ = fs::remove_dir_all(temp_root);
}
