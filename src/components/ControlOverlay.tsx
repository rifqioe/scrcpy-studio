// Content of the standalone always-on-top control window — a slim vertical bar that sits on
// top of the scrcpy mirror. Its own webview, so it reads the initial target serial from the
// window URL and can switch among connected devices itself.
import { useEffect, useRef, useState } from "react";
import { getCurrentWindow } from "@tauri-apps/api/window";
import {
  Bell,
  Camera,
  ChevronLeft,
  Circle,
  Clipboard,
  Copy,
  GripHorizontal,
  Menu as MenuIcon,
  Power,
  RotateCw,
  Smartphone,
  Square,
  Volume1,
  Volume2,
  VolumeX,
  X,
  type LucideIcon,
} from "lucide-react";
import { deviceAction, deviceScreenshot, listDevices, errMessage } from "../lib/ipc";
import type { Device } from "../lib/types";

interface Btn {
  action: string;
  label: string;
  Icon: LucideIcon;
  /** "repeat": fire rapidly while held (volume). "long": 500ms hold sends `holdAction`. */
  mode?: "repeat" | "long";
  holdAction?: string;
}

// Only actions adb can perform on the device directly (independent of the scrcpy window).
const BUTTONS: Btn[] = [
  { action: "notifications", label: "Notifications", Icon: Bell },
  { action: "copy", label: "Copy", Icon: Copy },
  { action: "paste", label: "Paste", Icon: Clipboard },
  { action: "volume_up", label: "Volume + (hold = rapid)", Icon: Volume2, mode: "repeat" },
  { action: "volume_down", label: "Volume − (hold = rapid)", Icon: Volume1, mode: "repeat" },
  { action: "mute", label: "Mute", Icon: VolumeX },
  { action: "power", label: "Power (hold = power menu)", Icon: Power, mode: "long", holdAction: "hold_power" },
  { action: "home", label: "Home (hold = assistant)", Icon: Circle, mode: "long", holdAction: "assist" },
  { action: "back", label: "Back", Icon: ChevronLeft },
  { action: "recents", label: "Recents", Icon: Square },
  { action: "menu", label: "Menu", Icon: MenuIcon },
  { action: "rotate", label: "Rotate screen", Icon: RotateCw },
];

export function ControlOverlay() {
  const initial = new URLSearchParams(window.location.search).get("serial") ?? "";
  const [devices, setDevices] = useState<Device[]>([]);
  const [target, setTarget] = useState(initial);
  const [status, setStatus] = useState<string>();
  const holdTimer = useRef<number | null>(null);
  const repeatTimer = useRef<number | null>(null);
  const heldRef = useRef(false);
  const targetRef = useRef(initial);
  targetRef.current = target;

  useEffect(() => {
    listDevices()
      .then((d) => {
        setDevices(d);
        if (!d.some((x) => x.serial === initial) && d[0]) setTarget(d[0].serial);
      })
      .catch(() => undefined);
  }, [initial]);

  async function send(action: string) {
    const serial = targetRef.current;
    if (!serial) {
      setStatus("no device");
      return;
    }
    try {
      await deviceAction(serial, action);
    } catch (e) {
      setStatus(errMessage(e));
    }
  }

  async function shot() {
    if (!targetRef.current) return;
    setStatus("…");
    try {
      const path = await deviceScreenshot(targetRef.current, Date.now());
      setStatus(path.split(/[\\/]/).pop());
    } catch (e) {
      setStatus(errMessage(e));
    }
  }

  function clearTimers() {
    if (holdTimer.current) window.clearTimeout(holdTimer.current);
    if (repeatTimer.current) window.clearInterval(repeatTimer.current);
    holdTimer.current = null;
    repeatTimer.current = null;
  }

  function handlers(b: Btn) {
    if (b.mode === "repeat") {
      return {
        onPointerDown: () => {
          send(b.action);
          repeatTimer.current = window.setInterval(() => send(b.action), 130);
        },
        onPointerUp: clearTimers,
        onPointerLeave: clearTimers,
      };
    }
    if (b.mode === "long") {
      return {
        onPointerDown: () => {
          heldRef.current = false;
          holdTimer.current = window.setTimeout(() => {
            heldRef.current = true;
            send(b.holdAction!);
          }, 500);
        },
        onPointerUp: () => {
          clearTimers();
          if (!heldRef.current) send(b.action);
        },
        onPointerLeave: clearTimers,
      };
    }
    return { onClick: () => send(b.action) };
  }

  function cycleDevice() {
    if (devices.length < 2) return;
    const i = devices.findIndex((d) => d.serial === target);
    setTarget(devices[(i + 1) % devices.length].serial);
  }

  const targetDev = devices.find((d) => d.serial === target);
  const targetName = (targetDev?.model ?? target) || "none";
  const btn =
    "flex h-9 w-full items-center justify-center text-zinc-300 hover:bg-zinc-700/70 hover:text-zinc-100";

  return (
    // The whole bar is a drag region; buttons still receive clicks, empty gaps drag the window.
    <div
      data-tauri-drag-region
      className="flex h-screen w-screen flex-col items-center bg-zinc-900 text-zinc-100"
    >
      <button onClick={() => getCurrentWindow().close()} className={btn} title="Close">
        <X size={17} />
      </button>
      <button onClick={cycleDevice} className={btn} title={`Target: ${targetName} (${target || "?"})${devices.length > 1 ? " — click to switch" : ""}`}>
        <Smartphone size={17} />
      </button>
      <div className="my-1 h-px w-6 bg-zinc-700" />

      {BUTTONS.map((b) => (
        <button key={b.action} className={btn} title={b.label} {...handlers(b)}>
          <b.Icon size={17} />
        </button>
      ))}

      <button onClick={shot} className={btn} title="Screenshot">
        <Camera size={17} />
      </button>

      <div className="mt-auto flex w-full flex-col items-center">
        {status && (
          <span className="max-w-full truncate px-1 text-[8px] text-zinc-500" title={status}>
            {status}
          </span>
        )}
        <div data-tauri-drag-region title="Drag" className="flex h-6 w-full cursor-move items-center justify-center text-zinc-600">
          <GripHorizontal size={15} />
        </div>
      </div>
    </div>
  );
}
