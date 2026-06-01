//! Typed model of a scrcpy invocation.
//!
//! Field names and flags are grounded against `scrcpy --help` (verified v4.0), not recalled.
//! A captured copy of the help text lives at `tests/fixtures/scrcpy-4.0-help.txt`.
//!
//! The struct is serialized to the frontend in camelCase; `lib/types.ts` mirrors it.

use serde::{Deserialize, Serialize};

pub mod builder;

#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(default, rename_all = "camelCase")]
pub struct ScrcpyArgs {
    pub connect: Connect,
    pub video: Video,
    pub audio: Audio,
    pub camera: Camera,
    pub control: Control,
    pub input: Input,
    pub window: Window,
    pub record: Record,
    pub virtual_display: VirtualDisplay,
    pub general: General,
    /// Raw flags appended verbatim (split on whitespace). Guarantees "always new":
    /// any flag a newer scrcpy adds works even before a dedicated control exists.
    pub extra_args: Option<String>,
}

#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(default, rename_all = "camelCase")]
pub struct Connect {
    pub serial: Option<String>,      // -s
    pub select_usb: bool,            // -d
    pub select_tcpip: bool,          // -e
    /// `--tcpip[=[+]ip[:port]]`. `Some("")` => bare `--tcpip`, `Some(addr)` => `--tcpip=addr`.
    pub tcpip: Option<String>,
    pub port: Option<String>,        // -p / --port=range
    pub force_adb_forward: bool,     // --force-adb-forward
    pub tunnel_host: Option<String>, // --tunnel-host
    pub tunnel_port: Option<u16>,    // --tunnel-port
    pub otg: bool,                   // --otg
}

#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(default, rename_all = "camelCase")]
pub struct Video {
    pub no_video: bool,                      // --no-video
    pub no_video_playback: bool,             // --no-video-playback
    pub source: Option<String>,              // --video-source=display|camera
    pub codec: Option<String>,               // --video-codec=h264|h265|av1
    pub encoder: Option<String>,             // --video-encoder
    pub bit_rate: Option<String>,            // -b / --video-bit-rate
    pub max_size: Option<u32>,               // -m / --max-size
    pub max_fps: Option<String>,             // --max-fps
    pub crop: Option<String>,                // --crop=w:h:x:y
    pub angle: Option<String>,               // --angle
    pub capture_orientation: Option<String>, // --capture-orientation
    pub display_orientation: Option<String>, // --display-orientation
    pub orientation: Option<String>,         // --orientation
    pub display_id: Option<u32>,             // --display-id
    pub video_buffer: Option<u32>,           // --video-buffer
    pub render_fit: Option<String>,          // --render-fit
}

#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(default, rename_all = "camelCase")]
pub struct Audio {
    pub no_audio: bool,           // --no-audio
    pub no_audio_playback: bool,  // --no-audio-playback
    pub codec: Option<String>,    // --audio-codec=opus|aac|flac|raw
    pub encoder: Option<String>,  // --audio-encoder
    pub source: Option<String>,   // --audio-source
    pub bit_rate: Option<String>, // --audio-bit-rate
    pub buffer: Option<u32>,      // --audio-buffer
    pub dup: bool,                // --audio-dup
    pub require_audio: bool,      // --require-audio
}

#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(default, rename_all = "camelCase")]
pub struct Camera {
    pub id: Option<String>,     // --camera-id
    pub facing: Option<String>, // --camera-facing=front|back|external
    pub size: Option<String>,   // --camera-size
    pub ar: Option<String>,     // --camera-ar
    pub fps: Option<u32>,       // --camera-fps
    pub high_speed: bool,       // --camera-high-speed
    pub torch: bool,            // --camera-torch
    pub zoom: Option<String>,   // --camera-zoom
}

#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(default, rename_all = "camelCase")]
pub struct Control {
    pub no_control: bool,                // -n / --no-control
    pub no_clipboard_autosync: bool,     // --no-clipboard-autosync
    pub legacy_paste: bool,              // --legacy-paste
    pub turn_screen_off: bool,           // -S / --turn-screen-off
    pub stay_awake: bool,                // -w / --stay-awake
    pub keep_active: bool,               // --keep-active
    pub show_touches: bool,              // -t / --show-touches
    pub no_power_on: bool,               // --no-power-on
    pub power_off_on_close: bool,        // --power-off-on-close
    pub screen_off_timeout: Option<u32>, // --screen-off-timeout
}

#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(default, rename_all = "camelCase")]
pub struct Input {
    pub keyboard: Option<String>,     // --keyboard=disabled|sdk|uhid|aoa
    pub mouse: Option<String>,        // --mouse=disabled|sdk|uhid|aoa
    pub gamepad: Option<String>,      // --gamepad=disabled|uhid|aoa
    pub mouse_bind: Option<String>,   // --mouse-bind
    pub no_mouse_hover: bool,         // --no-mouse-hover
    pub no_key_repeat: bool,          // --no-key-repeat
    pub raw_key_events: bool,         // --raw-key-events
    pub prefer_text: bool,            // --prefer-text
    pub shortcut_mod: Option<String>, // --shortcut-mod
}

#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(default, rename_all = "camelCase")]
pub struct Window {
    pub title: Option<String>,            // --window-title
    pub x: Option<i32>,                   // --window-x
    pub y: Option<i32>,                   // --window-y
    pub width: Option<u32>,               // --window-width
    pub height: Option<u32>,              // --window-height
    pub borderless: bool,                 // --window-borderless
    pub always_on_top: bool,              // --always-on-top
    pub fullscreen: bool,                 // -f / --fullscreen
    pub no_window: bool,                  // --no-window
    pub disable_screensaver: bool,        // --disable-screensaver
    pub background_color: Option<String>, // --background-color
    pub render_driver: Option<String>,    // --render-driver
}

#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(default, rename_all = "camelCase")]
pub struct Record {
    pub file: Option<String>,        // -r / --record
    pub format: Option<String>,      // --record-format
    pub orientation: Option<String>, // --record-orientation
    pub no_playback: bool,           // -N / --no-playback
    pub time_limit: Option<u32>,     // --time-limit
}

#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(default, rename_all = "camelCase")]
pub struct VirtualDisplay {
    /// Whether `--new-display` is emitted at all.
    pub enabled: bool,
    /// `--new-display[=[WxH][/dpi]]`. Empty string with `enabled` => bare flag.
    pub new_display: Option<String>,
    pub start_app: Option<String>,       // --start-app
    pub no_vd_destroy_content: bool,     // --no-vd-destroy-content
    pub no_vd_system_decorations: bool,  // --no-vd-system-decorations
}

#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(default, rename_all = "camelCase")]
pub struct General {
    pub print_fps: bool,               // --print-fps
    pub kill_adb_on_close: bool,       // --kill-adb-on-close
    pub no_cleanup: bool,              // --no-cleanup
    pub no_mipmaps: bool,              // --no-mipmaps
    pub time_limit: Option<u32>,       // --time-limit
    pub verbosity: Option<String>,     // -V / --verbosity
    pub pause_on_exit: Option<String>, // --pause-on-exit
    pub push_target: Option<String>,   // --push-target
}
