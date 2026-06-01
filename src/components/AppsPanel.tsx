import { useMemo, useState } from "react";
import { useConfig } from "../state/config";
import { useDevices } from "../state/devices";
import { listApps, errMessage, type DeviceApp } from "../lib/ipc";
import { Button, PanelTitle, Toggle } from "./ui";

export function AppsPanel() {
  const { args, patch } = useConfig();
  const selected = useDevices((s) => s.selected);
  const [apps, setApps] = useState<DeviceApp[]>([]);
  const [query, setQuery] = useState("");
  const [includeSystem, setIncludeSystem] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();

  async function load() {
    setBusy(true);
    setError(undefined);
    try {
      setApps(await listApps(selected, includeSystem));
    } catch (e) {
      setError(errMessage(e));
    } finally {
      setBusy(false);
    }
  }

  const filtered = useMemo(() => {
    const q = query.toLowerCase();
    return apps.filter(
      (a) => a.name.toLowerCase().includes(q) || a.package.toLowerCase().includes(q),
    );
  }, [apps, query]);

  const picked = args.virtualDisplay.startApp;

  return (
    <div>
      <PanelTitle
        title="Apps"
        desc="List installed apps and pick one to launch on start (via --start-app)."
      />

      <div className="mb-3 flex flex-wrap items-center gap-2">
        <Button variant="primary" onClick={load} disabled={busy || !selected}>
          {busy ? "Loading…" : "Load apps"}
        </Button>
        <Toggle label="Include system apps" checked={includeSystem} onChange={setIncludeSystem} />
        {!selected && <span className="text-xs text-amber-400">Select a device first.</span>}
      </div>

      <div className="mb-3 rounded-md border border-zinc-800 bg-zinc-900/40 p-2 text-sm">
        Launch target:{" "}
        {picked ? (
          <span className="font-mono text-emerald-300">{picked}</span>
        ) : (
          <span className="text-zinc-500">none — click an app below</span>
        )}
        {picked && (
          <button
            className="ml-2 text-xs text-zinc-500 hover:text-red-400"
            onClick={() => patch("virtualDisplay", { startApp: undefined })}
          >
            clear
          </button>
        )}
        <div className="mt-2">
          <Toggle
            label="Launch in a new virtual display"
            checked={args.virtualDisplay.enabled}
            onChange={(v) => patch("virtualDisplay", { enabled: v })}
            hint="Runs the app on a separate display instead of the device's main screen."
          />
        </div>
      </div>

      {error && <p className="mb-2 text-xs text-red-400">{error}</p>}

      {apps.length > 0 && (
        <input
          className="mb-2 w-full rounded-md border border-zinc-700 bg-zinc-900 px-2.5 py-1.5 text-sm text-zinc-100 outline-none focus:border-emerald-500"
          placeholder={`Search ${apps.length} apps…`}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      )}

      <div className="flex max-h-[50vh] flex-col gap-1 overflow-y-auto">
        {filtered.map((a) => (
          <button
            key={a.package}
            onClick={() => patch("virtualDisplay", { startApp: a.package })}
            className={
              "flex items-center justify-between rounded-md border px-2.5 py-1.5 text-left transition-colors " +
              (picked === a.package
                ? "border-emerald-500 bg-emerald-500/10"
                : "border-zinc-800 hover:border-zinc-700")
            }
          >
            <span className="min-w-0">
              <span className="block truncate text-sm text-zinc-100">{a.name}</span>
              <span className="block truncate font-mono text-[11px] text-zinc-500">{a.package}</span>
            </span>
            {a.system && <span className="ml-2 shrink-0 text-[10px] text-zinc-600">system</span>}
          </button>
        ))}
      </div>
    </div>
  );
}
