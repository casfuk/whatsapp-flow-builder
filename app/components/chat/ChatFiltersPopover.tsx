"use client";

import { useState, useEffect } from "react";
import { ChatFilters, Device } from "@/app/types/chat";

interface Tag {
  id: string;
  name: string;
  color: string;
}

interface ChatFiltersPopoverProps {
  filters: ChatFilters;
  devices: Device[];
  onFilterChange: (filters: Partial<ChatFilters>) => void;
}

export function ChatFiltersPopover({
  filters,
  devices,
  onFilterChange,
}: ChatFiltersPopoverProps) {
  const [tags, setTags] = useState<Tag[]>([]);
  const [selectedTags, setSelectedTags] = useState<string[]>(filters.tags || []);
  const [selectedDeviceId, setSelectedDeviceId] = useState<string | undefined>(
    filters.deviceId
  );
  const [selectedStatus, setSelectedStatus] = useState<string>(
    filters.status || "all"
  );

  useEffect(() => {
    fetchTags();
  }, []);

  const fetchTags = async () => {
    try {
      const response = await fetch("/api/tags");
      const data = await response.json();
      setTags(data || []);
    } catch (error) {
      console.error("Failed to fetch tags:", error);
    }
  };

  const handleStatusChange = (status: string) => {
    setSelectedStatus(status);
    onFilterChange({
      status: status as "unread" | "open" | "closed" | "all",
    });
  };

  const handleDeviceChange = (deviceId: string | undefined) => {
    setSelectedDeviceId(deviceId);
    onFilterChange({ deviceId });
  };

  const toggleTag = (tagId: string) => {
    const newSelectedTags = selectedTags.includes(tagId)
      ? selectedTags.filter((id) => id !== tagId)
      : [...selectedTags, tagId];

    setSelectedTags(newSelectedTags);
    onFilterChange({ tags: newSelectedTags });
  };

  const getDeviceLabel = (device: Device) => {
    if (device.alias) {
      // Extract last 4 digits of phone number for display
      const lastDigits = device.phoneNumber?.slice(-4) || device.id.slice(-4);
      return `${device.alias} (${lastDigits})`;
    }
    return `Sin alias (${device.phoneNumber?.slice(-4) || device.id.slice(-4)})`;
  };

  return (
    <div className="bg-white border border-gray-200 rounded-lg shadow-lg p-4 space-y-4">
      {/* Status Filter */}
      <div>
        <h4 className="text-sm font-semibold text-gray-700 mb-3">Estado</h4>
        <div className="space-y-2">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="radio"
              name="status"
              value="unread"
              checked={selectedStatus === "unread"}
              onChange={() => handleStatusChange("unread")}
              className="w-4 h-4 text-[#6D5BFA] focus:ring-[#6D5BFA]"
            />
            <span className="text-sm text-gray-700">
              Conversaciones no leídas
            </span>
          </label>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="radio"
              name="status"
              value="open"
              checked={selectedStatus === "open"}
              onChange={() => handleStatusChange("open")}
              className="w-4 h-4 text-[#6D5BFA] focus:ring-[#6D5BFA]"
            />
            <span className="text-sm text-gray-700">
              Conversaciones abiertas
            </span>
          </label>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="radio"
              name="status"
              value="closed"
              checked={selectedStatus === "closed"}
              onChange={() => handleStatusChange("closed")}
              className="w-4 h-4 text-[#6D5BFA] focus:ring-[#6D5BFA]"
            />
            <span className="text-sm text-gray-700">
              Conversaciones cerradas
            </span>
          </label>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="radio"
              name="status"
              value="all"
              checked={selectedStatus === "all"}
              onChange={() => handleStatusChange("all")}
              className="w-4 h-4 text-[#6D5BFA] focus:ring-[#6D5BFA]"
            />
            <span className="text-sm text-gray-700">
              Todas las conversaciones
            </span>
          </label>
        </div>
      </div>

      {/* Tags Filter */}
      <div>
        <h4 className="text-sm font-semibold text-gray-700 mb-3">Tags</h4>
        {tags.length === 0 ? (
          <p className="text-sm text-gray-500">No hay tags disponibles</p>
        ) : (
          <div className="max-h-32 overflow-y-auto space-y-2">
            {tags.map((tag) => (
              <label
                key={tag.id}
                className="flex items-center gap-2 cursor-pointer"
              >
                <input
                  type="checkbox"
                  checked={selectedTags.includes(tag.id)}
                  onChange={() => toggleTag(tag.id)}
                  className="w-4 h-4 rounded text-[#6D5BFA] focus:ring-[#6D5BFA]"
                />
                <span
                  className="px-2 py-0.5 rounded text-xs font-medium text-white"
                  style={{ backgroundColor: tag.color }}
                >
                  {tag.name}
                </span>
              </label>
            ))}
          </div>
        )}
      </div>

      {/* Device Filter */}
      <div>
        <h4 className="text-sm font-semibold text-gray-700 mb-3">
          Por dispositivo
        </h4>
        {devices.length === 0 ? (
          <p className="text-sm text-gray-500">
            No hay dispositivos conectados
          </p>
        ) : (
          <select
            value={selectedDeviceId || ""}
            onChange={(e) =>
              handleDeviceChange(e.target.value || undefined)
            }
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#6D5BFA] focus:border-transparent"
          >
            <option value="">Todos los dispositivos</option>
            {devices.map((device) => (
              <option key={device.id} value={device.id}>
                <span
                  className="inline-block w-2 h-2 rounded-full mr-2"
                  style={{
                    backgroundColor: device.isOnline ? "#10B981" : "#6B7280",
                  }}
                />
                {getDeviceLabel(device)}
              </option>
            ))}
          </select>
        )}

        {/* Device List with status dots */}
        <div className="mt-3 space-y-2">
          {devices.map((device) => (
            <button
              key={device.id}
              onClick={() =>
                handleDeviceChange(
                  selectedDeviceId === device.id ? undefined : device.id
                )
              }
              className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors ${
                selectedDeviceId === device.id
                  ? "bg-[#6D5BFA] text-white"
                  : "bg-gray-50 text-gray-700 hover:bg-gray-100"
              }`}
            >
              <span
                className="w-2 h-2 rounded-full flex-shrink-0"
                style={{
                  backgroundColor: device.isOnline ? "#10B981" : "#6B7280",
                }}
              />
              <span className="truncate">{getDeviceLabel(device)}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
