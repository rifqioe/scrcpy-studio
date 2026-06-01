// Display-only mirror of the Rust `to_argv` builder (src-tauri/src/args/builder.rs).
// The Rust side remains the source of truth at launch; this exists for the live preview.

import type { ScrcpyArgs } from "./types";

class Argv {
  parts: string[] = [];

  flag(cond: boolean | undefined, name: string) {
    if (cond) this.parts.push(name);
  }

  opt(name: string, value: string | number | undefined) {
    if (value !== undefined && value !== null && value !== "") {
      this.parts.push(`${name}=${value}`);
    }
  }

  pair(name: string, value: string | undefined) {
    if (value !== undefined && value !== null && value !== "") {
      this.parts.push(name);
      this.parts.push(value);
    }
  }

  raw(s: string) {
    this.parts.push(s);
  }
}

export function buildArgv(a: ScrcpyArgs): string[] {
  const v = new Argv();

  // Connect
  const c = a.connect;
  v.pair("-s", c.serial);
  v.flag(c.selectUsb, "-d");
  v.flag(c.selectTcpip, "-e");
  if (c.tcpip !== undefined && c.tcpip !== null) {
    if (c.tcpip === "") v.raw("--tcpip");
    else v.raw(`--tcpip=${c.tcpip}`);
  }
  v.opt("--port", c.port);
  v.flag(c.forceAdbForward, "--force-adb-forward");
  v.opt("--tunnel-host", c.tunnelHost);
  v.opt("--tunnel-port", c.tunnelPort);
  v.flag(c.otg, "--otg");

  // Video
  const vid = a.video;
  v.flag(vid.noVideo, "--no-video");
  v.flag(vid.noVideoPlayback, "--no-video-playback");
  v.opt("--video-source", vid.source);
  v.opt("--video-codec", vid.codec);
  v.opt("--video-encoder", vid.encoder);
  v.opt("--video-bit-rate", vid.bitRate);
  v.opt("--max-size", vid.maxSize);
  v.opt("--max-fps", vid.maxFps);
  v.opt("--crop", vid.crop);
  v.opt("--angle", vid.angle);
  v.opt("--capture-orientation", vid.captureOrientation);
  v.opt("--display-orientation", vid.displayOrientation);
  v.opt("--orientation", vid.orientation);
  v.opt("--display-id", vid.displayId);
  v.opt("--video-buffer", vid.videoBuffer);
  v.opt("--render-fit", vid.renderFit);

  // Audio
  const au = a.audio;
  v.flag(au.noAudio, "--no-audio");
  v.flag(au.noAudioPlayback, "--no-audio-playback");
  v.opt("--audio-codec", au.codec);
  v.opt("--audio-encoder", au.encoder);
  v.opt("--audio-source", au.source);
  v.opt("--audio-bit-rate", au.bitRate);
  v.opt("--audio-buffer", au.buffer);
  v.flag(au.dup, "--audio-dup");
  v.flag(au.requireAudio, "--require-audio");

  // Camera
  const cam = a.camera;
  v.opt("--camera-id", cam.id);
  v.opt("--camera-facing", cam.facing);
  v.opt("--camera-size", cam.size);
  v.opt("--camera-ar", cam.ar);
  v.opt("--camera-fps", cam.fps);
  v.flag(cam.highSpeed, "--camera-high-speed");
  v.flag(cam.torch, "--camera-torch");
  v.opt("--camera-zoom", cam.zoom);

  // Control
  const ct = a.control;
  v.flag(ct.noControl, "--no-control");
  v.flag(ct.noClipboardAutosync, "--no-clipboard-autosync");
  v.flag(ct.legacyPaste, "--legacy-paste");
  v.flag(ct.turnScreenOff, "--turn-screen-off");
  v.flag(ct.stayAwake, "--stay-awake");
  v.flag(ct.keepActive, "--keep-active");
  v.flag(ct.showTouches, "--show-touches");
  v.flag(ct.noPowerOn, "--no-power-on");
  v.flag(ct.powerOffOnClose, "--power-off-on-close");
  v.opt("--screen-off-timeout", ct.screenOffTimeout);

  // Input
  const i = a.input;
  v.opt("--keyboard", i.keyboard);
  v.opt("--mouse", i.mouse);
  v.opt("--gamepad", i.gamepad);
  v.opt("--mouse-bind", i.mouseBind);
  v.flag(i.noMouseHover, "--no-mouse-hover");
  v.flag(i.noKeyRepeat, "--no-key-repeat");
  v.flag(i.rawKeyEvents, "--raw-key-events");
  v.flag(i.preferText, "--prefer-text");
  v.opt("--shortcut-mod", i.shortcutMod);

  // Window
  const w = a.window;
  v.opt("--window-title", w.title);
  v.opt("--window-x", w.x);
  v.opt("--window-y", w.y);
  v.opt("--window-width", w.width);
  v.opt("--window-height", w.height);
  v.flag(w.borderless, "--window-borderless");
  v.flag(w.alwaysOnTop, "--always-on-top");
  v.flag(w.fullscreen, "--fullscreen");
  v.flag(w.noWindow, "--no-window");
  v.flag(w.disableScreensaver, "--disable-screensaver");
  v.opt("--background-color", w.backgroundColor);
  v.opt("--render-driver", w.renderDriver);

  // Record
  const r = a.record;
  v.opt("--record", r.file);
  v.opt("--record-format", r.format);
  v.opt("--record-orientation", r.orientation);
  v.flag(r.noPlayback, "--no-playback");
  v.opt("--time-limit", r.timeLimit);

  // Virtual display
  const vd = a.virtualDisplay;
  if (vd.enabled) {
    if (vd.newDisplay && vd.newDisplay !== "") v.raw(`--new-display=${vd.newDisplay}`);
    else v.raw("--new-display");
  }
  v.opt("--start-app", vd.startApp);
  v.flag(vd.noVdDestroyContent, "--no-vd-destroy-content");
  v.flag(vd.noVdSystemDecorations, "--no-vd-system-decorations");

  // General
  const g = a.general;
  v.flag(g.printFps, "--print-fps");
  v.flag(g.killAdbOnClose, "--kill-adb-on-close");
  v.flag(g.noCleanup, "--no-cleanup");
  v.flag(g.noMipmaps, "--no-mipmaps");
  v.opt("--verbosity", g.verbosity);
  v.opt("--pause-on-exit", g.pauseOnExit);
  v.opt("--push-target", g.pushTarget);

  // Raw passthrough
  if (a.extraArgs) {
    for (const token of a.extraArgs.split(/\s+/).filter(Boolean)) {
      v.raw(token);
    }
  }

  return v.parts;
}

export function buildPreview(a: ScrcpyArgs): string {
  return ["scrcpy", ...buildArgv(a)].join(" ");
}
