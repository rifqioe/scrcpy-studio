// Top application menu bar with dropdown menus.
import { useState, type ReactNode } from "react";
import { openUrl } from "@tauri-apps/plugin-opener";
import { binaryUpdate, errMessage } from "../lib/ipc";

const SCRCPY_DOCS = "https://github.com/Genymobile/scrcpy/tree/master/doc";
const APP_REPO = "https://github.com/rifqioe/scrcpy-studio";

// Panels reachable from the Command menu (must match the tab ids in App.tsx).
const COMMAND_PANELS: { id: string; label: string }[] = [
  { id: "connect", label: "Connect" },
  { id: "video", label: "Video" },
  { id: "audio", label: "Audio" },
  { id: "camera", label: "Camera" },
  { id: "control", label: "Control" },
  { id: "input", label: "Input" },
  { id: "window", label: "Window" },
  { id: "record", label: "Record" },
  { id: "vdisplay", label: "Virtual display" },
  { id: "general", label: "General" },
];

export function MenuBar({ onSelectTab }: { onSelectTab: (id: string) => void }) {
  const [open, setOpen] = useState<string | null>(null);
  const [note, setNote] = useState<string>();

  const toggle = (id: string) => setOpen((o) => (o === id ? null : id));
  const close = () => setOpen(null);

  const select = (tab: string) => {
    onSelectTab(tab);
    close();
  };

  async function updateScrcpy() {
    close();
    setNote("Updating scrcpy…");
    try {
      const bin = await binaryUpdate();
      setNote(`scrcpy updated to ${bin.version}`);
    } catch (e) {
      setNote(errMessage(e));
    }
  }

  return (
    <div className="relative z-40 flex items-center gap-0.5 border-b border-zinc-800 bg-zinc-950 px-2 py-1 text-sm">
      {open && <div className="fixed inset-0 z-30" onClick={close} />}

      <Menu id="command" label="Command" open={open} onToggle={toggle}>
        {COMMAND_PANELS.map((p) => (
          <Item key={p.id} onClick={() => select(p.id)}>
            {p.label}
          </Item>
        ))}
      </Menu>

      <button
        className="rounded px-2.5 py-1 text-zinc-300 hover:bg-zinc-800"
        onClick={() => select("apps")}
      >
        Apps
      </button>

      <Menu id="settings" label="Settings" open={open} onToggle={toggle}>
        <Item onClick={updateScrcpy}>Update scrcpy</Item>
      </Menu>

      <Menu id="help" label="Help" open={open} onToggle={toggle}>
        <Item onClick={() => select("shortcuts")}>Keyboard shortcuts</Item>
        <Item onClick={() => { openUrl(SCRCPY_DOCS); close(); }}>scrcpy documentation ↗</Item>
        <Item onClick={() => { openUrl(APP_REPO); close(); }}>scrcpy-studio on GitHub ↗</Item>
        <Item onClick={() => { openUrl(`${APP_REPO}#readme`); close(); }}>scrcpy-studio docs ↗</Item>
      </Menu>

      {note && <span className="ml-auto truncate text-[11px] text-zinc-500">{note}</span>}
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
        <div className="absolute left-0 top-full z-40 mt-1 min-w-[12rem] rounded-md border border-zinc-700 bg-zinc-900 py-1 shadow-xl">
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
