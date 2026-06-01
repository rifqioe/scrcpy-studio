import { useEffect, useState } from "react";
import { useSessions } from "../state/sessions";
import {
  onSessionExit,
  onSessionLog,
  stopSession,
  errMessage,
} from "../lib/ipc";
import { openControlWindow } from "../lib/controlWindow";
import { Button } from "./ui";

export function SessionList() {
  const { sessions, logs, appendLog, remove, refresh } = useSessions();
  const [open, setOpen] = useState<number | null>(null);
  const [status, setStatus] = useState<string>();

  useEffect(() => {
    refresh();
    const unlistenLog = onSessionLog((e) => appendLog(e.id, { stream: e.stream, line: e.line }));
    const unlistenExit = onSessionExit((e) => remove(e.id));
    return () => {
      unlistenLog.then((f) => f());
      unlistenExit.then((f) => f());
    };
  }, [appendLog, remove, refresh]);

  async function stop(id: number) {
    try {
      await stopSession(id);
      remove(id);
    } catch (e) {
      setStatus(errMessage(e));
    }
  }

  return (
    <aside className="flex h-full w-80 shrink-0 flex-col border-l border-zinc-800 bg-zinc-950">
      <div className="border-b border-zinc-800 px-3 py-2">
        <h3 className="text-sm font-semibold text-zinc-200">
          Sessions {sessions.length > 0 && <span className="text-zinc-500">({sessions.length})</span>}
        </h3>
      </div>
      <div className="flex-1 overflow-y-auto">
        {sessions.length === 0 && (
          <p className="p-3 text-xs text-zinc-500">No running mirrors.</p>
        )}
        {sessions.map((s) => (
          <div key={s.id} className="border-b border-zinc-900">
            <div className="flex items-center justify-between gap-2 px-3 py-2">
              <button
                className="min-w-0 flex-1 text-left"
                onClick={() => setOpen(open === s.id ? null : s.id)}
              >
                <div className="text-xs font-medium text-zinc-200">Session #{s.id}</div>
                <div className="truncate font-mono text-[10px] text-zinc-500">{s.command}</div>
              </button>
              <div className="flex shrink-0 gap-1">
                <Button
                  onClick={() =>
                    openControlWindow(s.serial ?? "").catch((e) => setStatus(errMessage(e)))
                  }
                  title="Open device controls for this session"
                >
                  Controls
                </Button>
                <Button variant="danger" onClick={() => stop(s.id)}>
                  Stop
                </Button>
              </div>
            </div>
            {open === s.id && (
              <pre className="max-h-48 overflow-auto bg-black px-3 py-2 font-mono text-[10px] leading-relaxed text-zinc-400">
                {(logs[s.id] ?? []).map((l, i) => (
                  <div key={i} className={l.stream === "stderr" ? "text-amber-400" : ""}>
                    {l.line}
                  </div>
                ))}
                {(logs[s.id] ?? []).length === 0 && <span className="text-zinc-600">waiting for output…</span>}
              </pre>
            )}
          </div>
        ))}
      </div>
      {status && <p className="border-t border-zinc-800 px-3 py-2 text-[11px] text-red-400">{status}</p>}
    </aside>
  );
}
