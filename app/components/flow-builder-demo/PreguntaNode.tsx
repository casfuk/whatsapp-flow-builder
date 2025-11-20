"use client";

import { Handle, Position, NodeProps } from "reactflow";
import { WysiwygEditor } from "@/app/components/flow-builder/WysiwygEditor";

export function PreguntaNode({ data, selected, id }: NodeProps) {
  const question = data.question || "";
  const fallbackText = data.fallbackText || "";
  const saveAs = data.saveAs || "";
  const onChange = data.onChange;
  const onHandleClick = data.onHandleClick;

  const handleQuestionChange = (value: string) => {
    if (onChange) {
      onChange(id, { question: value });
    }
  };

  const handleFallbackChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (onChange) {
      onChange(id, { fallbackText: e.target.value });
    }
  };

  const handleSaveAsChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (onChange) {
      onChange(id, { saveAs: e.target.value });
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
        <div className="w-8 h-8 rounded-lg bg-purple-100 flex items-center justify-center">
          <svg
            className="w-4 h-4 text-purple-600"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
        </div>
        <div>
          <div className="font-semibold text-gray-900">Pregunta</div>
          <div className="text-xs text-gray-500">Texto libre</div>
        </div>
      </div>

      {/* Question Input */}
      <div className="mb-3">
        <WysiwygEditor
          value={question}
          onChange={handleQuestionChange}
          placeholder="¿Cuál es tu pregunta?"
          rows={3}
        />
      </div>

      {/* Fallback Text */}
      <div className="mb-3">
        <label className="block text-xs font-medium text-gray-600 mb-1">
          Texto de respaldo:
        </label>
        <input
          type="text"
          value={fallbackText}
          onChange={handleFallbackChange}
          placeholder="No entendí tu respuesta..."
          className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:border-[#6D5BFA] focus:ring-2 focus:ring-[#6D5BFA] focus:ring-opacity-20 text-xs outline-none transition-all"
        />
      </div>

      {/* Save As Field */}
      <div className="mb-0">
        <label className="block text-xs font-medium text-gray-600 mb-1">
          Guardar como:
        </label>
        <input
          type="text"
          value={saveAs}
          onChange={handleSaveAsChange}
          placeholder="nombre_variable"
          className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:border-[#6D5BFA] focus:ring-2 focus:ring-[#6D5BFA] focus:ring-opacity-20 text-xs font-mono outline-none transition-all"
        />
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
