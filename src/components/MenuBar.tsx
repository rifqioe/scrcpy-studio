// Top application menu bar: App, Profiles, Help.
import { useEffect, useState, type ReactNode } from "react";
import { openUrl } from "@tauri-apps/plugin-opener";
import { useConfig } from "../state/config";
import {
  binaryUpdate,
  profileDelete,
  profileList,
  profileLoad,
  profileSave,
  errMessage,
} from "../lib/ipc";

const SCRCPY_DOCS = "https://github.com/Genymobile/scrcpy/tree/master/doc";
const APP_REPO = "https://github.com/rifqioe/scrcpy-studio";

export function MenuBar({ onSelectTab }: { onSelectTab: (id: string) => void }) {
  const { args, setArgs, reset } = useConfig();
  const [open, setOpen] = useState<string | null>(null);
  const [note, setNote] = useState<string>();
  const [profiles, setProfiles] = useState<string[]>([]);
  const [name, setName] = useState("");

  const toggle = (id: string) => setOpen((o) => (o === id ? null : id));
  const close = () => setOpen(null);

  async function refreshProfiles() {
    try {
      setProfiles(await profileList());
    } catch {
      /* ignore */
    }
  }
  useEffect(() => {
    refreshProfiles();
  }, []);

  async function updateScrcpy() {
    close();
    setNote("Checking scrcpy…");
    try {
      const bin = await binaryUpdate();
      setNote(`scrcpy ${bin.version} (latest)`);
    } catch (e) {
      setNote(errMessage(e));
    }
  }

  async function saveProfile() {
    if (!name.trim()) return;
    try {
      await profileSave(name, args);
      setNote(`Saved profile "${name}"`);
      await refreshProfiles();
    } catch (e) {
      setNote(errMessage(e));
    }
  }
  async function loadProfile(n: string) {
    try {
      setArgs(await profileLoad(n));
      setName(n);
      setNote(`Loaded "${n}"`);
      close();
    } catch (e) {
      setNote(errMessage(e));
    }
  }
  async function deleteProfile(n: string) {
    try {
      await profileDelete(n);
      await refreshProfiles();
    } catch (e) {
      setNote(errMessage(e));
    }
  }

  return (
    <div className="relative z-40 flex items-center gap-0.5 border-b border-zinc-800 bg-zinc-950 px-2 py-1 text-sm">
      {open && <div className="fixed inset-0 z-30" onClick={close} />}

      <Menu id="app" label="App" open={open} onToggle={toggle}>
        <Item onClick={updateScrcpy}>Update scrcpy</Item>
        <Item onClick={() => { openUrl(APP_REPO); close(); }}>About scrcpy-studio ↗</Item>
      </Menu>

      <Menu id="profiles" label="Profiles" open={open} onToggle={toggle}>
        <div className="flex gap-1 px-2 py-1.5">
          <input
            className="min-w-0 flex-1 rounded border border-zinc-700 bg-zinc-900 px-2 py-1 text-xs text-zinc-100 outline-none focus:border-emerald-500"
            placeholder="profile name"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <button
            onClick={saveProfile}
            disabled={!name.trim()}
            className="rounded bg-emerald-600 px-2 text-xs text-white hover:bg-emerald-500 disabled:opacity-40"
          >
            Save
          </button>
        </div>
        {profiles.length > 0 && <div className="my-1 h-px bg-zinc-800" />}
        {profiles.map((p) => (
          <div key={p} className="flex items-center justify-between px-3 py-1 hover:bg-zinc-800">
            <button className="flex-1 truncate text-left text-sm text-zinc-300" onClick={() => loadProfile(p)}>
              {p}
            </button>
            <button className="ml-2 text-zinc-600 hover:text-red-400" onClick={() => deleteProfile(p)} title="Delete">
              ×
            </button>
          </div>
        ))}
        <div className="my-1 h-px bg-zinc-800" />
        <Item onClick={() => { reset(); setName(""); close(); setNote("Config reset"); }}>Reset config</Item>
      </Menu>

      <Menu id="help" label="Help" open={open} onToggle={toggle}>
        <Item onClick={() => { onSelectTab("shortcuts"); close(); }}>Keyboard shortcuts</Item>
        <Item onClick={() => { openUrl(SCRCPY_DOCS); close(); }}>scrcpy documentation ↗</Item>
        <Item onClick={() => { openUrl(APP_REPO); close(); }}>scrcpy-studio on GitHub ↗</Item>
        <Item onClick={() => { openUrl(`${APP_REPO}#readme`); close(); }}>scrcpy-studio docs ↗</Item>
      </Menu>

      {note && <span className="ml-auto truncate pl-2 text-[11px] text-zinc-500">{note}</span>}
    </div>
  );
}

function Menu({
  id,
  label,
  open,
  onToggle,
  children,
}: {
  id: string;
  label: string;
  open: string | null;
  onToggle: (id: string) => void;
  children: ReactNode;
}) {
  return (
    <div className="relative">
      <button
        className={
          "rounded px-2.5 py-1 hover:bg-zinc-800 " +
          (open === id ? "bg-zinc-800 text-zinc-100" : "text-zinc-300")
        }
        onClick={() => onToggle(id)}
      >
        {label}
      </button>
      {open === id && (
        <div className="absolute left-0 top-full z-40 mt-1 min-w-[14rem] rounded-md border border-zinc-700 bg-zinc-900 py-1 shadow-xl">
          {children}
        </div>
      )}
    </div>
  );
}

function Item({ onClick, children }: { onClick: () => void; children: ReactNode }) {
  return (
    <button
      onClick={onClick}
      className="block w-full px-3 py-1.5 text-left text-sm text-zinc-300 hover:bg-zinc-800 hover:text-zinc-100"
    >
      {children}
    </button>
  );
}
