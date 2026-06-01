// Open (or focus) a standalone always-on-top device-control window for a given device.
// One window per device serial (label `control-<serial>`), so multiple sessions can each
// have their own controls.
import { WebviewWindow } from "@tauri-apps/api/webviewWindow";

export function controlLabel(serial: string): string {
  return "control-" + (serial || "default").replace(/[^a-zA-Z0-9]/g, "_");
}

export async function openControlWindow(serial: string): Promise<void> {
  const label = controlLabel(serial);
  const existing = await WebviewWindow.getByLabel(label);
  if (existing) {
    await existing.setFocus();
    return;
  }
  const win = new WebviewWindow(label, {
    url: `index.html?serial=${encodeURIComponent(serial)}`,
    title: "Controls",
    width: 44,
    height: 600,
    minWidth: 44,
    maxWidth: 44,
    resizable: false,
    decorations: false,
    alwaysOnTop: true,
    skipTaskbar: true,
  });
  await new Promise<void>((resolve, reject) => {
    win.once("tauri://created", () => resolve());
    win.once("tauri://error", (e) => reject(new Error(String(e.payload))));
  });
}
