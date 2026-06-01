import { useMemo, useState } from "react";
import { useConfig } from "../state/config";
import { useDevices } from "../state/devices";
import { useSessions } from "../state/sessions";
import { buildPreview } from "../lib/preview";
import { launch, errMessage } from "../lib/ipc";
import { openControlWindow } from "../lib/controlWindow";
import { Button } from "./ui";

export function CommandBar({ hasBinary }: { hasBinary: boolean }) {
  const args = useConfig((s) => s.args);
  const selected = useDevices((s) => s.selected);
  const addSession = useSessions((s) => s.add);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string>();
  const [launching, setLaunching] = useState(false);

  const preview = useMemo(() => buildPreview(args), [args]);

  async function copy() {
    await navigator.clipboard.writeText(preview);
    setCopied(true);
    setTimeout(() => setCopied(false), 1200);
  }

  async function doLaunch() {
    setLaunching(true);
    setError(undefined);
    try {
      const info = await launch(args);
      addSession(info);
    } catch (e) {
      setError(errMessage(e));
    } finally {
      setLaunching(false);
    }
  }

  // OTG mode does not require a selected device; everything else does.
  const needsDevice = !args.connect.otg;
  const canLaunch = hasBinary && (!needsDevice || !!selected) && !launching;

  return (
    <div className="border-t border-zinc-800 bg-zinc-950 p-3">
      <div className="flex items-center gap-2">
        <code className="flex-1 overflow-x-auto whitespace-nowrap rounded-md border border-zinc-800 bg-black px-3 py-2 font-mono text-xs text-emerald-300">
          {preview}
        </code>
        <Button variant="ghost" onClick={copy}>
          {copied ? "Copied" : "Copy"}
        </Button>
        <Button
          variant="ghost"
          disabled={!selected}
          title={selected ? "Open floating device controls" : "Select a device first"}
          onClick={() => openControlWindow(selected!).catch((e) => setError(errMessage(e)))}
        >
          Controls
        </Button>
        <Button
          variant="primary"
          disabled={!canLaunch}
          onClick={doLaunch}
          title={
            !hasBinary
              ? "Install scrcpy first"
              : needsDevice && !selected
                ? "Select a device first"
                : "Launch scrcpy"
          }
        >
          {launching ? "Launching…" : "Launch"}
        </Button>
      </div>
      {error && <p className="mt-2 text-xs text-red-400">{error}</p>}
    </div>
  );
}
