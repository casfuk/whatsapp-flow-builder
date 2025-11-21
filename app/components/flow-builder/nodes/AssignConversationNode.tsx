"use client";

import { Handle, Position, NodeProps } from "reactflow";
import { useState } from "react";
import { NodeWrapper } from "../NodeWrapper";

type AssignNodeData = {
  agentId?: string | null; // null or undefined = "Asignarme a mí" (assign to default agent)
  assignToSelf?: boolean;  // Explicit flag for "assign to self"
  onChange?: (partial: Partial<AssignNodeData>) => void;
  onDuplicate?: (nodeId: string) => void;
  onDelete?: (nodeId: string) => void;
};

// Mock agents - replace with real API data / useAgentsStore
const MOCK_AGENTS = [
  { id: "agent-1", name: "Juan Pérez", avatar: "👨" },
  { id: "agent-2", name: "María García", avatar: "👩" },
  { id: "agent-3", name: "Carlos López", avatar: "👨" },
];

export function AssignConversationNode({
  data,
  selected,
  id,
}: NodeProps<AssignNodeData>) {
  const [agentId, setAgentId] = useState<string | null>(data.agentId ?? null);

  const handleAgentChange = (value: string) => {
    const isAssignToSelf = value === "";
    const newAgentId = isAssignToSelf ? null : value;
    setAgentId(newAgentId);
    if (data.onChange) {
      data.onChange({
        agentId: newAgentId,
        assignToSelf: isAssignToSelf
      });
    }
  };

  return (
    <NodeWrapper nodeId={id} onDuplicate={data.onDuplicate} onDelete={data.onDelete}>
      <div className="relative">
        <div
          className={`rounded-2xl border bg-white shadow-sm w-[400px] px-5 py-4 flex flex-col gap-3 transition-all ${
            selected ? "border-[#5B5FEF] border-2 shadow-md" : "border-[#E2E4F0]"
          }`}
        >
          {/* Header */}
          <div className="flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-full border border-[#C2C4F5] text-[#5B5FEF] text-sm">
              👤
            </div>
            <span className="text-sm font-semibold text-[#2C2F4A]">
              Asignar conversación
            </span>
          </div>

          {/* Description */}
          <p className="text-xs text-[#656889] leading-relaxed">
            Utiliza esta acción para abrir una conversación con un agente.
            Puedes seleccionar un agente en específico o si no seleccionas ninguno
            la conversación se asignará a usted.
          </p>

          {/* Agent selector */}
          <div className="flex flex-col gap-2">
            <select
              value={agentId || ""}
              onChange={(e) => handleAgentChange(e.target.value)}
              onClick={(e) => e.stopPropagation()}
              onMouseDown={(e) => e.stopPropagation()}
              className="w-full px-3 py-2.5 text-sm border border-[#E2E4F0] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#5B5FEF] bg-white"
            >
              <option value="">🤖 Asignarme a mí</option>
              {MOCK_AGENTS.map((agent) => (
                <option key={agent.id} value={agent.id}>
                  {agent.avatar} {agent.name}
                </option>
              ))}
            </select>
          </div>

          {/* Próximo paso label near output handle */}
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
