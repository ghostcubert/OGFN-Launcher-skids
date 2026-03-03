@echo off
setlocal
title Launcher - Development Console

:: Define ANSI Color Codes
set "ESC="
set "Green=%ESC%[92m"
set "Red=%ESC%[91m"
set "Yellow=%ESC%[93m"
set "Cyan=%ESC%[96m"
set "White=%ESC%[97m"
set "Reset=%ESC%[0m"

:: --- Visual Header ---
cls
echo %Cyan%==========================================%Reset%
echo %White%          LAUNCHER TEST%Reset%
echo %Cyan%==========================================%Reset%
echo.

:: --- Pre-flight Checks ---
echo %Yellow%[1/2]%Reset% Checking environment...

:: Check for Bun
where bun >nul 2>nul
if %errorlevel% neq 0 (
    echo %Red%[ERROR]%Reset% Bun is missing! Run %Cyan%installer.bat%Reset% first.
    pause
    exit /b
)

:: Check for Rust (Essential for Tauri)
where cargo >nul 2>nul
if %errorlevel% neq 0 (
    echo %Red%[ERROR]%Reset% Rust/Cargo not found. 
    echo Please install from %Cyan%https://rustup.rs/%Reset%
    pause
    exit /b
)

echo %Green%[READY]%Reset% Environment looks good.
echo.

:: --- Start Dev Server ---
echo %Yellow%[2/2]%Reset% Booting Up...
echo %White%------------------------------------------%Reset%
echo %Cyan%Launching Vite + Rust Compilers...%Reset%
echo.

:: Run the dev command
call bun tauri dev

:: --- Cleanup on Close ---
echo.
echo %White%------------------------------------------%Reset%
echo %Yellow%Testing ended.%Reset%
echo %White%Press any key to close this window...%Reset%
pause >nul