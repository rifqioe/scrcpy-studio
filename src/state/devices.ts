import { create } from "zustand";
import { listDevices, errMessage } from "../lib/ipc";
import type { Device } from "../lib/types";

interface DeviceState {
  devices: Device[];
  selected?: string;
  loading: boolean;
  error?: string;
  select: (serial?: string) => void;
  refresh: () => Promise<void>;
}

export const useDevices = create<DeviceState>((set, get) => ({
  devices: [],
  selected: undefined,
  loading: false,
  error: undefined,
  select: (serial) => set({ selected: serial }),
  refresh: async () => {
    set({ loading: true, error: undefined });
    try {
      const devices = await listDevices();
      // Keep selection if still present, else pick the first ready device.
      const current = get().selected;
      const stillThere = devices.some((d) => d.serial === current);
      const selected = stillThere
        ? current
        : devices.find((d) => d.state === "device")?.serial;
      set({ devices, selected, loading: false });
    } catch (e) {
      set({ error: errMessage(e), loading: false });
    }
  },
}));
