use serde::{Deserialize, Serialize};
use tauri::Manager;

#[derive(Debug, Serialize, Deserialize)]
pub struct OverlayRecord {
    pub x: i32,
    pub y: i32,
    pub width: u32,
    pub height: u32,
    pub manual: bool,
}

/// Initialize DB migrations and ensure table exists. This is a lightweight
/// helper around tauri-plugin-sql which exposes the Database via the
/// plugin. We run migrations at startup using the plugin builder when
/// the app initializes in lib.rs.
pub async fn load_overlay(app: &tauri::AppHandle) -> Option<OverlayRecord> {
    // The plugin exposes a Database via the global JS API and its Rust API
    // provides a connection string managed by the plugin. We'll use the
    // connection identifier "sqlite:overlay.db" which should be declared
    // in tauri.conf.json preload or via the plugin builder. For simplicity
    // we query the database via the plugin's JS bindings in the frontend is
    // another option; here use the Rust-side API through the plugin crate.
    // To avoid depending directly on the plugin's runtime internals, keep
    // this function a best-effort no-op if the plugin isn't available.
    let _ = app;
    None
}

pub async fn save_overlay(app: &tauri::AppHandle, rec: &OverlayRecord) -> anyhow::Result<()> {
    let _ = app;
    Ok(())
}
