import { useEffect, useMemo, useState } from "react";
import { MoreVertical } from "lucide-react";
import { useConfig } from "../state/config";
import { useDevices } from "../state/devices";
import { listApps, createShortcut, errMessage, type DeviceApp } from "../lib/ipc";
import { Button, PanelTitle, Toggle } from "./ui";

export function AppsPanel() {
  const { args, patch } = useConfig();
  const selected = useDevices((s) => s.selected);
  const [apps, setApps] = useState<DeviceApp[]>([]);
  const [query, setQuery] = useState("");
  const [includeSystem, setIncludeSystem] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const [working, setWorking] = useState<string>();
  const [menuFor, setMenuFor] = useState<string>();
  const [autoLoad, setAutoLoad] = useState(() => localStorage.getItem("apps.autoLoad") === "1");

  // Auto-load the app list when the panel opens (if enabled and a device is selected).
  useEffect(() => {
    if (autoLoad && selected && apps.length === 0 && !busy) {
      load();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoLoad, selected]);

  function toggleAutoLoad(v: boolean) {
    setAutoLoad(v);
    localStorage.setItem("apps.autoLoad", v ? "1" : "0");
  }

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

  async function makeShortcut(app: DeviceApp) {
    setWorking(app.package);
    setError(undefined);
    try {
      // Build a shortcut from the current config, launching this app.
      const path = await createShortcut(args, app.package, `${app.name} (scrcpy)`);
      setError(`Shortcut created: ${path}`);
    } catch (e) {
      setError(errMessage(e));
    } finally {
      setWorking(undefined);
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
        desc="List installed apps. Pick one to launch on start (--start-app), or make a desktop shortcut."
      />

      <div className="mb-3 flex flex-wrap items-center gap-2">
        <Button variant="primary" onClick={load} disabled={busy || !selected}>
          {busy ? "Loading…" : "Load apps"}
        </Button>
        <Toggle label="Include system apps" checked={includeSystem} onChange={setIncludeSystem} />
        <Toggle label="Auto load" checked={autoLoad} onChange={toggleAutoLoad} />
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

      {error && <p className="mb-2 break-words text-xs text-zinc-400">{error}</p>}

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
          <div
            key={a.package}
            className={
              "flex items-center gap-2 rounded-md border px-2.5 py-1.5 transition-colors " +
              (picked === a.package
                ? "border-emerald-500 bg-emerald-500/10"
                : "border-zinc-800 hover:border-zinc-700")
            }
          >
            <button
              onClick={() => patch("virtualDisplay", { startApp: a.package })}
              className="min-w-0 flex-1 text-left"
              title="Set as launch target (--start-app)"
            >
              <span className="block truncate text-sm text-zinc-100">{a.name}</span>
              <span className="block truncate font-mono text-[11px] text-zinc-500">{a.package}</span>
            </button>
            {a.system && <span className="shrink-0 text-[10px] text-zinc-600">system</span>}
            <div className="relative shrink-0">
              <button
                onClick={() => setMenuFor(menuFor === a.package ? undefined : a.package)}
                className="flex h-7 w-7 items-center justify-center rounded-md text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200"
                title="More"
                disabled={working === a.package}
              >
                {working === a.package ? "…" : <MoreVertical size={16} />}
              </button>
              {menuFor === a.package && (
                <>
                  <div className="fixed inset-0 z-30" onClick={() => setMenuFor(undefined)} />
                  <div className="absolute right-0 top-full z-40 mt-1 min-w-[12rem] rounded-md border border-zinc-700 bg-zinc-900 py-1 shadow-xl">
                    <button
                      onClick={() => { setMenuFor(undefined); makeShortcut(a); }}
                      className="block w-full px-3 py-1.5 text-left text-sm text-zinc-300 hover:bg-zinc-800 hover:text-zinc-100"
                    >
                      Create Desktop Shortcut
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
