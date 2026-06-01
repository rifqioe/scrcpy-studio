import { create } from "zustand";
import { listSessions } from "../lib/ipc";
import type { SessionInfo } from "../lib/types";

export interface LogLine {
  stream: "stdout" | "stderr";
  line: string;
}

interface SessionState {
  sessions: SessionInfo[];
  logs: Record<number, LogLine[]>;
  add: (s: SessionInfo) => void;
  remove: (id: number) => void;
  appendLog: (id: number, line: LogLine) => void;
  refresh: () => Promise<void>;
}

const MAX_LINES = 500;

export const useSessions = create<SessionState>((set) => ({
  sessions: [],
  logs: {},
  add: (s) =>
    set((state) => ({
      sessions: [...state.sessions.filter((x) => x.id !== s.id), s],
      logs: { ...state.logs, [s.id]: state.logs[s.id] ?? [] },
    })),
  remove: (id) =>
    set((state) => ({ sessions: state.sessions.filter((s) => s.id !== id) })),
  appendLog: (id, line) =>
    set((state) => {
      const existing = state.logs[id] ?? [];
      const next = [...existing, line].slice(-MAX_LINES);
      return { logs: { ...state.logs, [id]: next } };
    }),
  refresh: async () => {
    const sessions = await listSessions();
    set({ sessions });
  },
}));
