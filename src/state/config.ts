import { create } from "zustand";
import { defaultArgs, type ScrcpyArgs } from "../lib/types";

type Section = Exclude<keyof ScrcpyArgs, "extraArgs">;

interface ConfigState {
  args: ScrcpyArgs;
  /** Patch a single section (e.g. video) with partial fields. */
  patch: <K extends Section>(section: K, value: Partial<ScrcpyArgs[K]>) => void;
  setExtraArgs: (value: string) => void;
  setArgs: (args: ScrcpyArgs) => void;
  reset: () => void;
}

export const useConfig = create<ConfigState>((set) => ({
  args: defaultArgs(),
  patch: (section, value) =>
    set((state) => ({
      args: { ...state.args, [section]: { ...state.args[section], ...value } },
    })),
  setExtraArgs: (value) =>
    set((state) => ({ args: { ...state.args, extraArgs: value || undefined } })),
  setArgs: (args) => set({ args }),
  reset: () => set({ args: defaultArgs() }),
}));
