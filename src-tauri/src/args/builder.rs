//! Pure conversion from [`ScrcpyArgs`] to a scrcpy `argv` vector.
//!
//! This is the correctness-critical core of the app. It does NOT invent flag-combination
//! validation — scrcpy itself is the authority on incompatible flags, and its stderr is
//! surfaced in the session log. The builder only does structural shaping.

use super::*;
use crate::error::Result;

/// Helper accumulator that mirrors scrcpy's `--flag` / `--flag=value` conventions.
struct Argv(Vec<String>);

impl Argv {
    fn new() -> Self {
        Argv(Vec::new())
    }

    /// Push a bare flag when `cond` is true, e.g. `--no-video`.
    fn flag(&mut self, cond: bool, name: &str) {
        if cond {
            self.0.push(name.to_string());
        }
    }

    /// Push `--name=value` when the option is set.
    fn opt<T: std::fmt::Display>(&mut self, name: &str, value: &Option<T>) {
        if let Some(v) = value {
            self.0.push(format!("{name}={v}"));
        }
    }

    /// Push a flag that takes a separate argument, e.g. `-s ABC123`.
    fn pair<T: std::fmt::Display>(&mut self, name: &str, value: &Option<T>) {
        if let Some(v) = value {
            self.0.push(name.to_string());
            self.0.push(v.to_string());
        }
    }

    fn raw(&mut self, s: &str) {
        self.0.push(s.to_string());
    }
}

impl ScrcpyArgs {
    /// Build the scrcpy command-line arguments (excluding the executable itself).
    pub fn to_argv(&self) -> Result<Vec<String>> {
        let mut a = Argv::new();

        // --- Connect ---
        let c = &self.connect;
        a.pair("-s", &c.serial);
        a.flag(c.select_usb, "-d");
        a.flag(c.select_tcpip, "-e");
        match &c.tcpip {
            Some(addr) if addr.is_empty() => a.raw("--tcpip"),
            Some(addr) => a.raw(&format!("--tcpip={addr}")),
            None => {}
        }
        a.opt("--port", &c.port);
        a.flag(c.force_adb_forward, "--force-adb-forward");
        a.opt("--tunnel-host", &c.tunnel_host);
        a.opt("--tunnel-port", &c.tunnel_port);
        a.flag(c.otg, "--otg");

        // --- Video ---
        let v = &self.video;
        a.flag(v.no_video, "--no-video");
        a.flag(v.no_video_playback, "--no-video-playback");
        a.opt("--video-source", &v.source);
        a.opt("--video-codec", &v.codec);
        a.opt("--video-encoder", &v.encoder);
        a.opt("--video-bit-rate", &v.bit_rate);
        a.opt("--max-size", &v.max_size);
        a.opt("--max-fps", &v.max_fps);
        a.opt("--crop", &v.crop);
        a.opt("--angle", &v.angle);
        a.opt("--capture-orientation", &v.capture_orientation);
        a.opt("--display-orientation", &v.display_orientation);
        a.opt("--orientation", &v.orientation);
        a.opt("--display-id", &v.display_id);
        a.opt("--video-buffer", &v.video_buffer);
        a.opt("--render-fit", &v.render_fit);

        // --- Audio ---
        let au = &self.audio;
        a.flag(au.no_audio, "--no-audio");
        a.flag(au.no_audio_playback, "--no-audio-playback");
        a.opt("--audio-codec", &au.codec);
        a.opt("--audio-encoder", &au.encoder);
        a.opt("--audio-source", &au.source);
        a.opt("--audio-bit-rate", &au.bit_rate);
        a.opt("--audio-buffer", &au.buffer);
        a.flag(au.dup, "--audio-dup");
        a.flag(au.require_audio, "--require-audio");

        // --- Camera ---
        let cam = &self.camera;
        a.opt("--camera-id", &cam.id);
        a.opt("--camera-facing", &cam.facing);
        a.opt("--camera-size", &cam.size);
        a.opt("--camera-ar", &cam.ar);
        a.opt("--camera-fps", &cam.fps);
        a.flag(cam.high_speed, "--camera-high-speed");
        a.flag(cam.torch, "--camera-torch");
        a.opt("--camera-zoom", &cam.zoom);

        // --- Control ---
        let ct = &self.control;
        a.flag(ct.no_control, "--no-control");
        a.flag(ct.no_clipboard_autosync, "--no-clipboard-autosync");
        a.flag(ct.legacy_paste, "--legacy-paste");
        a.flag(ct.turn_screen_off, "--turn-screen-off");
        a.flag(ct.stay_awake, "--stay-awake");
        a.flag(ct.keep_active, "--keep-active");
        a.flag(ct.show_touches, "--show-touches");
        a.flag(ct.no_power_on, "--no-power-on");
        a.flag(ct.power_off_on_close, "--power-off-on-close");
        a.opt("--screen-off-timeout", &ct.screen_off_timeout);

        // --- Input ---
        let i = &self.input;
        a.opt("--keyboard", &i.keyboard);
        a.opt("--mouse", &i.mouse);
        a.opt("--gamepad", &i.gamepad);
        a.opt("--mouse-bind", &i.mouse_bind);
        a.flag(i.no_mouse_hover, "--no-mouse-hover");
        a.flag(i.no_key_repeat, "--no-key-repeat");
        a.flag(i.raw_key_events, "--raw-key-events");
        a.flag(i.prefer_text, "--prefer-text");
        a.opt("--shortcut-mod", &i.shortcut_mod);

        // --- Window ---
        let w = &self.window;
        a.opt("--window-title", &w.title);
        a.opt("--window-x", &w.x);
        a.opt("--window-y", &w.y);
        a.opt("--window-width", &w.width);
        a.opt("--window-height", &w.height);
        a.flag(w.borderless, "--window-borderless");
        a.flag(w.always_on_top, "--always-on-top");
        a.flag(w.fullscreen, "--fullscreen");
        a.flag(w.no_window, "--no-window");
        a.flag(w.disable_screensaver, "--disable-screensaver");
        a.opt("--background-color", &w.background_color);
        a.opt("--render-driver", &w.render_driver);

        // --- Record ---
        let r = &self.record;
        a.opt("--record", &r.file);
        a.opt("--record-format", &r.format);
        a.opt("--record-orientation", &r.orientation);
        a.flag(r.no_playback, "--no-playback");
        a.opt("--time-limit", &r.time_limit);

        // --- Virtual display ---
        let vd = &self.virtual_display;
        if vd.enabled {
            match &vd.new_display {
                Some(spec) if !spec.is_empty() => a.raw(&format!("--new-display={spec}")),
                _ => a.raw("--new-display"),
            }
        }
        a.opt("--start-app", &vd.start_app);
        a.flag(vd.no_vd_destroy_content, "--no-vd-destroy-content");
        a.flag(vd.no_vd_system_decorations, "--no-vd-system-decorations");

        // --- General ---
        let g = &self.general;
        a.flag(g.print_fps, "--print-fps");
        a.flag(g.kill_adb_on_close, "--kill-adb-on-close");
        a.flag(g.no_cleanup, "--no-cleanup");
        a.flag(g.no_mipmaps, "--no-mipmaps");
        a.opt("--time-limit", &g.time_limit);
        a.opt("--verbosity", &g.verbosity);
        a.opt("--pause-on-exit", &g.pause_on_exit);
        a.opt("--push-target", &g.push_target);

        // --- Raw passthrough (verbatim, last) ---
        if let Some(extra) = &self.extra_args {
            for token in extra.split_whitespace() {
                a.raw(token);
            }
        }

        Ok(a.0)
    }

