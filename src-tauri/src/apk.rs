//! Pull an app's APK(s) to the PC and extract its launcher icon from the pulled base APK.

use crate::error::{AppError, Result};
use base64::Engine;
use serde::Serialize;
use std::io::Read;
use std::path::{Path, PathBuf};
use std::process::Command;

#[cfg(windows)]
use std::os::windows::process::CommandExt;
#[cfg(windows)]
const CREATE_NO_WINDOW: u32 = 0x0800_0000;

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PullResult {
    pub files: Vec<String>,
    /// Launcher icon as a data URL (raster icons only), if one could be extracted.
    pub icon: Option<String>,
}

fn adb(adb: &Path, serial: &str, args: &[&str]) -> Command {
    let mut cmd = Command::new(adb);
    cmd.arg("-s").arg(serial).args(args);
    #[cfg(windows)]
    cmd.creation_flags(CREATE_NO_WINDOW);
    cmd
}

/// `pm path <pkg>` → the remote APK paths (base + splits).
fn remote_paths(adb_path: &Path, serial: &str, pkg: &str) -> Result<Vec<String>> {
    let out = adb(adb_path, serial, &["shell", "pm", "path", pkg])
        .output()
        .map_err(|e| AppError::Adb(format!("pm path: {e}")))?;
    let text = String::from_utf8_lossy(&out.stdout);
    let paths: Vec<String> = text
        .lines()
        .filter_map(|l| l.trim().strip_prefix("package:"))
        .map(|s| s.trim().to_string())
        .collect();
    if paths.is_empty() {
        return Err(AppError::NotFound(format!("APK path for {pkg}")));
    }
    Ok(paths)
}

/// Pull all APK files for `pkg` into `dest`, then extract the launcher icon from the base APK.
pub fn pull(adb_path: &Path, serial: &str, pkg: &str, dest: &Path) -> Result<PullResult> {
    std::fs::create_dir_all(dest)?;
    let paths = remote_paths(adb_path, serial, pkg)?;

    let mut files = Vec::new();
    let mut base_local: Option<PathBuf> = None;
    for (i, remote) in paths.iter().enumerate() {
        let stem = remote.rsplit('/').next().unwrap_or("base.apk");
        let local = dest.join(format!("{pkg}-{stem}"));
        let local = if i == 0 { dest.join(format!("{pkg}.apk")) } else { local };
        let status = adb(adb_path, serial, &["pull", remote, &local.to_string_lossy()])
            .output()
            .map_err(|e| AppError::Adb(format!("adb pull: {e}")))?;
        if !status.status.success() {
            return Err(AppError::Adb(
                String::from_utf8_lossy(&status.stderr).trim().to_string(),
            ));
        }
        if remote.contains("base.apk") || base_local.is_none() {
            base_local = Some(local.clone());
        }
        files.push(local.to_string_lossy().to_string());
    }

    let icon = base_local.and_then(|p| extract_icon(&p).ok().flatten());
    Ok(PullResult { files, icon })
}

/// dpi score from an APK resource path (higher density preferred).
fn dpi_score(name: &str) -> i32 {
    let n = name.to_lowercase();
    if n.contains("xxxhdpi") {
        6
    } else if n.contains("xxhdpi") {
        5
    } else if n.contains("xhdpi") {
        4
    } else if n.contains("hdpi") {
        3
    } else if n.contains("mdpi") {
        2
    } else {
        1
    }
}

/// Pick the best raster launcher icon from an APK and return it as a data URL.
/// Adaptive/vector icons (XML) are skipped — those can't be rendered off-device.
fn extract_icon(apk: &Path) -> Result<Option<String>> {
    let file = std::fs::File::open(apk)?;
    let mut zip = zip::ZipArchive::new(file).map_err(|e| AppError::Io(e.to_string()))?;

    let mut best: Option<(i32, usize, String)> = None; // (score, index, ext)
    for i in 0..zip.len() {
        let entry = zip.by_index(i).map_err(|e| AppError::Io(e.to_string()))?;
        let name = entry.name().to_lowercase();
        let is_icon = (name.contains("/ic_launcher") || name.contains("ic_launcher"))
            && (name.contains("/mipmap") || name.contains("/drawable"));
        if !is_icon {
            continue;
        }
        let ext = if name.ends_with(".png") {
            "png"
        } else if name.ends_with(".webp") {
            "webp"
        } else {
            continue; // .xml (adaptive/vector) — skip
        };
        // Prefer the full icon over a transparent foreground-only layer.
        let mut score = dpi_score(&name);
        if !name.contains("foreground") && !name.contains("background") {
            score += 10;
        }
        if name.contains("round") {
            score -= 1;
        }
        if best.as_ref().map(|(s, _, _)| score > *s).unwrap_or(true) {
            best = Some((score, i, ext.to_string()));
        }
    }

    let Some((_, index, ext)) = best else {
        return Ok(None);
    };
    let mut entry = zip.by_index(index).map_err(|e| AppError::Io(e.to_string()))?;
    let mut bytes = Vec::with_capacity(entry.size() as usize);
    entry.read_to_end(&mut bytes)?;
    let b64 = base64::engine::general_purpose::STANDARD.encode(&bytes);
    Ok(Some(format!("data:image/{ext};base64,{b64}")))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn dpi_scores_rank_density() {
        assert!(dpi_score("res/mipmap-xxxhdpi/ic_launcher.png") > dpi_score("res/mipmap-hdpi/ic_launcher.png"));
        assert!(dpi_score("res/mipmap-hdpi/x.png") > dpi_score("res/drawable/x.png"));
    }
}
