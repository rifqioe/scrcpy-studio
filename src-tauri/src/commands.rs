//! Tauri command handlers — thin wrappers over the core modules.

use crate::adb::{self, Device};
use crate::apps::{self, App};
use crate::args::ScrcpyArgs;
use crate::control;
use crate::binary::Binaries;
use crate::error::{AppError, Result};
use crate::session::SessionInfo;
use crate::state::AppState;
use std::process::Command;
use tauri::{AppHandle, State};

#[cfg(windows)]
use std::os::windows::process::CommandExt;
#[cfg(windows)]
const CREATE_NO_WINDOW: u32 = 0x0800_0000;

// ---- Binary management ----

#[tauri::command]
pub fn binary_current(state: State<AppState>) -> Option<Binaries> {
    state.binary.current()
}

#[tauri::command]
pub fn binary_latest_version(state: State<AppState>) -> Result<String> {
    state.binary.latest_version()
}

#[tauri::command]
pub fn binary_install_latest(state: State<AppState>) -> Result<Binaries> {
    state.binary.ensure_latest()
}

#[tauri::command]
pub fn binary_update(state: State<AppState>) -> Result<Binaries> {
    state.binary.update()
}

// ---- adb ----

#[tauri::command]
pub fn list_devices(state: State<AppState>) -> Result<Vec<Device>> {
    let bin = state.binary.require()?;
    adb::devices(&bin.adb)
}

#[tauri::command]
pub fn adb_connect(state: State<AppState>, addr: String) -> Result<String> {
    let bin = state.binary.require()?;
    adb::connect(&bin.adb, &addr)
}

#[tauri::command]
pub fn adb_disconnect(state: State<AppState>, addr: String) -> Result<String> {
    let bin = state.binary.require()?;
    adb::disconnect(&bin.adb, &addr)
}

#[tauri::command]
pub fn adb_pair(state: State<AppState>, addr: String, code: String) -> Result<String> {
    let bin = state.binary.require()?;
    adb::pair(&bin.adb, &addr, &code)
}

#[tauri::command]
pub fn adb_tcpip(state: State<AppState>, serial: String, port: u16) -> Result<String> {
    let bin = state.binary.require()?;
    adb::tcpip(&bin.adb, &serial, port)
}

/// One-click USB → Wi-Fi: read the device IP over USB, switch it to TCP/IP on 5555, then
/// connect over the network so it survives unplugging the cable. Returns the `ip:5555` serial.
#[tauri::command]
pub fn go_wireless(state: State<AppState>, serial: String) -> Result<String> {
    let bin = state.binary.require()?;
    // Read the IP while USB is still connected.
    let ip = adb::device_ip(&bin.adb, &serial)?;
    // Switch the device's adbd into TCP/IP mode (restarts adbd, ~1-2s).
    adb::tcpip(&bin.adb, &serial, 5555)?;
    std::thread::sleep(std::time::Duration::from_millis(1500));
    let addr = format!("{ip}:5555");
    adb::connect(&bin.adb, &addr)?;
    Ok(addr)
}

/// Start a QR wireless-pairing session: returns the QR payload to render and begins
/// browsing mDNS for the phone. The outcome arrives via the `qr-pair-result` event.
#[tauri::command]
pub fn qr_pair_start(
    app: AppHandle,
    state: State<AppState>,
    auto_connect: bool,
) -> Result<crate::qr_pair::QrSession> {
    let bin = state.binary.require()?;
    let session = crate::qr_pair::new_session();
    crate::qr_pair::start(app, bin.adb.clone(), session.clone(), auto_connect)?;
    Ok(session)
}

// ---- scrcpy launch / sessions ----

#[tauri::command]
pub fn preview_argv(args: ScrcpyArgs) -> Result<String> {
    args.preview()
}

#[tauri::command]
pub fn launch(app: AppHandle, state: State<AppState>, args: ScrcpyArgs) -> Result<SessionInfo> {
    let bin = state.binary.require()?;
    let serial = args.connect.serial.clone();
    let argv = args.to_argv()?;
    state.sessions.launch(&app, &bin, argv, serial)
}

#[tauri::command]
pub fn stop_session(state: State<AppState>, id: u32) -> Result<()> {
    state.sessions.stop(id)
}

#[tauri::command]
pub fn list_sessions(state: State<AppState>) -> Vec<SessionInfo> {
    state.sessions.list()
}

