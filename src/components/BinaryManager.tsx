import { useEffect, useState } from "react";
import {
  binaryCurrent,
  binaryInstallLatest,
  binaryLatestVersion,
  binaryUpdate,
  errMessage,
} from "../lib/ipc";
import type { Binaries } from "../lib/types";
import { Button } from "./ui";

export function BinaryManager() {
  const [current, setCurrent] = useState<Binaries | null>(null);
  const [latest, setLatest] = useState<string>();
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<string>();

  async function load() {
    try {
      setCurrent(await binaryCurrent());
    } catch (e) {
      setStatus(errMessage(e));
    }
  }

  useEffect(() => {
    load();
    binaryLatestVersion()
      .then(setLatest)
      .catch(() => undefined);
  }, []);

  async function install() {
    setBusy(true);
    setStatus("Downloading scrcpy…");
    try {
      const bin = await binaryInstallLatest();
      setCurrent(bin);
      setStatus(`Installed ${bin.version}`);
    } catch (e) {
      setStatus(errMessage(e));
    } finally {
      setBusy(false);
    }
  }

  async function update() {
    setBusy(true);
    setStatus("Updating scrcpy…");
    try {
      const bin = await binaryUpdate();
      setCurrent(bin);
      setStatus(`Updated to ${bin.version}`);
    } catch (e) {
      setStatus(errMessage(e));
    } finally {
      setBusy(false);
    }
  }

  const updateAvailable = !!latest && !!current && latest !== current.version;

  return (
    <section className="rounded-md border border-zinc-800 bg-zinc-900/40 p-3">
      <h3 className="mb-1.5 text-sm font-semibold text-zinc-200">scrcpy</h3>
      {current ? (
        <p className="text-xs text-zinc-400">
          Installed: <span className="text-emerald-300">{current.version}</span>
          {latest && (
            <>
              {" · "}latest: <span className="text-zinc-300">{latest}</span>
            </>
          )}
        </p>
      ) : (
        <p className="text-xs text-amber-400">Not installed.</p>
      )}
      <div className="mt-2 flex gap-1.5">
        {!current && (
          <Button variant="primary" disabled={busy} onClick={install}>
            {busy ? "Installing…" : "Install latest"}
          </Button>
        )}
        {current && (
          <Button variant={updateAvailable ? "primary" : "default"} disabled={busy} onClick={update}>
            {busy ? "Working…" : updateAvailable ? `Update → ${latest}` : "Reinstall latest"}
          </Button>
        )}
      </div>
      {status && <p className="mt-2 break-words text-[11px] text-zinc-400">{status}</p>}
    </section>
  );
}
