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
use tauri::Manager;

/// Resolve the same app-data directory Tauri uses, without a running app instance.
fn data_dir() -> std::path::PathBuf {
    let base = dirs::data_dir().unwrap_or_else(|| std::path::PathBuf::from("."));
    base.join("com.rifqioe.scrcpy-studio")
}

/// Headless entry used by desktop shortcuts: spawn scrcpy with the given argv, detached and
/// with no console window, using the bundled binaries. Then exit immediately.
pub fn headless_launch(scrcpy_argv: &[String]) {
    let mgr = binary::BinaryManager::new(data_dir(), make_provider());
    let Ok(bin) = mgr.require() else {
        return;
    };
    // Pre-start the adb server quietly so scrcpy doesn't spawn extra adb console windows.
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
    cmd.args(scrcpy_argv).env("ADB", &bin.adb);
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

#[cfg(target_os = "windows")]
fn make_provider() -> Box<dyn binary::BinaryProvider> {
    Box::new(binary::windows::WindowsProvider::new())
}

#[cfg(not(target_os = "windows"))]
fn make_provider() -> Box<dyn binary::BinaryProvider> {
    // Headless launch is Windows-first; other platforms get a no-op provider.
    struct NoProvider;
    impl binary::BinaryProvider for NoProvider {
        fn latest_version(&self) -> error::Result<String> {
            Err(error::AppError::BinaryMissing("unsupported".into()))
        }
        fn install(&self, _v: &str, _d: &std::path::Path) -> error::Result<binary::Binaries> {
            Err(error::AppError::BinaryMissing("unsupported".into()))
        }
        fn locate(&self, _d: &std::path::Path, _v: &str) -> Option<binary::Binaries> {
            None
        }
    }
    Box::new(NoProvider)
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
