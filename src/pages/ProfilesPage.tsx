import { useEffect, useState } from "react";
import { useConfig } from "../state/config";
import {
  profileDelete,
  profileList,
  profileLoad,
  profileSave,
  errMessage,
} from "../lib/ipc";
import { Button, PanelTitle } from "../components/ui";

export function ProfilesPage() {
  const { args, setArgs, reset, activeProfile, setActiveProfile } = useConfig();
  const [profiles, setProfiles] = useState<string[]>([]);
  const [name, setName] = useState("");
  const [status, setStatus] = useState<string>();

  async function refresh() {
    try {
      setProfiles(await profileList());
    } catch (e) {
      setStatus(errMessage(e));
    }
  }
  useEffect(() => {
    refresh();
  }, []);

  async function create() {
    const n = name.trim();
    if (!n) return;
    try {
      await profileSave(n, args);
      setActiveProfile(n);
      setName("");
      setStatus(`Created "${n}" — changes now auto-save here`);
      await refresh();
    } catch (e) {
      setStatus(errMessage(e));
    }
  }
  async function load(n: string) {
    try {
      setArgs(await profileLoad(n));
      setActiveProfile(n);
      setStatus(`Loaded "${n}"`);
    } catch (e) {
      setStatus(errMessage(e));
    }
  }
  async function del(n: string) {
    try {
      await profileDelete(n);
      if (activeProfile === n) setActiveProfile(undefined);
      await refresh();
    } catch (e) {
      setStatus(errMessage(e));
    }
  }

  return (
    <div className="mx-auto max-w-xl p-6">
      <PanelTitle
        title="Profiles"
        desc="Save named configurations. Changes auto-save to the active profile."
      />

      <div className="mb-4 flex gap-2">
        <input
          className="min-w-0 flex-1 rounded-md border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-100 outline-none focus:border-emerald-500"
          placeholder="New profile name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && create()}
        />
        <Button variant="primary" onClick={create} disabled={!name.trim()}>
          New
        </Button>
      </div>

      {activeProfile ? (
        <p className="mb-3 text-xs text-emerald-300">
          Active: ● {activeProfile} — edits save automatically.
        </p>
      ) : (
        <p className="mb-3 text-xs text-amber-400">
          No active profile. Edits aren't saved until you create or load one.
        </p>
      )}

      <div className="flex flex-col gap-1">
        {profiles.length === 0 && <p className="text-sm text-zinc-500">No profiles yet.</p>}
        {profiles.map((p) => (
          <div
            key={p}
            className={
              "flex items-center justify-between rounded-md border px-3 py-2 " +
              (activeProfile === p ? "border-emerald-500 bg-emerald-500/10" : "border-zinc-800")
            }
          >
            <button className="flex-1 truncate text-left text-sm text-zinc-200" onClick={() => load(p)}>
              {activeProfile === p ? "● " : ""}
              {p}
            </button>
            <div className="flex gap-2">
              <Button onClick={() => load(p)}>Load</Button>
              <Button variant="danger" onClick={() => del(p)}>
                Delete
              </Button>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-6 border-t border-zinc-800 pt-4">
        <Button onClick={() => { reset(); setStatus("Config reset to defaults"); }}>
          Reset Config
        </Button>
      </div>

      {status && <p className="mt-3 text-xs text-zinc-500">{status}</p>}
    </div>
  );
}
