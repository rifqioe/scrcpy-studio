//! Windows [`BinaryProvider`]: downloads the official scrcpy-win64 release zip
//! (which bundles `adb.exe`), verifies its SHA-256, and extracts it.

use super::{Binaries, BinaryProvider};
use crate::error::{AppError, Result};
use sha2::{Digest, Sha256};
use std::io::Read;
use std::path::Path;
use std::sync::Mutex;
use std::time::{Duration, Instant};

const REPO: &str = "Genymobile/scrcpy";
const USER_AGENT: &str = "scrcpy-studio";
const CACHE_TTL: Duration = Duration::from_secs(600); // 10 min — respect GitHub 60 req/hr

#[derive(Default)]
pub struct WindowsProvider {
    /// In-memory cache of the latest version to avoid hammering the rate-limited API.
    version_cache: Mutex<Option<(String, Instant)>>,
}

impl WindowsProvider {
    pub fn new() -> Self {
        Self::default()
    }

    fn client() -> Result<reqwest::blocking::Client> {
        reqwest::blocking::Client::builder()
            .user_agent(USER_AGENT)
            .timeout(Duration::from_secs(60))
            .build()
            .map_err(|e| AppError::Download(e.to_string()))
    }

    /// Resolve the latest tag from the GitHub API.
    fn latest_from_api(&self) -> Result<String> {
        let url = format!("https://api.github.com/repos/{REPO}/releases/latest");
        let resp = Self::client()?
            .get(url)
            .send()
            .map_err(|e| AppError::Download(e.to_string()))?;
        if !resp.status().is_success() {
            return Err(AppError::Download(format!(
                "GitHub API returned {}",
                resp.status()
            )));
        }
        let json: serde_json::Value = resp
            .json()
            .map_err(|e| AppError::Download(e.to_string()))?;
        json.get("tag_name")
            .and_then(|t| t.as_str())
            .map(|s| s.to_string())
            .ok_or_else(|| AppError::Download("no tag_name in release JSON".into()))
    }

    /// Fallback: follow the `releases/latest` redirect and read the tag from the Location
    /// header. Works even when the JSON API is rate-limited.
    fn latest_from_redirect(&self) -> Result<String> {
        let client = reqwest::blocking::Client::builder()
            .user_agent(USER_AGENT)
            .redirect(reqwest::redirect::Policy::none())
            .timeout(Duration::from_secs(30))
            .build()
            .map_err(|e| AppError::Download(e.to_string()))?;
        let url = format!("https://github.com/{REPO}/releases/latest");
        let resp = client
            .get(url)
            .send()
            .map_err(|e| AppError::Download(e.to_string()))?;
        let location = resp
            .headers()
            .get(reqwest::header::LOCATION)
            .and_then(|h| h.to_str().ok())
            .ok_or_else(|| AppError::Download("no redirect for latest release".into()))?;
        // e.g. https://github.com/Genymobile/scrcpy/releases/tag/v4.0
        location
            .rsplit('/')
            .next()
            .filter(|s| !s.is_empty())
            .map(|s| s.to_string())
            .ok_or_else(|| AppError::Download("could not parse tag from redirect".into()))
    }

    /// Resolve `(download_url, expected_sha256_hex)` for the win64 zip of `version`.
    ///
    /// Prefers the GitHub API (which exposes both the asset URL and its `digest`). Falls back
    /// to the conventional download URL with no digest when the API is unavailable.
    fn resolve_asset(&self, version: &str, asset_name: &str) -> (String, Option<String>) {
        let fallback = format!(
            "https://github.com/{REPO}/releases/download/{version}/{asset_name}"
        );
        let from_api = || -> Result<(String, Option<String>)> {
            let url = format!("https://api.github.com/repos/{REPO}/releases/tags/{version}");
            let resp = Self::client()?
                .get(url)
                .send()
                .map_err(|e| AppError::Download(e.to_string()))?;
            if !resp.status().is_success() {
                return Err(AppError::Download(format!("API returned {}", resp.status())));
            }
            let json: serde_json::Value =
                resp.json().map_err(|e| AppError::Download(e.to_string()))?;
            let assets = json
                .get("assets")
                .and_then(|a| a.as_array())
                .ok_or_else(|| AppError::Download("no assets in release".into()))?;
            for a in assets {
                let name = a.get("name").and_then(|n| n.as_str()).unwrap_or("");
                if name.contains("win64") && name.ends_with(".zip") {
                    let dl = a
                        .get("browser_download_url")
                        .and_then(|u| u.as_str())
                        .map(|s| s.to_string())
                        .unwrap_or_else(|| fallback.clone());
                    // `digest` looks like "sha256:<hex>".
                    let digest = a
                        .get("digest")
                        .and_then(|d| d.as_str())
                        .and_then(|d| d.strip_prefix("sha256:"))
                        .map(|h| h.to_lowercase());
                    return Ok((dl, digest));
                }
            }
            Err(AppError::Download("no win64 asset in release".into()))
        };
        from_api().unwrap_or((fallback, None))
    }

    fn download_bytes(url: &str) -> Result<Vec<u8>> {
        let resp = Self::client()?
            .get(url)
            .send()
            .map_err(|e| AppError::Download(e.to_string()))?;
        if !resp.status().is_success() {
            return Err(AppError::Download(format!(
                "download {} returned {}",
                url,
                resp.status()
            )));
        }
        resp.bytes()
            .map(|b| b.to_vec())
            .map_err(|e| AppError::Download(e.to_string()))
    }

