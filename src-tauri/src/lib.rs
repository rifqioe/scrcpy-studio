mod adb;
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
