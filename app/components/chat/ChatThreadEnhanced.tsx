"use client";

import { useState, useEffect, useRef } from "react";
import { Device } from "@/app/types/chat";

interface Message {
  id: string;
  chatId: string;
  sender: "agent" | "contact";
  text: string;
  status: string;
  createdAt: string;
  metadata?: string; // JSON string with interactive message details
}

interface Contact {
  id: string;
  name: string | null;
  phone: string;
  email: string | null;
  profileImageUrl: string | null;
  notes: string | null;
  assignedAdminId: string | null;
  tags: Array<{ id: string; name: string; color: string }>;
  customValues: Array<{
    id: string;
    value: string;
    fieldDef: { id: string; name: string; type: string };
  }>;
}

interface AdminUser {
  id: string;
  name: string;
}

interface ChatThreadEnhancedProps {
  chatId: string;
  contactName: string | null;
  phoneNumber: string;
  onClose?: () => void;
}

export function ChatThreadEnhanced({
  chatId,
  contactName: initialContactName,
  phoneNumber,
  onClose,
}: ChatThreadEnhancedProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [contact, setContact] = useState<Contact | null>(null);
  const [devices, setDevices] = useState<Device[]>([]);
  const [adminUsers, setAdminUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [messageText, setMessageText] = useState("");
  const [selectedDeviceId, setSelectedDeviceId] = useState<string>("");
  const [showNotesPanel, setShowNotesPanel] = useState(true);
  const [localNotes, setLocalNotes] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const notesTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Fetch contact, messages, devices, and admin users on mount
  useEffect(() => {
    fetchContact();
    fetchMessages();
    fetchDevices();
    fetchAdminUsers();
    markAsRead();

    // Set up auto-refresh every 3 seconds
    const interval = setInterval(() => {
      fetchMessages(true);
      fetchContact(true);
    }, 3000);

    return () => clearInterval(interval);
  }, [chatId]);

  // Update local notes when contact changes
  useEffect(() => {
    if (contact) {
      setLocalNotes(contact.notes || "");
    }
  }, [contact]);

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const fetchContact = async (silent = false) => {
    try {
      // Find contact by phone number
      const response = await fetch(`/api/contacts?search=${encodeURIComponent(phoneNumber)}`);
      const data = await response.json();

      // Handle both array and object responses defensively
      const contactsArray = Array.isArray(data)
        ? data
        : Array.isArray(data?.contacts)
          ? data.contacts
          : [];

      if (contactsArray.length > 0) {
        setContact(contactsArray[0]);
      }
    } catch (error) {
      console.error("Failed to fetch contact:", error);
      setContact(null);
    }
  };

  const fetchMessages = async (silent = false) => {
    try {
      if (!silent) setLoading(true);
      const response = await fetch(`/api/chats/${chatId}/messages`);
      const data = await response.json();

      // Handle both array and object responses defensively
      const messagesArray = Array.isArray(data)
        ? data
        : Array.isArray(data?.messages)
          ? data.messages
          : [];

      setMessages(messagesArray);
    } catch (error) {
      console.error("Failed to fetch messages:", error);
      setMessages([]);
    } finally {
      if (!silent) setLoading(false);
    }
  };

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

      // Set first device as default
      if (devicesArray.length > 0) {
        setSelectedDeviceId(devicesArray[0].id);
      }
    } catch (error) {
      console.error("Failed to fetch devices:", error);
      setDevices([]);
    }
  };

  const fetchAdminUsers = async () => {
    try {
      // For now, create mock admin users
      // TODO: Replace with actual API call when admin users endpoint is ready
      setAdminUsers([
        { id: "admin-1", name: "David" },
        { id: "admin-2", name: "María" },
        { id: "admin-3", name: "Carlos" },
      ]);
    } catch (error) {
      console.error("Failed to fetch admin users:", error);
    }
  };

  const markAsRead = async () => {
    try {
      await fetch(`/api/chats/${chatId}/read`, { method: "PATCH" });
    } catch (error) {
      console.error("Failed to mark as read:", error);
    }
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  const handleAssignAdmin = async (adminId: string) => {
    if (!contact) return;

    try {
      await fetch(`/api/contacts/${contact.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ assignedAdminId: adminId || null }),
      });

      // Update local state
      setContact({ ...contact, assignedAdminId: adminId });
    } catch (error) {
      console.error("Failed to assign admin:", error);
    }
  };

  const handleNotesChange = (notes: string) => {
    setLocalNotes(notes);

    // Debounce save
    if (notesTimeoutRef.current) {
      clearTimeout(notesTimeoutRef.current);
    }

    notesTimeoutRef.current = setTimeout(async () => {
      if (contact) {
        try {
          await fetch(`/api/contacts/${contact.id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ notes }),
          });
        } catch (error) {
          console.error("Failed to save notes:", error);
        }
      }
    }, 1000);
  };

  const insertFormatting = (format: "bold" | "italic" | "strikethrough") => {
    if (!textareaRef.current) return;

    const textarea = textareaRef.current;
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selectedText = messageText.substring(start, end);

    let formattedText = "";
    switch (format) {
      case "bold":
        formattedText = `*${selectedText}*`;
        break;
      case "italic":
        formattedText = `_${selectedText}_`;
        break;
      case "strikethrough":
        formattedText = `~${selectedText}~`;
        break;
    }

    const newText =
      messageText.substring(0, start) + formattedText + messageText.substring(end);
    setMessageText(newText);

    // Restore cursor position
    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(start + 1, start + 1 + selectedText.length);
    }, 0);
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!messageText.trim() || sending) return;

    try {
      setSending(true);

      const response = await fetch(`/api/chats/${chatId}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: messageText }),
      });

      if (!response.ok) throw new Error("Failed to send message");

      const newMessage = await response.json();
      setMessages((prev) => [...prev, newMessage]);
      setMessageText("");
      setTimeout(scrollToBottom, 100);
    } catch (error) {
      console.error("Failed to send message:", error);
      alert("Error al enviar el mensaje");
    } finally {
      setSending(false);
    }
  };

  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleTimeString("es-ES", {
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    if (date.toDateString() === today.toDateString()) {
      return "Hoy";
    } else if (date.toDateString() === yesterday.toDateString()) {
      return "Ayer";
    } else {
      return date.toLocaleDateString("es-ES", {
        day: "numeric",
        month: "short",
        year: "numeric",
      });
    }
  };

  const groupedMessages = messages.reduce((acc, message) => {
    const date = new Date(message.createdAt).toDateString();
    if (!acc[date]) acc[date] = [];
    acc[date].push(message);
    return acc;
  }, {} as Record<string, Message[]>);

  const getInitials = (name: string | null, phone: string) => {
    if (name) {
      return name
        .split(" ")
        .map((n) => n[0])
        .join("")
        .toUpperCase()
        .substring(0, 2);
    }
    return phone.substring(phone.length - 2);
  };

  const assignedAdmin = adminUsers.find((u) => u.id === contact?.assignedAdminId);

  return (
    <div className="flex h-full bg-gray-50">
      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col">
        {/* Header */}
        <div className="bg-white border-b border-gray-200 px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              {/* Avatar */}
              {contact?.profileImageUrl ? (
                <img
                  src={contact.profileImageUrl}
                  alt={contact.name || phoneNumber}
                  className="w-12 h-12 rounded-full"
                />
              ) : (
                <div className="w-12 h-12 rounded-full bg-[#6D5BFA] flex items-center justify-center text-white font-semibold">
                  {getInitials(contact?.name || null, phoneNumber)}
                </div>
              )}

              {/* Contact Info */}
              <div>
                <h2 className="text-lg font-semibold text-gray-900">
                  {contact?.name || phoneNumber}
                </h2>
                <p className="text-sm text-gray-500">{phoneNumber}</p>
              </div>
            </div>

            {/* Admin Assignment */}
            <div className="flex items-center gap-3">
              <select
                value={contact?.assignedAdminId || ""}
                onChange={(e) => handleAssignAdmin(e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#6D5BFA] focus:border-transparent"
              >
                <option value="">Sin asignar</option>
                {adminUsers.map((admin) => (
                  <option key={admin.id} value={admin.id}>
                    {admin.name}
                  </option>
                ))}
              </select>

              {onClose && (
                <button
                  onClick={onClose}
                  className="text-gray-400 hover:text-gray-600"
                  title="Cerrar"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-6 py-4">
          {loading ? (
            <div className="flex items-center justify-center h-full">
              <div className="text-gray-500 text-sm">Cargando mensajes...</div>
            </div>
          ) : messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full">
              <svg
                className="w-16 h-16 text-gray-300 mb-3"
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
              <p className="text-gray-500 text-sm">No hay mensajes aún</p>
            </div>
          ) : (
            <div className="space-y-4">
              {Object.entries(groupedMessages).map(([date, msgs]) => (
                <div key={date}>
                  <div className="flex items-center justify-center mb-4">
                    <div className="bg-gray-200 text-gray-600 text-xs px-3 py-1 rounded-full">
                      {formatDate(msgs[0].createdAt)}
                    </div>
                  </div>
                  <div className="space-y-2">
                    {msgs.map((message) => (
                      <div
                        key={message.id}
                        className={`flex ${
                          message.sender === "agent" ? "justify-end" : "justify-start"
                        }`}
                      >
                        <div
                          className={`max-w-xs lg:max-w-md px-4 py-2 rounded-lg ${
                            message.sender === "agent"
                              ? "bg-[#6D5BFA] text-white"
                              : "bg-white border border-gray-200 text-gray-900"
                          }`}
                        >
                          <p className="text-sm whitespace-pre-wrap break-words">
                            {(() => {
                              // For interactive messages, show the button title (what user sees)
                              // instead of the button ID (what engine uses)
                              if (message.metadata) {
                                try {
                                  const metadata = JSON.parse(message.metadata);
                                  if (metadata.buttonTitle) {
                                    return metadata.buttonTitle; // e.g., "document"
                                  }
                                  if (metadata.listItemTitle) {
                                    return metadata.listItemTitle;
                                  }
                                } catch (e) {
                                  // If metadata parsing fails, fall back to text
                                }
                              }
                              return message.text; // For text messages or fallback
                            })()}
                          </p>
                          <div
                            className={`text-xs mt-1 flex items-center gap-1 ${
                              message.sender === "agent"
                                ? "text-purple-200 justify-end"
                                : "text-gray-500"
                            }`}
                          >
                            <span>{formatTime(message.createdAt)}</span>
                            {message.sender === "agent" && (
                              <span>
                                {message.status === "sent" && "✓"}
                                {message.status === "delivered" && "✓✓"}
                                {message.status === "read" && <span className="text-blue-300">✓✓</span>}
                                {message.status === "failed" && "⚠️"}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
              <div ref={messagesEndRef} />
            </div>
          )}
        </div>

        {/* Composer */}
        <div className="bg-white border-t border-gray-200 px-6 py-4">
          {/* Device Selector and Formatting */}
          <div className="flex items-center gap-2 mb-3">
            <select
              value={selectedDeviceId}
              onChange={(e) => setSelectedDeviceId(e.target.value)}
              className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#6D5BFA] focus:border-transparent"
              title="Buscar dispositivo"
            >
              {devices.map((device) => (
                <option key={device.id} value={device.id}>
                  {device.isOnline ? "🟢" : "⚫"} {device.alias || `Device ${device.id.slice(-4)}`}
                </option>
              ))}
            </select>

            <div className="flex items-center gap-1 ml-2">
              <button
                type="button"
                onClick={() => insertFormatting("bold")}
                className="p-2 hover:bg-gray-100 rounded"
                title="Negrita"
              >
                <strong className="text-sm">B</strong>
              </button>
              <button
                type="button"
                onClick={() => insertFormatting("italic")}
                className="p-2 hover:bg-gray-100 rounded"
                title="Cursiva"
              >
                <em className="text-sm">I</em>
              </button>
              <button
                type="button"
                onClick={() => insertFormatting("strikethrough")}
                className="p-2 hover:bg-gray-100 rounded"
                title="Tachado"
              >
                <s className="text-sm">S</s>
              </button>
            </div>
          </div>

          {/* Message Input */}
          <form onSubmit={handleSendMessage} className="flex gap-3">
            <textarea
              ref={textareaRef}
              value={messageText}
              onChange={(e) => setMessageText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  handleSendMessage(e);
                }
              }}
              placeholder="Escribe un mensaje..."
              className="flex-1 px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#6D5BFA] focus:border-transparent resize-none"
              rows={2}
              disabled={sending}
            />
            <button
              type="submit"
              disabled={!messageText.trim() || sending}
              className="px-6 py-2.5 bg-[#6D5BFA] text-white rounded-lg hover:bg-[#5B4BD8] transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed self-end"
            >
              {sending ? (
                <svg className="animate-spin h-5 w-5" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                  />
                </svg>
              ) : (
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                </svg>
              )}
            </button>
          </form>
        </div>
      </div>

      {/* Right Sidebar - Notes and Info */}
      {showNotesPanel && (
        <div className="w-80 bg-white border-l border-gray-200 overflow-y-auto">
          <div className="p-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-gray-900">Información del contacto</h3>
              <button
                onClick={() => setShowNotesPanel(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Notes */}
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Notas del contacto
              </label>
              <textarea
                value={localNotes}
                onChange={(e) => handleNotesChange(e.target.value)}
                placeholder="Añade notas sobre este contacto..."
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#6D5BFA] focus:border-transparent resize-none"
                rows={4}
              />
              <p className="text-xs text-gray-500 mt-1">
                Las notas se guardan automáticamente
              </p>
            </div>

            {/* Tags */}
            {contact && contact.tags.length > 0 && (
              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Tags
                </label>
                <div className="flex flex-wrap gap-2">
                  {contact.tags.map((tag) => (
                    <span
                      key={tag.id}
                      className="px-2 py-1 rounded text-xs font-medium text-white"
                      style={{ backgroundColor: tag.color }}
                    >
                      {tag.name}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Custom Fields */}
            {contact && contact.customValues.length > 0 && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Campos personalizados
                </label>
                <div className="space-y-2">
                  {contact.customValues.map((cv) => (
                    <div key={cv.id} className="text-sm">
                      <span className="text-gray-600">{cv.fieldDef.name}:</span>{" "}
                      <span className="text-gray-900 font-medium">{cv.value}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Assigned Admin */}
            {assignedAdmin && (
              <div className="mt-6 pt-6 border-t border-gray-200">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Asignado a
                </label>
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-full bg-[#6D5BFA] flex items-center justify-center text-white text-sm font-semibold">
                    {assignedAdmin.name.substring(0, 2).toUpperCase()}
                  </div>
                  <span className="text-sm text-gray-900">{assignedAdmin.name}</span>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Toggle Notes Panel Button (when hidden) */}
      {!showNotesPanel && (
        <button
          onClick={() => setShowNotesPanel(true)}
          className="absolute top-4 right-4 p-2 bg-white border border-gray-300 rounded-lg shadow-sm hover:bg-gray-50"
          title="Mostrar información"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </button>
      )}
    </div>
  );
}
