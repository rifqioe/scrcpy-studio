//! Thin wrappers over the bundled `adb` executable.

use crate::error::{AppError, Result};
use serde::Serialize;
use std::path::Path;
use std::process::Command;

#[cfg(windows)]
use std::os::windows::process::CommandExt;
#[cfg(windows)]
const CREATE_NO_WINDOW: u32 = 0x0800_0000;

#[derive(Debug, Clone, Serialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct Device {
    pub serial: String,
    pub state: String,
    pub model: Option<String>,
    /// true when the serial looks like `ip:port` (a TCP/IP connection).
    pub is_tcpip: bool,
}

fn command(adb: &Path) -> Command {
    let mut cmd = Command::new(adb);
    #[cfg(windows)]
    cmd.creation_flags(CREATE_NO_WINDOW);
    cmd
}

/// Run an adb subcommand, returning stdout. Detects the adb-server version conflict.
fn run(adb: &Path, args: &[&str]) -> Result<String> {
    let output = command(adb)
        .args(args)
        .output()
        .map_err(|e| AppError::Adb(format!("failed to run adb: {e}")))?;
    let stdout = String::from_utf8_lossy(&output.stdout).to_string();
    let stderr = String::from_utf8_lossy(&output.stderr).to_string();

    if is_version_conflict(&stderr) {
        return Err(AppError::AdbVersionConflict(format!(
            "Another adb server is running with a different version. Close other adb tools \
             (or Android Studio) and retry. Details: {}",
            stderr.trim()
        )));
    }
    if !output.status.success() {
        let msg = if stderr.trim().is_empty() {
            stdout.trim().to_string()
        } else {
            stderr.trim().to_string()
        };
        return Err(AppError::Adb(msg));
    }
    Ok(stdout)
}

fn is_version_conflict(stderr: &str) -> bool {
    let s = stderr.to_lowercase();
    s.contains("adb server version") && s.contains("doesn't match")
}

/// Parse the output of `adb devices -l` into structured devices.
pub fn parse_devices(stdout: &str) -> Vec<Device> {
    let mut devices = Vec::new();
    for line in stdout.lines() {
        let line = line.trim();
        // Skip header and blank/info lines.
        if line.is_empty() || line.starts_with("List of devices") || line.starts_with('*') {
            continue;
        }
        let mut parts = line.split_whitespace();
        let serial = match parts.next() {
            Some(s) => s.to_string(),
            None => continue,
        };
        let state = parts.next().unwrap_or("unknown").to_string();
        // Remaining tokens are `key:value` qualifiers; pull out model if present.
        let mut model = None;
        for token in parts {
            if let Some(v) = token.strip_prefix("model:") {
                model = Some(v.to_string());
            }
        }
        let is_tcpip = serial.contains(':');
        devices.push(Device {
            serial,
            state,
            model,
            is_tcpip,
        });
    }
    devices
}

/// `adb start-server` — ensure the local adb server is running before pairing.
pub fn start_server(adb: &Path) -> Result<String> {
    Ok(run(adb, &["start-server"])?.trim().to_string())
}

pub fn devices(adb: &Path) -> Result<Vec<Device>> {
    let out = run(adb, &["devices", "-l"])?;
    Ok(parse_devices(&out))
}

/// `adb connect ip:port`
pub fn connect(adb: &Path, addr: &str) -> Result<String> {
    Ok(run(adb, &["connect", addr])?.trim().to_string())
}

/// `adb disconnect [ip:port]`
pub fn disconnect(adb: &Path, addr: &str) -> Result<String> {
    Ok(run(adb, &["disconnect", addr])?.trim().to_string())
}

/// `adb pair ip:port code` (Android 11+ wireless pairing).
pub fn pair(adb: &Path, addr: &str, code: &str) -> Result<String> {
    Ok(run(adb, &["pair", addr, code])?.trim().to_string())
}

/// `adb -s <serial> tcpip <port>` — switch a USB device to listen over TCP/IP.
pub fn tcpip(adb: &Path, serial: &str, port: u16) -> Result<String> {
    let port = port.to_string();
    Ok(run(adb, &["-s", serial, "tcpip", &port])?.trim().to_string())
}

