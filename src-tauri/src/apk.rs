//! Download an app's APK file(s) to the PC.

use crate::error::{AppError, Result};
use std::path::Path;
use std::process::Command;

#[cfg(windows)]
use std::os::windows::process::CommandExt;
#[cfg(windows)]
const CREATE_NO_WINDOW: u32 = 0x0800_0000;

fn adb(adb: &Path, serial: &str, args: &[&str]) -> Command {
    let mut cmd = Command::new(adb);
    cmd.arg("-s").arg(serial).args(args);
    #[cfg(windows)]
    cmd.creation_flags(CREATE_NO_WINDOW);
    cmd
}

/// Pull all APK files for `pkg` (base + splits) into `dest`. Returns the saved paths.
pub fn pull(adb_path: &Path, serial: &str, pkg: &str, dest: &Path) -> Result<Vec<String>> {
    std::fs::create_dir_all(dest)?;
    let out = adb(adb_path, serial, &["shell", "pm", "path", pkg])
        .output()
        .map_err(|e| AppError::Adb(format!("pm path: {e}")))?;
    let text = String::from_utf8_lossy(&out.stdout);
    let remotes: Vec<&str> = text
        .lines()
        .filter_map(|l| l.trim().strip_prefix("package:"))
        .map(|s| s.trim())
        .collect();
    if remotes.is_empty() {
        return Err(AppError::NotFound(format!("APK path for {pkg}")));
    }

    let mut files = Vec::new();
    for (i, remote) in remotes.iter().enumerate() {
        let stem = remote.rsplit('/').next().unwrap_or("base.apk");
        let local = if i == 0 {
            dest.join(format!("{pkg}.apk"))
        } else {
            dest.join(format!("{pkg}-{stem}"))
        };
        let status = adb(adb_path, serial, &["pull", remote, &local.to_string_lossy()])
            .output()
            .map_err(|e| AppError::Adb(format!("adb pull: {e}")))?;
        if !status.status.success() {
            return Err(AppError::Adb(
                String::from_utf8_lossy(&status.stderr).trim().to_string(),
            ));
        }
        files.push(local.to_string_lossy().to_string());
    }
    Ok(files)
}
