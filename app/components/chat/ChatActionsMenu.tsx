"use client";

import { useState, useRef, useEffect } from "react";

interface ChatActionsMenuProps {
  chatId: string;
  onDelete: () => void;
  onClear: () => void;
}

export function ChatActionsMenu({ chatId, onDelete, onClear }: ChatActionsMenuProps) {
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Close menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isOpen]);

  const handleDelete = async () => {
    if (!confirm("¿Estás seguro de que deseas eliminar este chat? Esta acción no se puede deshacer.")) {
      return;
    }

    try {
      const response = await fetch(`/api/chats/${chatId}`, {
        method: "DELETE",
      });

      if (response.ok) {
        onDelete();
        setIsOpen(false);
      } else {
        alert("Error al eliminar el chat");
      }
    } catch (error) {
      console.error("Error deleting chat:", error);
      alert("Error al eliminar el chat");
    }
  };

  const handleClear = async () => {
    if (!confirm("¿Estás seguro de que deseas vaciar este chat? Se eliminarán todos los mensajes pero el chat permanecerá.")) {
      return;
    }

    try {
      const response = await fetch(`/api/chats/${chatId}/clear`, {
        method: "POST",
      });

      if (response.ok) {
        onClear();
        setIsOpen(false);
      } else {
        alert("Error al vaciar el chat");
      }
    } catch (error) {
      console.error("Error clearing chat:", error);
      alert("Error al vaciar el chat");
    }
  };

  return (
    <div className="relative" ref={menuRef}>
      <button
        className="flex-shrink-0 text-gray-400 hover:text-gray-600 p-1 rounded hover:bg-gray-100 transition-colors"
        onClick={(e) => {
          e.stopPropagation();
          setIsOpen(!isOpen);
        }}
        title="Más acciones"
      >
        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
          <path d="M10 6a2 2 0 110-4 2 2 0 010 4zM10 12a2 2 0 110-4 2 2 0 010 4zM10 18a2 2 0 110-4 2 2 0 010 4z" />
        </svg>
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-1 w-48 bg-white rounded-lg shadow-lg border border-gray-200 py-1 z-50">
          <button
            onClick={(e) => {
              e.stopPropagation();
              handleClear();
            }}
            className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-100 flex items-center gap-2"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
            Vaciar chat
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              handleDelete();
            }}
            className="w-full px-4 py-2 text-left text-sm text-red-600 hover:bg-red-50 flex items-center gap-2"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
            Eliminar chat
          </button>
        </div>
      )}
    </div>
  );
}
