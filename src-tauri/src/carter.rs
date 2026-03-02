use winapi::um::memoryapi::{VirtualAllocEx, WriteProcessMemory};
use winapi::um::processthreadsapi::{CreateRemoteThread, OpenProcess};
use winapi::um::winnt::{MEM_COMMIT, MEM_RESERVE, PAGE_READWRITE, PROCESS_ALL_ACCESS};
use winapi::um::libloaderapi::{GetModuleHandleA, GetProcAddress};
use std::time::{Duration};
use std::os::windows::process::CommandExt;
use tauri::{AppHandle};
use winapi::shared::minwindef::FALSE;
use winapi::um::handleapi::CloseHandle;
use winapi::um::processthreadsapi::{OpenThread, SuspendThread};
use winapi::um::tlhelp32::{CreateToolhelp32Snapshot, Thread32First, Thread32Next, TH32CS_SNAPTHREAD, THREADENTRY32};
use winapi::um::debugapi::IsDebuggerPresent;
use winapi::um::synchapi::WaitForSingleObject;
use winapi::um::winbase::INFINITE;
use tauri::Manager;
use winapi::um::winnt::HANDLE;
use winapi::um::winnt::THREAD_SUSPEND_RESUME;
use sysinfo::System;

async fn wait_for_game_stable(pid: u32) -> bool {
    let mut system = System::new_all();
    let sys_pid = sysinfo::Pid::from(pid as usize);
    let mut stable_seconds = 0;

    tokio::time::sleep(Duration::from_secs(15)).await;

    for i in 0..120 {
        system.refresh_processes(sysinfo::ProcessesToUpdate::All, true);
        
        if let Some(process) = system.processes().get(&sys_pid) {
            let memory_mb = process.memory() / 1024 / 1024;
            let cpu_usage = process.cpu_usage();
            if memory_mb > 1200 && cpu_usage > 1.0 {
                stable_seconds += 1;
            } else {
                stable_seconds = 0;
            }

            if stable_seconds >= 5 {
                println!("Game is good. Ready to inject DLL's.");
                tokio::time::sleep(Duration::from_secs(5)).await;
                return true;
            }
        } else {
            println!("Game lost during wait.");
            return false; 
        }
        
        tokio::time::sleep(Duration::from_secs(1)).await;
    }
    false
}

pub fn security_check() -> bool {
    unsafe {
        if IsDebuggerPresent() != 0 {
            return false;
        }
    }
    true
}

use discord_rich_presence::{activity, DiscordIpc, DiscordIpcClient};

pub fn start_discord_rpc() {
    let app_id = std::env::var("VITE_DISCORD_CLIENT_ID").unwrap_or_default();
    let launcher_name = std::env::var("VITE_LAUNCHER_NAME").unwrap_or_else(|_| "Project".to_string());
    let discord_link = std::env::var("VITE_DISCORD_LINK").unwrap_or_default();

    tokio::spawn(async move {
        if app_id.is_empty() {
            println!("RPC Error: No Client ID found in .env file");
            return;
        }

        let mut client = DiscordIpcClient::new(&app_id).expect("Failed to create RPC client");
        
        loop {
            if client.connect().is_ok() {
                println!("Discord RPC Connected!");
                loop {
                    let details = format!("Playing {}", launcher_name);
                    let payload = activity::Activity::new()
                        .state("In Launcher")
                        .details(&details)
                        .assets(activity::Assets::new()
                            .large_image("logo")
                            .large_text(&launcher_name))
                        .buttons(vec![activity::Button::new("Join Discord", &discord_link)]);

                    if client.set_activity(payload).is_err() {
                        break;
                    }
                    tokio::time::sleep(std::time::Duration::from_secs(15)).await;
                }
            }
            tokio::time::sleep(std::time::Duration::from_secs(5)).await;
        }
    });
}

const CREATE_NO_WINDOW: u32 = 0x08000000;

pub fn kill() {
    let mut system = System::new_all();
    system.refresh_all();

    let processes = vec![
        "EpicGamesLauncher.exe",
        "FortniteLauncher.exe",
        "FortniteClient-Win64-Shipping_EAC.exe",
        "FortniteClient-Win64-Shipping_BE.exe",
        "FortniteClient-Win64-Shipping.exe",
        "EasyAntiCheat_EOS.exe",
        "EpicWebHelper.exe",
    ];

    for process in processes.iter() {
        let cmd = std::process::Command::new("cmd")
            .creation_flags(CREATE_NO_WINDOW)
            .args(&["/C", "taskkill", "/F", "/IM", process])
            .spawn();

        if cmd.is_err() {
            return;
        }
    }

    std::thread::sleep(std::time::Duration::from_millis(10));
}

