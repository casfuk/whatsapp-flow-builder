import { create } from "zustand";

export interface Device {
  id: string;
  name: string;
  phoneNumber?: string;
  status?: string;
}

interface DevicesStore {
  devices: Device[];
  loading: boolean;
  error: string | null;
  fetchDevices: () => Promise<void>;
}

export const useDevicesStore = create<DevicesStore>((set) => ({
  devices: [],
  loading: false,
  error: null,
  fetchDevices: async () => {
    set({ loading: true, error: null });
    try {
      const response = await fetch("/api/devices");
      if (!response.ok) {
        throw new Error("Failed to fetch devices");
      }
      const data = await response.json();

      // Handle both array and object responses defensively
      const devicesArray = Array.isArray(data)
        ? data
        : Array.isArray(data?.devices)
          ? data.devices
          : [];

      set({ devices: devicesArray, loading: false });
    } catch (error) {
      set({
        devices: [],
        error: error instanceof Error ? error.message : "Unknown error",
        loading: false,
      });
    }
  },
}));
