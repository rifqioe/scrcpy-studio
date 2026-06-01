import { useState, type ReactNode } from "react";
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
} from "../components/panels";

const SECTIONS: { id: string; label: string; el: ReactNode }[] = [
  { id: "connect", label: "Connect", el: <ConnectPanel /> },
  { id: "video", label: "Video", el: <VideoPanel /> },
  { id: "audio", label: "Audio", el: <AudioPanel /> },
  { id: "camera", label: "Camera", el: <CameraPanel /> },
  { id: "control", label: "Control", el: <ControlPanel /> },
  { id: "input", label: "Input", el: <InputPanel /> },
  { id: "window", label: "Window", el: <WindowPanel /> },
  { id: "record", label: "Record", el: <RecordPanel /> },
  { id: "vdisplay", label: "Virtual display", el: <VirtualDisplayPanel /> },
  { id: "other", label: "Other", el: <GeneralPanel /> },
];

export function ConfigurationPage() {
  const [section, setSection] = useState("connect");
  return (
    <div className="flex h-full min-h-0">
      <nav className="flex w-40 shrink-0 flex-col gap-0.5 overflow-y-auto border-r border-zinc-800 bg-zinc-950/60 p-2">
        {SECTIONS.map((s) => (
          <button
            key={s.id}
            onClick={() => setSection(s.id)}
            className={
              "rounded-md px-3 py-1.5 text-left text-sm transition-colors " +
              (section === s.id
                ? "bg-emerald-600 text-white"
                : "text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200")
            }
          >
            {s.label}
          </button>
        ))}
      </nav>
      <div className="flex-1 overflow-y-auto p-5">
        {SECTIONS.find((s) => s.id === section)?.el}
      </div>
    </div>
  );
}
