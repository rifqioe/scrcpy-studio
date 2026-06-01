//! Tauri command handlers — thin wrappers over the core modules.

use crate::adb::{self, Device};
use crate::apps::{self, App};
use crate::args::ScrcpyArgs;
use crate::control;
use crate::binary::Binaries;
use crate::error::{AppError, Result};
use crate::session::SessionInfo;
use crate::state::AppState;
use std::process::Command;
use tauri::{AppHandle, State};

#[cfg(windows)]
use std::os::windows::process::CommandExt;
#[cfg(windows)]
const CREATE_NO_WINDOW: u32 = 0x0800_0000;

// ---- Binary management ----

#[tauri::command]
pub fn binary_current(state: State<AppState>) -> Option<Binaries> {
    state.binary.current()
}

#[tauri::command]
pub fn binary_latest_version(state: State<AppState>) -> Result<String> {
    state.binary.latest_version()
}

#[tauri::command]
pub fn binary_install_latest(state: State<AppState>) -> Result<Binaries> {
    state.binary.ensure_latest()
}

#[tauri::command]
pub fn binary_update(state: State<AppState>) -> Result<Binaries> {
    state.binary.update()
}

// ---- adb ----

#[tauri::command]
pub fn list_devices(state: State<AppState>) -> Result<Vec<Device>> {
    let bin = state.binary.require()?;
    adb::devices(&bin.adb)
}

#[tauri::command]
pub fn adb_connect(state: State<AppState>, addr: String) -> Result<String> {
    let bin = state.binary.require()?;
    adb::connect(&bin.adb, &addr)
}

#[tauri::command]
pub fn adb_disconnect(state: State<AppState>, addr: String) -> Result<String> {
    let bin = state.binary.require()?;
    adb::disconnect(&bin.adb, &addr)
}

#[tauri::command]
pub fn adb_pair(state: State<AppState>, addr: String, code: String) -> Result<String> {
    let bin = state.binary.require()?;
    adb::pair(&bin.adb, &addr, &code)
}

#[tauri::command]
pub fn adb_tcpip(state: State<AppState>, serial: String, port: u16) -> Result<String> {
    let bin = state.binary.require()?;
    adb::tcpip(&bin.adb, &serial, port)
}

/// One-click USB → Wi-Fi: read the device IP over USB, switch it to TCP/IP on 5555, then
/// connect over the network so it survives unplugging the cable. Returns the `ip:5555` serial.
#[tauri::command]
pub fn go_wireless(state: State<AppState>, serial: String) -> Result<String> {
    let bin = state.binary.require()?;
    // Read the IP while USB is still connected.
    let ip = adb::device_ip(&bin.adb, &serial)?;
    // Switch the device's adbd into TCP/IP mode (restarts adbd, ~1-2s).
    adb::tcpip(&bin.adb, &serial, 5555)?;
    std::thread::sleep(std::time::Duration::from_millis(1500));
    let addr = format!("{ip}:5555");
    adb::connect(&bin.adb, &addr)?;
    Ok(addr)
}

/// Start a QR wireless-pairing session: returns the QR payload to render and begins
/// browsing mDNS for the phone. The outcome arrives via the `qr-pair-result` event.
#[tauri::command]
pub fn qr_pair_start(
    app: AppHandle,
    state: State<AppState>,
    auto_connect: bool,
) -> Result<crate::qr_pair::QrSession> {
    let bin = state.binary.require()?;
    let session = crate::qr_pair::new_session();
    crate::qr_pair::start(app, bin.adb.clone(), session.clone(), auto_connect)?;
    Ok(session)
}

// ---- scrcpy launch / sessions ----

#[tauri::command]
pub fn preview_argv(args: ScrcpyArgs) -> Result<String> {
    args.preview()
}

#[tauri::command]
pub fn launch(app: AppHandle, state: State<AppState>, args: ScrcpyArgs) -> Result<SessionInfo> {
    let bin = state.binary.require()?;
    let argv = args.to_argv()?;
    state.sessions.launch(&app, &bin, argv)
}

#[tauri::command]
pub fn stop_session(state: State<AppState>, id: u32) -> Result<()> {
    state.sessions.stop(id)
}

#[tauri::command]
pub fn list_sessions(state: State<AppState>) -> Vec<SessionInfo> {
    state.sessions.list()
}

/// Run one of scrcpy's `--list-*` commands and return its combined output, used to
/// populate dropdowns (cameras, displays, encoders, apps, camera sizes).
#[tauri::command]
pub fn scrcpy_list(state: State<AppState>, kind: String, serial: Option<String>) -> Result<String> {
    let flag = match kind.as_str() {
        "cameras" => "--list-cameras",
        "camera-sizes" => "--list-camera-sizes",
        "displays" => "--list-displays",
        "encoders" => "--list-encoders",
        "apps" => "--list-apps",
        other => return Err(AppError::InvalidArgs(format!("unknown list kind: {other}"))),
    };
    let bin = state.binary.require()?;

    let mut cmd = Command::new(&bin.scrcpy);
    cmd.env("ADB", &bin.adb);
    if let Some(serial) = serial.filter(|s| !s.is_empty()) {
        cmd.arg("-s").arg(serial);
    }
    cmd.arg(flag);
    #[cfg(windows)]
    cmd.creation_flags(CREATE_NO_WINDOW);

    let out = cmd
        .output()
        .map_err(|e| AppError::Session(format!("failed to run scrcpy {flag}: {e}")))?;
    let mut text = String::from_utf8_lossy(&out.stdout).to_string();
    let stderr = String::from_utf8_lossy(&out.stderr);
    if !stderr.trim().is_empty() {
        text.push_str(&stderr);
    }
    Ok(text)
}

// ---- app launcher ----

#[tauri::command]
pub fn list_apps(
    state: State<AppState>,
    serial: Option<String>,
    include_system: bool,
) -> Result<Vec<App>> {
    let bin = state.binary.require()?;
    apps::list(&bin.scrcpy, &bin.adb, serial.as_deref(), include_system)
}

// ---- device control (floating toolbar) ----

#[tauri::command]
pub fn device_action(state: State<AppState>, serial: String, action: String) -> Result<()> {
    let bin = state.binary.require()?;
    control::action(&bin.adb, &serial, &action)
}

/// `stamp` is a caller-supplied timestamp used to name the PNG. Returns the saved path.
#[tauri::command]
pub fn device_screenshot(state: State<AppState>, serial: String, stamp: String) -> Result<String> {
    let bin = state.binary.require()?;
    let dir = state.data_dir.join("screenshots");
    let path = control::screenshot(&bin.adb, &serial, &dir, &stamp)?;
    Ok(path.to_string_lossy().to_string())
}

// ---- profiles ----

#[tauri::command]
pub fn profile_save(state: State<AppState>, name: String, args: ScrcpyArgs) -> Result<()> {
    crate::profiles::save(&state.data_dir, &name, &args)
}

#[tauri::command]
pub fn profile_load(state: State<AppState>, name: String) -> Result<ScrcpyArgs> {
    crate::profiles::load(&state.data_dir, &name)
}

#[tauri::command]
pub fn profile_list(state: State<AppState>) -> Result<Vec<String>> {
    crate::profiles::list(&state.data_dir)
}

#[tauri::command]
pub fn profile_delete(state: State<AppState>, name: String) -> Result<()> {
    crate::profiles::delete(&state.data_dir, &name)
}
