// Content of the standalone always-on-top control window — a slim vertical bar that sits on
// top of the scrcpy mirror. Its own webview, so it reads the initial target serial from the
// window URL and can switch among connected devices itself.
import { useEffect, useRef, useState } from "react";
import { getCurrentWindow, PhysicalPosition } from "@tauri-apps/api/window";
import { openPath } from "@tauri-apps/plugin-opener";
import {
  Bell,
  Camera,
  ChevronLeft,
  Circle,
  Clipboard,
  Copy,
  GripHorizontal,
  Menu as MenuIcon,
  Pin,
  PinOff,
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
import { deviceAction, deviceScreenshot, listDevices, scrcpyWindowRect } from "../lib/ipc";
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

// Bar layout: action names, "screenshot", or "sep" (divider).
const LAYOUT: string[] = [
  "notifications", "copy", "paste", "menu", "sep",
  "volume_up", "volume_down", "mute", "sep",
  "power", "sep",
  "rotate", "screenshot", "sep",
  "back", "home", "recents", "sep",
];

export function ControlOverlay() {
  const params = new URLSearchParams(window.location.search);
  const initial = params.get("serial") ?? "";
  const scrcpyTitle = params.get("title") ?? "";
  const [devices, setDevices] = useState<Device[]>([]);
  const [target, setTarget] = useState(initial);
  const [attached, setAttached] = useState(true);
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

  // Dock to the scrcpy window: poll its rect and stick this bar to its left edge.
  useEffect(() => {
    if (!attached) return;
    let cancelled = false;
    let timer: number | undefined;
    async function tick() {
      if (cancelled) return;
      try {
        const r = await scrcpyWindowRect(scrcpyTitle || undefined);
        if (r) {
          const size = await getCurrentWindow().outerSize();
          let x = r.x - size.width;
          if (x < 0) x = r.x + r.w; // not enough room on the left → dock right
          await getCurrentWindow().setPosition(new PhysicalPosition(x, r.y));
        }
      } catch {
        /* scrcpy window not found yet */
      }
      timer = window.setTimeout(tick, 300);
    }
    tick();
    return () => {
      cancelled = true;
      if (timer) window.clearTimeout(timer);
    };
  }, [attached, scrcpyTitle]);

  async function send(action: string) {
    const serial = targetRef.current;
    if (!serial) return;
    try {
      await deviceAction(serial, action);
    } catch {
      /* ignore */
    }
  }

  async function shot() {
    if (!targetRef.current) return;
    try {
      const path = await deviceScreenshot(targetRef.current, Date.now());
      // Open the screenshot in the default image viewer.
      await openPath(path);
    } catch {
      /* ignore */
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
    "flex h-8 w-full items-center justify-center text-zinc-300 hover:bg-zinc-700/70 hover:text-zinc-100";

  return (
    // The whole bar is a drag region; buttons receive clicks, the surrounding area drags.
    <div
      data-tauri-drag-region
      className="flex h-screen w-screen flex-col items-center gap-0.5 bg-zinc-900 py-1 text-zinc-100"
    >
      <button onClick={() => getCurrentWindow().close()} className={btn} title="Close">
        <X size={17} />
      </button>
      <button onClick={cycleDevice} className={btn} title={`Target: ${targetName} (${target || "?"})${devices.length > 1 ? " — click to switch" : ""}`}>
        <Smartphone size={17} />
      </button>
      <button
        onClick={() => setAttached((a) => !a)}
        className={btn + (attached ? " text-emerald-400" : "")}
        title={attached ? "Docked to scrcpy — click to detach" : "Detached — click to dock"}
      >
        {attached ? <Pin size={17} /> : <PinOff size={17} />}
      </button>
      <div className="my-1 h-px w-6 bg-zinc-700" />

      {LAYOUT.map((tok, i) => {
        if (tok === "sep") return <div key={`sep${i}`} className="my-1 h-px w-6 bg-zinc-700" />;
        if (tok === "screenshot")
          return (
            <button key="screenshot" onClick={shot} className={btn} title="Screenshot">
              <Camera size={17} />
            </button>
          );
        const b = BUTTONS.find((x) => x.action === tok);
        if (!b) return null;
        return (
          <button key={b.action} className={btn} title={b.label} {...handlers(b)}>
            <b.Icon size={17} />
          </button>
        );
      })}

      <div className="mt-auto w-full">
        <div data-tauri-drag-region title="Drag" className="flex h-6 w-full cursor-move items-center justify-center text-zinc-600">
          <GripHorizontal size={15} />
        </div>
      </div>
    </div>
  );
}
