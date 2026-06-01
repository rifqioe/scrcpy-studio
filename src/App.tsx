import { useEffect, useState, type ReactNode } from "react";
import { DeviceDock } from "./components/DeviceDock";
import { SessionList } from "./components/SessionList";
import { CommandBar } from "./components/CommandBar";
import { ShortcutsPanel } from "./components/ShortcutsPanel";
import {
  AudioPanel,
  CameraPanel,
  ConnectPanel,
  ControlPanel,
  GeneralPanel,
  InputPanel,
  RecordPanel,
  VideoPanel,
  VirtualDisplayPanel,
  WindowPanel,
} from "./components/panels";
import { AppsPanel } from "./components/AppsPanel";
import { MenuBar } from "./components/MenuBar";
import { binaryCurrent } from "./lib/ipc";

// The visible configuration tab bar.
const TAB_BAR: { id: string; label: string }[] = [
  { id: "connect", label: "Connect" },
  { id: "video", label: "Video" },
  { id: "audio", label: "Audio" },
  { id: "camera", label: "Camera" },
  { id: "control", label: "Control" },
  { id: "input", label: "Input" },
  { id: "window", label: "Window" },
  { id: "record", label: "Record" },
  { id: "vdisplay", label: "Virtual display" },
  { id: "other", label: "Other" },
];

// All views, including ones reached via the menu bar (Apps, Shortcuts).
const VIEWS: Record<string, ReactNode> = {
  connect: <ConnectPanel />,
  video: <VideoPanel />,
  audio: <AudioPanel />,
  camera: <CameraPanel />,
  control: <ControlPanel />,
  input: <InputPanel />,
  window: <WindowPanel />,
  record: <RecordPanel />,
  vdisplay: <VirtualDisplayPanel />,
  other: <GeneralPanel />,
  apps: <AppsPanel />,
  shortcuts: <ShortcutsPanel />,
};

export default function App() {
  const [active, setActive] = useState("connect");
  const [hasBinary, setHasBinary] = useState(false);

  useEffect(() => {
    const check = () =>
      binaryCurrent()
        .then((b) => setHasBinary(!!b))
        .catch(() => undefined);
    check();
    const t = setInterval(check, 3000);
    return () => clearInterval(t);
  }, []);

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-zinc-900 text-zinc-100">
      <DeviceDock />

      <main className="flex min-w-0 flex-1 flex-col">
        <MenuBar onSelectTab={setActive} />

        <nav className="flex gap-1 overflow-x-auto border-b border-zinc-800 bg-zinc-950 px-2 py-1.5">
          {TAB_BAR.map((t) => (
            <button
              key={t.id}
              onClick={() => setActive(t.id)}
              className={
                "whitespace-nowrap rounded-md px-3 py-1.5 text-sm transition-colors " +
                (active === t.id
                  ? "bg-emerald-600 text-white"
                  : "text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200")
              }
            >
              {t.label}
            </button>
          ))}
        </nav>

        <div className="flex-1 overflow-y-auto p-5">{VIEWS[active] ?? VIEWS.connect}</div>

        <CommandBar hasBinary={hasBinary} />
      </main>

      <SessionList />
    </div>
  );
}
