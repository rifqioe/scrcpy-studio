import { create } from "zustand";
import { defaultArgs, type ScrcpyArgs } from "../lib/types";

type Section = Exclude<keyof ScrcpyArgs, "extraArgs">;

interface ConfigState {
  args: ScrcpyArgs;
  /** Name of the profile changes are auto-saved to, if any. */
  activeProfile?: string;
  /** Patch a single section (e.g. video) with partial fields. */
  patch: <K extends Section>(section: K, value: Partial<ScrcpyArgs[K]>) => void;
  setExtraArgs: (value: string) => void;
  setArgs: (args: ScrcpyArgs) => void;
  setActiveProfile: (name?: string) => void;
  reset: () => void;
}

export const useConfig = create<ConfigState>((set) => ({
  args: defaultArgs(),
  activeProfile: undefined,
  patch: (section, value) =>
    set((state) => ({
      args: { ...state.args, [section]: { ...state.args[section], ...value } },
    })),
  setExtraArgs: (value) =>
    set((state) => ({ args: { ...state.args, extraArgs: value || undefined } })),
  setArgs: (args) => set({ args }),
  setActiveProfile: (name) => set({ activeProfile: name }),
  reset: () => set({ args: defaultArgs(), activeProfile: undefined }),
}));
