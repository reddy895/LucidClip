//! LucidClip Desktop Backend Library

pub mod errors;
pub mod settings;
pub mod storage;
pub mod database;
pub mod clipboard;
pub mod screenshots;
pub mod search;
pub mod platform;
pub mod security;
pub mod commands;

pub fn init() {
    println!("[LucidClip] Initializing backend services...");
}