/// Run one of scrcpy's `--list-*` commands and return its combined output, used to
/// populate dropdowns (cameras, displays, encoders, apps, camera sizes).
#[tauri::command]
pub fn scrcpy_list(state: State<AppState>, kind: String, serial: Option<String>) -> Result<String> {
    let flag = match kind.as_str() {
        "cameras" => "--list-cameras",
        "camera-sizes" => "--list-camera-sizes",
        "displays" => "--list-displays",
        "encoders" => "--list-encoders",
        "apps" => "--list-apps",
        other => return Err(AppError::InvalidArgs(format!("unknown list kind: {other}"))),
    };
    let bin = state.binary.require()?;

    let mut cmd = Command::new(&bin.scrcpy);
    cmd.env("ADB", &bin.adb);
    if let Some(serial) = serial.filter(|s| !s.is_empty()) {
        cmd.arg("-s").arg(serial);
    }
    cmd.arg(flag);
    #[cfg(windows)]
    cmd.creation_flags(CREATE_NO_WINDOW);

    let out = cmd
        .output()
        .map_err(|e| AppError::Session(format!("failed to run scrcpy {flag}: {e}")))?;
    let mut text = String::from_utf8_lossy(&out.stdout).to_string();
    let stderr = String::from_utf8_lossy(&out.stderr);
    if !stderr.trim().is_empty() {
        text.push_str(&stderr);
    }
    Ok(text)
}

// ---- app launcher ----

#[tauri::command]
pub fn list_apps(
    state: State<AppState>,
    serial: Option<String>,
    include_system: bool,
) -> Result<Vec<App>> {
    let bin = state.binary.require()?;
    apps::list(&bin.scrcpy, &bin.adb, serial.as_deref(), include_system)
}

/// Download an app's APK file(s) to `dest`. Returns saved paths.
#[tauri::command]
pub fn pull_apk(
    state: State<AppState>,
    serial: String,
    package: String,
    dest: String,
) -> Result<Vec<String>> {
    let bin = state.binary.require()?;
    crate::apk::pull(&bin.adb, &serial, &package, std::path::Path::new(&dest))
}

/// Look up an app's icon URL from its Google Play listing (og:image). Returns None if the
/// package isn't on Play or has no icon. Network only — installs nothing, pulls no APK.
#[tauri::command]
pub fn icon_web(package: String) -> Result<Option<String>> {
    let url = format!("https://play.google.com/store/apps/details?id={package}&hl=en");
    let client = reqwest::blocking::Client::builder()
        .user_agent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) scrcpy-studio")
        .timeout(std::time::Duration::from_secs(10))
        .build()
        .map_err(|e| AppError::Download(e.to_string()))?;
    let resp = client
        .get(url)
        .send()
        .map_err(|e| AppError::Download(e.to_string()))?;
    if !resp.status().is_success() {
        return Ok(None);
    }
    let body = resp.text().map_err(|e| AppError::Download(e.to_string()))?;
    Ok(parse_og_image(&body).map(|u| normalize_icon_url(&u)))
}

/// Ask Google's image CDN for a small square (96px) crop to keep icons light and uniform.
fn normalize_icon_url(url: &str) -> String {
    if url.contains("googleusercontent.com") {
        let base = url.split('=').next().unwrap_or(url);
        format!("{base}=s96")
    } else {
        url.to_string()
    }
}

/// Extract the `og:image` content URL from an HTML page.
fn parse_og_image(html: &str) -> Option<String> {
    let i = html.find("og:image")?;
    let rest = &html[i..];
    let c = rest.find("content=\"")?;
    let start = i + c + "content=\"".len();
    let end = html[start..].find('"')?;
    let url = html[start..start + end].to_string();
    if url.starts_with("http") {
        Some(url)
    } else {
        None
    }
}

/// Create a desktop shortcut that launches scrcpy with the given config (optionally starting
/// `package`). Returns the saved `.lnk` path.
#[derive(serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ShortcutResult {
    pub path: String,
    pub icon_applied: bool,
    pub warning: Option<String>,
}

#[tauri::command]
pub fn create_shortcut(
    state: State<AppState>,
    args: ScrcpyArgs,
    package: Option<String>,
    label: String,
    icon_url: Option<String>,
) -> Result<ShortcutResult> {
    let _bin = state.binary.require()?; // ensure scrcpy is installed before making a shortcut
    let mut args = args;
    if let Some(pkg) = &package {
        args.virtual_display.start_app = Some(pkg.clone());
    }
    // Shortcuts always launch the app into a fresh virtual display.
    args.virtual_display.enabled = true;
    let argv = args.to_argv()?;

    // Build a .ico from the app's web icon so the shortcut shows the app, not scrcpy.
    let mut warning = None;
    let icon = match (&package, &icon_url) {
        (Some(pkg), Some(url)) if url.starts_with("http") => match make_ico(&state.data_dir, pkg, url) {
            Ok(p) => Some(p),
            Err(e) => {
                warning = Some(format!("icon: {e}"));
                None
            }
        },
        _ => {
            warning = Some("no web icon for this app".into());
            None
        }
    };

    // Target our own exe in --launch mode so scrcpy starts silently (no console window).
    let exe = std::env::current_exe().map_err(|e| AppError::Io(e.to_string()))?;
    let mut launch_args = vec!["--launch".to_string()];
    launch_args.extend(argv);

    let path = crate::shortcut::create(&exe, &launch_args, &label, icon.as_deref())?;
    Ok(ShortcutResult {
        path: path.to_string_lossy().to_string(),
        icon_applied: icon.is_some(),
        warning,
    })
}

