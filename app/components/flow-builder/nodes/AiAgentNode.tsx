"use client";

import { Handle, Position, NodeProps } from "reactflow";
import { useState, useEffect } from "react";
import { NodeWrapper } from "../NodeWrapper";

export type AiAgentAction = "activate" | "change" | "stop";

type AiAgentNodeData = {
  aiAction?: AiAgentAction;
  agentId?: string | null;
  agentName?: string | null;
  respondNow?: boolean;
  resetContext?: boolean;
  stopMessage?: string;
  onChange?: (partial: Partial<AiAgentNodeData>) => void;
  onUpdateNode?: (nodeId: string, partial: Partial<AiAgentNodeData>) => void;
  onDuplicate?: (nodeId: string) => void;
  onDelete?: (nodeId: string) => void;
};

interface AiAgent {
  id: string;
  name: string;
  description: string | null;
  isActive: boolean;
}

const ACTIONS: { value: AiAgentAction; label: string; icon: string; help: string }[] = [
  { value: "activate", label: "Activar", icon: "🤖", help: "Este agente atenderá los siguientes mensajes de la conversación." },
  { value: "change", label: "Cambiar", icon: "🔄", help: "Pasa la conversación a otro agente." },
  { value: "stop", label: "Detener", icon: "⏹️", help: "La IA deja de responder; la conversación vuelve a flujos / atención manual." },
];

const stop = (e: React.SyntheticEvent) => e.stopPropagation();

export function AiAgentNode({ data, selected, id }: NodeProps<AiAgentNodeData>) {
  const action: AiAgentAction = data.aiAction ?? "activate";
  const [agents, setAgents] = useState<AiAgent[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    fetch("/api/ai-agents")
      .then((res) => res.json())
      .then((res) => setAgents(res.agents || []))
      .catch((err) => console.error("Failed to load AI agents:", err))
      .finally(() => setLoaded(true));
  }, []);

  // onChange is attached after the first render; onUpdateNode exists from creation
  const update = (partial: Partial<AiAgentNodeData>) =>
    data.onChange ? data.onChange(partial) : data.onUpdateNode?.(id, partial);
  const selectedAgent = agents.find((a) => a.id === data.agentId);
  const missingAgent = action !== "stop" && loaded && (!data.agentId || !selectedAgent);
  const current = ACTIONS.find((a) => a.value === action)!;

  return (
    <NodeWrapper nodeId={id} onDuplicate={data.onDuplicate} onDelete={data.onDelete}>
      <div className="relative">
        <div
          className={`rounded-2xl border bg-white shadow-sm w-[400px] px-5 py-4 flex flex-col gap-3 transition-all ${
            selected ? "border-[#5B5FEF] border-2 shadow-md" : missingAgent ? "border-red-300" : "border-[#E2E4F0]"
          }`}
        >
          <div className="flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-full border border-[#C2C4F5] text-sm">
              {current.icon}
            </div>
            <span className="text-sm font-semibold text-[#2C2F4A]">{current.label} agente IA</span>
          </div>

          <div className="flex gap-2">
            {ACTIONS.map((a) => (
              <button
                key={a.value}
                type="button"
                onClick={(e) => {
                  stop(e);
                  update({ aiAction: a.value });
                }}
                onMouseDown={stop}
                className={`flex-1 px-3 py-2 text-xs rounded-lg font-medium transition-colors ${
                  action === a.value ? "bg-[#5B5FEF] text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                }`}
              >
                {a.icon} {a.label}
              </button>
            ))}
          </div>

          <p className="text-xs text-[#656889] leading-relaxed">{current.help}</p>

          {action !== "stop" ? (
            <>
              <select
                value={data.agentId || ""}
                onChange={(e) => {
                  const agent = agents.find((a) => a.id === e.target.value);
                  update({ agentId: agent?.id ?? null, agentName: agent?.name ?? null });
                }}
                onClick={stop}
                onMouseDown={stop}
                className={`w-full px-3 py-2.5 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-[#5B5FEF] bg-white ${
                  missingAgent ? "border-red-300" : "border-[#E2E4F0]"
                }`}
              >
                <option value="">Seleccionar agente de IA</option>
                {agents.map((agent) => (
                  <option key={agent.id} value={agent.id}>
                    🤖 {agent.name}
                    {agent.isActive ? "" : " (inactivo)"}
                  </option>
                ))}
              </select>
              {missingAgent && (
                <p className="text-xs text-red-600">
                  {data.agentId ? `El agente "${data.agentName || data.agentId}" ya no existe.` : "Elige un agente."}
                </p>
              )}
              {selectedAgent && !selectedAgent.isActive && (
                <p className="text-xs text-amber-600">Este agente está inactivo: no responderá hasta activarlo.</p>
              )}

              <label className="flex items-start gap-2 text-xs text-[#2C2F4A]" onMouseDown={stop}>
                <input
                  type="checkbox"
                  className="mt-0.5"
                  checked={data.respondNow !== false}
                  onChange={(e) => update({ respondNow: e.target.checked })}
                />
                Responder ya al último mensaje del cliente (o saludar si aún no ha escrito)
              </label>
              {action === "change" && (
                <label className="flex items-start gap-2 text-xs text-[#2C2F4A]" onMouseDown={stop}>
                  <input
                    type="checkbox"
                    className="mt-0.5"
                    checked={data.resetContext !== false}
                    onChange={(e) => update({ resetContext: e.target.checked })}
                  />
                  Empezar con contexto limpio (el nuevo agente no ve la conversación anterior)
                </label>
              )}
            </>
          ) : (
            <textarea
              rows={2}
              value={data.stopMessage || ""}
              onChange={(e) => update({ stopMessage: e.target.value })}
              onClick={stop}
              onMouseDown={stop}
              placeholder="Mensaje opcional al cliente (ej: Te paso con una persona del equipo)"
              className="w-full px-3 py-2 text-sm border border-[#E2E4F0] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#5B5FEF] resize-none"
            />
          )}

          <span className="self-end text-[11px] text-[#656889]">Próximo paso</span>
        </div>

        <Handle type="target" position={Position.Left} className="w-3 h-3 border-2 border-gray-300 bg-white" />
        <Handle type="source" position={Position.Right} className="w-3 h-3 border-2 border-gray-300 bg-white" />
      </div>
    </NodeWrapper>
  );
}
