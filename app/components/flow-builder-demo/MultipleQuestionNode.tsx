"use client";

import { Handle, Position, NodeProps } from "reactflow";
import { WysiwygEditor } from "@/app/components/flow-builder/WysiwygEditor";

export interface MultipleQuestionData {
  message: string;
  options: { id: string; label: string }[];
  onChange?: (nodeId: string, updates: any) => void;
  onHandleClick?: (nodeId: string, e: React.MouseEvent) => void;
}

export function MultipleQuestionNode({ data, selected, id }: NodeProps<MultipleQuestionData>) {
  const message = data.message || "";
  const options = data.options || [];
  const onChange = data.onChange;
  const onHandleClick = data.onHandleClick;

  const handleMessageChange = (value: string) => {
    if (onChange) {
      onChange(id, { message: value });
    }
  };

  const handleOptionChange = (optionId: string, newLabel: string) => {
    if (onChange) {
      const updatedOptions = options.map((opt) =>
        opt.id === optionId ? { ...opt, label: newLabel } : opt
      );
      onChange(id, { options: updatedOptions });
    }
  };

  const handleAddOption = () => {
    if (onChange) {
      const newOption = {
        id: `option-${Date.now()}`,
        label: `Opción ${options.length + 1}`,
      };
      onChange(id, { options: [...options, newOption] });
    }
  };

  const handleRemoveOption = (optionId: string) => {
    if (onChange) {
      const updatedOptions = options.filter((opt) => opt.id !== optionId);
      onChange(id, { options: updatedOptions });
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
          <div className="font-semibold text-gray-900">Pregunta múltiple</div>
          <div className="text-xs text-gray-500">Con botones</div>
        </div>
      </div>

      {/* Message Input */}
      <div className="mb-3">
        <label className="block text-xs font-medium text-gray-600 mb-1">
          Mensaje:
        </label>
        <WysiwygEditor
          value={message}
          onChange={handleMessageChange}
          placeholder="Escribe tu pregunta aquí..."
          rows={3}
        />
      </div>

      {/* Options/Buttons */}
      <div className="mb-3">
        <label className="block text-xs font-medium text-gray-600 mb-2">
          Opciones:
        </label>
        <div className="space-y-2">
          {options.map((option, index) => (
            <div key={option.id} className="flex gap-2 items-center">
              <div className="flex-1 bg-white border-2 border-[#6D5BFA] rounded-lg px-3 py-2 flex items-center justify-center">
                <input
                  type="text"
                  value={option.label}
                  onChange={(e) => handleOptionChange(option.id, e.target.value)}
                  className="w-full text-center text-xs font-medium text-[#6D5BFA] bg-transparent outline-none"
                  placeholder={`Opción ${index + 1}`}
                />
              </div>
              {options.length > 1 && (
                <button
                  onClick={() => handleRemoveOption(option.id)}
                  className="p-1 hover:bg-red-50 rounded transition-colors"
                  title="Eliminar opción"
                >
                  <svg
                    className="w-4 h-4 text-red-500"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M6 18L18 6M6 6l12 12"
                    />
                  </svg>
                </button>
              )}
            </div>
          ))}
        </div>

        {/* Add Option Button */}
        {options.length < 10 && (
          <button
            onClick={handleAddOption}
            className="mt-2 w-full px-3 py-2 border-2 border-dashed border-gray-300 rounded-lg text-xs text-gray-500 hover:border-[#6D5BFA] hover:text-[#6D5BFA] transition-colors flex items-center justify-center gap-1"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Agregar opción
          </button>
        )}
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