    /// Convenience: the previewed command string, prefixed with `scrcpy`.
    pub fn preview(&self) -> Result<String> {
        let argv = self.to_argv()?;
        let mut parts = vec!["scrcpy".to_string()];
        parts.extend(argv);
        Ok(parts.join(" "))
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn s(x: &str) -> String {
        x.to_string()
    }

    #[test]
    fn empty_args_produce_no_flags() {
        let a = ScrcpyArgs::default();
        assert_eq!(a.to_argv().unwrap(), Vec::<String>::new());
    }

    #[test]
    fn serial_and_video_flags() {
        let mut a = ScrcpyArgs::default();
        a.connect.serial = Some(s("ABC123"));
        a.video.codec = Some(s("h265"));
        a.video.max_size = Some(1024);
        a.video.bit_rate = Some(s("8M"));
        let argv = a.to_argv().unwrap();
        assert!(argv.contains(&s("-s")));
        assert!(argv.contains(&s("ABC123")));
        assert!(argv.contains(&s("--video-codec=h265")));
        assert!(argv.contains(&s("--max-size=1024")));
        assert!(argv.contains(&s("--video-bit-rate=8M")));
    }

    #[test]
    fn boolean_flags_emit_when_true_only() {
        let mut a = ScrcpyArgs::default();
        a.control.turn_screen_off = true;
        let argv = a.to_argv().unwrap();
        assert!(argv.contains(&s("--turn-screen-off")));
        assert!(!argv.contains(&s("--stay-awake")));
    }

    #[test]
    fn record_sets_file_and_format() {
        let mut a = ScrcpyArgs::default();
        a.record.file = Some(s("out.mkv"));
        a.record.format = Some(s("mkv"));
        let argv = a.to_argv().unwrap();
        assert!(argv.contains(&s("--record=out.mkv")));
        assert!(argv.contains(&s("--record-format=mkv")));
    }

    #[test]
    fn capture_orientation_uses_correct_flag() {
        let mut a = ScrcpyArgs::default();
        a.video.capture_orientation = Some(s("90"));
        assert!(a.to_argv().unwrap().contains(&s("--capture-orientation=90")));
    }

    #[test]
    fn tcpip_bare_when_empty_string() {
        let mut a = ScrcpyArgs::default();
        a.connect.tcpip = Some(String::new());
        assert!(a.to_argv().unwrap().contains(&s("--tcpip")));
    }

    #[test]
    fn tcpip_with_addr() {
        let mut a = ScrcpyArgs::default();
        a.connect.tcpip = Some(s("192.168.1.5:5555"));
        assert!(a.to_argv().unwrap().contains(&s("--tcpip=192.168.1.5:5555")));
    }

    #[test]
    fn extra_args_appended_verbatim() {
        let mut a = ScrcpyArgs::default();
        a.extra_args = Some(s("--list-displays --foo=bar"));
        let argv = a.to_argv().unwrap();
        assert!(argv.contains(&s("--list-displays")));
        assert!(argv.contains(&s("--foo=bar")));
    }

    #[test]
    fn new_display_bare_when_enabled_empty() {
        let mut a = ScrcpyArgs::default();
        a.virtual_display.enabled = true;
        assert!(a.to_argv().unwrap().contains(&s("--new-display")));
    }

    #[test]
    fn new_display_with_spec() {
        let mut a = ScrcpyArgs::default();
        a.virtual_display.enabled = true;
        a.virtual_display.new_display = Some(s("1920x1080/420"));
        assert!(a
            .to_argv()
            .unwrap()
            .contains(&s("--new-display=1920x1080/420")));
    }

    #[test]
    fn preview_is_prefixed_with_scrcpy() {
        let mut a = ScrcpyArgs::default();
        a.window.fullscreen = true;
        assert_eq!(a.preview().unwrap(), "scrcpy --fullscreen");
    }
}
