//! Application error type, serializable so the frontend can pattern-match on `kind`.

use serde::Serialize;

#[derive(Debug, Serialize)]
#[serde(tag = "kind", content = "message")]
pub enum AppError {
    InvalidArgs(String),
    BinaryMissing(String),
    Adb(String),
    /// Raised specifically when the adb server version conflicts with another
    /// adb instance on the system PATH.
    AdbVersionConflict(String),
    Io(String),
    Download(String),
    Session(String),
    NotFound(String),
}

impl std::fmt::Display for AppError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            AppError::InvalidArgs(m) => write!(f, "invalid args: {m}"),
            AppError::BinaryMissing(m) => write!(f, "binary missing: {m}"),
            AppError::Adb(m) => write!(f, "adb error: {m}"),
            AppError::AdbVersionConflict(m) => write!(f, "adb version conflict: {m}"),
            AppError::Io(m) => write!(f, "io error: {m}"),
            AppError::Download(m) => write!(f, "download error: {m}"),
            AppError::Session(m) => write!(f, "session error: {m}"),
            AppError::NotFound(m) => write!(f, "not found: {m}"),
        }
    }
}

impl std::error::Error for AppError {}

impl From<std::io::Error> for AppError {
    fn from(e: std::io::Error) -> Self {
        AppError::Io(e.to_string())
    }
}

pub type Result<T> = std::result::Result<T, AppError>;
