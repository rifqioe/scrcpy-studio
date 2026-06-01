import { useState } from "react";
import { AppsPanel } from "../components/AppsPanel";
import { PanelTitle } from "../components/ui";

const SECTIONS = [
  { id: "apps", label: "Apps" },
  { id: "vcam", label: "Virtual camera" },
];

function VirtualCameraPanel() {
  return (
    <div>
      <PanelTitle title="Virtual camera" desc="Use the device camera as a PC webcam." />
      <div className="rounded-md border border-zinc-800 bg-zinc-900/40 p-4 text-sm text-zinc-400">
        <p className="mb-2 text-amber-400">Planned — not available yet on Windows.</p>
        <p>
          scrcpy can only output a virtual camera natively on Linux (<code>--v4l2-sink</code>).
          On Windows it needs a virtual-camera driver such as OBS Virtual Camera, fed by scrcpy
          with <code>--video-source=camera</code>. Integration is planned.
        </p>
      </div>
    </div>
  );
}

export function ControlPage() {
  const [section, setSection] = useState("apps");
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
        {section === "apps" ? <AppsPanel /> : <VirtualCameraPanel />}
      </div>
    </div>
  );
}