#[cfg(windows)]
fn make_ico(data_dir: &std::path::Path, pkg: &str, url: &str) -> Result<std::path::PathBuf> {
    let dir = data_dir.join("shortcut-icons");
    std::fs::create_dir_all(&dir)?;
    let safe: String = pkg.chars().map(|c| if c.is_alphanumeric() { c } else { '_' }).collect();
    let path = dir.join(format!("{safe}.ico"));

    let bytes = reqwest::blocking::Client::builder()
        .user_agent("scrcpy-studio")
        .timeout(std::time::Duration::from_secs(10))
        .build()
        .map_err(|e| AppError::Download(e.to_string()))?
        .get(url)
        .send()
        .and_then(|r| r.bytes())
        .map_err(|e| AppError::Download(e.to_string()))?;

    let img = image::load_from_memory(&bytes).map_err(|e| AppError::Io(format!("decode: {e}")))?;
    // Windows icons cap at 256px; downscale if needed.
    let img = if img.width() > 256 || img.height() > 256 {
        img.thumbnail(256, 256)
    } else {
        img
    };
    let rgba = image::DynamicImage::ImageRgba8(img.to_rgba8());
    let mut out = std::io::Cursor::new(Vec::new());
    rgba.write_to(&mut out, image::ImageFormat::Ico)
        .map_err(|e| AppError::Io(format!("encode: {e}")))?;
    std::fs::write(&path, out.into_inner())?;
    Ok(path)
}

#[cfg(not(windows))]
fn make_ico(_data_dir: &std::path::Path, _pkg: &str, _url: &str) -> Result<std::path::PathBuf> {
    Err(AppError::InvalidArgs("icons only on windows".into()))
}

#[derive(serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct WinRect {
    pub x: i32,
    pub y: i32,
    pub w: i32,
    pub h: i32,
}

#[cfg(windows)]
fn wide(s: &str) -> Vec<u16> {
    s.encode_utf16().chain(std::iter::once(0)).collect()
}

/// Find the scrcpy mirror window by title, falling back to the SDL window class.
#[cfg(windows)]
fn find_scrcpy_hwnd(title: Option<&str>) -> Option<windows::Win32::Foundation::HWND> {
    use windows::core::PCWSTR;
    use windows::Win32::UI::WindowsAndMessaging::FindWindowW;
    unsafe {
        let by_title = match title {
            Some(t) if !t.is_empty() => {
                let w = wide(t);
                FindWindowW(PCWSTR::null(), PCWSTR(w.as_ptr())).ok()
            }
            _ => None,
        }
        .filter(|h| !h.0.is_null());
        by_title.or_else(|| {
            let cls = wide("SDL_app");
            FindWindowW(PCWSTR(cls.as_ptr()), PCWSTR::null())
                .ok()
                .filter(|h| !h.0.is_null())
        })
    }
}

/// Locate the scrcpy mirror window and return its screen rectangle, for docking the control
/// bar beside it.
#[tauri::command]
pub fn scrcpy_window_rect(title: Option<String>) -> Option<WinRect> {
    #[cfg(windows)]
    {
        use windows::Win32::Foundation::RECT;
        use windows::Win32::UI::WindowsAndMessaging::GetWindowRect;
        let hwnd = find_scrcpy_hwnd(title.as_deref())?;
        let mut r = RECT::default();
        if unsafe { GetWindowRect(hwnd, &mut r) }.is_ok() {
            return Some(WinRect {
                x: r.left,
                y: r.top,
                w: r.right - r.left,
                h: r.bottom - r.top,
            });
        }
        None
    }
    #[cfg(not(windows))]
    {
        let _ = title;
        None
    }
}