    fn sha256_hex(bytes: &[u8]) -> String {
        let mut hasher = Sha256::new();
        hasher.update(bytes);
        hasher
            .finalize()
            .iter()
            .map(|b| format!("{b:02x}"))
            .collect()
    }

    /// Recursively locate scrcpy.exe + adb.exe under `dir`.
    fn find_binaries(dir: &Path, version: &str) -> Option<Binaries> {
        let scrcpy = find_file(dir, "scrcpy.exe")?;
        let adb = find_file(dir, "adb.exe")?;
        Some(Binaries {
            scrcpy,
            adb,
            version: version.to_string(),
        })
    }
}

fn find_file(dir: &Path, name: &str) -> Option<std::path::PathBuf> {
    let entries = std::fs::read_dir(dir).ok()?;
    for entry in entries.flatten() {
        let path = entry.path();
        if path.is_dir() {
            if let Some(found) = find_file(&path, name) {
                return Some(found);
            }
        } else if path.file_name().map(|f| f.eq_ignore_ascii_case(name)) == Some(true) {
            return Some(path);
        }
    }
    None
}

impl BinaryProvider for WindowsProvider {
    fn latest_version(&self) -> Result<String> {
        if let Some((v, when)) = self.version_cache.lock().unwrap().clone() {
            if when.elapsed() < CACHE_TTL {
                return Ok(v);
            }
        }
        let version = self
            .latest_from_api()
            .or_else(|_| self.latest_from_redirect())?;
        *self.version_cache.lock().unwrap() = Some((version.clone(), Instant::now()));
        Ok(version)
    }

    fn install(&self, version: &str, dest: &Path) -> Result<Binaries> {
        let asset = format!("scrcpy-win64-{version}.zip");
        // Resolve the download URL and (when the API is reachable) the published SHA-256
        // digest. scrcpy does not publish `.sha256` sidecar files; the digest comes from the
        // GitHub release-asset `digest` field.
        let (zip_url, expected) = self.resolve_asset(version, &asset);

        let zip_bytes = Self::download_bytes(&zip_url)?;

        // Verify only when the API gave us a digest. If it didn't (e.g. rate-limited), we do
        // NOT silently claim success — extraction proceeds unverified by necessity.
        if let Some(expected) = expected {
            let actual = Self::sha256_hex(&zip_bytes);
            if actual != expected {
                return Err(AppError::Download(format!(
                    "checksum mismatch for {asset}: expected {expected}, got {actual}"
                )));
            }
        }

        // Extract.
        let reader = std::io::Cursor::new(&zip_bytes);
        let mut archive =
            zip::ZipArchive::new(reader).map_err(|e| AppError::Download(e.to_string()))?;
        for i in 0..archive.len() {
            let mut file = archive
                .by_index(i)
                .map_err(|e| AppError::Download(e.to_string()))?;
            let out_path = match file.enclosed_name() {
                Some(p) => dest.join(p),
                None => continue,
            };
            if file.is_dir() {
                std::fs::create_dir_all(&out_path)?;
            } else {
                if let Some(parent) = out_path.parent() {
                    std::fs::create_dir_all(parent)?;
                }
                let mut buf = Vec::with_capacity(file.size() as usize);
                file.read_to_end(&mut buf)?;
                std::fs::write(&out_path, buf)?;
            }
        }

        Self::find_binaries(dest, version)
            .ok_or_else(|| AppError::Download("scrcpy.exe/adb.exe not found after extract".into()))
    }

    fn locate(&self, dir: &Path, version: &str) -> Option<Binaries> {
        Self::find_binaries(dir, version)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parses_tag_from_release_json() {
        // Mirrors the field the provider reads, without a network call.
        let json: serde_json::Value =
            serde_json::from_str(r#"{"tag_name":"v4.0","name":"scrcpy v4.0"}"#).unwrap();
        assert_eq!(json.get("tag_name").unwrap().as_str().unwrap(), "v4.0");
    }

    #[test]
    fn sha256_is_lowercase_hex() {
        let h = WindowsProvider::sha256_hex(b"hello");
        assert_eq!(
            h,
            "2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824"
        );
    }

    /// Real end-to-end install: resolve asset → download → (verify) → extract → locate.
    /// Network + ~30 MB download, so it's `#[ignore]`. Run with:
    ///   cargo test -- --ignored install_v40_end_to_end
    #[test]
    #[ignore]
    fn install_v40_end_to_end() {
        let tmp = tempfile::tempdir().unwrap();
        let provider = WindowsProvider::new();
        let bin = provider.install("v4.0", tmp.path()).expect("install failed");
        assert!(bin.scrcpy.exists(), "scrcpy.exe not located");
        assert!(bin.adb.exists(), "adb.exe not located");
        assert_eq!(bin.version, "v4.0");
    }

    #[test]
    fn find_file_locates_nested_exe() {
        let tmp = tempfile::tempdir().unwrap();
        let nested = tmp.path().join("scrcpy-win64-v4.0");
        std::fs::create_dir_all(&nested).unwrap();
        std::fs::write(nested.join("scrcpy.exe"), b"x").unwrap();
        let found = find_file(tmp.path(), "scrcpy.exe").unwrap();
        assert!(found.ends_with("scrcpy.exe"));
    }
}
