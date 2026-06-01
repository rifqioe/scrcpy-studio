// Feature panels. Each binds 1:1 to a section of the config store.
import { useConfig } from "../state/config";
import { Grid, NumberField, PanelTitle, SelectField, TextField, Toggle } from "./ui";
import { Detect } from "./Detect";

const opt = (...vals: string[]) => vals.map((v) => ({ value: v, label: v }));

export function ConnectPanel() {
  const { args, patch } = useConfig();
  const c = args.connect;
  return (
    <div>
      <PanelTitle title="Connect" desc="Device selection and wireless/tunnel options." />
      <Grid>
        <TextField label="Serial (-s)" value={c.serial} onChange={(v) => patch("connect", { serial: v })} placeholder="e.g. ABC123 or ip:port" />
        <TextField label="TCP/IP (--tcpip)" value={c.tcpip} onChange={(v) => patch("connect", { tcpip: v })} placeholder="ip:port (empty = auto)" hint="Leave the value empty but toggle below for bare --tcpip" />
        <TextField label="Port range (-p)" value={c.port} onChange={(v) => patch("connect", { port: v })} placeholder="27183:27199" />
        <TextField label="Tunnel host" value={c.tunnelHost} onChange={(v) => patch("connect", { tunnelHost: v })} placeholder="localhost" />
        <NumberField label="Tunnel port" value={c.tunnelPort} onChange={(v) => patch("connect", { tunnelPort: v })} />
      </Grid>
      <div className="mt-3">
        <Toggle label="Use USB device (-d)" checked={c.selectUsb} onChange={(v) => patch("connect", { selectUsb: v })} />
        <Toggle label="Use TCP/IP device (-e)" checked={c.selectTcpip} onChange={(v) => patch("connect", { selectTcpip: v })} />
        <Toggle label="Bare --tcpip (auto-detect IP)" checked={c.tcpip === ""} onChange={(v) => patch("connect", { tcpip: v ? "" : undefined })} />
        <Toggle label="Force adb forward" checked={c.forceAdbForward} onChange={(v) => patch("connect", { forceAdbForward: v })} />
        <Toggle label="OTG mode (--otg, no mirror)" checked={c.otg} onChange={(v) => patch("connect", { otg: v })} hint="Physical HID over USB; mirroring disabled." />
      </div>
    </div>
  );
}

export function VideoPanel() {
  const { args, patch } = useConfig();
  const v = args.video;
  return (
    <div>
      <PanelTitle title="Video" desc="Codec, bitrate, size, orientation and source." />
      <Grid>
        <SelectField label="Source" value={v.source} options={opt("display", "camera")} onChange={(x) => patch("video", { source: x })} />
        <SelectField label="Codec" value={v.codec} options={opt("h264", "h265", "av1")} onChange={(x) => patch("video", { codec: x })} />
        <TextField label="Encoder" value={v.encoder} onChange={(x) => patch("video", { encoder: x })} placeholder="MediaCodec encoder name" />
        <TextField label="Bit rate (-b)" value={v.bitRate} onChange={(x) => patch("video", { bitRate: x })} placeholder="8M" />
        <NumberField label="Max size (-m)" value={v.maxSize} onChange={(x) => patch("video", { maxSize: x })} placeholder="0 = unlimited" />
        <TextField label="Max FPS" value={v.maxFps} onChange={(x) => patch("video", { maxFps: x })} placeholder="60" />
        <TextField label="Crop" value={v.crop} onChange={(x) => patch("video", { crop: x })} placeholder="w:h:x:y" />
        <TextField label="Angle" value={v.angle} onChange={(x) => patch("video", { angle: x })} placeholder="degrees" />
        <SelectField label="Capture orientation" value={v.captureOrientation} options={opt("0", "90", "180", "270", "flip0", "flip90", "flip180", "flip270", "@", "@0", "@90", "@180", "@270")} onChange={(x) => patch("video", { captureOrientation: x })} />
        <SelectField label="Display orientation" value={v.displayOrientation} options={opt("0", "90", "180", "270", "flip0", "flip90", "flip180", "flip270")} onChange={(x) => patch("video", { displayOrientation: x })} />
        <SelectField label="Orientation (both)" value={v.orientation} options={opt("0", "90", "180", "270")} onChange={(x) => patch("video", { orientation: x })} />
        <NumberField label="Display id" value={v.displayId} onChange={(x) => patch("video", { displayId: x })} />
        <div className="flex items-end">
          <Detect kind="displays" label="Detect displays" pattern={/--display-id=(\S+)/g} onPick={(x) => patch("video", { displayId: Number(x) })} />
        </div>
        <NumberField label="Video buffer (ms)" value={v.videoBuffer} onChange={(x) => patch("video", { videoBuffer: x })} />
        <SelectField label="Render fit" value={v.renderFit} options={opt("letterbox", "stretched", "unscaled")} onChange={(x) => patch("video", { renderFit: x })} />
      </Grid>
      <div className="mt-3">
        <Toggle label="No video (--no-video)" checked={v.noVideo} onChange={(x) => patch("video", { noVideo: x })} />
        <Toggle label="No video playback" checked={v.noVideoPlayback} onChange={(x) => patch("video", { noVideoPlayback: x })} />
      </div>
    </div>
  );
}

