import { useEffect, useRef, useState } from "react";
import { DeviceDock } from "./components/DeviceDock";
import { SessionList } from "./components/SessionList";
import { CommandBar } from "./components/CommandBar";
import { ShortcutsPanel } from "./components/ShortcutsPanel";
import { MenuBar } from "./components/MenuBar";
import { ConfigurationPage } from "./pages/ConfigurationPage";
import { ControlPage } from "./pages/ControlPage";
import { ProfilesPage } from "./pages/ProfilesPage";
import { useConfig } from "./state/config";
import { binaryCurrent, profileSave } from "./lib/ipc";

export default function App() {
  const [page, setPage] = useState("config");
  const [hasBinary, setHasBinary] = useState(false);

  const args = useConfig((s) => s.args);
  const activeProfile = useConfig((s) => s.activeProfile);
  const saveTimer = useRef<number | null>(null);
  const firstRun = useRef(true);

  useEffect(() => {
    const check = () =>
      binaryCurrent()
        .then((b) => setHasBinary(!!b))
        .catch(() => undefined);
    check();
    const t = setInterval(check, 3000);
    return () => clearInterval(t);
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
      profileSave(activeProfile, args).catch(() => undefined);
    }, 600);
  }, [args, activeProfile]);

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-zinc-900 text-zinc-100">
      <DeviceDock />

      <main className="flex min-w-0 flex-1 flex-col">
        <MenuBar page={page} onNavigate={setPage} />

        <div className="min-h-0 flex-1">
          {page === "config" && <ConfigurationPage />}
          {page === "control" && <ControlPage />}
          {page === "profiles" && <ProfilesPage />}
          {page === "shortcuts" && (
            <div className="h-full overflow-y-auto p-5">
              <ShortcutsPanel />
            </div>
          )}
        </div>

        <CommandBar hasBinary={hasBinary} />
      </main>

      <SessionList />
    </div>
  );
}
