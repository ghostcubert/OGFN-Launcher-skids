# OGFN Ultimate Launcher Setup Guide

Welcome to the **OGFN Ultimate Launcher** guide. Follow these steps to use the launcher.

---

## Prerequisites

Before starting, you must have the following tools installed. 

### 1. Rust Language
Download **Rust** and choose the version accommodates your device: (32-bit, x64, or arm64)

[![](https://img.shields.io/badge/Install-Rust-brown?style=for-the-badge&logo=rust)](https://rust-lang.org/tools/install/)

### 2. Bun
Download **Bun** to execute code, choose Windows and run the command on powershell.

[![](https://img.shields.io/badge/Install-Bun-black?style=for-the-badge&logo=bun)](https://bun.com/get)

### 3. C++ Build Tools
Download **Microsoft C++ Build Tools** to compile the launcher.

[![](https://img.shields.io/badge/Install-C++_Build_Tools-purple?style=for-the-badge&logo=C%2B%2B&logoColor=white)](https://visualstudio.microsoft.com/visual-cpp-build-tools/)

---

## Getting Started

### Step 1: Install dependencies
Open the tauri_install.bat

_or_

Run this command on the root folder:

```bash
bun install
```

### Step 2: Modify the launcher
Rename the file ".env.example" to ".env", open it and modify as you like. Here are is what each setting does on the env file [Configuration guide](./Config.md).

### Step 3: Test the launcher
Open the tauri_test.bat

_or_

Run this command on the root folder

```bash
bun tauri dev
```

### Step 4: Building the launcher
Open the tauri_build.bat

_or_

Run this command on the root folder

```bash
bun tauri build
```
