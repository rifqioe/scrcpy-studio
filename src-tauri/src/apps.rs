//! Listing installed apps via `scrcpy --list-apps`, for the app launcher.

use crate::error::Result;
use serde::Serialize;
use std::path::Path;
use std::process::Command;

#[cfg(windows)]
use std::os::windows::process::CommandExt;
#[cfg(windows)]
const CREATE_NO_WINDOW: u32 = 0x0800_0000;

#[derive(Debug, Clone, Serialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct App {
    pub name: String,
    pub package: String,
    pub system: bool,
}

/// Parse `scrcpy --list-apps` output.
///
/// Lines look like (system apps marked `*`, user apps `-`):
/// ```text
/// List of apps:
///  * Settings                              com.android.settings
///  - Chrome                                com.android.chrome
/// ```
/// The package is the trailing dotted token; everything before it is the display name.
pub fn parse_apps(text: &str) -> Vec<App> {
    let mut apps = Vec::new();
    for line in text.lines() {
        let trimmed = line.trim_start();
        let (system, rest) = match trimmed.strip_prefix('*') {
            Some(r) => (true, r),
            None => match trimmed.strip_prefix('-') {
                Some(r) => (false, r),
                None => continue, // header / noise
            },
        };
        let mut parts: Vec<&str> = rest.split_whitespace().collect();
        let Some(package) = parts.pop() else {
            continue;
        };
        if !package.contains('.') {
            continue; // not a package name
        }
        let name = if parts.is_empty() {
            package.to_string()
        } else {
            parts.join(" ")
        };
        apps.push(App {
            name,
            package: package.to_string(),
            system,
        });
    }
    apps
}

/// Run `scrcpy --list-apps` against an optional device and return parsed apps.
pub fn list(scrcpy: &Path, adb: &Path, serial: Option<&str>, include_system: bool) -> Result<Vec<App>> {
    let mut cmd = Command::new(scrcpy);
    cmd.env("ADB", adb);
    if let Some(serial) = serial.filter(|s| !s.is_empty()) {
        cmd.arg("-s").arg(serial);
    }
    cmd.arg("--list-apps");
    #[cfg(windows)]
    cmd.creation_flags(CREATE_NO_WINDOW);

    let out = cmd
        .output()
        .map_err(|e| crate::error::AppError::Session(format!("scrcpy --list-apps: {e}")))?;
    let mut text = String::from_utf8_lossy(&out.stdout).to_string();
    text.push_str(&String::from_utf8_lossy(&out.stderr));

    let mut apps = parse_apps(&text);
    if !include_system {
        apps.retain(|a| !a.system);
    }
    apps.sort_by(|a, b| a.name.to_lowercase().cmp(&b.name.to_lowercase()));
    Ok(apps)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parses_system_and_user_apps() {
        let sample = "List of apps:\n \
            * Settings                       com.android.settings\n \
            - Chrome                         com.android.chrome\n \
            - My Cool App                    com.example.cool\n";
        let apps = parse_apps(sample);
        assert_eq!(apps.len(), 3);
        assert_eq!(apps[0].name, "Settings");
        assert_eq!(apps[0].package, "com.android.settings");
        assert!(apps[0].system);
        assert_eq!(apps[1].package, "com.android.chrome");
        assert!(!apps[1].system);
        assert_eq!(apps[2].name, "My Cool App");
    }

    #[test]
    fn skips_header_and_garbage() {
        assert!(parse_apps("List of apps:\nrandom line\n").is_empty());
    }
}
