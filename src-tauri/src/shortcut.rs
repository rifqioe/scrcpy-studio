//! Create a desktop shortcut that launches scrcpy with a given configuration.
//!
//! The shortcut targets the bundled `scrcpy.exe` with the resolved argv, and sets its working
//! directory to scrcpy's folder so the bundled `adb.exe` is found.

use crate::error::{AppError, Result};
use std::path::{Path, PathBuf};

fn sanitize(name: &str) -> String {
    name.chars()
        .map(|c| if c.is_alphanumeric() || c == ' ' || c == '-' || c == '_' { c } else { '_' })
        .collect::<String>()
        .trim()
        .to_string()
}

/// Quote argv items that contain spaces so the shortcut passes them as single arguments.
fn join_args(argv: &[String]) -> String {
    argv.iter()
        .map(|a| if a.contains(' ') { format!("\"{a}\"") } else { a.clone() })
        .collect::<Vec<_>>()
        .join(" ")
}

#[cfg(windows)]
pub fn create(target: &Path, args: &[String], label: &str, icon: Option<&Path>) -> Result<PathBuf> {
    let desktop = dirs::desktop_dir()
        .ok_or_else(|| AppError::NotFound("desktop directory".into()))?;
    let name = format!("{}.lnk", sanitize(label));
    let path = desktop.join(name);

    let mut link = mslnk::ShellLink::new(target).map_err(|e| AppError::Io(e.to_string()))?;
    link.set_arguments(Some(join_args(args)));
    if let Some(dir) = target.parent() {
        link.set_working_dir(Some(dir.to_string_lossy().to_string()));
    }
    if let Some(icon) = icon {
        link.set_icon_location(Some(icon.to_string_lossy().to_string()));
    }
    link.create_lnk(&path).map_err(|e| AppError::Io(e.to_string()))?;
    Ok(path)
}

#[cfg(not(windows))]
pub fn create(_target: &Path, _args: &[String], _label: &str, _icon: Option<&Path>) -> Result<PathBuf> {
    Err(AppError::InvalidArgs(
        "desktop shortcuts are only implemented on Windows so far".into(),
    ))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn sanitizes_label() {
        assert_eq!(sanitize("My App: v2/3"), "My App_ v2_3");
    }

    #[test]
    fn quotes_args_with_spaces() {
        let argv = vec!["--start-app=com.x".to_string(), "--window-title=My Phone".to_string()];
        assert_eq!(join_args(&argv), "--start-app=com.x \"--window-title=My Phone\"");
    }
}
