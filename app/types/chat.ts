export type ChatStatus = "open" | "closed";

export interface Device {
  id: string;
  alias: string | null;
  phoneNumber: string;
  isOnline: boolean;
}

export interface Chat {
  id: string;
  contactName: string | null;
  phoneNumber: string;
  lastMessagePreview: string | null;
  lastMessageAt: string;
  unreadCount: number;
  status: ChatStatus;
  tags: string[];
  deviceId: string;
  isFavorite: boolean;
  assignedToUserId: string | null;
}

export interface CreateChatRequest {
  deviceId: string;
  phoneNumber: string;
}

export interface ChatFilters {
  tab: "all" | "mine" | "favorites";
  status: "unread" | "open" | "closed" | "all";
  deviceId?: string;
  tags?: string[];
  search?: string;
  sort?: "name_asc" | "name_desc";
}
