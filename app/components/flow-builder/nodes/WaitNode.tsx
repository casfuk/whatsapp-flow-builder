import { Handle, Position, NodeProps } from "reactflow";
import { useState } from "react";
import { NodeWrapper } from "../NodeWrapper";

type WaitUnit = "minutes" | "hours" | "days" | "";

type WaitNodeData = {
  waitUnit?: WaitUnit;
  waitValue?: string;
  onChange?: (partial: Partial<WaitNodeData>) => void;
  onDuplicate?: (nodeId: string) => void;
  onDelete?: (nodeId: string) => void;
};

export function WaitNode({ data, selected, id }: NodeProps<WaitNodeData>) {
  const [waitUnit, setWaitUnit] = useState<WaitUnit>(data.waitUnit || "");
  const [waitValue, setWaitValue] = useState<string>(data.waitValue || "");

  const handleChange = (partial: Partial<WaitNodeData>) => {
    if (partial.waitUnit !== undefined) {
      setWaitUnit(partial.waitUnit);
    }
    if (partial.waitValue !== undefined) {
      setWaitValue(partial.waitValue);
    }
    if (data.onChange) {
      data.onChange(partial);
    }
  };

  return (
    <NodeWrapper nodeId={id} onDuplicate={data.onDuplicate} onDelete={data.onDelete}>
      <div className="relative">
        <div
          className={`rounded-2xl border bg-white shadow-sm w-[360px] px-6 py-4 flex flex-col gap-4 transition-all ${
            selected ? "border-[#5B5FEF] border-2 shadow-md" : "border-[#E2E4F0]"
          }`}
        >
          {/* Header */}
          <div className="flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-full border border-[#C2C4F5] text-[#5B5FEF] text-sm">
              ⏱
            </div>
            <span className="text-sm font-semibold text-[#2C2F4A]">Espera</span>
          </div>

          {/* Description */}
          <p className="text-xs text-[#656889] leading-snug">
            Utiliza esta acción para hacer una espera
            <br />
            antes de ejecutar el siguiente paso de tu flujo.
          </p>

          {/* Select */}
          <select
            className="w-full rounded-md border border-[#D2D4E4] bg-white px-3 py-2 text-xs text-[#373955] focus:outline-none focus:ring-2 focus:ring-[#5B5FEF]"
            value={waitUnit}
            onChange={(e) => handleChange({ waitUnit: e.target.value as WaitUnit })}
            onClick={(e) => e.stopPropagation()}
            onMouseDown={(e) => e.stopPropagation()}
          >
            <option value="">seleccione una opción</option>
            <option value="minutes">Minutos</option>
            <option value="hours">Horas</option>
            <option value="days">Días</option>
          </select>

          {/* Input */}
          <input
            type="number"
            placeholder="indique un valor de tiempo"
            className="w-full rounded-md border border-[#D2D4E4] bg-white px-3 py-2 text-xs placeholder:text-[#B0B3C6] text-[#373955] focus:outline-none focus:ring-2 focus:ring-[#5B5FEF]"
            value={waitValue}
            onChange={(e) => handleChange({ waitValue: e.target.value })}
            onClick={(e) => e.stopPropagation()}
            onMouseDown={(e) => e.stopPropagation()}
          />

          {/* Próximo paso */}
          <span className="absolute right-10 bottom-4 text-[11px] text-[#656889]">
            Próximo paso
          </span>
        </div>

        <Handle
          type="target"
          position={Position.Left}
          className="w-3 h-3 border-2 border-gray-300 bg-white"
        />
        <Handle
          type="source"
          position={Position.Right}
          className="w-3 h-3 border-2 border-gray-300 bg-white"
        />
      </div>
    </NodeWrapper>
  );
}
