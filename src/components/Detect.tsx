// Runs one of scrcpy's `--list-*` commands and offers the parsed results as clickable chips.
import { useState } from "react";
import { useDevices } from "../state/devices";
import { scrcpyList, errMessage } from "../lib/ipc";
import { Button } from "./ui";

export function Detect({
  kind,
  label,
  pattern,
  onPick,
}: {
  kind: string;
  label: string;
  /** Global regex with one capture group yielding the value to pick. */
  pattern: RegExp;
  onPick: (value: string) => void;
}) {
  const serial = useDevices((s) => s.selected);
  const [items, setItems] = useState<string[]>([]);
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);

  async function run() {
    setBusy(true);
    setError(undefined);
    try {
      const out = await scrcpyList(kind, serial);
      const found = [...out.matchAll(pattern)].map((m) => m[1]);
      setItems([...new Set(found)]);
      if (found.length === 0) setError("none detected");
    } catch (e) {
      setError(errMessage(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-1.5">
      <Button onClick={run} disabled={busy}>
        {busy ? "Detecting…" : label}
      </Button>
      {error && <span className="text-[11px] text-amber-400">{error}</span>}
      {items.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {items.map((v) => (
            <button
              key={v}
              onClick={() => onPick(v)}
              className="rounded-md border border-zinc-700 px-2 py-0.5 text-xs text-emerald-300 hover:border-emerald-500"
            >
              {v}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