pub fn kill_epic() {
    let cmd = std::process::Command::new("cmd")
        .creation_flags(CREATE_NO_WINDOW)
        .args(&["/C", "taskkill /F /IM", "EpicGamesLauncher.exe"])
        .spawn();

    if cmd.is_err() {
        return;
    }

    std::thread::sleep(std::time::Duration::from_millis(10));
}

pub async fn download(url: &str, filename: &str, path: &str, window: &tauri::Window) -> Result<(), String> {
    println!("Downloading {} from: {}", filename, url);
    
    let full_url = if url.ends_with('/') || url.is_empty() {
        format!("{}{}", url, filename)
    } else {
        url.to_string()
    };

    let response = reqwest::get(&full_url)
        .await
        .map_err(|e| format!("Network error: {}", e))?;

    if !response.status().is_success() {
        return Err(format!("Download failed for {}: {}", filename, response.status()));
    }

    let _ = window.emit("update-status", format!("Downloading: {}", filename));

    let content = response.bytes().await.map_err(|e| e.to_string())?;
    std::fs::write(path, content).map_err(|e| format!("File Error: {}", e))?;
    
    Ok(())
}

pub async fn download_paks(game_root: &str, urls: String, app: &tauri::AppHandle) -> Result<(), String> {
    use tauri::Manager;
    if urls.trim().is_empty() { return Ok(()); }

    let window = app.get_window("main").ok_or("Main window not found")?;
    let mut paks_path = std::path::PathBuf::from(game_root);
    paks_path.push("FortniteGame\\Content\\Paks");

    if !paks_path.exists() {
        std::fs::create_dir_all(&paks_path).map_err(|e| e.to_string())?;
    }

    let url_list: Vec<&str> = urls.split(',').filter(|s| !s.trim().is_empty()).collect();
    
    let _ = window.emit("download-start", true);

    for (i, url) in url_list.iter().enumerate() {
        let filename = url.split('/').last().unwrap_or("unknown.pak");
        let target_path = paks_path.join(filename);
        let progress = ((i + 1) as f32 / url_list.len() as f32 * 100.0) as u32;

        if target_path.exists() {
            let _ = window.emit("download-progress", progress);
            continue; 
        }

        let _ = window.emit("update-status", format!("Installing: {}", filename));
        let _ = window.emit("download-progress", progress);
        
        let target_str = target_path.to_str().unwrap();

        match download(url, filename, target_str, &window).await {
            Ok(_) => {
            }
            Err(e) => {
                let _ = window.emit("download-warning", format!("Failed: {} (Skipping in 3s)", filename));
                println!("Download failed for {}: {}", filename, e);

                tokio::time::sleep(Duration::from_secs(3)).await;

                let _ = window.emit("update-status", "Resuming...");
            }
        }
    }
    let _ = window.emit("download-complete", true);
    Ok(())
}

pub fn suspend_process(pid: u32) -> (u32, bool) {
    unsafe {
        let mut has_err = false;
        let mut count: u32 = 0;

        let te: &mut THREADENTRY32 = &mut std::mem::zeroed();
        (*te).dwSize = std::mem::size_of::<THREADENTRY32>() as u32;

        let snapshot: HANDLE = CreateToolhelp32Snapshot(TH32CS_SNAPTHREAD, 0);

        if Thread32First(snapshot, te) == 1 {
            loop {
                if pid == (*te).th32OwnerProcessID {
                    let tid = (*te).th32ThreadID;

                    let thread: HANDLE = OpenThread(THREAD_SUSPEND_RESUME, FALSE, tid);
                    has_err |= SuspendThread(thread) as i32 == -1i32;

                    CloseHandle(thread);
                    count += 1;
                }

                if Thread32Next(snapshot, te) == 0 {
                    break;
                }
            }
        }

        CloseHandle(snapshot);

        (count, has_err)
    }
}

