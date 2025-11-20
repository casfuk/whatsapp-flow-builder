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
      // Ensure data is always an array to prevent .map() crashes
      const safeDevices = Array.isArray(data) ? data : [];
      set({ devices: safeDevices, loading: false });
    } catch (error) {
      set({
        devices: [], // Reset to empty array on error to prevent .map() crashes
        error: error instanceof Error ? error.message : "Unknown error",
        loading: false,
      });
    }
  },
}));
