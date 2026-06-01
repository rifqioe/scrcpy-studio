// Top application menu bar: Profiles, Configuration, Control, Help.
import { useEffect, useRef, useState, type ReactNode } from "react";
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

const SCRCPY_REPO = "https://github.com/Genymobile/scrcpy";
const APP_REPO = "https://github.com/rifqioe/scrcpy-studio";
const APP_RELEASES = `${APP_REPO}/releases`;

const CONFIG_SECTIONS: { id: string; label: string }[] = [
  { id: "connect", label: "Connect" },
  { id: "video", label: "Video" },
  { id: "audio", label: "Audio" },
  { id: "camera", label: "Camera" },
  { id: "control", label: "Control" },
  { id: "input", label: "Input" },
  { id: "window", label: "Window" },
  { id: "record", label: "Record" },
  { id: "vdisplay", label: "Virtual Display" },
  { id: "other", label: "Other" },
];

export function MenuBar({ onSelectTab }: { onSelectTab: (id: string) => void }) {
  const { args, setArgs, reset, activeProfile, setActiveProfile } = useConfig();
  const [open, setOpen] = useState<string | null>(null);
  const [note, setNote] = useState<string>();
  const [profiles, setProfiles] = useState<string[]>([]);
  const [name, setName] = useState("");
  const saveTimer = useRef<number | null>(null);
  const firstRun = useRef(true);

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

  // Auto-save parameter changes to the active profile (debounced).
  useEffect(() => {
    if (firstRun.current) {
      firstRun.current = false;
      return;
    }
    if (!activeProfile) return;
    if (saveTimer.current) window.clearTimeout(saveTimer.current);
    saveTimer.current = window.setTimeout(() => {
      profileSave(activeProfile, args)
        .then(() => setNote(`Saved to "${activeProfile}"`))
        .catch((e) => setNote(errMessage(e)));
    }, 600);
  }, [args, activeProfile]);

  async function newProfile() {
    const n = name.trim();
    if (!n) {
      setNote("Enter a profile name first");
      return;
    }
    try {
      await profileSave(n, args);
      setActiveProfile(n);
      setNote(`Created "${n}" — changes auto-save here`);
      await refreshProfiles();
      close();
    } catch (e) {
      setNote(errMessage(e));
    }
  }

  async function loadProfile(n: string) {
    try {
      setArgs(await profileLoad(n));
      setActiveProfile(n);
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
      if (activeProfile === n) setActiveProfile(undefined);
      await refreshProfiles();
    } catch (e) {
      setNote(errMessage(e));
    }
  }

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

  const go = (tab: string) => {
    onSelectTab(tab);
    close();
  };
  const link = (url: string) => {
    openUrl(url);
    close();
  };

  return (
    <div className="relative z-40 flex items-center gap-0.5 border-b border-zinc-800 bg-zinc-950 px-2 py-1 text-sm">
      {open && <div className="fixed inset-0 z-30" onClick={close} />}

      <Menu id="profiles" label={`Profiles${activeProfile ? `: ${activeProfile}` : ""}`} open={open} onToggle={toggle}>
        <div className="flex gap-1 px-2 py-1.5">
          <input
            className="min-w-0 flex-1 rounded border border-zinc-700 bg-zinc-900 px-2 py-1 text-xs text-zinc-100 outline-none focus:border-emerald-500"
            placeholder="new profile name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && newProfile()}
          />
          <button
            onClick={newProfile}
            disabled={!name.trim()}
            className="rounded bg-emerald-600 px-2 text-xs text-white hover:bg-emerald-500 disabled:opacity-40"
          >
            New
          </button>
        </div>
        {!activeProfile && (
          <p className="px-3 pb-1 text-[10px] text-amber-400/80">
            No active profile — changes aren't saved. Create one above.
          </p>
        )}
        {profiles.length > 0 && <div className="my-1 h-px bg-zinc-800" />}
        {profiles.map((p) => (
          <div
            key={p}
            className={
              "flex items-center justify-between px-3 py-1 hover:bg-zinc-800 " +
              (activeProfile === p ? "text-emerald-300" : "text-zinc-300")
            }
          >
            <button className="flex-1 truncate text-left text-sm" onClick={() => loadProfile(p)}>
              {activeProfile === p ? "● " : ""}
              {p}
            </button>
            <button className="ml-2 text-zinc-600 hover:text-red-400" onClick={() => deleteProfile(p)} title="Delete">
              ×
            </button>
          </div>
        ))}
        <div className="my-1 h-px bg-zinc-800" />
        <Item onClick={() => { reset(); setName(""); close(); setNote("Config reset"); }}>Reset Config</Item>
      </Menu>

      <Menu id="config" label="Configuration" open={open} onToggle={toggle}>
        {CONFIG_SECTIONS.map((s) => (
          <Item key={s.id} onClick={() => go(s.id)}>
            {s.label}
          </Item>
        ))}
      </Menu>

      <Menu id="control" label="Control" open={open} onToggle={toggle}>
        <Item onClick={() => go("apps")}>Apps</Item>
        <button
          disabled
          title="On Windows this needs an OBS virtual camera; native support is Linux-only (v4l2). Planned."
          className="block w-full cursor-not-allowed px-3 py-1.5 text-left text-sm text-zinc-600"
        >
          Virtual camera (planned)
        </button>
      </Menu>

      <Menu id="help" label="Help" open={open} onToggle={toggle}>
        <Item onClick={() => go("shortcuts")}>Keyboard shortcuts</Item>
        <div className="my-1 h-px bg-zinc-800" />
        <Item onClick={updateScrcpy}>Update scrcpy</Item>
        <Item onClick={() => link(`${SCRCPY_REPO}#scrcpy-v30`)}>About scrcpy ↗</Item>
        <div className="my-1 h-px bg-zinc-800" />
        <Item onClick={() => link(APP_RELEASES)}>Update scrcpy-studio ↗</Item>
        <Item onClick={() => link(APP_REPO)}>About scrcpy-studio ↗</Item>
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
