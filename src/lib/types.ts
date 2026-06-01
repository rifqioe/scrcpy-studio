// TypeScript mirror of the Rust `ScrcpyArgs` model (src-tauri/src/args/mod.rs).
// Field names match the serde camelCase serialization. Keep the two in sync.

export interface Connect {
  serial?: string;
  selectUsb?: boolean;
  selectTcpip?: boolean;
  tcpip?: string;
  port?: string;
  forceAdbForward?: boolean;
  tunnelHost?: string;
  tunnelPort?: number;
  otg?: boolean;
}

export interface Video {
  noVideo?: boolean;
  noVideoPlayback?: boolean;
  source?: string;
  codec?: string;
  encoder?: string;
  bitRate?: string;
  maxSize?: number;
  maxFps?: string;
  crop?: string;
  angle?: string;
  captureOrientation?: string;
  displayOrientation?: string;
  orientation?: string;
  displayId?: number;
  videoBuffer?: number;
  renderFit?: string;
}

export interface Audio {
  noAudio?: boolean;
  noAudioPlayback?: boolean;
  codec?: string;
  encoder?: string;
  source?: string;
  bitRate?: string;
  buffer?: number;
  dup?: boolean;
  requireAudio?: boolean;
}

export interface Camera {
  id?: string;
  facing?: string;
  size?: string;
  ar?: string;
  fps?: number;
  highSpeed?: boolean;
  torch?: boolean;
  zoom?: string;
}

export interface Control {
  noControl?: boolean;
  noClipboardAutosync?: boolean;
  legacyPaste?: boolean;
  turnScreenOff?: boolean;
  stayAwake?: boolean;
  keepActive?: boolean;
  showTouches?: boolean;
  noPowerOn?: boolean;
  powerOffOnClose?: boolean;
  screenOffTimeout?: number;
}

export interface Input {
  keyboard?: string;
  mouse?: string;
  gamepad?: string;
  mouseBind?: string;
  noMouseHover?: boolean;
  noKeyRepeat?: boolean;
  rawKeyEvents?: boolean;
  preferText?: boolean;
  shortcutMod?: string;
}

export interface Window {
  title?: string;
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  borderless?: boolean;
  alwaysOnTop?: boolean;
  fullscreen?: boolean;
  noWindow?: boolean;
  disableScreensaver?: boolean;
  backgroundColor?: string;
  renderDriver?: string;
}

export interface Record {
  file?: string;
  format?: string;
  orientation?: string;
  noPlayback?: boolean;
  timeLimit?: number;
}

export interface VirtualDisplay {
  enabled?: boolean;
  newDisplay?: string;
  startApp?: string;
  noVdDestroyContent?: boolean;
  noVdSystemDecorations?: boolean;
}

export interface General {
  printFps?: boolean;
  killAdbOnClose?: boolean;
  noCleanup?: boolean;
  noMipmaps?: boolean;
  verbosity?: string;
  pauseOnExit?: string;
  pushTarget?: string;
}

export interface ScrcpyArgs {
  connect: Connect;
  video: Video;
  audio: Audio;
  camera: Camera;
  control: Control;
  input: Input;
  window: Window;
  record: Record;
  virtualDisplay: VirtualDisplay;
  general: General;
  extraArgs?: string;
}

export function defaultArgs(): ScrcpyArgs {
  return {
    connect: {},
    video: {},
    audio: {},
    camera: {},
    control: {},
    input: {},
    window: {},
    record: {},
    virtualDisplay: {},
    general: {},
  };
}

export interface Device {
  serial: string;
  state: string;
  model?: string;
  isTcpip: boolean;
}

export interface Binaries {
  scrcpy: string;
  adb: string;
  version: string;
}

export interface SessionInfo {
  id: number;
  command: string;
  serial?: string;
}

export interface AppError {
  kind: string;
  message: string;
}
