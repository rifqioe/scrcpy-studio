// Typed wrappers around Tauri's invoke / event APIs.

import { invoke } from "@tauri-apps/api/core";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";
import type { Binaries, Device, ScrcpyArgs, SessionInfo } from "./types";

// ---- Binary management ----
export const binaryCurrent = () => invoke<Binaries | null>("binary_current");
export const binaryLatestVersion = () => invoke<string>("binary_latest_version");
export const binaryInstallLatest = () => invoke<Binaries>("binary_install_latest");
export const binaryUpdate = () => invoke<Binaries>("binary_update");

// ---- adb ----
export const listDevices = () => invoke<Device[]>("list_devices");
export const adbConnect = (addr: string) => invoke<string>("adb_connect", { addr });
export const adbDisconnect = (addr: string) => invoke<string>("adb_disconnect", { addr });
export const adbPair = (addr: string, code: string) =>
  invoke<string>("adb_pair", { addr, code });
export const adbTcpip = (serial: string, port: number) =>
  invoke<string>("adb_tcpip", { serial, port });
export const goWireless = (serial: string) => invoke<string>("go_wireless", { serial });

// ---- QR wireless pairing ----
export interface QrSession {
  payload: string;
  name: string;
  code: string;
}
export interface QrPairResult {
  success: boolean;
  message: string;
}
export const qrPairStart = (autoConnect: boolean) =>
  invoke<QrSession>("qr_pair_start", { autoConnect });
export const onQrPairResult = (cb: (e: QrPairResult) => void): Promise<UnlistenFn> =>
  listen<QrPairResult>("qr-pair-result", (event) => cb(event.payload));

// ---- scrcpy launch / sessions ----
export const previewArgv = (args: ScrcpyArgs) => invoke<string>("preview_argv", { args });
export const launch = (args: ScrcpyArgs) => invoke<SessionInfo>("launch", { args });
export const stopSession = (id: number) => invoke<void>("stop_session", { id });
export const listSessions = () => invoke<SessionInfo[]>("list_sessions");
export const scrcpyList = (kind: string, serial?: string) =>
  invoke<string>("scrcpy_list", { kind, serial });

// ---- app launcher ----
export interface DeviceApp {
  name: string;
  package: string;
  system: boolean;
}
export const listApps = (serial: string | undefined, includeSystem: boolean) =>
  invoke<DeviceApp[]>("list_apps", { serial, includeSystem });

export const createShortcut = (args: ScrcpyArgs, pkg: string, label: string) =>
  invoke<string>("create_shortcut", { args, package: pkg, label });

// ---- device control ----
export const deviceAction = (serial: string, action: string) =>
  invoke<void>("device_action", { serial, action });
export const deviceScreenshot = (serial: string, stamp: number) =>
  invoke<string>("device_screenshot", { serial, stamp: String(stamp) });

// ---- profiles ----
export const profileSave = (name: string, args: ScrcpyArgs) =>
  invoke<void>("profile_save", { name, args });
export const profileLoad = (name: string) => invoke<ScrcpyArgs>("profile_load", { name });
export const profileList = () => invoke<string[]>("profile_list");
export const profileDelete = (name: string) => invoke<void>("profile_delete", { name });

// ---- events ----
export interface SessionLog {
  id: number;
  stream: "stdout" | "stderr";
  line: string;
}
export interface SessionExit {
  id: number;
  code: number | null;
}

export const onSessionLog = (cb: (e: SessionLog) => void): Promise<UnlistenFn> =>
  listen<SessionLog>("session-log", (event) => cb(event.payload));

export const onSessionExit = (cb: (e: SessionExit) => void): Promise<UnlistenFn> =>
  listen<SessionExit>("session-exit", (event) => cb(event.payload));

// Normalize a thrown command error (the Rust AppError) into a readable string.
export function errMessage(e: unknown): string {
  if (typeof e === "string") return e;
  if (e && typeof e === "object") {
    const obj = e as { kind?: string; message?: string };
    if (obj.message) return obj.kind ? `${obj.kind}: ${obj.message}` : obj.message;
  }
  return String(e);
}
