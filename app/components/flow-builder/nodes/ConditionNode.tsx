import { Handle, Position, NodeProps } from "reactflow";
import { useState } from "react";
import { ConditionModal, Condition } from "@/app/components/condition/ConditionModal";

export function ConditionNode({ data, selected, id }: NodeProps) {
  const [showConditionModal, setShowConditionModal] = useState(false);
  const conditions = (data.conditions as Condition[]) || [];

  const handleConditionSave = (newConditions: Condition[]) => {
    if (data.onConditionsChange) {
      data.onConditionsChange(id, newConditions);
    }
  };

  const getConditionsSummary = () => {
    if (conditions.length === 0) {
      return "Haz clic para configurar condiciones...";
    }

    if (conditions.length === 1) {
      const c = conditions[0];
      const typeLabel =
        c.type === "tag" ? "Tag" : c.type === "weekday" ? "Día" : "Hora";
      const operatorLabel = c.operator === "is" ? "es" : "no es";
      return `${typeLabel} ${operatorLabel} "${c.value}"`;
    }

    return `${conditions.length} condiciones configuradas`;
  };

  return (
    <>
      <div
        className={`bg-white rounded-xl shadow-md p-3 border
                   w-[260px] min-h-[120px]
                   flex flex-col gap-2 transition-all ${
          selected
            ? "border-[#6D5BFA] border-2 shadow-md"
            : "border-gray-200"
        }`}
      >
        <p className="text-sm font-medium break-words text-gray-900">Condición</p>

        <div className="break-words">
          {/* Configuration Button */}
          <button
            onClick={() => setShowConditionModal(true)}
            className="w-full text-left px-3 py-2 bg-gray-50 hover:bg-gray-100 rounded-xl transition-colors text-xs border border-gray-200 break-words"
            style={{ color: "#000" }}
          >
            {getConditionsSummary()}
          </button>

          {/* Output Labels */}
          <div className="mt-3 space-y-2 text-xs text-gray-600">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-green-500 flex-shrink-0" />
              <span className="break-words">El contacto cumple</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-red-500 flex-shrink-0" />
              <span className="break-words">El contacto NO cumple</span>
            </div>
          </div>
        </div>

        {/* Input Handle (left) */}
        <Handle
          type="target"
          position={Position.Left}
          className="w-3 h-3 border-2 border-gray-300 bg-white"
        />

        {/* Output Handle 1: Cumple (top right) */}
        <Handle
          type="source"
          position={Position.Right}
          id="cumple"
          style={{ top: "40%" }}
          className="w-3 h-3 border-2 border-green-500 bg-white"
        />

        {/* Output Handle 2: NO Cumple (bottom right) */}
        <Handle
          type="source"
          position={Position.Right}
          id="no_cumple"
          style={{ top: "60%" }}
          className="w-3 h-3 border-2 border-red-500 bg-white"
        />
      </div>

      <ConditionModal
        open={showConditionModal}
        initialConditions={conditions}
        onClose={() => setShowConditionModal(false)}
        onSave={handleConditionSave}
      />
    </>
  );
}
