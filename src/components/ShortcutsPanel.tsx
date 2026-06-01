// Static reference of scrcpy keyboard shortcuts (from `scrcpy --help`, v4.0).
import { PanelTitle } from "./ui";

const SHORTCUTS: { keys: string; action: string }[] = [
  { keys: "MOD+q", action: "Quit" },
  { keys: "MOD+f / F11", action: "Switch fullscreen mode" },
  { keys: "MOD+Left / MOD+Right", action: "Rotate display left / right" },
  { keys: "MOD+Shift+Left/Right", action: "Flip display horizontally" },
  { keys: "MOD+Shift+Up/Down", action: "Flip display vertically" },
  { keys: "MOD+z", action: "Pause or re-pause display" },
  { keys: "MOD+Shift+z", action: "Unpause display" },
  { keys: "MOD+Shift+r", action: "Reset video capture/encoding" },
  { keys: "MOD+g", action: "Resize window to 1:1 (pixel-perfect)" },
  { keys: "MOD+w / Double-click", action: "Resize window to remove black borders" },
  { keys: "MOD+h / Middle-click", action: "Click on HOME" },
  { keys: "MOD+b / MOD+Backspace / Right-click", action: "Click on BACK" },
  { keys: "MOD+s / 4th-click", action: "Click on APP_SWITCH" },
  { keys: "MOD+m", action: "Click on MENU" },
  { keys: "MOD+Up / MOD+Down", action: "Volume up / down" },
  { keys: "MOD+p", action: "Click on POWER (turn screen on/off)" },
  { keys: "Right-click (screen off)", action: "Power on" },
  { keys: "MOD+o", action: "Turn device screen off (keep mirroring)" },
  { keys: "MOD+Shift+o", action: "Turn device screen on" },
  { keys: "MOD+r", action: "Rotate device screen" },
  { keys: "MOD+n / 5th-click", action: "Expand notification panel" },
  { keys: "MOD+Shift+n", action: "Collapse notification panel" },
  { keys: "MOD+c", action: "Copy to clipboard (Android 7+)" },
  { keys: "MOD+x", action: "Cut to clipboard (Android 7+)" },
  { keys: "MOD+v", action: "Paste computer clipboard to device" },
  { keys: "MOD+Shift+v", action: "Inject clipboard as key events" },
  { keys: "MOD+k", action: "Open keyboard settings (HID only)" },
  { keys: "MOD+i", action: "Enable/disable FPS counter" },
  { keys: "Ctrl+click-and-move", action: "Pinch-to-zoom / rotate" },
  { keys: "Shift+click-and-move", action: "Tilt vertically" },
  { keys: "Drag & drop APK", action: "Install APK from computer" },
  { keys: "Drag & drop file", action: "Push file to device" },
  { keys: "MOD+t / MOD+Shift+t", action: "Camera torch on / off (camera mode)" },
];

export function ShortcutsPanel() {
  return (
    <div>
      <PanelTitle
        title="Shortcuts"
        desc="Reference only. MOD defaults to Left-Alt or Left-Super (configurable in Input → Shortcut mod)."
      />
      <div className="overflow-hidden rounded-md border border-zinc-800">
        <table className="w-full text-sm">
          <tbody>
            {SHORTCUTS.map((s, idx) => (
              <tr key={s.keys} className={idx % 2 ? "bg-zinc-900/40" : ""}>
                <td className="px-3 py-1.5 font-mono text-emerald-300 whitespace-nowrap align-top">
                  {s.keys}
                </td>
                <td className="px-3 py-1.5 text-zinc-300">{s.action}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
