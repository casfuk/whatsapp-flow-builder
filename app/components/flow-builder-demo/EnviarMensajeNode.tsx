"use client";

import { useRef, useState } from "react";
import { Handle, Position, NodeProps } from "reactflow";
import { RichTextToolbar } from "@/app/components/flow-builder/RichTextToolbar";

type MessageType = "text" | "multimedia" | "audio" | "document" | "contact";

export function EnviarMensajeNode({ data, selected, id }: NodeProps) {
  const currentType = (data.messageType as MessageType) || "text";
  const delaySeconds = data.delaySeconds || 5;
  const onChange = data.onChange;
  const onHandleClick = data.onHandleClick;
  const textareaRef = useRef<HTMLTextAreaElement>(null!);

  // Text message data
  const textBody = data.text?.body || "";

  // Multimedia data
  const multimediaFile = data.multimedia?.fileUrl || "";
  const multimediaCaption = data.multimedia?.caption || "";

  // Audio data
  const audioFile = data.audio?.fileUrl || "";

  // Document data
  const documentFile = data.document?.fileUrl || "";

  // Contact data
  const contactPhone = data.contact?.phone || "";
  const contactName = data.contact?.name || "";
  const useConnectedNumber = data.contact?.useConnectedNumber || false;

  const handleTypeChange = (type: MessageType) => {
    if (onChange) {
      onChange(id, { messageType: type });
    }
  };

  const handleTextBodyChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    if (onChange) {
      onChange(id, { text: { body: e.target.value } });
    }
  };

  const handleTextBodyInsert = (newValue: string) => {
    if (onChange) {
      onChange(id, { text: { body: newValue } });
    }
  };

  const handleMultimediaFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && onChange) {
      // In a real app, you'd upload the file and get a URL
      // For now, just store the file name
      onChange(id, {
        multimedia: {
          fileUrl: file.name,
          caption: multimediaCaption
        }
      });
    }
  };

  const handleMultimediaCaptionChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (onChange) {
      onChange(id, {
        multimedia: {
          fileUrl: multimediaFile,
          caption: e.target.value
        }
      });
    }
  };

  const handleAudioFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && onChange) {
      onChange(id, { audio: { fileUrl: file.name } });
    }
  };

  const handleDocumentFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && onChange) {
      onChange(id, { document: { fileUrl: file.name } });
    }
  };

  const handleContactPhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (onChange) {
      onChange(id, {
        contact: {
          phone: e.target.value,
          name: contactName,
          useConnectedNumber
        }
      });
    }
  };

  const handleContactNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (onChange) {
      onChange(id, {
        contact: {
          phone: contactPhone,
          name: e.target.value,
          useConnectedNumber
        }
      });
    }
  };

  const handleUseConnectedNumberChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (onChange) {
      onChange(id, {
        contact: {
          phone: contactPhone,
          name: contactName,
          useConnectedNumber: e.target.checked
        }
      });
    }
  };

  const handleDelayChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = parseInt(e.target.value) || 5;
    const clamped = Math.max(5, Math.min(60, value));
    if (onChange) {
      onChange(id, { delaySeconds: clamped });
    }
  };

  const handleSourceClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (onHandleClick) {
      onHandleClick(id, e);
    }
  };

  return (
    <div
      className={`relative rounded-2xl bg-white shadow-sm border px-4 py-3 w-80 text-sm transition-all ${
        selected ? "border-[#6D5BFA] border-2 shadow-lg" : "border-gray-200"
      }`}
    >
      {/* Header */}
      <div className="flex items-center gap-2 mb-3">
        <div className="w-8 h-8 rounded-lg bg-blue-100 flex items-center justify-center">
          <svg
            className="w-4 h-4 text-blue-600"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
            />
          </svg>
        </div>
        <div>
          <div className="font-semibold text-gray-900">Enviar mensaje</div>
          <div className="text-xs text-gray-500 capitalize">{currentType}</div>
        </div>
      </div>

      {/* Message Type Selector */}
      <div className="mb-3">
        <label className="block text-xs font-medium text-gray-600 mb-2">
          Tipo de mensaje:
        </label>
        <div className="flex flex-wrap gap-2">
          {[
            { type: "text" as MessageType, label: "Texto", icon: "💬" },
            { type: "multimedia" as MessageType, label: "Multimedia", icon: "🖼️" },
            { type: "audio" as MessageType, label: "Audio", icon: "🎵" },
            { type: "document" as MessageType, label: "Documento", icon: "📄" },
            { type: "contact" as MessageType, label: "Contacto", icon: "👤" },
          ].map(({ type, label, icon }) => (
            <button
              key={type}
              type="button"
              onClick={() => handleTypeChange(type)}
              className={`flex-1 min-w-[60px] px-2 py-1.5 text-xs font-medium rounded-lg transition-all ${
                currentType === type
                  ? "bg-[#6D5BFA] text-white shadow-sm"
                  : "bg-gray-100 text-gray-700 hover:bg-gray-200"
              }`}
            >
              <span className="mr-1">{icon}</span>
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Text Message Input */}
      {currentType === "text" && (
        <div className="mb-3">
          <label className="block text-xs font-medium text-gray-600 mb-1">
            Mensaje:
          </label>
          <RichTextToolbar
            textareaRef={textareaRef}
            onInsert={handleTextBodyInsert}
          />
          <textarea
            ref={textareaRef}
            value={textBody}
            onChange={handleTextBodyChange}
            placeholder="Escribe un mensaje..."
            className="w-full p-3 bg-gray-50 rounded-lg border border-gray-200 focus:border-[#6D5BFA] focus:ring-2 focus:ring-[#6D5BFA] focus:ring-opacity-20 text-xs leading-relaxed resize-none outline-none transition-all text-black placeholder:text-gray-400"
            rows={4}
          />
        </div>
      )}

      {/* Multimedia Input */}
      {currentType === "multimedia" && (
        <div className="mb-3 space-y-3">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-2">
              Archivo multimedia:
            </label>
            <div className="border-2 border-dashed border-gray-300 rounded-lg p-4 text-center hover:border-[#6D5BFA] transition-colors">
              <input
                type="file"
                accept="image/*,video/*"
                onChange={handleMultimediaFileChange}
                className="hidden"
                id={`multimedia-${id}`}
              />
              <label
                htmlFor={`multimedia-${id}`}
                className="cursor-pointer flex flex-col items-center"
              >
                <svg className="w-8 h-8 text-gray-400 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                <span className="text-xs text-gray-600">Subir archivo</span>
                <span className="text-xs text-gray-400 mt-1">Máx 80 MB (API: 16 MB)</span>
                {multimediaFile && (
                  <span className="text-xs text-[#6D5BFA] mt-2 font-medium">{multimediaFile}</span>
                )}
              </label>
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">
              Pie de foto (opcional):
            </label>
            <input
              type="text"
              value={multimediaCaption}
              onChange={handleMultimediaCaptionChange}
              placeholder="Añade una descripción..."
              className="w-full px-3 py-2 text-xs border border-gray-200 rounded-lg focus:border-[#6D5BFA] focus:ring-2 focus:ring-[#6D5BFA] focus:ring-opacity-20 outline-none"
            />
          </div>
        </div>
      )}

      {/* Audio Input */}
      {currentType === "audio" && (
        <div className="mb-3 space-y-3">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-2">
              Archivo de audio:
            </label>
            <div className="border-2 border-dashed border-gray-300 rounded-lg p-4 text-center hover:border-[#6D5BFA] transition-colors">
              <input
                type="file"
                accept="audio/*"
                onChange={handleAudioFileChange}
                className="hidden"
                id={`audio-${id}`}
              />
              <label
                htmlFor={`audio-${id}`}
                className="cursor-pointer flex flex-col items-center"
              >
                <svg className="w-8 h-8 text-gray-400 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
                </svg>
                <span className="text-xs text-gray-600">Subir audio</span>
                <span className="text-xs text-gray-400 mt-1">Máx 80 MB (API: 16 MB)</span>
                {audioFile && (
                  <span className="text-xs text-[#6D5BFA] mt-2 font-medium">{audioFile}</span>
                )}
              </label>
            </div>
          </div>
          <button
            type="button"
            className="w-full px-3 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg text-xs font-medium transition-colors flex items-center justify-center gap-2"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
            </svg>
            Grabar audio
          </button>
        </div>
      )}

      {/* Document Input */}
      {currentType === "document" && (
        <div className="mb-3">
          <label className="block text-xs font-medium text-gray-600 mb-2">
            Documento:
          </label>
          <div className="border-2 border-dashed border-gray-300 rounded-lg p-4 text-center hover:border-[#6D5BFA] transition-colors">
            <input
              type="file"
              accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt"
              onChange={handleDocumentFileChange}
              className="hidden"
              id={`document-${id}`}
            />
            <label
              htmlFor={`document-${id}`}
              className="cursor-pointer flex flex-col items-center"
            >
              <svg className="w-8 h-8 text-gray-400 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              <span className="text-xs text-gray-600">Subir documento</span>
              <span className="text-xs text-gray-400 mt-1">Máx 80 MB (API: 16 MB)</span>
              {documentFile && (
                <span className="text-xs text-[#6D5BFA] mt-2 font-medium">{documentFile}</span>
              )}
            </label>
          </div>
        </div>
      )}

      {/* Contact Input */}
      {currentType === "contact" && (
        <div className="mb-3 space-y-3">
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id={`use-connected-${id}`}
              checked={useConnectedNumber}
              onChange={handleUseConnectedNumberChange}
              className="w-4 h-4 text-[#6D5BFA] border-gray-300 rounded focus:ring-[#6D5BFA]"
            />
            <label htmlFor={`use-connected-${id}`} className="text-xs text-gray-700">
              Usar número de WhatsApp conectado
            </label>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">
              Número de teléfono:
            </label>
            <input
              type="tel"
              value={contactPhone}
              onChange={handleContactPhoneChange}
              placeholder="+34 123 456 789"
              disabled={useConnectedNumber}
              className="w-full px-3 py-2 text-xs border border-gray-200 rounded-lg focus:border-[#6D5BFA] focus:ring-2 focus:ring-[#6D5BFA] focus:ring-opacity-20 outline-none disabled:bg-gray-100 disabled:text-gray-500"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">
              Nombre del contacto:
            </label>
            <input
              type="text"
              value={contactName}
              onChange={handleContactNameChange}
              placeholder="Juan Pérez"
              className="w-full px-3 py-2 text-xs border border-gray-200 rounded-lg focus:border-[#6D5BFA] focus:ring-2 focus:ring-[#6D5BFA] focus:ring-opacity-20 outline-none"
            />
          </div>
        </div>
      )}

      {/* Tiempo entre mensajes */}
      <div className="mb-3">
        <label className="block text-xs font-medium text-gray-600 mb-1">
          Tiempo entre mensaje:
        </label>
        <div className="flex items-center gap-2">
          <input
            type="number"
            value={delaySeconds}
            onChange={handleDelayChange}
            min="5"
            max="60"
            className="w-20 px-3 py-2 text-xs border border-gray-200 rounded-lg focus:border-[#6D5BFA] focus:ring-2 focus:ring-[#6D5BFA] focus:ring-opacity-20 outline-none text-center"
          />
          <span className="text-xs text-gray-600">Segundos</span>
        </div>
        <p className="text-xs text-gray-400 mt-1">Mínimo de 5 y un máximo de 60</p>
      </div>

      {/* Connection Handles */}
      <Handle
        type="target"
        position={Position.Left}
        className="w-3 h-3 border-2 border-gray-400 bg-white hover:border-[#6D5BFA] transition-colors"
      />
      <Handle
        type="source"
        position={Position.Right}
        className="w-3 h-3 border-2 border-gray-400 bg-white hover:border-[#6D5BFA] transition-colors"
      />

      {/* Add Node Button */}
      <button
        onClick={handleSourceClick}
        className="absolute -right-8 top-1/2 -translate-y-1/2 w-6 h-6 bg-[#6D5BFA] hover:bg-[#5B4BD8] text-white rounded-full flex items-center justify-center shadow-md transition-all hover:scale-110 z-10"
        title="Agregar siguiente paso"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
        </svg>
      </button>
    </div>
  );
}
