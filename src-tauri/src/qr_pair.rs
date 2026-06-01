//! Wireless pairing via QR code (Android "Pair device with QR code").
//!
//! Flow (mirrors Android Studio):
//! 1. We generate a service name + pairing code and encode them in a QR payload.
//! 2. We browse mDNS for `_adb-tls-pairing._tcp`.
//! 3. The phone scans the QR, enables pairing, and advertises that service.
//! 4. We discover the service's address:port and run `adb pair <addr> <code>`.

use crate::adb;
use crate::error::{AppError, Result};
use mdns_sd::{ServiceDaemon, ServiceEvent};
use rand::Rng;
use serde::Serialize;
use std::path::PathBuf;
use std::time::{Duration, Instant};
use tauri::{AppHandle, Emitter};

const PAIRING_SERVICE: &str = "_adb-tls-pairing._tcp.local.";
const BROWSE_TIMEOUT: Duration = Duration::from_secs(120);

/// Data the frontend needs to render the QR code and show the human-readable code.
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct QrSession {
    /// The exact string to encode in the QR image.
    pub payload: String,
    /// Service name advertised by the phone after scanning (used for matching).
    pub name: String,
    /// Pairing code (also embedded in the payload).
    pub code: String,
}

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct QrResult {
    success: bool,
    message: String,
}

/// Build a fresh QR pairing session (name + code + payload).
pub fn new_session() -> QrSession {
    let mut rng = rand::thread_rng();
    let suffix: String = (0..10)
        .map(|_| {
            let n = rng.gen_range(0..16);
            std::char::from_digit(n, 16).unwrap()
        })
        .collect();
    let name = format!("studio-{suffix}");
    // 6-digit numeric pairing code.
    let code: String = (0..6).map(|_| rng.gen_range(0..10).to_string()).collect();
    let payload = build_payload(&name, &code);
    QrSession { payload, name, code }
}

/// The QR payload format understood by Android's wireless-debugging QR scanner.
fn build_payload(name: &str, code: &str) -> String {
    format!("WIFI:T:ADB;S:{name};P:{code};;")
}

/// Browse mDNS until the phone advertises the matching pairing service, then run `adb pair`.
/// Emits `qr-pair-result` with the outcome. Runs on a background thread.
pub fn start(app: AppHandle, adb_path: PathBuf, session: QrSession) -> Result<()> {
    let daemon = ServiceDaemon::new().map_err(|e| AppError::Adb(format!("mDNS init: {e}")))?;
    let receiver = daemon
        .browse(PAIRING_SERVICE)
        .map_err(|e| AppError::Adb(format!("mDNS browse: {e}")))?;

    std::thread::spawn(move || {
        // adb pair needs the local server running; "protocol fault" often follows a cold server.
        let _ = adb::start_server(&adb_path);

        let deadline = Instant::now() + BROWSE_TIMEOUT;
        let mut tried: std::collections::HashSet<String> = std::collections::HashSet::new();
        let mut last_err: Option<String> = None;

        loop {
            let remaining = deadline.saturating_duration_since(Instant::now());
            if remaining.is_zero() {
                let msg = match last_err {
                    Some(e) => format!("Timed out. Last pairing error: {e}"),
                    None => "Timed out waiting for the device to scan the QR code.".to_string(),
                };
                emit(&app, false, &msg);
                break;
            }
            match receiver.recv_timeout(remaining.min(Duration::from_secs(5))) {
                Ok(ServiceEvent::ServiceResolved(info)) => {
                    // Match on the instance name carrying our generated service name.
                    if !info.get_fullname().contains(&session.name) {
                        continue;
                    }
                    let port = info.get_port();
                    // Prefer an IPv4 address; an IPv6 link-local (fe80::) makes `adb pair`
                    // fail with "protocol fault: couldn't read status message".
                    let addrs = info.get_addresses();
                    let addr = addrs
                        .iter()
                        .find(|a| a.is_ipv4())
                        .or_else(|| addrs.iter().next())
                        .copied();
                    let Some(addr) = addr else {
                        continue;
                    };
                    let target = format!("{addr}:{port}");
                    // Don't hammer the same endpoint repeatedly within one session.
                    if !tried.insert(target.clone()) {
                        continue;
                    }
                    match adb::pair(&adb_path, &target, &session.code) {
                        Ok(out) => {
                            emit(&app, true, &format!("Paired with {target}. {out}"));
                            break;
                        }
                        // Keep listening — the phone re-advertises and may succeed on a retry
                        // or a different address.
                        Err(e) => last_err = Some(e.to_string()),
                    }
                }
                Ok(_) => {}
                Err(flume::RecvTimeoutError::Disconnected) => break,
                Err(flume::RecvTimeoutError::Timeout) => {}
            }
        }
        let _ = daemon.shutdown();
    });

    Ok(())
}

fn emit(app: &AppHandle, success: bool, message: &str) {
    let _ = app.emit(
        "qr-pair-result",
        QrResult {
            success,
            message: message.to_string(),
        },
    );
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn payload_has_expected_format() {
        assert_eq!(
            build_payload("studio-abc", "123456"),
            "WIFI:T:ADB;S:studio-abc;P:123456;;"
        );
    }

    #[test]
    fn session_fields_are_consistent() {
        let s = new_session();
        assert!(s.name.starts_with("studio-"));
        assert_eq!(s.code.len(), 6);
        assert!(s.code.chars().all(|c| c.is_ascii_digit()));
        assert!(s.payload.contains(&s.name));
        assert!(s.payload.contains(&s.code));
    }
}
