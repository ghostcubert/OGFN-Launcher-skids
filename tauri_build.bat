@echo off
setlocal
title Launcher - Production Build

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
echo %White%            TAURI BUILDER%Reset%
echo %Cyan%==========================================%Reset%
echo.

:: --- Pre-flight Checks ---
echo %Yellow%[1/3]%Reset% Checking environment...
where bun >nul 2>nul || (echo %Red%[!] Bun Missing%Reset% && pause && exit /b)
where cargo >nul 2>nul || (echo %Red%[!] Rust Missing%Reset% && pause && exit /b)

:: --- Start Build ---
echo %Green%[READY]%Reset% Starting compilation...
echo %Yellow%[!] Warning:%Reset% This may take a few minutes.
echo %White%------------------------------------------%Reset%

:: The actual build command
call bun tauri build

:: --- Post-Build Handling ---
if %errorlevel% equ 0 (
    echo %White%------------------------------------------%Reset%
    echo %Green%[SUCCESS] Build complete!%Reset%
    echo.
    set /p open_folder="Would you like to open the output folder? (y/n): "
    if /i "%open_folder%"=="y" (
        start explorer "src-tauri\target\release\bundle\msi"
    )
) else (
    echo.
    echo %Red%[!!] Build failed. Check the logs above for errors.%Reset%
    pause
    exit /b
)

echo.
echo %White%Press any key to exit...%Reset%
pause >nul