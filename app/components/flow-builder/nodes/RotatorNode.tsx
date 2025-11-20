"use client";

import { Handle, Position, NodeProps } from "reactflow";
import { useState } from "react";
import { NodeWrapper } from "../NodeWrapper";

type SelectionMode = "random" | "sequential";

type RotatorOption = {
  id: string;
  label: string;
  weight: number; // 0–100 for random mode
};

type RotatorNodeData = {
  mode?: SelectionMode;
  options?: RotatorOption[];
  onChange?: (partial: Partial<RotatorNodeData>) => void;
  onDuplicate?: (nodeId: string) => void;
  onDelete?: (nodeId: string) => void;
};

export function RotatorNode({ data, selected, id }: NodeProps<RotatorNodeData>) {
  const [mode, setMode] = useState<SelectionMode>(data.mode || "random");
  const [options, setOptions] = useState<RotatorOption[]>(
    data.options?.length ? data.options : []
  );

  const handleModeChange = (newMode: SelectionMode) => {
    setMode(newMode);
    if (data.onChange) {
      data.onChange({ mode: newMode });
    }
  };

  const handleAddOption = () => {
    const newOption: RotatorOption = {
      id: `option-${Date.now()}`,
      label: "",
      weight: mode === "random" ? 50 : 0,
    };
    const updatedOptions = [...options, newOption];
    setOptions(updatedOptions);
    if (data.onChange) {
      data.onChange({ options: updatedOptions });
    }
  };

  const handleRemoveOption = (optionId: string) => {
    const updatedOptions = options.filter((opt) => opt.id !== optionId);
    setOptions(updatedOptions);
    if (data.onChange) {
      data.onChange({ options: updatedOptions });
    }
  };

  const handleOptionChange = (optionId: string, field: keyof RotatorOption, value: string | number) => {
    const updatedOptions = options.map((opt) =>
      opt.id === optionId ? { ...opt, [field]: value } : opt
    );
    setOptions(updatedOptions);
    if (data.onChange) {
      data.onChange({ options: updatedOptions });
    }
  };

  return (
    <NodeWrapper nodeId={id} onDuplicate={data.onDuplicate} onDelete={data.onDelete}>
      <Handle
        type="target"
        position={Position.Left}
        className="w-3 h-3 border-2 border-gray-300 bg-white"
      />

      <div
        className={`rounded-2xl border bg-white shadow-sm w-[400px] px-5 py-4 flex flex-col gap-3 transition-all ${
          selected ? "border-[#5B5FEF] border-2 shadow-md" : "border-[#E2E4F0]"
        }`}
      >
        {/* Header */}
        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-full bg-[#8B5CF6] text-white text-sm">
            🔄
          </div>
          <span className="text-sm font-semibold text-[#2C2F4A]">Rotador</span>
        </div>

        {/* Tipo de selección */}
        <div className="flex flex-col gap-2">
          <span className="text-xs font-semibold text-[#2C2F4A]">Tipo de selección</span>

          <div className="flex flex-col gap-2">
            {/* Aleatorio */}
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="radio"
                name="mode"
                checked={mode === "random"}
                onChange={() => handleModeChange("random")}
                onClick={(e) => e.stopPropagation()}
                className="w-4 h-4 text-[#5B5FEF] focus:ring-[#5B5FEF]"
              />
              <span className="text-sm text-[#2C2F4A]">Aleatorio</span>
            </label>

            {/* Secuencial */}
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="radio"
                name="mode"
                checked={mode === "sequential"}
                onChange={() => handleModeChange("sequential")}
                onClick={(e) => e.stopPropagation()}
                className="w-4 h-4 text-[#5B5FEF] focus:ring-[#5B5FEF]"
              />
              <span className="text-sm text-[#2C2F4A]">Secuencial, uno por uno</span>
            </label>
          </div>
        </div>

        {/* Descriptive text */}
        {mode === "random" && (
          <p className="text-xs text-[#656889] leading-relaxed">
            Indique la probabilidad de elegir la opción. Cuanto mayor sea el porcentaje,
            mayores serán las posibilidades de elegir esta opción. Los porcentajes deben
            sumar el 100%
          </p>
        )}

        {/* Options list */}
        {options.length > 0 && (
          <div className="flex flex-col gap-2 max-h-[200px] overflow-y-auto pr-1">
            {options.map((option) => (
              <div key={option.id} className="flex flex-wrap items-center gap-2">
                <input
                  type="text"
                  value={option.label}
                  onChange={(e) => handleOptionChange(option.id, "label", e.target.value)}
                  onClick={(e) => e.stopPropagation()}
                  onMouseDown={(e) => e.stopPropagation()}
                  placeholder="Nombre de la opción"
                  className="flex-1 min-w-[140px] px-3 py-2 text-sm border border-[#E2E4F0] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#5B5FEF]"
                />

                {mode === "random" && (
                  <input
                    type="number"
                    min="0"
                    max="100"
                    value={option.weight}
                    onChange={(e) => handleOptionChange(option.id, "weight", parseInt(e.target.value) || 0)}
                    onClick={(e) => e.stopPropagation()}
                    onMouseDown={(e) => e.stopPropagation()}
                    placeholder="%"
                    className="w-20 px-3 py-2 text-sm border border-[#E2E4F0] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#5B5FEF]"
                  />
                )}

                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleRemoveOption(option.id);
                  }}
                  className="shrink-0 p-2 text-red-600 hover:text-red-700 hover:bg-red-50 rounded-lg transition-colors"
                  title="Eliminar opción"
                >
                  🗑
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Agregar nueva opción */}
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            handleAddOption();
          }}
          className="w-full py-2.5 text-[#10B981] bg-[#10B981]/10 hover:bg-[#10B981]/20 rounded-xl transition-colors font-medium text-sm flex items-center justify-center gap-2"
        >
          <svg
            className="w-4 h-4"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 4v16m8-8H4"
            />
          </svg>
          Agregar nueva opción
        </button>
      </div>

      <Handle
        type="source"
        position={Position.Right}
        className="w-3 h-3 border-2 border-gray-300 bg-white"
      />
    </NodeWrapper>
  );
}
