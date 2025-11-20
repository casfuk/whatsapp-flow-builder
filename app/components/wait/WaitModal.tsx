"use client";

import { useState, useEffect } from "react";

export interface WaitConfig {
  type: "minutes" | "hours" | "days" | "specific_date" | "weekday" | "specific_time";
  value: string;
}

interface WaitModalProps {
  open: boolean;
  initialType?: WaitConfig["type"];
  initialValue?: string;
  onClose: () => void;
  onSave: (config: WaitConfig) => void;
}

export function WaitModal({
  open,
  initialType = "minutes",
  initialValue = "",
  onClose,
  onSave,
}: WaitModalProps) {
  const [type, setType] = useState<WaitConfig["type"]>(initialType);
  const [value, setValue] = useState(initialValue);

  useEffect(() => {
    if (open) {
      setType(initialType);
      setValue(initialValue);
    }
  }, [open, initialType, initialValue]);

  const handleSave = () => {
    if (!value.trim()) {
      alert("Por favor ingresa un valor");
      return;
    }
    onSave({ type, value });
    onClose();
  };

  const handleTypeChange = (newType: WaitConfig["type"]) => {
    setType(newType);
    setValue(""); // Reset value when type changes
  };

  const renderValueInput = () => {
    switch (type) {
      case "minutes":
      case "hours":
      case "days":
        return (
          <input
            type="number"
            min="1"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder="indique un valor de tiempo"
            className="w-full px-3 py-2 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#6D5BFA] focus:border-transparent text-sm"
          />
        );

      case "specific_date":
        return (
          <input
            type="date"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#6D5BFA] focus:border-transparent text-sm"
          />
        );

      case "weekday":
        return (
          <select
            value={value}
            onChange={(e) => setValue(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#6D5BFA] focus:border-transparent text-sm"
          >
            <option value="">Selecciona un día</option>
            <option value="lunes">Lunes</option>
            <option value="martes">Martes</option>
            <option value="miercoles">Miércoles</option>
            <option value="jueves">Jueves</option>
            <option value="viernes">Viernes</option>
            <option value="sabado">Sábado</option>
            <option value="domingo">Domingo</option>
          </select>
        );

      case "specific_time":
        return (
          <input
            type="time"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder="indique un valor de tiempo"
            className="w-full px-3 py-2 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#6D5BFA] focus:border-transparent text-sm"
          />
        );
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
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>

            {/* Title */}
            <h3 className="font-semibold text-lg mb-2 text-gray-900">Espera</h3>

            {/* Description */}
            <p className="text-sm text-gray-600">
              Utiliza esta acción para hacer una espera antes de ejecutar el siguiente paso de tu flujo.
            </p>
          </div>

          {/* Scrollable Body */}
          <div className="flex-1 overflow-y-auto px-5 pb-3 pt-1">
            <div className="space-y-4">
            {/* Type Select */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Tipo de espera
              </label>
              <select
                value={type}
                onChange={(e) => handleTypeChange(e.target.value as WaitConfig["type"])}
                className="w-full px-3 py-2 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#6D5BFA] focus:border-transparent text-sm"
              >
                <option value="">seleccione una opción</option>
                <option value="minutes">Minutos</option>
                <option value="hours">Horas</option>
                <option value="days">Días</option>
                <option value="specific_date">Fecha específica</option>
                <option value="weekday">Día de la semana</option>
                <option value="specific_time">Hora específica del día</option>
              </select>
            </div>

            {/* Value Input */}
            {type && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Valor
                </label>
                {renderValueInput()}
              </div>
            )}
            </div>
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
              disabled={!type || !value.trim()}
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