pub fn is_process_suspended(pid: u32) -> bool {
    unsafe {
        let mut is_suspended = true;

        let te: &mut THREADENTRY32 = &mut std::mem::zeroed();
        (*te).dwSize = std::mem::size_of::<THREADENTRY32>() as u32;

        let snapshot: HANDLE = CreateToolhelp32Snapshot(TH32CS_SNAPTHREAD, 0);

        if Thread32First(snapshot, te) == 1 {
            loop {
                if pid == (*te).th32OwnerProcessID {
                    let tid = (*te).th32ThreadID;

                    let thread: HANDLE = OpenThread(THREAD_SUSPEND_RESUME, FALSE, tid);
                    let suspend_count = SuspendThread(thread) as i32;

                    if suspend_count == -1i32 {
                        is_suspended = false;
                    } else {
                        is_suspended &= suspend_count > 0;
                    }

                    CloseHandle(thread);
                }

                if Thread32Next(snapshot, te) == 0 {
                    break;
                }
            }
        }

        CloseHandle(snapshot);

        is_suspended
    }
}

pub async fn launch_real_launcher(root: &str) -> Result<bool, String> {
    println!("Launching real launcher at path: {}", root);

    let base = std::path::PathBuf::from(root);
    let mut resource_path = base.clone();
    resource_path.push("FortniteGame\\Binaries\\Win64\\FortniteLauncher.exe");

    println!("Launcher path: {:?}", resource_path);

    let mut cwd = std::path::PathBuf::from(root);
    cwd.push("FortniteGame\\Binaries\\Win64");

    println!("Current directory for launcher: {:?}", cwd);

    kill_epic();
    println!("Killed Epic process.");

    let cmd = std::process::Command::new(resource_path.clone())
        .creation_flags(CREATE_NO_WINDOW | 0x00000004)
        .current_dir(cwd)
        .spawn();

    if cmd.is_err() {
        println!("Failed to launch '{}'", resource_path.to_str().unwrap());
        return Err(format!(
            "Failed to launch '{}'",
            resource_path.to_str().unwrap()
        ));
    }

    let pid = cmd.unwrap().id();
    println!("Launched process with PID: {}", pid);

    while !is_process_suspended(pid.clone()) {
        let (_, _) = suspend_process(pid.clone());
        println!("Suspended process with PID: {}", pid);
        std::thread::sleep(std::time::Duration::from_millis(100));
    }
    kill_epic();
    Ok(true)
}

#[tauri::command]
pub async fn dll_replace(path: &str, url: String, _app: tauri::AppHandle) -> Result<bool, String> {
    use tauri::Manager;
    
    let path_buf = std::path::PathBuf::from(path);
    let mut nvidia_path = path_buf.clone();
    nvidia_path.push("Engine\\Binaries\\ThirdParty\\NVIDIA\\NVaftermath\\Win64\\GFSDK_Aftermath_Lib.x64.dll");

    if nvidia_path.exists() {
        let _ = std::fs::remove_file(&nvidia_path);
    }

    let window = _app.get_window("main").ok_or("Main window not found")?;
    let target_str = nvidia_path.to_str().unwrap();

    download(&url, "", target_str, &window).await?;

    Ok(true)
}

pub fn inject_dll(pid: u32, dll_path: &str) -> Result<(), String> {
    unsafe {
        let handle = OpenProcess(PROCESS_ALL_ACCESS, FALSE, pid);
        if handle.is_null() { return Err("Couldn't find the game process".into()); }

        let path_null = format!("{}\0", dll_path);
        let bytes = path_null.as_bytes();
        
        let mem = VirtualAllocEx(handle, std::ptr::null_mut(), bytes.len(), MEM_COMMIT | MEM_RESERVE, PAGE_READWRITE);
        WriteProcessMemory(handle, mem, bytes.as_ptr() as *const _, bytes.len(), std::ptr::null_mut());

        let k32 = GetModuleHandleA("kernel32.dll\0".as_ptr() as *const i8);
        let load_lib = GetProcAddress(k32, "LoadLibraryA\0".as_ptr() as *const i8);

        let thread = CreateRemoteThread(handle, std::ptr::null_mut(), 0, Some(std::mem::transmute(load_lib)), mem, 0, std::ptr::null_mut());
        
        if !thread.is_null() {
            WaitForSingleObject(thread, INFINITE);
            CloseHandle(thread);
        }
        
        CloseHandle(handle);
        Ok(())
    }
}

