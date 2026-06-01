// Open (or focus) the standalone always-on-top device-control window.
import { WebviewWindow } from "@tauri-apps/api/webviewWindow";

export async function openControlWindow(serial: string): Promise<void> {
  const existing = await WebviewWindow.getByLabel("control");
  if (existing) {
    await existing.setFocus();
    return;
  }
  const win = new WebviewWindow("control", {
    url: `index.html?serial=${encodeURIComponent(serial)}`,
    title: "Device controls",
    width: 56,
    height: 620,
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
