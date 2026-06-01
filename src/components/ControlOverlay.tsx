// Content of the standalone always-on-top control window. Runs in its own webview, so it
// reads the target device serial from the window URL rather than the shared store.
import { useState } from "react";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { deviceAction, deviceScreenshot, errMessage } from "../lib/ipc";

const BUTTONS = [
  { action: "back", label: "Back", glyph: "‹" },
  { action: "home", label: "Home", glyph: "○" },
  { action: "recents", label: "Recents", glyph: "▢" },
  { action: "menu", label: "Menu", glyph: "≡" },
  { action: "volume_down", label: "Vol −", glyph: "−" },
  { action: "volume_up", label: "Vol +", glyph: "+" },
  { action: "power", label: "Power", glyph: "⏻" },
  { action: "notifications", label: "Notifs", glyph: "🔔" },
];

export function ControlOverlay() {
  const serial = new URLSearchParams(window.location.search).get("serial") ?? "";
  const [status, setStatus] = useState<string>();

  async function send(action: string) {
    setStatus(undefined);
    try {
      await deviceAction(serial, action);
    } catch (e) {
      setStatus(errMessage(e));
    }
  }

  async function shot() {
    setStatus("…");
    try {
      const path = await deviceScreenshot(serial, Date.now());
      setStatus(`saved: ${path.split(/[\\/]/).pop()}`);
    } catch (e) {
      setStatus(errMessage(e));
    }
  }

  return (
    <div className="flex h-screen w-screen flex-col overflow-hidden rounded-xl border border-zinc-700 bg-zinc-900/95 text-zinc-100">
      <div
        data-tauri-drag-region
        className="flex items-center justify-between border-b border-zinc-800 px-2 py-1"
      >
        <span data-tauri-drag-region className="truncate text-[11px] text-zinc-400">
          {serial || "no device"}
        </span>
        <button
          onClick={() => getCurrentWindow().close()}
          className="text-zinc-500 hover:text-red-400"
          title="Close"
        >
          ×
        </button>
      </div>

      <div className="grid grid-cols-4 gap-1 p-2">
        {BUTTONS.map((b) => (
          <button
            key={b.action}
            title={b.label}
            onClick={() => send(b.action)}
            className="flex h-10 w-10 items-center justify-center rounded-lg bg-zinc-800 text-lg hover:bg-zinc-700"
          >
            {b.glyph}
          </button>
        ))}
      </div>
      <button
        onClick={shot}
        className="mx-2 mb-2 rounded-lg bg-zinc-800 py-1.5 text-xs hover:bg-zinc-700"
      >
        📷 Screenshot
      </button>
      {status && <p className="px-2 pb-2 text-[10px] text-zinc-400 break-words">{status}</p>}
    </div>
  );
}
