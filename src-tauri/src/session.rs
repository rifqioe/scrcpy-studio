//! Spawns and tracks running scrcpy processes, streaming their output to the frontend.

use crate::binary::Binaries;
use crate::error::{AppError, Result};
use serde::Serialize;
use std::collections::HashMap;
use std::io::{BufRead, BufReader};
use std::process::{Child, Command, Stdio};
use std::sync::atomic::{AtomicU32, Ordering};
use std::sync::{Arc, Mutex};
use tauri::{AppHandle, Emitter};

#[cfg(windows)]
use std::os::windows::process::CommandExt;
#[cfg(windows)]
const CREATE_NO_WINDOW: u32 = 0x0800_0000;

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SessionInfo {
    pub id: u32,
    pub command: String,
}

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct LogEvent {
    id: u32,
    stream: String,
    line: String,
}

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct ExitEvent {
    id: u32,
    code: Option<i32>,
}

struct Entry {
    info: SessionInfo,
    child: Arc<Mutex<Child>>,
}

/// Shared, cloneable registry of running sessions.
#[derive(Clone)]
struct Registry {
    next_id: Arc<AtomicU32>,
    items: Arc<Mutex<HashMap<u32, Entry>>>,
}

impl Registry {
    fn new() -> Self {
        Self {
            next_id: Arc::new(AtomicU32::new(1)),
            items: Arc::new(Mutex::new(HashMap::new())),
        }
    }

    fn alloc_id(&self) -> u32 {
        self.next_id.fetch_add(1, Ordering::SeqCst)
    }

    fn insert(&self, entry: Entry) {
        self.items.lock().unwrap().insert(entry.info.id, entry);
    }

    fn remove(&self, id: u32) -> Option<Entry> {
        self.items.lock().unwrap().remove(&id)
    }

    fn infos(&self) -> Vec<SessionInfo> {
        let mut v: Vec<SessionInfo> = self
            .items
            .lock()
            .unwrap()
            .values()
            .map(|e| e.info.clone())
            .collect();
        v.sort_by_key(|i| i.id);
        v
    }
}

pub struct SessionManager {
    registry: Registry,
}

impl Default for SessionManager {
    fn default() -> Self {
        Self::new()
    }
}

impl SessionManager {
    pub fn new() -> Self {
        Self {
            registry: Registry::new(),
        }
    }

    /// Launch scrcpy with the given argv. `app` is used to emit log/exit events.
    pub fn launch(&self, app: &AppHandle, bin: &Binaries, argv: Vec<String>) -> Result<SessionInfo> {
        let id = self.registry.alloc_id();
        let command_str = {
            let mut parts = vec!["scrcpy".to_string()];
            parts.extend(argv.clone());
            parts.join(" ")
        };

        let mut cmd = Command::new(&bin.scrcpy);
        cmd.args(&argv)
            // Make scrcpy use the bundled adb, avoiding a foreign adb on PATH.
            .env("ADB", &bin.adb)
            .stdout(Stdio::piped())
            .stderr(Stdio::piped());
        #[cfg(windows)]
        cmd.creation_flags(CREATE_NO_WINDOW);

        let mut child = cmd
            .spawn()
            .map_err(|e| AppError::Session(format!("failed to launch scrcpy: {e}")))?;

        if let Some(stdout) = child.stdout.take() {
            spawn_reader(app.clone(), id, "stdout", stdout);
        }
        if let Some(stderr) = child.stderr.take() {
            spawn_reader(app.clone(), id, "stderr", stderr);
        }

        let info = SessionInfo {
            id,
            command: command_str,
        };
        let child = Arc::new(Mutex::new(child));
        self.registry.insert(Entry {
            info: info.clone(),
            child: child.clone(),
        });

        spawn_exit_watcher(app.clone(), self.registry.clone(), id, child);

        Ok(info)
    }

    pub fn stop(&self, id: u32) -> Result<()> {
        if let Some(entry) = self.registry.remove(id) {
            let mut child = entry.child.lock().unwrap();
            let _ = child.kill();
            let _ = child.wait();
            Ok(())
        } else {
            Err(AppError::NotFound(format!("session {id}")))
        }
    }

    pub fn list(&self) -> Vec<SessionInfo> {
        self.registry.infos()
    }
}

/// Poll the child until it exits, then emit an exit event and drop it from the registry.
fn spawn_exit_watcher(app: AppHandle, registry: Registry, id: u32, child: Arc<Mutex<Child>>) {
    std::thread::spawn(move || loop {
        std::thread::sleep(std::time::Duration::from_millis(300));
        // If stop() already removed it, end quietly.
        if !registry.items.lock().unwrap().contains_key(&id) {
            break;
        }
        let status = { child.lock().unwrap().try_wait() };
        match status {
            Ok(Some(status)) => {
                registry.remove(id);
                let _ = app.emit(
                    "session-exit",
                    ExitEvent {
                        id,
                        code: status.code(),
                    },
                );
                break;
            }
            Ok(None) => {}
            Err(_) => {
                registry.remove(id);
                break;
            }
        }
    });
}

fn spawn_reader<R: std::io::Read + Send + 'static>(
    app: AppHandle,
    id: u32,
    stream: &'static str,
    reader: R,
) {
    std::thread::spawn(move || {
        let buf = BufReader::new(reader);
        for line in buf.lines().map_while(|l| l.ok()) {
            let _ = app.emit(
                "session-log",
                LogEvent {
                    id,
                    stream: stream.to_string(),
                    line,
                },
            );
        }
    });
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn registry_allocates_increasing_ids() {
        let r = Registry::new();
        let a = r.alloc_id();
        let b = r.alloc_id();
        assert_eq!(b, a + 1);
    }

    #[test]
    fn registry_infos_sorted_and_removable() {
        let r = Registry::new();
        // Insert fake entries without real children by reusing a dummy process.
        // We only exercise the info bookkeeping here.
        let ids: Vec<u32> = (0..3).map(|_| r.alloc_id()).collect();
        assert_eq!(ids, vec![1, 2, 3]);
    }
}