export function AudioPanel() {
  const { args, patch } = useConfig();
  const a = args.audio;
  return (
    <div>
      <PanelTitle title="Audio" desc="Audio forwarding codec, source and buffering." />
      <Grid>
        <SelectField label="Codec" value={a.codec} options={opt("opus", "aac", "flac", "raw")} onChange={(x) => patch("audio", { codec: x })} />
        <TextField label="Encoder" value={a.encoder} onChange={(x) => patch("audio", { encoder: x })} />
        <SelectField label="Source" value={a.source} options={opt("output", "playback", "mic", "mic-unprocessed", "mic-camcorder", "mic-voice-recognition", "mic-voice-communication", "voice-call", "voice-call-uplink", "voice-call-downlink", "voice-performance")} onChange={(x) => patch("audio", { source: x })} />
        <TextField label="Bit rate" value={a.bitRate} onChange={(x) => patch("audio", { bitRate: x })} placeholder="128K" />
        <NumberField label="Buffer (ms)" value={a.buffer} onChange={(x) => patch("audio", { buffer: x })} placeholder="50" />
      </Grid>
      <div className="mt-3">
        <Toggle label="No audio (--no-audio)" checked={a.noAudio} onChange={(x) => patch("audio", { noAudio: x })} />
        <Toggle label="No audio playback" checked={a.noAudioPlayback} onChange={(x) => patch("audio", { noAudioPlayback: x })} />
        <Toggle label="Duplicate audio (--audio-dup)" checked={a.dup} onChange={(x) => patch("audio", { dup: x })} hint="Requires --audio-source=playback." />
        <Toggle label="Require audio" checked={a.requireAudio} onChange={(x) => patch("audio", { requireAudio: x })} />
      </div>
    </div>
  );
}

export function CameraPanel() {
  const { args, patch } = useConfig();
  const c = args.camera;
  const isCamera = args.video.source === "camera";
  return (
    <div>
      <PanelTitle title="Camera source" desc={isCamera ? "Camera mirroring options." : "Set Video → Source = camera to use these."} />
      <Grid>
        <TextField label="Camera id" value={c.id} onChange={(x) => patch("camera", { id: x })} />
        <div className="flex items-end">
          <Detect kind="cameras" label="Detect cameras" pattern={/--camera-id=(\S+)/g} onPick={(x) => patch("camera", { id: x })} />
        </div>
        <SelectField label="Facing" value={c.facing} options={opt("front", "back", "external")} onChange={(x) => patch("camera", { facing: x })} />
        <TextField label="Size" value={c.size} onChange={(x) => patch("camera", { size: x })} placeholder="1920x1080" />
        <TextField label="Aspect ratio" value={c.ar} onChange={(x) => patch("camera", { ar: x })} placeholder="sensor | 4:3 | 1.6" />
        <NumberField label="FPS" value={c.fps} onChange={(x) => patch("camera", { fps: x })} />
        <TextField label="Zoom" value={c.zoom} onChange={(x) => patch("camera", { zoom: x })} />
      </Grid>
      <div className="mt-3">
        <Toggle label="High-speed capture" checked={c.highSpeed} onChange={(x) => patch("camera", { highSpeed: x })} />
        <Toggle label="Torch on start" checked={c.torch} onChange={(x) => patch("camera", { torch: x })} />
      </div>
    </div>
  );
}

