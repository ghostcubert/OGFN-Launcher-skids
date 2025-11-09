use std::io::Write;
use std::os::windows::process::CommandExt;
use std::path::PathBuf;
use tauri::{AppHandle, Manager};
use winapi::shared::minwindef::FALSE;
use winapi::um::handleapi::CloseHandle;
use winapi::um::processthreadsapi::{OpenThread, SuspendThread};
use winapi::um::tlhelp32::{
    CreateToolhelp32Snapshot, Thread32First, Thread32Next, TH32CS_SNAPTHREAD, THREADENTRY32,
};

use winapi::um::winnt::HANDLE;
use winapi::um::winnt::THREAD_SUSPEND_RESUME;

use sysinfo::System;

use std::sync::Arc;
use tokio::sync::Mutex;

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

fn generate_ranges(file_size: u64, worker_count: u64) -> Vec<(u64, u64)> {
    let mut ranges = Vec::new();
    let chunk_size = file_size / worker_count;
    let mut start = 0;

    for i in 0..worker_count {
        let end = if i == worker_count - 1 {
            file_size - 1
        } else {
            start + chunk_size - 1
        };

        ranges.push((start, end));
        start = end + 1;
    }

    ranges
}

#[derive(serde::Serialize, serde::Deserialize, Debug, Clone)]
pub struct DownloadProgress {
    pub file_name: String,
    pub wanted_file_size: u64,
    pub downloaded_file_size: u64,
    pub download_speed: u128,
    pub is_zip_progress: bool,
}

const OVERWRITE_LIST: [[&str; 2]; 3] = [
    ["EasyAntiCheat", "Easy Anti-Cheat"],
    ["asdasdasdsad", "asdasdasdasdas"],
    ["paks", "asdasdsadasd"],
];

