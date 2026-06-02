mod adb;
mod apk;
mod apps;
mod args;
mod binary;
mod commands;
mod control;
mod error;
mod profiles;
mod qr_pair;
mod session;
mod shortcut;
mod state;

use state::AppState;
use tauri::{Manager, WebviewUrl, WebviewWindowBuilder, WindowEvent};

/// Spawn scrcpy silently (no console window) using the bundled binaries, pre-warming adb.
fn spawn_scrcpy(bin: &binary::Binaries, argv: &[String]) {
    {
        let mut s = std::process::Command::new(&bin.adb);
        s.arg("start-server");
        #[cfg(windows)]
        {
            use std::os::windows::process::CommandExt;
            s.creation_flags(0x0800_0000); // CREATE_NO_WINDOW
        }
        let _ = s.output();
    }
    let mut cmd = std::process::Command::new(&bin.scrcpy);
    cmd.args(argv).env("ADB", &bin.adb);
    if let Some(dir) = bin.scrcpy.parent() {
        cmd.current_dir(dir);
    }
    #[cfg(windows)]
    {
        use std::os::windows::process::CommandExt;
        const CREATE_NO_WINDOW: u32 = 0x0800_0000;
        const DETACHED_PROCESS: u32 = 0x0000_0008;
        cmd.creation_flags(CREATE_NO_WINDOW | DETACHED_PROCESS);
    }
    let _ = cmd.spawn();
}

/// Extract the `-s <serial>` value from a scrcpy argv, if present.
fn parse_serial(argv: &[String]) -> Option<String> {
    argv.iter().position(|a| a == "-s").and_then(|i| argv.get(i + 1).cloned())
}

/// Shortcut entry: run a minimal app instance that launches scrcpy and shows only the
/// floating control window for the target device. Closing the control window exits.
pub fn run_launch(scrcpy_argv: Vec<String>) {
    let serial = parse_serial(&scrcpy_argv).unwrap_or_default();
    // Give scrcpy a known window title so the control bar can dock to it.
    let win_title = format!("scrcpy-studio:{serial}");
    let mut scrcpy_argv = scrcpy_argv;
    if !scrcpy_argv.iter().any(|a| a.starts_with("--window-title")) {
        scrcpy_argv.push(format!("--window-title={win_title}"));
    }
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .setup(move |app| {
            let data_dir = app.path().app_data_dir().expect("app data dir");
            std::fs::create_dir_all(&data_dir).ok();
            let state = AppState::new(data_dir);
            if let Ok(bin) = state.binary.require() {
                spawn_scrcpy(&bin, &scrcpy_argv);
            }
            app.manage(state);

            // No main window in shortcut mode — just the control bar.
            if let Some(main) = app.get_webview_window("main") {
                let _ = main.close();
            }
            let label = format!(
                "control-{}",
                serial.chars().map(|c| if c.is_alphanumeric() { c } else { '_' }).collect::<String>()
            );
            let url = format!("index.html?serial={serial}&title={win_title}");
            WebviewWindowBuilder::new(app, label, WebviewUrl::App(url.into()))
                .title("Controls")
                .inner_size(44.0, 600.0)
                .resizable(false)
                .decorations(false)
                .always_on_top(true)
                .skip_taskbar(true)
                .build()?;
            Ok(())
        })
        .on_window_event(|window, event| {
            // Quit the shortcut instance when its control window is closed.
            if matches!(event, WindowEvent::CloseRequested { .. }) && window.label().starts_with("control") {
                window.app_handle().exit(0);
            }
        })
        .invoke_handler(tauri::generate_handler![
            commands::list_devices,
            commands::device_action,
            commands::device_screenshot,
            commands::scrcpy_window_rect,
        ])
        .run(tauri::generate_context!())
        .expect("error while running launch instance");
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .setup(|app| {
            // Resolve the per-app data directory and create it.
            let data_dir = app
                .path()
                .app_data_dir()
                .expect("failed to resolve app data dir");
            std::fs::create_dir_all(&data_dir).ok();
            app.manage(AppState::new(data_dir));
            if let Some(main) = app.get_webview_window("main") {
                let _ = main.show();
            }
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::binary_current,
            commands::binary_latest_version,
            commands::binary_install_latest,
            commands::binary_update,
            commands::list_devices,
            commands::adb_connect,
            commands::adb_disconnect,
            commands::adb_pair,
            commands::adb_tcpip,
            commands::go_wireless,
            commands::qr_pair_start,
            commands::list_apps,
            commands::icon_web,
            commands::pull_apk,
            commands::create_shortcut,
            commands::device_action,
            commands::device_screenshot,
            commands::scrcpy_window_rect,
            commands::preview_argv,
            commands::launch,
            commands::stop_session,
            commands::list_sessions,
            commands::scrcpy_list,
            commands::profile_save,
            commands::profile_load,
            commands::profile_list,
            commands::profile_delete,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
