// Top menu bar. Profiles / Configuration / Control are pages; Help is a popup.
import { useState, type ReactNode } from "react";
import { openUrl } from "@tauri-apps/plugin-opener";
import { binaryUpdate, errMessage } from "../lib/ipc";

const SCRCPY_REPO = "https://github.com/Genymobile/scrcpy";
const APP_REPO = "https://github.com/rifqioe/scrcpy-studio";
const APP_RELEASES = `${APP_REPO}/releases`;

const PAGES: { id: string; label: string }[] = [
  { id: "profiles", label: "Profiles" },
  { id: "config", label: "Configuration" },
  { id: "control", label: "Control" },
];

export function MenuBar({
  page,
  onNavigate,
}: {
  page: string;
  onNavigate: (page: string) => void;
}) {
  const [helpOpen, setHelpOpen] = useState(false);
  const [note, setNote] = useState<string>();

  async function updateScrcpy() {
    setHelpOpen(false);
    setNote("Checking scrcpy…");
    try {
      const bin = await binaryUpdate();
      setNote(`scrcpy ${bin.version} (latest)`);
    } catch (e) {
      setNote(errMessage(e));
    }
  }

  const link = (url: string) => {
    openUrl(url);
    setHelpOpen(false);
  };

  return (
    <div className="relative z-40 flex items-center gap-0.5 border-b border-zinc-800 bg-zinc-950 px-2 py-1 text-sm">
      {PAGES.map((p) => (
        <button
          key={p.id}
          onClick={() => onNavigate(p.id)}
          className={
            "rounded px-3 py-1 transition-colors " +
            (page === p.id ? "bg-emerald-600 text-white" : "text-zinc-300 hover:bg-zinc-800")
          }
        >
          {p.label}
        </button>
      ))}

      <div className="relative">
        <button
          onClick={() => setHelpOpen((o) => !o)}
          className={
            "rounded px-3 py-1 hover:bg-zinc-800 " +
            (helpOpen ? "bg-zinc-800 text-zinc-100" : "text-zinc-300")
          }
        >
          Help
        </button>
        {helpOpen && (
          <>
            <div className="fixed inset-0 z-30" onClick={() => setHelpOpen(false)} />
            <div className="absolute left-0 top-full z-40 mt-1 min-w-[14rem] rounded-md border border-zinc-700 bg-zinc-900 py-1 shadow-xl">
              <Item onClick={() => { onNavigate("shortcuts"); setHelpOpen(false); }}>
                Keyboard shortcuts
              </Item>
              <div className="my-1 h-px bg-zinc-800" />
              <Item onClick={updateScrcpy}>Update scrcpy</Item>
              <Item onClick={() => link(SCRCPY_REPO)}>About scrcpy ↗</Item>
              <div className="my-1 h-px bg-zinc-800" />
              <Item onClick={() => link(APP_RELEASES)}>Update scrcpy-studio ↗</Item>
              <Item onClick={() => link(APP_REPO)}>About scrcpy-studio ↗</Item>
            </div>
          </>
        )}
      </div>

      {note && <span className="ml-auto truncate pl-2 text-[11px] text-zinc-500">{note}</span>}
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
