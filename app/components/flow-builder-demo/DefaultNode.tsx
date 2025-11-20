"use client";

import { Handle, Position, NodeProps } from "reactflow";

export function DefaultNode({ data, selected, id }: NodeProps) {
  const label = data.label || "Acción";
  const onHandleClick = data.onHandleClick;

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
      <div className="flex items-center gap-2 mb-2">
        <div className="w-8 h-8 rounded-lg bg-gray-100 flex items-center justify-center">
          <svg
            className="w-4 h-4 text-gray-600"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M13 10V3L4 14h7v7l9-11h-7z"
            />
          </svg>
        </div>
        <div>
          <div className="font-semibold text-gray-900">{label}</div>
          <div className="text-xs text-gray-500">Acción</div>
        </div>
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
