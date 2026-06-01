// Content of the standalone always-on-top control window — a slim vertical bar that can sit
// on top of the scrcpy mirror. Runs in its own webview, so it reads the initial target serial
// from the window URL and can switch among connected devices itself.
import { useEffect, useRef, useState } from "react";
import { getCurrentWindow } from "@tauri-apps/api/window";
import {
  Bell,
  Camera,
  ChevronLeft,
  Circle,
  Clipboard,
  Copy,
  GripVertical,
  Menu as MenuIcon,
  Power,
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
  holdable?: boolean;
}

// Only actions adb can perform on the device directly (independent of the scrcpy window).
const BUTTONS: Btn[] = [
  { action: "notifications", label: "Notifications", Icon: Bell },
  { action: "copy", label: "Copy", Icon: Copy },
  { action: "paste", label: "Paste", Icon: Clipboard },
  { action: "volume_up", label: "Volume +", Icon: Volume2 },
  { action: "volume_down", label: "Volume −", Icon: Volume1 },
  { action: "mute", label: "Mute", Icon: VolumeX },
  { action: "power", label: "Power (hold = menu)", Icon: Power, holdable: true },
  { action: "home", label: "Home", Icon: Circle },
  { action: "back", label: "Back", Icon: ChevronLeft },
  { action: "recents", label: "Recents", Icon: Square },
  { action: "menu", label: "Menu", Icon: MenuIcon },
];

export function ControlOverlay() {
  const initial = new URLSearchParams(window.location.search).get("serial") ?? "";
  const [devices, setDevices] = useState<Device[]>([]);
  const [target, setTarget] = useState(initial);
  const [status, setStatus] = useState<string>();
  const holdTimer = useRef<number | null>(null);
  const heldRef = useRef(false);

  useEffect(() => {
    listDevices()
      .then((d) => {
        setDevices(d);
        if (!d.some((x) => x.serial === initial) && d[0]) setTarget(d[0].serial);
      })
      .catch(() => undefined);
  }, [initial]);

  async function send(action: string) {
    if (!target) {
      setStatus("no device");
      return;
    }
    setStatus(undefined);
    try {
      await deviceAction(target, action);
    } catch (e) {
      setStatus(errMessage(e));
    }
  }

  async function shot() {
    if (!target) return;
    setStatus("…");
    try {
      const path = await deviceScreenshot(target, Date.now());
      setStatus(path.split(/[\\/]/).pop());
    } catch (e) {
      setStatus(errMessage(e));
    }
  }

  // Press = tap action; hold (500ms) = long-press variant.
  function holdHandlers(b: Btn) {
    if (!b.holdable) return { onClick: () => send(b.action) };
    return {
      onPointerDown: () => {
        heldRef.current = false;
        holdTimer.current = window.setTimeout(() => {
          heldRef.current = true;
          send(`hold_${b.action}`);
        }, 500);
      },
      onPointerUp: () => {
        if (holdTimer.current) window.clearTimeout(holdTimer.current);
        if (!heldRef.current) send(b.action);
      },
    };
  }

  function cycleDevice() {
    if (devices.length < 2) return;
    const i = devices.findIndex((d) => d.serial === target);
    setTarget(devices[(i + 1) % devices.length].serial);
  }

  const targetDev = devices.find((d) => d.serial === target);
  const targetName = (targetDev?.model ?? target) || "none";
  const iconBtn =
    "flex h-9 w-9 items-center justify-center rounded-lg text-zinc-200 hover:bg-zinc-700";

  return (
    <div className="flex h-screen w-screen flex-col items-center bg-zinc-900 py-1 text-zinc-100">
      <button onClick={() => getCurrentWindow().close()} className={iconBtn} title="Close">
        <X size={18} />
      </button>

      <button
        onClick={cycleDevice}
        className={iconBtn}
        title={`Target: ${targetName} (${target || "?"})${devices.length > 1 ? " — click to switch" : ""}`}
      >
        <Smartphone size={18} />
      </button>

      <div className="my-1 h-px w-7 bg-zinc-700" />

      {BUTTONS.map((b) => (
        <button key={b.action} className={iconBtn} title={b.label} {...holdHandlers(b)}>
          <b.Icon size={18} />
        </button>
      ))}

      <button onClick={shot} className={iconBtn} title="Screenshot">
        <Camera size={18} />
      </button>

      <div className="mt-auto flex flex-col items-center">
        {status && (
          <span className="mb-1 max-w-[3rem] truncate text-[8px] text-zinc-500" title={status}>
            {status}
          </span>
        )}
        <div
          data-tauri-drag-region
          title="Drag"
          className="flex h-7 w-9 cursor-move items-center justify-center rounded-lg bg-zinc-800 text-zinc-500"
        >
          <GripVertical size={16} />
        </div>
      </div>
    </div>
  );
}
