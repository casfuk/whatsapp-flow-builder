"use client";

import { useRouter } from "next/navigation";

interface FlowHeaderProps {
  flowName: string;
  isActive: boolean;
  isSaving: boolean;
  onChangeName: (name: string) => void;
  onToggleActive: () => void;
  onSave: () => void;
}

export function FlowHeader({
  flowName,
  isActive,
  isSaving,
  onChangeName,
  onToggleActive,
  onSave,
}: FlowHeaderProps) {
  const router = useRouter();

  return (
    <div className="flex items-center justify-between gap-4 px-6 py-3 border-b border-[#E2E4F0] bg-white">
      {/* Left: Volver button */}
      <button
        onClick={() => router.push("/flows")}
        className="flex items-center gap-2 text-sm text-[#656889] hover:text-[#2C2F4A] transition-colors"
      >
        <span>←</span>
        <span>Volver</span>
      </button>

      {/* Center: Flow name pill */}
      <input
        type="text"
        value={flowName}
        onChange={(e) => onChangeName(e.target.value)}
        placeholder="Nombre del flow"
        className="w-full max-w-xl rounded-xl bg-[#F5F7FB] border border-[#DDE0ED] px-4 py-2 text-sm text-center text-[#2C2F4A] focus:outline-none focus:ring-2 focus:ring-[#5B5FEF] focus:border-transparent"
      />

      {/* Right: Status toggle + Save button */}
      <div className="flex items-center gap-3">
        {/* Active/Inactive pill */}
        <div className="flex items-center gap-3">
          <span className="text-sm font-medium text-[#2C2F4A]">
            {isActive ? "Activo" : "Inactivo"}
          </span>
          <button
            onClick={onToggleActive}
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
              isActive ? "bg-[#6D5BFA]" : "bg-gray-300"
            }`}
          >
            <span
              className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform shadow-sm ${
                isActive ? "translate-x-6" : "translate-x-1"
              }`}
            />
          </button>
        </div>

        {/* Save button */}
        <button
          type="button"
          onClick={onSave}
          disabled={isSaving}
          className="rounded-xl bg-[#5B5FEF] px-5 py-2 text-sm font-semibold text-white shadow-sm disabled:opacity-60"
        >
          {isSaving ? "Guardando..." : "Guardar automatización"}
        </button>
      </div>
    </div>
  );
}
