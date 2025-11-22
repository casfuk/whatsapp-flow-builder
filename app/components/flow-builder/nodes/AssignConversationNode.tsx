"use client";

import { Handle, Position, NodeProps } from "reactflow";
import { useState, useEffect } from "react";
import { NodeWrapper } from "../NodeWrapper";

type AssignNodeData = {
  agentType?: "human" | "ai"; // Type of agent
  agentId?: string | null; // Agent ID
  assignToSelf?: boolean;  // Explicit flag for "assign to self"
  onChange?: (partial: Partial<AssignNodeData>) => void;
  onDuplicate?: (nodeId: string) => void;
  onDelete?: (nodeId: string) => void;
};

interface Device {
  id: string;
  name: string;
  phoneNumber: string | null;
  isConnected: boolean;
}

interface AiAgent {
  id: string;
  name: string;
  description: string | null;
  isActive: boolean;
}

export function AssignConversationNode({
  data,
  selected,
  id,
}: NodeProps<AssignNodeData>) {
  const [agentType, setAgentType] = useState<"human" | "ai">(data.agentType || "human");
  const [agentId, setAgentId] = useState<string | null>(data.agentId ?? null);
  const [aiAgents, setAiAgents] = useState<AiAgent[]>([]);
  const [devices, setDevices] = useState<Device[]>([]);

  useEffect(() => {
    // Load AI agents from API
    fetch("/api/ai-agents")
      .then((res) => res.json())
      .then((data) => setAiAgents(data.filter((a: AiAgent) => a.isActive)))
      .catch((err) => console.error("Failed to load AI agents:", err));

    // Load devices from API
    fetch("/api/devices")
      .then((res) => res.json())
      .then((data) => {
        const devicesArray = Array.isArray(data)
          ? data
          : Array.isArray(data?.devices)
            ? data.devices
            : [];
        setDevices(devicesArray.filter((d: Device) => d.isConnected));
      })
      .catch((err) => console.error("Failed to load devices:", err));
  }, []);

  const handleTypeChange = (type: "human" | "ai") => {
    setAgentType(type);
    setAgentId(null); // Reset agent when type changes
    if (data.onChange) {
      data.onChange({
        agentType: type,
        agentId: null,
        assignToSelf: false
      });
    }
  };

  const handleAgentChange = (value: string) => {
    const isAssignToSelf = value === "";
    const newAgentId = isAssignToSelf ? null : value;
    setAgentId(newAgentId);
    if (data.onChange) {
      data.onChange({
        agentType,
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
            Utiliza esta acción para asignar la conversación a un agente humano o de IA.
          </p>

          {/* Agent type selector */}
          <div className="flex gap-2">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                handleTypeChange("human");
              }}
              onMouseDown={(e) => e.stopPropagation()}
              className={`flex-1 px-3 py-2 text-xs rounded-lg font-medium transition-colors ${
                agentType === "human"
                  ? "bg-[#5B5FEF] text-white"
                  : "bg-gray-100 text-gray-600 hover:bg-gray-200"
              }`}
            >
              👨 Humano
            </button>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                handleTypeChange("ai");
              }}
              onMouseDown={(e) => e.stopPropagation()}
              className={`flex-1 px-3 py-2 text-xs rounded-lg font-medium transition-colors ${
                agentType === "ai"
                  ? "bg-[#5B5FEF] text-white"
                  : "bg-gray-100 text-gray-600 hover:bg-gray-200"
              }`}
            >
              🤖 IA
            </button>
          </div>

          {/* Agent selector */}
          <div className="flex flex-col gap-2">
            {agentType === "human" ? (
              <select
                value={agentId || ""}
                onChange={(e) => handleAgentChange(e.target.value)}
                onClick={(e) => e.stopPropagation()}
                onMouseDown={(e) => e.stopPropagation()}
                className="w-full px-3 py-2.5 text-sm border border-[#E2E4F0] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#5B5FEF] bg-white"
              >
                <option value="">📱 Asignarme a mí</option>
                {devices.map((device) => (
                  <option key={device.id} value={device.id}>
                    📱 {device.name} {device.phoneNumber ? `(${device.phoneNumber})` : ""}
                  </option>
                ))}
              </select>
            ) : (
              <select
                value={agentId || ""}
                onChange={(e) => handleAgentChange(e.target.value)}
                onClick={(e) => e.stopPropagation()}
                onMouseDown={(e) => e.stopPropagation()}
                className="w-full px-3 py-2.5 text-sm border border-[#E2E4F0] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#5B5FEF] bg-white"
              >
                <option value="">Seleccionar agente de IA</option>
                {aiAgents.map((agent) => (
                  <option key={agent.id} value={agent.id}>
                    🤖 {agent.name}
                  </option>
                ))}
              </select>
            )}
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