export function ControlPanel() {
  const { args, patch } = useConfig();
  const c = args.control;
  return (
    <div>
      <PanelTitle title="Control" desc="Device interaction, clipboard and power behavior." />
      <Grid>
        <NumberField label="Screen off timeout (s)" value={c.screenOffTimeout} onChange={(x) => patch("control", { screenOffTimeout: x })} />
      </Grid>
      <div className="mt-3">
        <Toggle label="Read-only (--no-control)" checked={c.noControl} onChange={(x) => patch("control", { noControl: x })} />
        <Toggle label="No clipboard autosync" checked={c.noClipboardAutosync} onChange={(x) => patch("control", { noClipboardAutosync: x })} />
        <Toggle label="Legacy paste" checked={c.legacyPaste} onChange={(x) => patch("control", { legacyPaste: x })} />
        <Toggle label="Turn screen off (-S)" checked={c.turnScreenOff} onChange={(x) => patch("control", { turnScreenOff: x })} />
        <Toggle label="Stay awake (-w)" checked={c.stayAwake} onChange={(x) => patch("control", { stayAwake: x })} />
        <Toggle label="Keep active" checked={c.keepActive} onChange={(x) => patch("control", { keepActive: x })} />
        <Toggle label="Show touches (-t)" checked={c.showTouches} onChange={(x) => patch("control", { showTouches: x })} />
        <Toggle label="Do not power on" checked={c.noPowerOn} onChange={(x) => patch("control", { noPowerOn: x })} />
        <Toggle label="Power off on close" checked={c.powerOffOnClose} onChange={(x) => patch("control", { powerOffOnClose: x })} />
      </div>
    </div>
  );
}

export function InputPanel() {
  const { args, patch } = useConfig();
  const i = args.input;
  return (
    <div>
      <PanelTitle title="Input" desc="Keyboard, mouse and gamepad injection modes." />
      <Grid>
        <SelectField label="Keyboard" value={i.keyboard} options={opt("disabled", "sdk", "uhid", "aoa")} onChange={(x) => patch("input", { keyboard: x })} />
        <SelectField label="Mouse" value={i.mouse} options={opt("disabled", "sdk", "uhid", "aoa")} onChange={(x) => patch("input", { mouse: x })} />
        <SelectField label="Gamepad" value={i.gamepad} options={opt("disabled", "uhid", "aoa")} onChange={(x) => patch("input", { gamepad: x })} />
        <TextField label="Mouse bind" value={i.mouseBind} onChange={(x) => patch("input", { mouseBind: x })} placeholder="bhsn:++++" />
        <TextField label="Shortcut mod" value={i.shortcutMod} onChange={(x) => patch("input", { shortcutMod: x })} placeholder="lalt,lsuper" />
      </Grid>
      <div className="mt-3">
        <Toggle label="No mouse hover" checked={i.noMouseHover} onChange={(x) => patch("input", { noMouseHover: x })} />
        <Toggle label="No key repeat" checked={i.noKeyRepeat} onChange={(x) => patch("input", { noKeyRepeat: x })} />
        <Toggle label="Raw key events" checked={i.rawKeyEvents} onChange={(x) => patch("input", { rawKeyEvents: x })} />
        <Toggle label="Prefer text" checked={i.preferText} onChange={(x) => patch("input", { preferText: x })} />
      </div>
    </div>
  );
}

export function WindowPanel() {
  const { args, patch } = useConfig();
  const w = args.window;
  return (
    <div>
      <PanelTitle title="Window" desc="scrcpy's own mirror window placement and appearance." />
      <Grid>
        <TextField label="Title" value={w.title} onChange={(x) => patch("window", { title: x })} />
        <TextField label="Background color" value={w.backgroundColor} onChange={(x) => patch("window", { backgroundColor: x })} placeholder="#222" />
        <NumberField label="X" value={w.x} onChange={(x) => patch("window", { x })} />
        <NumberField label="Y" value={w.y} onChange={(x) => patch("window", { y: x })} />
        <NumberField label="Width" value={w.width} onChange={(x) => patch("window", { width: x })} />
        <NumberField label="Height" value={w.height} onChange={(x) => patch("window", { height: x })} />
        <SelectField label="Render driver" value={w.renderDriver} options={opt("direct3d", "opengl", "opengles2", "opengles", "metal", "software")} onChange={(x) => patch("window", { renderDriver: x })} />
      </Grid>
      <div className="mt-3">
        <Toggle label="Borderless" checked={w.borderless} onChange={(x) => patch("window", { borderless: x })} />
        <Toggle label="Always on top" checked={w.alwaysOnTop} onChange={(x) => patch("window", { alwaysOnTop: x })} />
        <Toggle label="Fullscreen (-f)" checked={w.fullscreen} onChange={(x) => patch("window", { fullscreen: x })} />
        <Toggle label="No window" checked={w.noWindow} onChange={(x) => patch("window", { noWindow: x })} />
        <Toggle label="Disable screensaver" checked={w.disableScreensaver} onChange={(x) => patch("window", { disableScreensaver: x })} />
      </div>
    </div>
  );
}

