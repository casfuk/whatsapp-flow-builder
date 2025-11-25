"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { SidebarLayout } from "@/app/components/SidebarLayout";
import { Chat, Device, ChatFilters } from "@/app/types/chat";
import { ChatFiltersPopover } from "@/app/components/chat/ChatFiltersPopover";
import { NewChatModal } from "@/app/components/chat/NewChatModal";
import { ChatThreadEnhanced } from "@/app/components/chat/ChatThreadEnhanced";
import { ChatActionsMenu } from "@/app/components/chat/ChatActionsMenu";

type Tab = "all" | "mine" | "favorites";

export default function ChatsPage() {
  const [chats, setChats] = useState<Chat[]>([]);
  const [devices, setDevices] = useState<Device[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<Tab>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedChatId, setSelectedChatId] = useState<string | null>(null);
  const [showFilters, setShowFilters] = useState(false);
  const [showNewChatModal, setShowNewChatModal] = useState(false);

  const [filters, setFilters] = useState<ChatFilters>({
    tab: "all",
    status: "all",
    deviceId: undefined,
    tags: [],
    search: undefined,
    sort: "name_asc",
  });

  // Fetch devices on mount
  useEffect(() => {
    fetchDevices();
  }, []);

  // Fetch chats when filters change
  useEffect(() => {
    fetchChats();
  }, [filters]);

  // Auto-refresh chats every 5 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      fetchChats();
    }, 5000);

    return () => clearInterval(interval);
  }, [filters]);

  // Debounced search
  useEffect(() => {
    const timer = setTimeout(() => {
      setFilters(prev => ({ ...prev, search: searchQuery || undefined }));
    }, 300);

    return () => clearTimeout(timer);
  }, [searchQuery]);

  const fetchDevices = async () => {
    try {
      const response = await fetch("/api/devices");
      const data = await response.json();

      // Handle both array and object responses defensively
      const devicesArray = Array.isArray(data)
        ? data
        : Array.isArray(data?.devices)
          ? data.devices
          : [];

      setDevices(devicesArray);
    } catch (error) {
      console.error("Failed to fetch devices:", error);
      setDevices([]);
    }
  };

  const fetchChats = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();

      params.append("tab", filters.tab);
      params.append("status", filters.status);
      if (filters.deviceId) params.append("deviceId", filters.deviceId);
      if (filters.tags && filters.tags.length > 0) {
        params.append("tags", filters.tags.join(","));
      }
      if (filters.search) params.append("search", filters.search);
      if (filters.sort) params.append("sort", filters.sort);

      const response = await fetch(`/api/chats?${params.toString()}`);
      const data = await response.json();

      // Handle both array and object responses defensively
      const chatsArray = Array.isArray(data)
        ? data
        : Array.isArray(data?.chats)
          ? data.chats
          : [];

      setChats(chatsArray);
    } catch (error) {
      console.error("Failed to fetch chats:", error);
      setChats([]);
    } finally {
      setLoading(false);
    }
  };

  const handleTabChange = (tab: Tab) => {
    setActiveTab(tab);
    setFilters(prev => ({ ...prev, tab }));
  };

  const handleFilterChange = (newFilters: Partial<ChatFilters>) => {
    setFilters(prev => ({ ...prev, ...newFilters }));
  };

  const handleSortChange = (sort: "name_asc" | "name_desc") => {
    setFilters(prev => ({ ...prev, sort }));
  };

  const handleNewChatCreated = (chat: Chat) => {
    setChats(prev => [chat, ...prev]);
    setSelectedChatId(chat.id);
    setShowNewChatModal(false);
  };

  const handleChatDeleted = (chatId: string) => {
    setChats(prev => prev.filter(c => c.id !== chatId));
    if (selectedChatId === chatId) {
      setSelectedChatId(null);
    }
  };

  const handleChatCleared = (chatId: string) => {
    // Refresh the chat list to show updated message count
    fetchChats();
  };

  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleTimeString("es-ES", {
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const getInitials = (name: string | null, phone: string) => {
    if (name) {
      return name
        .split(" ")
        .map(n => n[0])
        .join("")
        .toUpperCase()
        .substring(0, 2);
    }
    return phone.substring(0, 2);
  };

  const selectedChat = chats.find(c => c.id === selectedChatId);

  return (
    <SidebarLayout>
      <div className="flex h-screen bg-gray-50">
        {/* Left Panel - Chat List */}
        <div className="w-96 bg-white border-r border-gray-200 flex flex-col">
          {/* Header with Tabs */}
          <div className="border-b border-gray-200">
            <div className="flex items-center justify-between px-4 py-3">
              <h1 className="text-xl font-bold text-gray-900">Chats</h1>
              <button
                onClick={() => setShowNewChatModal(true)}
                className="w-10 h-10 bg-[#6D5BFA] text-white rounded-full flex items-center justify-center hover:bg-[#5B4BD8] transition-colors shadow-sm"
                title="Nuevo chat"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
              </button>
            </div>

            {/* Tabs */}
            <div className="flex px-4">
              <button
                onClick={() => handleTabChange("all")}
                className={`flex-1 py-3 text-sm font-medium border-b-2 transition-colors ${
                  activeTab === "all"
                    ? "border-[#6D5BFA] text-[#6D5BFA]"
                    : "border-transparent text-gray-500 hover:text-gray-700"
                }`}
              >
                Todos
              </button>
              <button
                onClick={() => handleTabChange("mine")}
                className={`flex-1 py-3 text-sm font-medium border-b-2 transition-colors ${
                  activeTab === "mine"
                    ? "border-[#6D5BFA] text-[#6D5BFA]"
                    : "border-transparent text-gray-500 hover:text-gray-700"
                }`}
              >
                Mis chats
              </button>
              <button
                onClick={() => handleTabChange("favorites")}
                className={`flex-1 py-3 text-sm font-medium border-b-2 transition-colors ${
                  activeTab === "favorites"
                    ? "border-[#6D5BFA] text-[#6D5BFA]"
                    : "border-transparent text-gray-500 hover:text-gray-700"
                }`}
              >
                Favoritos
              </button>
            </div>
          </div>

          {/* Search and Actions */}
          <div className="p-4 space-y-3 border-b border-gray-200">
            <div className="flex gap-2">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Buscar contactos"
                className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#6D5BFA] focus:border-transparent"
              />
              <button
                onClick={() => setShowFilters(!showFilters)}
                className={`p-2 border rounded-lg transition-colors ${
                  showFilters
                    ? "bg-[#6D5BFA] text-white border-[#6D5BFA]"
                    : "border-gray-300 text-gray-600 hover:bg-gray-50"
                }`}
                title="Filtrar"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
                </svg>
              </button>
              <button
                onClick={() => handleSortChange(filters.sort === "name_asc" ? "name_desc" : "name_asc")}
                className="p-2 border border-gray-300 rounded-lg text-gray-600 hover:bg-gray-50 transition-colors"
                title={filters.sort === "name_asc" ? "Ordenar Z-A" : "Ordenar A-Z"}
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  {filters.sort === "name_asc" ? (
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4h13M3 8h9m-9 4h6m4 0l4-4m0 0l4 4m-4-4v12" />
                  ) : (
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4h13M3 8h9m-9 4h9m5-4v12m0 0l-4-4m4 4l4-4" />
                  )}
                </svg>
              </button>
            </div>

            {/* Filters Popover */}
            {showFilters && (
              <ChatFiltersPopover
                filters={filters}
                devices={devices}
                onFilterChange={handleFilterChange}
              />
            )}
          </div>

          {/* Chat List */}
          <div className="flex-1 overflow-y-auto">
            {loading ? (
              <div className="flex items-center justify-center h-32">
                <div className="text-gray-500 text-sm">Cargando...</div>
              </div>
            ) : chats.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-32 px-4">
                <p className="text-gray-500 text-sm text-center">
                  {searchQuery ? "No se encontraron conversaciones" : "No hay conversaciones aún"}
                </p>
              </div>
            ) : (
              <div className="divide-y divide-gray-100">
                {chats.map((chat) => (
                  <button
                    key={chat.id}
                    onClick={() => setSelectedChatId(chat.id)}
                    className={`w-full px-4 py-3 flex items-start gap-3 hover:bg-gray-50 transition-colors ${
                      selectedChatId === chat.id ? "bg-gray-100" : ""
                    }`}
                  >
                    {/* Avatar */}
                    <div className="flex-shrink-0 w-12 h-12 rounded-full bg-[#6D5BFA] flex items-center justify-center text-white font-semibold">
                      {getInitials(chat.contactName, chat.phoneNumber)}
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0 text-left">
                      <div className="flex items-start justify-between mb-1">
                        <div className="flex-1 min-w-0">
                          <h3 className="text-sm font-semibold text-gray-900 truncate">
                            {chat.contactName || chat.phoneNumber}
                          </h3>
                          {!chat.assignedToUserId && (
                            <span className="text-xs text-gray-500">Sin asignar</span>
                          )}
                        </div>
                        <span className="text-xs text-gray-500 ml-2 flex-shrink-0">
                          {formatTime(chat.lastMessageAt)}
                        </span>
                      </div>
                      <div className="flex items-center justify-between">
                        <p className="text-sm text-gray-600 truncate">
                          {chat.lastMessagePreview || ""}
                        </p>
                        {chat.unreadCount > 0 && (
                          <span className="ml-2 flex-shrink-0 w-5 h-5 bg-[#6D5BFA] text-white text-xs rounded-full flex items-center justify-center">
                            {chat.unreadCount}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* More Actions Menu */}
                    <ChatActionsMenu
                      chatId={chat.id}
                      onDelete={() => handleChatDeleted(chat.id)}
                      onClear={() => handleChatCleared(chat.id)}
                    />
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right Panel - Chat View */}
        <div className="flex-1 bg-gray-50">
          {selectedChat ? (
            <ChatThreadEnhanced
              chatId={selectedChat.id}
              contactName={selectedChat.contactName}
              phoneNumber={selectedChat.phoneNumber}
            />
          ) : (
            <div className="flex items-center justify-center h-full">
              <div className="text-center">
                <svg
                  className="w-24 h-24 mx-auto text-gray-300 mb-4"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={1.5}
                    d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
                  />
                </svg>
                <h2 className="text-xl font-semibold text-gray-700 mb-2">
                  Seleccione una conversación para iniciar
                </h2>
                <p className="text-gray-500">
                  Elige un chat de la izquierda para ver los mensajes
                </p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* New Chat Modal */}
      {showNewChatModal && (
        <NewChatModal
          devices={devices}
          onClose={() => setShowNewChatModal(false)}
          onChatCreated={handleNewChatCreated}
        />
      )}
    </SidebarLayout>
  );
}
