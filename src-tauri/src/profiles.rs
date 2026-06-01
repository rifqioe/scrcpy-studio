//! Named [`ScrcpyArgs`] configurations persisted as JSON under `<data>/profiles/`.

use crate::args::ScrcpyArgs;
use crate::error::{AppError, Result};
use std::path::{Path, PathBuf};

fn profiles_dir(data_dir: &Path) -> PathBuf {
    data_dir.join("profiles")
}

/// Convert a profile name into a safe filename stem (no path separators).
fn sanitize(name: &str) -> String {
    name.chars()
        .map(|c| if c.is_alphanumeric() || c == '-' || c == '_' { c } else { '_' })
        .collect()
}

fn profile_path(data_dir: &Path, name: &str) -> PathBuf {
    profiles_dir(data_dir).join(format!("{}.json", sanitize(name)))
}

pub fn save(data_dir: &Path, name: &str, args: &ScrcpyArgs) -> Result<()> {
    if name.trim().is_empty() {
        return Err(AppError::InvalidArgs("profile name is empty".into()));
    }
    let dir = profiles_dir(data_dir);
    std::fs::create_dir_all(&dir)?;
    let json = serde_json::to_string_pretty(args)
        .map_err(|e| AppError::Io(e.to_string()))?;
    std::fs::write(profile_path(data_dir, name), json)?;
    Ok(())
}

pub fn load(data_dir: &Path, name: &str) -> Result<ScrcpyArgs> {
    let path = profile_path(data_dir, name);
    let data = std::fs::read_to_string(&path)
        .map_err(|_| AppError::NotFound(format!("profile '{name}'")))?;
    serde_json::from_str(&data).map_err(|e| AppError::Io(e.to_string()))
}

pub fn list(data_dir: &Path) -> Result<Vec<String>> {
    let dir = profiles_dir(data_dir);
    let mut names = Vec::new();
    if let Ok(entries) = std::fs::read_dir(&dir) {
        for entry in entries.flatten() {
            let path = entry.path();
            if path.extension().and_then(|e| e.to_str()) == Some("json") {
                if let Some(stem) = path.file_stem().and_then(|s| s.to_str()) {
                    names.push(stem.to_string());
                }
            }
        }
    }
    names.sort();
    Ok(names)
}

pub fn delete(data_dir: &Path, name: &str) -> Result<()> {
    let path = profile_path(data_dir, name);
    if path.exists() {
        std::fs::remove_file(path)?;
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn round_trips_a_profile() {
        let tmp = tempfile::tempdir().unwrap();
        let mut args = ScrcpyArgs::default();
        args.video.codec = Some("h265".into());
        args.window.fullscreen = true;
        save(tmp.path(), "My Profile", &args).unwrap();

        let loaded = load(tmp.path(), "My Profile").unwrap();
        assert_eq!(loaded.video.codec.as_deref(), Some("h265"));
        assert!(loaded.window.fullscreen);

        let names = list(tmp.path()).unwrap();
        assert_eq!(names, vec!["My_Profile"]);
    }

    #[test]
    fn list_loads_by_sanitized_name() {
        let tmp = tempfile::tempdir().unwrap();
        save(tmp.path(), "game low/latency", &ScrcpyArgs::default()).unwrap();
        // Saved file stem is sanitized; load must use the same sanitization.
        let loaded = load(tmp.path(), "game low/latency");
        assert!(loaded.is_ok());
    }

    #[test]
    fn missing_profile_errors() {
        let tmp = tempfile::tempdir().unwrap();
        assert!(load(tmp.path(), "nope").is_err());
    }

    #[test]
    fn empty_name_rejected() {
        let tmp = tempfile::tempdir().unwrap();
        assert!(save(tmp.path(), "   ", &ScrcpyArgs::default()).is_err());
    }
}
