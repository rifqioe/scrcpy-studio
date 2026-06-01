//! Direct device control via adb — the buttons behind the floating control toolbar.
//!
//! These send input/system commands straight to the device, independent of a scrcpy mirror.

use crate::error::{AppError, Result};
use std::path::{Path, PathBuf};
use std::process::Command;

#[cfg(windows)]
use std::os::windows::process::CommandExt;
#[cfg(windows)]
const CREATE_NO_WINDOW: u32 = 0x0800_0000;

fn adb_args(adb: &Path, serial: &str, args: &[&str]) -> Command {
    let mut cmd = Command::new(adb);
    cmd.arg("-s").arg(serial).args(args);
    #[cfg(windows)]
    cmd.creation_flags(CREATE_NO_WINDOW);
    cmd
}

fn run(adb: &Path, serial: &str, args: &[&str]) -> Result<()> {
    let out = adb_args(adb, serial, args)
        .output()
        .map_err(|e| AppError::Adb(format!("adb {args:?}: {e}")))?;
    if !out.status.success() {
        return Err(AppError::Adb(
            String::from_utf8_lossy(&out.stderr).trim().to_string(),
        ));
    }
    Ok(())
}

/// Map a high-level action to its Android keycode (see KeyEvent constants).
fn keycode(action: &str) -> Option<&'static str> {
    Some(match action {
        "home" => "3",
        "back" => "4",
        "recents" => "187",  // APP_SWITCH
        "menu" => "82",
        "power" => "26",
        "volume_up" => "24",
        "volume_down" => "25",
        "mute" => "164",      // VOLUME_MUTE
        "wake" => "224",      // KEYCODE_WAKEUP
        "sleep" => "223",     // KEYCODE_SLEEP
        "copy" => "278",      // KEYCODE_COPY
        "paste" => "279",     // KEYCODE_PASTE
        "cut" => "277",       // KEYCODE_CUT
        "assist" => "219",    // KEYCODE_ASSIST (hold-home → assistant/Gemini)
        _ => return None,
    })
}

/// Cycle the device's forced display rotation (0→1→2→3), disabling auto-rotate first.
fn rotate(adb: &Path, serial: &str) -> Result<()> {
    let out = adb_args(adb, serial, &["shell", "settings", "get", "system", "user_rotation"])
        .output()
        .map_err(|e| AppError::Adb(format!("read rotation: {e}")))?;
    let cur: i32 = String::from_utf8_lossy(&out.stdout).trim().parse().unwrap_or(0);
    let next = ((cur + 1) % 4).to_string();
    run(adb, serial, &["shell", "settings", "put", "system", "accelerometer_rotation", "0"])?;
    run(adb, serial, &["shell", "settings", "put", "system", "user_rotation", &next])
}

/// Perform a device action. Keycode-backed actions plus a few system commands.
/// An action prefixed `hold_` is sent as a long-press (e.g. `hold_power` → power menu).
pub fn action(adb: &Path, serial: &str, action: &str) -> Result<()> {
    if let Some(rest) = action.strip_prefix("hold_") {
        if let Some(code) = keycode(rest) {
            return run(adb, serial, &["shell", "input", "keyevent", "--longpress", code]);
        }
    }
    if let Some(code) = keycode(action) {
        return run(adb, serial, &["shell", "input", "keyevent", code]);
    }
    match action {
        "notifications" => run(adb, serial, &["shell", "cmd", "statusbar", "expand-notifications"]),
        "collapse" => run(adb, serial, &["shell", "cmd", "statusbar", "collapse"]),
        "settings" => run(adb, serial, &["shell", "cmd", "statusbar", "expand-settings"]),
        "rotate" => rotate(adb, serial),
        other => Err(AppError::InvalidArgs(format!("unknown control action: {other}"))),
    }
}

/// Capture a screenshot via `adb exec-out screencap -p`, saving a PNG under `dir`.
/// `stamp` is supplied by the caller (the backend has no clock-free way to name files).
pub fn screenshot(adb: &Path, serial: &str, dir: &Path, stamp: &str) -> Result<PathBuf> {
    std::fs::create_dir_all(dir)?;
    let out = adb_args(adb, serial, &["exec-out", "screencap", "-p"])
        .output()
        .map_err(|e| AppError::Adb(format!("screencap: {e}")))?;
    if !out.status.success() || out.stdout.is_empty() {
        return Err(AppError::Adb(
            String::from_utf8_lossy(&out.stderr).trim().to_string(),
        ));
    }
    let path = dir.join(format!("screenshot-{stamp}.png"));
    std::fs::write(&path, &out.stdout)?;
    Ok(path)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn known_actions_map_to_keycodes() {
        assert_eq!(keycode("home"), Some("3"));
        assert_eq!(keycode("back"), Some("4"));
        assert_eq!(keycode("recents"), Some("187"));
        assert_eq!(keycode("volume_up"), Some("24"));
        assert_eq!(keycode("unknown"), None);
    }
}
