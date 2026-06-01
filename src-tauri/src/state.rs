//! Shared application state held in Tauri's managed state.

use crate::binary::{BinaryManager, BinaryProvider};
use std::path::PathBuf;

use crate::session::SessionManager;

pub struct AppState {
    pub data_dir: PathBuf,
    pub binary: BinaryManager,
    pub sessions: SessionManager,
}

impl AppState {
    pub fn new(data_dir: PathBuf) -> Self {
        Self {
            data_dir: data_dir.clone(),
            binary: BinaryManager::new(data_dir, make_provider()),
            sessions: SessionManager::new(),
        }
    }
}

#[cfg(target_os = "windows")]
fn make_provider() -> Box<dyn BinaryProvider> {
    Box::new(crate::binary::windows::WindowsProvider::new())
}

#[cfg(not(target_os = "windows"))]
fn make_provider() -> Box<dyn BinaryProvider> {
    Box::new(UnsupportedProvider)
}

/// Placeholder provider for platforms not yet implemented (keeps the crate building).
#[cfg(not(target_os = "windows"))]
struct UnsupportedProvider;

#[cfg(not(target_os = "windows"))]
impl BinaryProvider for UnsupportedProvider {
    fn latest_version(&self) -> crate::error::Result<String> {
        Err(crate::error::AppError::BinaryMissing(
            "automatic binary management is only implemented on Windows so far".into(),
        ))
    }
    fn install(
        &self,
        _version: &str,
        _dest: &std::path::Path,
    ) -> crate::error::Result<crate::binary::Binaries> {
        Err(crate::error::AppError::BinaryMissing(
            "automatic binary management is only implemented on Windows so far".into(),
        ))
    }
    fn locate(&self, _dir: &std::path::Path, _version: &str) -> Option<crate::binary::Binaries> {
        None
    }
}