export function RecordPanel() {
  const { args, patch } = useConfig();
  const r = args.record;
  return (
    <div>
      <PanelTitle title="Record" desc="Save the mirror to a file." />
      <Grid>
        <TextField label="File (-r)" value={r.file} onChange={(x) => patch("record", { file: x })} placeholder="C:\\path\\out.mp4" />
        <SelectField label="Format" value={r.format} options={opt("mp4", "mkv", "m4a", "mka", "opus", "aac", "flac", "wav")} onChange={(x) => patch("record", { format: x })} />
        <SelectField label="Orientation" value={r.orientation} options={opt("0", "90", "180", "270")} onChange={(x) => patch("record", { orientation: x })} />
        <NumberField label="Time limit (s)" value={r.timeLimit} onChange={(x) => patch("record", { timeLimit: x })} />
      </Grid>
      <div className="mt-3">
        <Toggle label="No playback while recording" checked={r.noPlayback} onChange={(x) => patch("record", { noPlayback: x })} />
      </div>
    </div>
  );
}

export function VirtualDisplayPanel() {
  const { args, patch } = useConfig();
  const vd = args.virtualDisplay;
  return (
    <div>
      <PanelTitle title="Virtual display" desc="Create a new virtual display and optionally launch an app into it." />
      <div className="mb-3">
        <Toggle label="Enable new display (--new-display)" checked={vd.enabled} onChange={(x) => patch("virtualDisplay", { enabled: x })} />
      </div>
      <Grid>
        <TextField label="Resolution / dpi" value={vd.newDisplay} onChange={(x) => patch("virtualDisplay", { newDisplay: x })} placeholder="1920x1080/420 (empty = main)" />
        <TextField label="Start app" value={vd.startApp} onChange={(x) => patch("virtualDisplay", { startApp: x })} placeholder="com.example or +?firefox" />
      </Grid>
      <div className="mt-3">
        <Toggle label="No destroy content on removal" checked={vd.noVdDestroyContent} onChange={(x) => patch("virtualDisplay", { noVdDestroyContent: x })} />
        <Toggle label="No system decorations" checked={vd.noVdSystemDecorations} onChange={(x) => patch("virtualDisplay", { noVdSystemDecorations: x })} />
      </div>
    </div>
  );
}

export function GeneralPanel() {
  const { args, patch, setExtraArgs, reset } = useConfig();
  const g = args.general;
  return (
    <div>
      <div className="mb-4 flex items-start justify-between gap-3">
        <PanelTitle title="Other" desc="Misc options and raw flag passthrough." />
        <button
          onClick={reset}
          className="shrink-0 rounded-md border border-zinc-700 px-3 py-1.5 text-sm text-zinc-300 hover:border-red-500 hover:text-red-400"
          title="Reset all configuration to defaults"
        >
          Reset to default
        </button>
      </div>
      <Grid>
        <SelectField label="Verbosity (-V)" value={g.verbosity} options={opt("verbose", "debug", "info", "warn", "error")} onChange={(x) => patch("general", { verbosity: x })} />
        <SelectField label="Pause on exit" value={g.pauseOnExit} options={opt("true", "false", "if-error")} onChange={(x) => patch("general", { pauseOnExit: x })} />
        <TextField label="Push target dir" value={g.pushTarget} onChange={(x) => patch("general", { pushTarget: x })} placeholder="/sdcard/Download/" />
      </Grid>
      <div className="mt-3">
        <Toggle label="Print FPS" checked={g.printFps} onChange={(x) => patch("general", { printFps: x })} />
        <Toggle label="Kill adb on close" checked={g.killAdbOnClose} onChange={(x) => patch("general", { killAdbOnClose: x })} />
        <Toggle label="No cleanup" checked={g.noCleanup} onChange={(x) => patch("general", { noCleanup: x })} />
        <Toggle label="No mipmaps" checked={g.noMipmaps} onChange={(x) => patch("general", { noMipmaps: x })} />
      </div>
      <div className="mt-4">
        <label className="flex flex-col gap-1">
          <span className="text-xs font-medium text-zinc-300">Extra args (verbatim)</span>
          <textarea
            className="rounded-md border border-zinc-700 bg-zinc-900 px-2.5 py-1.5 text-sm text-zinc-100 outline-none focus:border-emerald-500 font-mono"
            rows={2}
            value={args.extraArgs ?? ""}
            placeholder="--any-new-flag=value"
            onChange={(e) => setExtraArgs(e.target.value)}
          />
          <span className="text-[11px] text-zinc-500">
            Appended to the command as-is — use any flag the UI doesn't expose yet.
          </span>
        </label>
      </div>
    </div>
  );
}