/// Rotate the scrcpy view by simulating its MOD+r shortcut into the scrcpy window. This is the
/// reliable way to rotate a virtual display (adb user-rotation doesn't affect it).
#[tauri::command]
pub fn rotate_scrcpy(title: Option<String>) -> Result<()> {
    #[cfg(windows)]
    {
        use windows::Win32::UI::Input::KeyboardAndMouse::{
            SendInput, INPUT, INPUT_0, INPUT_KEYBOARD, KEYBDINPUT, KEYBD_EVENT_FLAGS,
            KEYEVENTF_KEYUP, VIRTUAL_KEY, VK_LMENU,
        };
        use windows::Win32::UI::WindowsAndMessaging::SetForegroundWindow;

        let hwnd = find_scrcpy_hwnd(title.as_deref())
            .ok_or_else(|| AppError::NotFound("scrcpy window".into()))?;
        let key_r = VIRTUAL_KEY(0x52); // 'R'

        let mk = |vk: VIRTUAL_KEY, up: bool| INPUT {
            r#type: INPUT_KEYBOARD,
            Anonymous: INPUT_0 {
                ki: KEYBDINPUT {
                    wVk: vk,
                    wScan: 0,
                    dwFlags: if up { KEYEVENTF_KEYUP } else { KEYBD_EVENT_FLAGS(0) },
                    time: 0,
                    dwExtraInfo: 0,
                },
            },
        };
        // MOD+r — default scrcpy modifier is left Alt.
        let inputs = [
            mk(VK_LMENU, false),
            mk(key_r, false),
            mk(key_r, true),
            mk(VK_LMENU, true),
        ];
        unsafe {
            let _ = SetForegroundWindow(hwnd);
            // Give the window a moment to take focus before injecting the keys.
            std::thread::sleep(std::time::Duration::from_millis(80));
            SendInput(&inputs, std::mem::size_of::<INPUT>() as i32);
        }
    }
    #[cfg(not(windows))]
    {
        let _ = title;
    }
    Ok(())
}

/// Force the calling window to an exact physical size via Win32, bypassing the WebView2
/// minimum-width clamp so the control bar can be truly thin.
#[tauri::command]
pub fn fit_window(window: tauri::WebviewWindow, width: i32, height: i32) -> Result<()> {
    #[cfg(windows)]
    {
        use windows::Win32::Foundation::HWND;
        use windows::Win32::UI::WindowsAndMessaging::{
            SetWindowPos, SWP_NOACTIVATE, SWP_NOMOVE, SWP_NOZORDER,
        };
        let raw = window.hwnd().map_err(|e| AppError::Io(e.to_string()))?;
        // Rebuild HWND in this crate's `windows` version (tauri may use a different one).
        let hwnd = HWND(raw.0 as *mut core::ffi::c_void);
        unsafe {
            SetWindowPos(
                hwnd,
                HWND::default(),
                0,
                0,
                width,
                height,
                SWP_NOMOVE | SWP_NOZORDER | SWP_NOACTIVATE,
            )
            .map_err(|e| AppError::Io(e.to_string()))?;
        }
    }
    #[cfg(not(windows))]
    {
        let _ = (window, width, height);
    }
    Ok(())
}

// ---- device control (floating toolbar) ----

#[tauri::command]
pub fn device_action(state: State<AppState>, serial: String, action: String) -> Result<()> {
    let bin = state.binary.require()?;
    control::action(&bin.adb, &serial, &action)
}

/// `stamp` is a caller-supplied timestamp used to name the PNG. Returns the saved path.
#[tauri::command]
pub fn device_screenshot(state: State<AppState>, serial: String, stamp: String) -> Result<String> {
    let bin = state.binary.require()?;
    let dir = state.data_dir.join("screenshots");
    let path = control::screenshot(&bin.adb, &serial, &dir, &stamp)?;
    Ok(path.to_string_lossy().to_string())
}

// ---- profiles ----

#[tauri::command]
pub fn profile_save(state: State<AppState>, name: String, args: ScrcpyArgs) -> Result<()> {
    crate::profiles::save(&state.data_dir, &name, &args)
}

#[tauri::command]
pub fn profile_load(state: State<AppState>, name: String) -> Result<ScrcpyArgs> {
    crate::profiles::load(&state.data_dir, &name)
}

#[tauri::command]
pub fn profile_list(state: State<AppState>) -> Result<Vec<String>> {
    crate::profiles::list(&state.data_dir)
}

#[tauri::command]
pub fn profile_delete(state: State<AppState>, name: String) -> Result<()> {
    crate::profiles::delete(&state.data_dir, &name)
}

#[cfg(test)]
mod tests {
    use super::parse_og_image;

    #[test]
    fn extracts_og_image_url() {
        let html = r#"<meta property="og:image" content="https://play-lh.googleusercontent.com/abc=s512"><x>"#;
        assert_eq!(
            parse_og_image(html).as_deref(),
            Some("https://play-lh.googleusercontent.com/abc=s512")
        );
    }

    #[test]
    fn returns_none_without_og_image() {
        assert_eq!(parse_og_image("<html>no meta</html>"), None);
    }

    #[test]
    fn normalizes_googleusercontent_to_small_square() {
        use super::normalize_icon_url;
        assert_eq!(
            normalize_icon_url("https://play-lh.googleusercontent.com/abc=w240-h480-rw"),
            "https://play-lh.googleusercontent.com/abc=s96"
        );
        assert_eq!(normalize_icon_url("https://example.com/x.png"), "https://example.com/x.png");
    }
}
