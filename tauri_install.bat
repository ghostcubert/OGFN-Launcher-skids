@echo off
setlocal
title Launcher - Installing Setup

:: Define ANSI Color Codes
set "ESC="
set "Green=%ESC%[92m"
set "Red=%ESC%[91m"
set "Yellow=%ESC%[33m"
set "Cyan=%ESC%[96m"
set "White=%ESC%[97m"
set "Reset=%ESC%[0m"

:: --- Visual Header ---
echo %Cyan%==========================================%Reset%
echo %White%          LAUNCHER - INSTALLER%Reset%
echo %Cyan%==========================================%Reset%
echo.

:: --- Check if Bun is installed ---
where bun >nul 2>nul
if %errorlevel% neq 0 (
    echo %Red%[ERROR]%Reset% Bun is not installed or not in your PATH.
    echo Please install it from %Cyan%https://bun.sh%Reset%
    pause
    exit /b
)

:: --- Run the Install ---
echo %Yellow%[1/2]%Reset% Cleaning old cache...
:: bun pm cache rm

echo %Yellow%[2/2]%Reset% Installing dependencies...
echo %White%------------------------------------------%Reset%
call bun install
echo %White%------------------------------------------%Reset%

:: --- Error Handling ---
if %errorlevel% equ 0 (
    echo.
    echo %Green%==========================================%Reset%
    echo %White%[SUCCESS] Everything has been installed!%Reset%
    echo %Green%==========================================%Reset%
) else (
    echo.
    echo %Red%[!!] Something went wrong during installation.%Reset%
    pause
    exit /b
)

echo.
echo %White%Press any key to exit...%Reset%
pause >nul