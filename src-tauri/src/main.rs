// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    let args: Vec<String> = std::env::args().collect();
    if let Some(pos) = args.iter().position(|a| a == "--launch") {
        // Desktop-shortcut entry: spawn scrcpy silently with the remaining args, then exit.
        scrcpy_studio_lib::headless_launch(&args[pos + 1..]);
        return;
    }
    scrcpy_studio_lib::run()
}
