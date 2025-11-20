"use client";

import { useState, useEffect } from "react";
import { useTagsStore } from "@/lib/stores/useTagsStore";

export interface Condition {
  type: "tag" | "weekday" | "time";
  operator: "is" | "is_not";
  value: string;
}

interface ConditionModalProps {
  open: boolean;
  initialConditions?: Condition[];
  onClose: () => void;
  onSave: (conditions: Condition[]) => void;
}

const WEEKDAYS = [
  "Lunes",
  "Martes",
  "Miércoles",
  "Jueves",
  "Viernes",
  "Sábado",
  "Domingo",
];

export function ConditionModal({
  open,
  initialConditions = [],
  onClose,
  onSave,
}: ConditionModalProps) {
  // Use tags from zustand store
  const tags = useTagsStore((s) => s.tags);
  const fetchTags = useTagsStore((s) => s.fetchTags);

  const [conditions, setConditions] = useState<Condition[]>(
    initialConditions.length > 0
      ? initialConditions
      : [{ type: "tag", operator: "is", value: "" }]
  );

  // Fetch tags when modal opens
  useEffect(() => {
    if (open) {
      fetchTags();
      setConditions(
        initialConditions.length > 0
          ? initialConditions
          : [{ type: "tag", operator: "is", value: "" }]
      );
    }
  }, [open, initialConditions, fetchTags]);

  const handleSave = () => {
    // Validate that all conditions have a value
    const hasEmptyValues = conditions.some((c) => !c.value.trim());
    if (hasEmptyValues) {
      alert("Por favor completa todas las condiciones");
      return;
    }
    onSave(conditions);
    onClose();
  };

  const addCondition = () => {
    setConditions([
      ...conditions,
      { type: "tag", operator: "is", value: "" },
    ]);
  };

  const removeCondition = (index: number) => {
    if (conditions.length === 1) {
      alert("Debe haber al menos una condición");
      return;
    }
    setConditions(conditions.filter((_, i) => i !== index));
  };

  const updateCondition = (
    index: number,
    field: keyof Condition,
    value: string
  ) => {
    const updated = [...conditions];
    updated[index] = {
      ...updated[index],
      [field]: value,
      // Reset value when type changes
      ...(field === "type" ? { value: "" } : {}),
    };
    setConditions(updated);
  };

  const renderValueDropdown = (condition: Condition, index: number) => {
    switch (condition.type) {
      case "tag":
        return (
          <select
            value={condition.value}
            onChange={(e) => updateCondition(index, "value", e.target.value)}
            className="flex-1 min-w-[120px] px-3 py-2 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#6D5BFA] focus:border-transparent text-sm"
          >
            <option value="">Seleccionar</option>
            {tags.map((tag) => (
              <option key={tag.id} value={tag.name}>
                {tag.name}
              </option>
            ))}
          </select>
        );

      case "weekday":
        return (
          <select
            value={condition.value}
            onChange={(e) => updateCondition(index, "value", e.target.value)}
            className="flex-1 min-w-[120px] px-3 py-2 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#6D5BFA] focus:border-transparent text-sm"
          >
            <option value="">Seleccionar</option>
            {WEEKDAYS.map((day) => (
              <option key={day} value={day}>
                {day}
              </option>
            ))}
          </select>
        );

      case "time":
        return (
          <input
            type="time"
            value={condition.value}
            onChange={(e) => updateCondition(index, "value", e.target.value)}
            className="flex-1 min-w-[120px] px-3 py-2 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#6D5BFA] focus:border-transparent text-sm"
          />
        );

      default:
        return null;
    }
  };

  if (!open) return null;

  return (
    <>
      {/* Overlay */}
      <div
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/20"
        onClick={onClose}
      >
        {/* Modal Card */}
        <div
          className="bg-white rounded-2xl shadow-xl w-full max-w-md max-h-[80vh] flex flex-col"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header - Fixed at top */}
          <div className="px-5 pt-4 pb-2">
            {/* Close Button */}
            <button
              onClick={onClose}
              className="absolute right-4 top-4 text-gray-400 hover:text-gray-600 transition-colors"
            >
              <svg
                className="w-5 h-5"
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

            {/* Title */}
            <h3 className="font-semibold text-lg mb-2 text-gray-900">
              Condición
            </h3>

            {/* Description */}
            <p className="text-sm text-gray-600">
              Define las condiciones que debe cumplir el contacto
            </p>
          </div>

          {/* Scrollable Body */}
          <div className="flex-1 overflow-y-auto px-5 pb-3 pt-1">
            {/* Conditions List */}
            <div className="space-y-3 mb-4">
            {conditions.map((condition, index) => (
              <div key={index} className="flex flex-wrap items-center gap-2">
                {/* Type Dropdown */}
                <select
                  value={condition.type}
                  onChange={(e) =>
                    updateCondition(
                      index,
                      "type",
                      e.target.value as Condition["type"]
                    )
                  }
                  className="flex-1 min-w-[120px] px-3 py-2 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#6D5BFA] focus:border-transparent text-sm"
                >
                  <option value="tag">Tag</option>
                  <option value="weekday">Día de la semana</option>
                  <option value="time">Hora</option>
                </select>

                {/* Operator Dropdown */}
                <select
                  value={condition.operator}
                  onChange={(e) =>
                    updateCondition(
                      index,
                      "operator",
                      e.target.value as Condition["operator"]
                    )
                  }
                  className="flex-1 min-w-[100px] px-3 py-2 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#6D5BFA] focus:border-transparent text-sm"
                >
                  <option value="is">Es</option>
                  <option value="is_not">No es</option>
                </select>

                {/* Value Dropdown/Input */}
                {renderValueDropdown(condition, index)}

                {/* Delete Button */}
                <button
                  onClick={() => removeCondition(index)}
                  className="shrink-0 p-2 text-red-600 hover:text-red-700 hover:bg-red-50 rounded-lg transition-colors"
                  title="Eliminar condición"
                >
                  <svg
                    className="w-5 h-5"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                    />
                  </svg>
                </button>
              </div>
            ))}
          </div>

            {/* Add Condition Button */}
            <button
              onClick={addCondition}
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

          {/* Footer - Fixed at bottom */}
          <div className="px-5 pt-2 pb-4 flex gap-3 justify-end border-t border-[#E4E6F2]">
            <button
              onClick={onClose}
              className="px-5 py-2.5 text-gray-700 hover:bg-gray-100 rounded-xl transition-colors font-medium"
            >
              Cancelar
            </button>
            <button
              onClick={handleSave}
              className="px-5 py-2.5 bg-[#6D5BFA] text-white rounded-xl hover:bg-[#5B4BD8] transition-colors shadow-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Guardar
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