pub async fn download(
    url: &str,
    file_name: &str,
    path: &str,
    window: &tauri::Window,
) -> Result<bool, String> {
    let file_url = format!("{}/{}", url, file_name);
    let file_client = reqwest::Client::new();

    let file_res = file_client.get(file_url.clone()).send().await;
    let file_res = match file_res {
        Ok(res) => res,
        Err(e) => return Err(format!("Failed to download '{}': {}", file_name, e)),
    };

    let wanted_file_size = file_res.content_length().unwrap_or(0);
    let progress = Arc::new(Mutex::new(DownloadProgress {
        file_name: file_name.to_string(),
        wanted_file_size,
        downloaded_file_size: 0,
        download_speed: 0,
        is_zip_progress: false,
    }));

    for i in 0..OVERWRITE_LIST.len() {
        if file_name.contains(OVERWRITE_LIST[i][0]) {
            let mut progress_m = progress.lock().await;
            progress_m.file_name = OVERWRITE_LIST[i][1].to_string();
            break;
        }
    }

    window
        .emit("download_progress", progress.lock().await.to_owned())
        .unwrap();

    let worker_count = (num_cpus::get() / 2) as u8;
    let byte_ranges = generate_ranges(wanted_file_size, worker_count as u64);

    let download_tasks: Vec<_> = byte_ranges
        .into_iter()
        .map(|(start, end)| {
            let file_url = file_url.clone();
            let file_name = file_name.to_string();
            let progress = progress.clone();
            let partial_file_client = file_client.clone();
            let window = window.clone();

            tokio::spawn(async move {
                let mut bytes: Vec<u8> = Vec::new();
                let res = partial_file_client
                    .get(file_url.clone())
                    .header("Range", format!("bytes={}-{}", start, end))
                    .send()
                    .await;

                let mut res = match res {
                    Ok(res) => res,
                    Err(e) => return Err(format!("Failed to download '{}': {}", file_name, e)),
                };

                let mut last_update = std::time::Instant::now();

                while let Some(chunk) = res.chunk().await.unwrap_or(None) {
                    let now = std::time::Instant::now();
                    let elapsed = now.duration_since(last_update).as_millis();

                    let mut progress_lock = progress.lock().await;
                    progress_lock.downloaded_file_size += chunk.len() as u64;

                    let mut elapsed2 = now.duration_since(last_update).as_millis();
                    if elapsed2 == 0 {
                        elapsed2 = 1;
                    }
                    progress_lock.download_speed = (chunk.len() as u128 * 1000000) / elapsed2;

                    if elapsed >= 100 {
                        window
                            .emit("download_progress", progress_lock.to_owned())
                            .unwrap();
                        last_update = now;
                    }

                    drop(progress_lock);
                    bytes.write_all(&chunk).unwrap();
                }

                window
                    .emit("download_progress", progress.lock().await.to_owned())
                    .unwrap();

                Ok::<Vec<u8>, String>(bytes)
            })
        })
        .collect();

    let results = futures::future::join_all(download_tasks).await;

    let mut total_bytes: Vec<u8> = Vec::new();
    for result in results {
        let bytes = match result {
            Ok(bytes) => bytes,
            Err(_) => {
                println!("Failed to download '{}'", file_name);
                return Err("Failed to download file".to_string());
            }
        };

        total_bytes.write_all(bytes.unwrap().as_ref()).unwrap();
    }

    let mut file =
        std::fs::File::create(path).or(Err(format!("Failed to create file '{}'", path)))?;
    file.write_all(&total_bytes)
        .or(Err(format!("Failed to write '{}'", path)))?;

    Ok(true)
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
async fn dll_replace(path: &str, app: AppHandle) -> Result<bool, String> {
    println!("Experience function called for path: {}", path);

    let window = app.get_window("main").unwrap();
    println!("Got main window.");

    println!("Killed any existing processes.");

    let path = PathBuf::from(path);
    println!("Converted path to PathBuf: {:?}", path);

    let mut nvidia_path = path.clone();
    nvidia_path.push(
        "Engine\\Binaries\\ThirdParty\\NVIDIA\\NVaftermath\\Win64\\GFSDK_Aftermath_Lib.x64.dll",
    );
    println!("NVIDIA DLL path: {:?}", nvidia_path);

    while nvidia_path.exists() {
        if std::fs::remove_file(&nvidia_path).is_ok() {
            println!("Removed existing NVIDIA DLL: {:?}", nvidia_path);
            break;
        }

        println!("Failed to remove NVIDIA DLL, retrying...");
        std::thread::sleep(std::time::Duration::from_millis(100));
    }

    let _ = download(
        "DLL",
        "Starfall.dll",
        nvidia_path.clone().to_str().unwrap(),
        &window,
    )
    .await;

    Ok(true)
}

#[tauri::command]
pub async fn launch_fn(
    path: &str,
    app: AppHandle,
    email: String,
    password: String,
    eor: bool,
) -> Result<bool, String> {
    match dll_replace(path, app).await {
        Ok(_) => {}
        Err(e) => {
            return Err(
                "Could not launch the game for reason: ".to_string() + e.to_string().as_str()
            );
        }
    }

    let base = std::path::PathBuf::from(path);
    let mut fort_ac_path = base.clone();
    fort_ac_path.push("FortniteGame\\Binaries\\Win64\\FortniteClient-Win64-Shipping_EAC.exe");
    if !fort_ac_path.exists() {
        return Err("FortniteClient-Win64-Shipping_EAC.exe not found".to_string());
    }

    let mut fort_ac_cwd = base.clone();
    fort_ac_cwd.push("FortniteGame\\Binaries\\Win64");
    let fortnite_ac_process = std::process::Command::new(fort_ac_path)
        .creation_flags(CREATE_NO_WINDOW | 0x00000004)
        .current_dir(fort_ac_cwd)
        .spawn();

    if fortnite_ac_process.is_err() {
        return Err("Failed to launch FortniteClient-Win64-Shipping_EAC.exe".to_string());
    }
    let res = launch_real_launcher(base.clone().to_str().unwrap()).await;
    if res.is_err() {
        println!("launch easy anti cheat");
        return Err("Failed to launch Fortnite Launcher".to_string());
    }

    let mut fort_binary = base.clone();
    fort_binary.push("FortniteGame\\Binaries\\Win64\\FortniteClient-Win64-Shipping.exe");
    if !fort_binary.exists() {
        return Err("Could not find FortniteClient-Win64-Shipping.exe".to_string());
    }

    let auth_email = format!("-AUTH_LOGIN={}", email);
    let auth_password = format!("-AUTH_PASSWORD={}", password);
    let fort_args = vec![
        "-epicapp=Fortnite",
        "-epicenv=Prod",
        "-epiclocale=en-us",
        "-epicportal",
        "-skippatchcheck",
        "-nobe",
        "-fromfl=eac",
        "-fltoken=3db3ba5dcbd2e16703f3978d",
        "-caldera=eyJhbGciOiJFUzI1NiIsInR5cCI6IkpXVCJ9.eyJhY2NvdW50X2lkIjoiYmU5ZGE1YzJmYmVhNDQwN2IyZjQwZWJhYWQ4NTlhZDQiLCJnZW5lcmF0ZWQiOjE2Mzg3MTcyNzgsImNhbGRlcmFHdWlkIjoiMzgxMGI4NjMtMmE2NS00NDU3LTliNTgtNGRhYjNiNDgyYTg2IiwiYWNQcm92aWRlciI6IkVhc3lBbnRpQ2hlYXQiLCJub3RlcyI6IiIsImZhbGxiYWNrIjpmYWxzZX0.VAWQB67RTxhiWOxx7DBjnzDnXyyEnX7OljJm-j2d88G_WgwQ9wrE6lwMEHZHjBd1ISJdUO1UVUqkfLdU5nofBQ",
        "-AUTH_TYPE=epic",
        if eor { "-eor" } else {""},
        &auth_email,
        &auth_password,
    ];

    let fort_cmd = std::process::Command::new(fort_binary)
        .creation_flags(CREATE_NO_WINDOW)
        .args(fort_args)
        .spawn();

    if fort_cmd.is_err() {
        return Err("Failed to launch Fortnite".to_string());
    }

    println!("Fortnite launched successfully.");
    Ok(true)
}
