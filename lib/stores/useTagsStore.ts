import { create } from "zustand";

export interface Tag {
  id: string;
  name: string;
  color?: string;
}

interface TagsStore {
  tags: Tag[];
  loading: boolean;
  error: string | null;
  fetchTags: () => Promise<void>;
}

export const useTagsStore = create<TagsStore>((set) => ({
  tags: [],
  loading: false,
  error: null,
  fetchTags: async () => {
    set({ loading: true, error: null });
    try {
      const response = await fetch("/api/tags");
      if (!response.ok) {
        throw new Error("Failed to fetch tags");
      }
      const data = await response.json();
      set({ tags: data, loading: false });
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : "Unknown error",
        loading: false,
      });
    }
  },
}));
