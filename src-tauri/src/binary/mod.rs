//! Management of the scrcpy + adb binaries the app drives.
//!
//! scrcpy is kept as a swappable binary so the app always runs the latest release without
//! being rebuilt. A [`BinaryProvider`] abstracts per-OS fetching; Windows ships first.

use crate::error::{AppError, Result};
use serde::Serialize;
use std::path::{Path, PathBuf};

#[cfg(target_os = "windows")]
pub mod windows;

/// Resolved paths to the binaries plus the installed version tag.
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Binaries {
    pub scrcpy: PathBuf,
    pub adb: PathBuf,
    pub version: String,
}

/// Per-OS strategy for discovering and installing scrcpy + adb.
pub trait BinaryProvider: Send + Sync {
    /// Resolve the latest available release tag (e.g. "v4.0").
    fn latest_version(&self) -> Result<String>;
    /// Download + extract the given version into `dest`, returning resolved binaries.
    fn install(&self, version: &str, dest: &Path) -> Result<Binaries>;
    /// Locate already-installed binaries within `dir`, if present.
    fn locate(&self, dir: &Path, version: &str) -> Option<Binaries>;
}

/// Orchestrates installs/updates over a [`BinaryProvider`] within an app-data directory.
///
/// Layout: `<data_dir>/binaries/<version>/…` (one directory per installed release).
pub struct BinaryManager {
    data_dir: PathBuf,
    provider: Box<dyn BinaryProvider>,
}

impl BinaryManager {
    pub fn new(data_dir: PathBuf, provider: Box<dyn BinaryProvider>) -> Self {
        Self { data_dir, provider }
    }

    fn binaries_root(&self) -> PathBuf {
        self.data_dir.join("binaries")
    }

    fn version_dir(&self, version: &str) -> PathBuf {
        self.binaries_root().join(version)
    }

    /// Return the currently installed binaries, if any. Picks the most recently modified
    /// version directory that still contains the expected executables.
    pub fn current(&self) -> Option<Binaries> {
        let root = self.binaries_root();
        let mut candidates: Vec<(std::time::SystemTime, PathBuf, String)> = std::fs::read_dir(&root)
            .ok()?
            .filter_map(|e| e.ok())
            .filter(|e| e.path().is_dir())
            .filter_map(|e| {
                let modified = e.metadata().ok()?.modified().ok()?;
                let name = e.file_name().to_string_lossy().to_string();
                Some((modified, e.path(), name))
            })
            .collect();
        candidates.sort_by_key(|(t, _, _)| *t);
        for (_, path, version) in candidates.into_iter().rev() {
            if let Some(bin) = self.provider.locate(&path, &version) {
                return Some(bin);
            }
        }
        None
    }

    /// Latest version available from the provider.
    pub fn latest_version(&self) -> Result<String> {
        self.provider.latest_version()
    }

    /// Install a specific version (idempotent: if already present, just locate it).
    pub fn install(&self, version: &str) -> Result<Binaries> {
        let dir = self.version_dir(version);
        if let Some(bin) = self.provider.locate(&dir, version) {
            return Ok(bin);
        }
        std::fs::create_dir_all(&dir)?;
        self.provider.install(version, &dir)
    }

    /// Ensure the latest version is installed and return it.
    pub fn ensure_latest(&self) -> Result<Binaries> {
        let version = self.latest_version()?;
        self.install(&version)
    }

    /// Force-install the latest version (used by the "update" button).
    pub fn update(&self) -> Result<Binaries> {
        let version = self.latest_version()?;
        let dir = self.version_dir(&version);
        std::fs::create_dir_all(&dir)?;
        self.provider.install(&version, &dir)
    }

    /// Resolve binaries to use for a launch: prefer installed, else error with guidance.
    pub fn require(&self) -> Result<Binaries> {
        self.current()
            .ok_or_else(|| AppError::BinaryMissing("scrcpy is not installed yet".into()))
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    /// Fake provider that "installs" by writing placeholder exe files.
    struct FakeProvider;
    impl BinaryProvider for FakeProvider {
        fn latest_version(&self) -> Result<String> {
            Ok("v9.9".into())
        }
        fn install(&self, _version: &str, dest: &Path) -> Result<Binaries> {
            std::fs::create_dir_all(dest)?;
            let scrcpy = dest.join("scrcpy.exe");
            let adb = dest.join("adb.exe");
            std::fs::write(&scrcpy, b"x")?;
            std::fs::write(&adb, b"x")?;
            Ok(Binaries {
                scrcpy,
                adb,
                version: "v9.9".into(),
            })
        }
        fn locate(&self, dir: &Path, version: &str) -> Option<Binaries> {
            let scrcpy = dir.join("scrcpy.exe");
            let adb = dir.join("adb.exe");
            if scrcpy.exists() && adb.exists() {
                Some(Binaries {
                    scrcpy,
                    adb,
                    version: version.to_string(),
                })
            } else {
                None
            }
        }
    }

    #[test]
    fn install_uses_versioned_dir_layout() {
        let tmp = tempfile::tempdir().unwrap();
        let mgr = BinaryManager::new(tmp.path().to_path_buf(), Box::new(FakeProvider));
        let bin = mgr.install("v9.9").unwrap();
        assert!(bin.scrcpy.ends_with("binaries/v9.9/scrcpy.exe") || bin.scrcpy.ends_with("binaries\\v9.9\\scrcpy.exe"));
        assert_eq!(bin.version, "v9.9");
    }

    #[test]
    fn current_finds_installed() {
        let tmp = tempfile::tempdir().unwrap();
        let mgr = BinaryManager::new(tmp.path().to_path_buf(), Box::new(FakeProvider));
        assert!(mgr.current().is_none());
        mgr.install("v9.9").unwrap();
        assert_eq!(mgr.current().unwrap().version, "v9.9");
    }

    #[test]
    fn require_errors_when_missing() {
        let tmp = tempfile::tempdir().unwrap();
        let mgr = BinaryManager::new(tmp.path().to_path_buf(), Box::new(FakeProvider));
        assert!(mgr.require().is_err());
    }
}