pub async fn launch_fn(
    path: &str,
    redirect_url: String, 
    inject_urls: String,
    paks_urls: String,
    app: AppHandle,
    email: String,
    password: String,
    eor: bool,
) -> Result<bool, String> {
    let window = app.get_window("main").ok_or("Main window not found")?;
    let base = std::path::PathBuf::from(path);

    download_paks(path, paks_urls, &app).await?;

    if let Err(e) = dll_replace(path, redirect_url, app.clone()).await {
        return Err(format!("Could not replace DLL: {}", e));
    }

    let mut downloaded_dlls = Vec::new();
    if !inject_urls.is_empty() {
        for url in inject_urls.split(',') {
            let url = url.trim();
            if url.is_empty() { continue; }
            
            let filename = url.split('/').last().unwrap_or("inject.dll");
            let temp_path = std::env::temp_dir().join(filename);
            let temp_path_str = temp_path.to_str().ok_or("Invalid temp path")?.to_string();

            download(url, filename, &temp_path_str, &window).await?;
            downloaded_dlls.push(temp_path_str);
        }
    }

    let mut fort_ac_path = base.clone();
    fort_ac_path.push("FortniteGame\\Binaries\\Win64\\FortniteClient-Win64-Shipping_EAC.exe");
    
    let mut fort_ac_cwd = base.clone();
    fort_ac_cwd.push("FortniteGame\\Binaries\\Win64");
    
    let _ = std::process::Command::new(fort_ac_path)
        .creation_flags(CREATE_NO_WINDOW | 0x00000004)
        .current_dir(fort_ac_cwd)
        .spawn();

    let _ = launch_real_launcher(base.to_str().unwrap()).await?;

    let mut fort_binary = base.clone();
    fort_binary.push("FortniteGame\\Binaries\\Win64\\FortniteClient-Win64-Shipping.exe");
    
    let fort_args = vec![
        "-epicapp=Fortnite".to_string(),
        "-epicenv=Prod".to_string(),
        "-epiclocale=en-us".to_string(),
        "-epicportal".to_string(),
        "-nouac".to_string(),
        "-skippatchcheck".to_string(),
        "-nobe".to_string(),
        "-fromfl=eac".to_string(),
        "-fltoken=3db3ba5dcbd2e16703f3978d".to_string(),
        "-caldera=eyJhbGciOiJFUzI1NiIsInR5cCI6IkpXVCJ9.eyJhY2NvdW50X2lkIjoiYmU5ZGE1YzJmYmVhNDQwN2IyZjQwZWJhYWQ4NTlhZDQiLCJnZW5lcmF0ZWQiOjE2Mzg3MTcyNzgsImNhbGRlcmFHdWlkIjoiMzgxMGI4NjMtMmE2NS00NDU3LTliNTgtNGRhYjNiNDgyYTg2IiwiYWNQcm92aWRlciI6IkVhc3lBbnRpQ2hlYXQiLCJub3RlcyI6IiIsImZhbGxiYWNrIjpmYWxzZX0.VAWQB67RTxhiWOxx7DBjnzDnXyyEnX7OljJm-j2d88G_WgwQ9wrE6lwMEHZHjBd1ISJdUO1UVUqkfLdU5nofBQ".to_string(),
        "-AUTH_TYPE=epic".to_string(),
        if eor { "-eor".to_string() } else { "".to_string() },
        format!("-AUTH_LOGIN={}", email),
        format!("-AUTH_PASSWORD={}", password),
    ];

    let fort_cmd = std::process::Command::new(&fort_binary)
        .creation_flags(CREATE_NO_WINDOW)
        .args(&fort_args) 
        .spawn()
        .map_err(|e| format!("Failed to spawn: {}", e))?;

    let pid = fort_cmd.id();
    let _ = window.emit("update-status", "Monitoring game load...");

    if wait_for_game_stable(pid).await {
        for dll_path in downloaded_dlls {
            let _ = inject_dll(pid, &dll_path);
            tokio::time::sleep(Duration::from_millis(500)).await;
        }
        let _ = window.emit("update-status", "Ready!");
    }

    Ok(true)
}

#[tauri::command]
pub async fn download_paks_cmd(game_root: String, urls: String, app: tauri::AppHandle) -> Result<(), String> {
    download_paks(&game_root, urls, &app).await
}
