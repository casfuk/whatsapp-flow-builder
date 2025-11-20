"use client";

import { Handle, Position, NodeProps } from "reactflow";
import { useState, useEffect } from "react";
import { NodeWrapper } from "../NodeWrapper";

interface Flow {
  id: string;
  name: string;
}

export function StartAutomationNode({ data, id, selected }: NodeProps) {
  const [flows, setFlows] = useState<Flow[]>([]);
  const [loading, setLoading] = useState(true);
  const targetFlowId = data.targetFlowId || "";

  useEffect(() => {
    // Load available flows
    const fetchFlows = async () => {
      try {
        const response = await fetch("/api/flows");
        const data = await response.json();
        setFlows(data || []);
      } catch (error) {
        console.error("Failed to load flows:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchFlows();
  }, []);

  const handleFlowChange = (flowId: string) => {
    if (data.onUpdateNode) {
      data.onUpdateNode(id, { targetFlowId: flowId });
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
        className={`bg-white rounded-xl shadow-md p-3 border w-[260px] min-h-[140px] flex flex-col gap-2 transition-all ${
          selected ? "border-[#6D5BFA] border-2 shadow-md" : "border-gray-200"
        }`}
      >
        {/* Title */}
        <div className="flex items-center gap-2">
          <div className="flex h-6 w-6 items-center justify-center rounded-full bg-[#6D5BFA] text-white text-xs flex-shrink-0">
            ▶
          </div>
          <p className="text-sm font-semibold text-gray-900 break-words">
            Iniciar automatización
          </p>
        </div>

        {/* Description */}
        <p className="text-xs text-gray-600 break-words">
          Este nodo termina esta automatización y comienza otra.
        </p>

        {/* Flow Selector */}
        <div className="mt-2">
          <select
            value={targetFlowId}
            onChange={(e) => handleFlowChange(e.target.value)}
            onClick={(e) => e.stopPropagation()}
            onMouseDown={(e) => e.stopPropagation()}
            className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 outline-none focus:border-[#6D5BFA] focus:ring-1 focus:ring-[#6D5BFA]"
            disabled={loading}
          >
            <option value="">Seleccione una opción</option>
            {flows.map((flow) => (
              <option key={flow.id} value={flow.id}>
                {flow.name}
              </option>
            ))}
          </select>
        </div>

        {/* Warning if no flow selected */}
        {!targetFlowId && !loading && (
          <p className="text-xs text-orange-500">
            ⚠ Selecciona una automatización para continuar
          </p>
        )}
      </div>

      <Handle
        type="source"
        position={Position.Right}
        className="w-3 h-3 border-2 border-gray-300 bg-white"
      />
    </NodeWrapper>
  );
}
