import { useState } from "react";
import { useDevices } from "../state/devices";
import { deviceAction, deviceScreenshot, errMessage } from "../lib/ipc";

// guiscrcpy-inspired floating control panel: sends device inputs over adb,
// independent of the scrcpy mirror window.

interface Ctl {
  action: string;
  label: string;
  glyph: string;
}

const BUTTONS: Ctl[] = [
  { action: "back", label: "Back", glyph: "‹" },
  { action: "home", label: "Home", glyph: "○" },
  { action: "recents", label: "Recents", glyph: "▢" },
  { action: "menu", label: "Menu", glyph: "≡" },
  { action: "volume_down", label: "Vol −", glyph: "−" },
  { action: "volume_up", label: "Vol +", glyph: "+" },
  { action: "power", label: "Power", glyph: "⏻" },
  { action: "notifications", label: "Notifs", glyph: "🔔" },
];

export function ControlToolbar() {
  const selected = useDevices((s) => s.selected);
  const [open, setOpen] = useState(true);
  const [status, setStatus] = useState<string>();

  if (!selected) return null;

  async function send(action: string) {
    setStatus(undefined);
    try {
      await deviceAction(selected!, action);
    } catch (e) {
      setStatus(errMessage(e));
    }
  }

  async function shot() {
    setStatus("Capturing…");
    try {
      const path = await deviceScreenshot(selected!, Date.now());
      setStatus(`Saved: ${path}`);
    } catch (e) {
      setStatus(errMessage(e));
    }
  }

  return (
    <div className="pointer-events-none fixed bottom-4 right-[22rem] z-50 flex flex-col items-end gap-1">
      {open && (
        <div className="pointer-events-auto flex flex-col gap-1 rounded-xl border border-zinc-700 bg-zinc-900/95 p-2 shadow-xl backdrop-blur">
          <div className="grid grid-cols-4 gap-1">
            {BUTTONS.map((b) => (
              <button
                key={b.action}
                title={b.label}
                onClick={() => send(b.action)}
                className="flex h-10 w-10 items-center justify-center rounded-lg bg-zinc-800 text-lg text-zinc-200 hover:bg-zinc-700"
              >
                {b.glyph}
              </button>
            ))}
          </div>
          <button
            onClick={shot}
            className="mt-0.5 rounded-lg bg-zinc-800 py-1.5 text-xs text-zinc-200 hover:bg-zinc-700"
          >
            📷 Screenshot
          </button>
          {status && (
            <p className="max-w-[12rem] break-words text-[10px] text-zinc-400">{status}</p>
          )}
        </div>
      )}
      <button
        onClick={() => setOpen((o) => !o)}
        title="Device controls"
        className="pointer-events-auto flex h-11 w-11 items-center justify-center rounded-full bg-emerald-600 text-xl text-white shadow-xl hover:bg-emerald-500"
      >
        {open ? "×" : "⊞"}
      </button>
    </div>
  );
}