/// Best-effort discovery of a device's Wi-Fi IPv4 address (queried over the current
/// connection, typically USB). Tries `ip addr show wlan0`, then the routing table.
pub fn device_ip(adb: &Path, serial: &str) -> Result<String> {
    let attempts: [&[&str]; 3] = [
        &["-s", serial, "shell", "ip", "-o", "-4", "addr", "show", "wlan0"],
        &["-s", serial, "shell", "ip", "route"],
        &["-s", serial, "shell", "ip", "-o", "-4", "addr"],
    ];
    for args in attempts {
        if let Ok(out) = run(adb, args) {
            if let Some(ip) = parse_ipv4(&out) {
                return Ok(ip);
            }
        }
    }
    Err(AppError::Adb(
        "could not determine the device Wi-Fi IP (is Wi-Fi on?)".into(),
    ))
}

/// Pull the device's IPv4 out of arbitrary `ip` command output.
///
/// Prefers the address that follows an `inet` or `src` marker (the host address), which
/// avoids picking the network address (e.g. `192.168.1.0`) that precedes `src` in route output.
fn parse_ipv4(text: &str) -> Option<String> {
    fn clean(token: &str) -> Option<String> {
        let token = token.split('/').next().unwrap_or(token);
        let addr = token.parse::<std::net::Ipv4Addr>().ok()?;
        let o = addr.octets();
        let bad = o[0] == 127 || addr.is_unspecified() || (o[0] == 169 && o[1] == 254);
        if bad {
            None
        } else {
            Some(addr.to_string())
        }
    }

    let tokens: Vec<&str> = text.split_whitespace().collect();
    for (i, t) in tokens.iter().enumerate() {
        if *t == "inet" || *t == "src" {
            if let Some(ip) = tokens.get(i + 1).and_then(|n| clean(n)) {
                return Some(ip);
            }
        }
    }
    // Fallback: first usable address that isn't a network address (x.x.x.0).
    tokens.iter().filter_map(|t| clean(t)).find(|ip| !ip.ends_with(".0"))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parses_usb_and_tcpip_devices() {
        let sample = "List of devices attached\n\
            ABC123XYZ        device usb:1-2 product:foo model:Pixel_7 device:panther transport_id:1\n\
            192.168.1.42:5555 device product:bar model:Galaxy_S21 device:o1s transport_id:2\n";
        let d = parse_devices(sample);
        assert_eq!(d.len(), 2);
        assert_eq!(d[0].serial, "ABC123XYZ");
        assert_eq!(d[0].state, "device");
        assert_eq!(d[0].model.as_deref(), Some("Pixel_7"));
        assert!(!d[0].is_tcpip);
        assert!(d[1].is_tcpip);
        assert_eq!(d[1].model.as_deref(), Some("Galaxy_S21"));
    }

    #[test]
    fn skips_header_and_blank_lines() {
        assert!(parse_devices("List of devices attached\n\n").is_empty());
    }

    #[test]
    fn detects_version_conflict() {
        assert!(is_version_conflict(
            "adb server version (41) doesn't match this client (39); killing..."
        ));
        assert!(!is_version_conflict("error: device offline"));
    }

    #[test]
    fn parses_ipv4_from_addr_output() {
        let out = "32: wlan0    inet 192.168.1.23/24 brd 192.168.1.255 scope global wlan0";
        assert_eq!(parse_ipv4(out).as_deref(), Some("192.168.1.23"));
    }

    #[test]
    fn parses_ipv4_from_route_output() {
        let out = "192.168.1.0/24 dev wlan0 proto kernel scope link src 192.168.1.42";
        assert_eq!(parse_ipv4(out).as_deref(), Some("192.168.1.42"));
    }

    #[test]
    fn parse_ipv4_skips_loopback_and_link_local() {
        assert_eq!(parse_ipv4("127.0.0.1 169.254.1.1 10.0.0.5").as_deref(), Some("10.0.0.5"));
    }

    #[test]
    fn handles_unauthorized_state() {
        let d = parse_devices("List of devices attached\nABC123 unauthorized\n");
        assert_eq!(d[0].state, "unauthorized");
        assert!(d[0].model.is_none());
    }
}
