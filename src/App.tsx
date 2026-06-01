import { useEffect, useState } from "react";
import { DeviceDock } from "./components/DeviceDock";
import { SessionList } from "./components/SessionList";
import { ProfileBar } from "./components/ProfileBar";
import { CommandBar } from "./components/CommandBar";
import { ShortcutsPanel } from "./components/ShortcutsPanel";
import { AppsPanel } from "./components/AppsPanel";
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
import { binaryCurrent } from "./lib/ipc";

const TABS = [
  { id: "connect", label: "Connect", el: <ConnectPanel /> },
  { id: "video", label: "Video", el: <VideoPanel /> },
  { id: "audio", label: "Audio", el: <AudioPanel /> },
  { id: "camera", label: "Camera", el: <CameraPanel /> },
  { id: "control", label: "Control", el: <ControlPanel /> },
  { id: "input", label: "Input", el: <InputPanel /> },
  { id: "window", label: "Window", el: <WindowPanel /> },
  { id: "record", label: "Record", el: <RecordPanel /> },
  { id: "vdisplay", label: "Virtual display", el: <VirtualDisplayPanel /> },
  { id: "apps", label: "Apps", el: <AppsPanel /> },
  { id: "general", label: "General", el: <GeneralPanel /> },
  { id: "shortcuts", label: "Shortcuts", el: <ShortcutsPanel /> },
];

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
        <ProfileBar />

        <nav className="flex gap-1 overflow-x-auto border-b border-zinc-800 bg-zinc-950 px-2 py-1.5">
          {TABS.map((t) => (
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

        <div className="flex-1 overflow-y-auto p-5">{TABS.find((t) => t.id === active)?.el}</div>

        <CommandBar hasBinary={hasBinary} />
      </main>

      <SessionList />
    </div>
  );
}
