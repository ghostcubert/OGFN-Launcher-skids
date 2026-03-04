#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]
use std::env;
use std::fs::create_dir_all;
use sysinfo::System;
use tauri::{AppHandle, Window};
mod carter;
use dotenvy::dotenv;

#[tauri::command]
fn close_launcher(app: tauri::AppHandle) {
    app.exit(0);
}

#[tauri::command]
fn window_minimize(window: Window) {
    window.minimize().unwrap();
}

#[tauri::command]
async fn firstlaunch(
    path: String,
    app: AppHandle,
    email: String,
    password: String,
    eor: bool,
) -> Result<bool, String> {
    if !carter::security_check() {
        return Err("Security violation: Debugger detected. Please close UUU or x64dbg.".to_string());
    }

    carter::kill();
    carter::kill_epic();

    let dll_url = env::var("VITE_REDIRECT_LINK").unwrap_or_default();
    let inject_dlls = env::var("VITE_INJECT_DLLS_LINKS").unwrap_or_default();
    let paks = env::var("VITE_PAKS_AND_SIGS_LINKS").unwrap_or_default();

    carter::launch_fn(&path, dll_url, inject_dlls, paks, app, email, password, eor).await
}

#[tauri::command]
fn is_fortnite_client_running() -> bool {
    let mut system = System::new_all();
    system.refresh_all();
    for (_, process) in system.processes() {
        if process.name().to_string_lossy().contains("FortniteClient-Win64-Shipping.exe") {
            return true;
        }
    }
    false
}

#[tauri::command]
fn window_close(window: Window) {
    window.close().unwrap();
}

#[tokio::main]
async fn main() {
    let env_content = include_str!("../../.env");
    for line in env_content.lines() {
        if line.starts_with('#') || line.trim().is_empty() { continue; }
        if let Some((key, value)) = line.split_once('=') {
            let clean_value = value.trim().trim_matches('"');
            std::env::set_var(key.trim(), clean_value);
        }
    }
    dotenv().ok();

    carter::start_discord_rpc();
    
    let app_name = env::var("VITE_LAUNCHER_NAME").unwrap_or_else(|_| "Project".to_string());
    let path = format!("C:\\Program Files\\{}", app_name);

    if let Err(e) = create_dir_all(&path) {
        eprintln!("Error creating directory: {}", e);
    }

    tauri::Builder::default()
        .on_window_event(|event| {
            match event.event() {
                tauri::WindowEvent::Destroyed | tauri::WindowEvent::CloseRequested { .. } => {
                    println!("Closing detected. Killing game processes...");
                    carter::kill();
                }
                _ => {}
            }
        })
        .setup(|_app| {
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            window_minimize,
            window_close,
            firstlaunch,
            is_fortnite_client_running,
            close_launcher,
            carter::download_paks_cmd,
            carter::install_build
        ])
        .run(tauri::generate_context!())
        .expect("Error starting the app");
}