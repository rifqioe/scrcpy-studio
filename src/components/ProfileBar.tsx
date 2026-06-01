import { useEffect, useState } from "react";
import { useConfig } from "../state/config";
import {
  profileDelete,
  profileList,
  profileLoad,
  profileSave,
  errMessage,
} from "../lib/ipc";
import { Button } from "./ui";

export function ProfileBar() {
  const { args, setArgs, reset } = useConfig();
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

  async function save() {
    if (!name.trim()) return;
    try {
      await profileSave(name, args);
      setStatus(`Saved "${name}"`);
      await refresh();
    } catch (e) {
      setStatus(errMessage(e));
    }
  }

  async function load(n: string) {
    try {
      setArgs(await profileLoad(n));
      setName(n);
      setStatus(`Loaded "${n}"`);
    } catch (e) {
      setStatus(errMessage(e));
    }
  }

  async function del(n: string) {
    try {
      await profileDelete(n);
      await refresh();
      setStatus(`Deleted "${n}"`);
    } catch (e) {
      setStatus(errMessage(e));
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-2 border-b border-zinc-800 bg-zinc-950 px-3 py-2">
      <span className="text-xs font-semibold text-zinc-400">Profiles</span>
      <input
        className="w-40 rounded-md border border-zinc-700 bg-zinc-900 px-2 py-1 text-xs text-zinc-100 outline-none focus:border-emerald-500"
        placeholder="profile name"
        value={name}
        onChange={(e) => setName(e.target.value)}
      />
      <Button onClick={save} disabled={!name.trim()}>
        Save
      </Button>
      <Button variant="ghost" onClick={reset}>
        Reset
      </Button>
      <div className="flex flex-wrap gap-1.5">
        {profiles.map((p) => (
          <span key={p} className="flex items-center gap-1 rounded-md border border-zinc-800 px-2 py-0.5 text-xs">
            <button className="text-emerald-300 hover:underline" onClick={() => load(p)}>
              {p}
            </button>
            <button className="text-zinc-600 hover:text-red-400" onClick={() => del(p)} title="Delete">
              ×
            </button>
          </span>
        ))}
      </div>
      {status && <span className="ml-auto text-[11px] text-zinc-500">{status}</span>}
    </div>
  );
}
