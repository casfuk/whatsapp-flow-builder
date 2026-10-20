"use client";

import { useEffect, useState } from "react";

interface AiState {
  assignedAgentType: string | null;
  assignedAgentId: string | null;
  aiDisabled: boolean;
  agentName: string | null;
}

interface AgentOption {
  id: string;
  name: string;
  isActive: boolean;
}

/**
 * Admin controls for the conversation's AI agent: see which agent is handling
 * it, switch/stop it manually, pause the AI, or reset its context.
 */
export function ChatAgentControl({ chatId }: { chatId: string }) {
  const [state, setState] = useState<AiState | null>(null);
  const [agents, setAgents] = useState<AgentOption[]>([]);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      fetch(`/api/chats/${chatId}`).then((r) => (r.ok ? r.json() : null)),
      fetch("/api/ai-agents").then((r) => r.json()),
    ])
      .then(([chat, list]) => {
        if (cancelled) return;
        setState(chat);
        setAgents(list.agents || []);
      })
      .catch((err) => console.error("Failed to load AI state:", err));
    return () => {
      cancelled = true;
    };
  }, [chatId]);

  const patch = async (body: Record<string, unknown>) => {
    setBusy(true);
    try {
      const res = await fetch(`/api/chats/${chatId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error((await res.json()).error || "Error");
      setState(await res.json());
    } catch (error) {
      alert(error instanceof Error ? error.message : "No se pudo actualizar");
    } finally {
      setBusy(false);
    }
  };

  const resetContext = async () => {
    if (!confirm("¿Reiniciar el contexto de la IA? El agente no verá los mensajes anteriores (el historial se conserva).")) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/chats/${chatId}/reset-ai`, { method: "POST" });
      if (!res.ok) throw new Error("Error");
      alert("Contexto de IA reiniciado");
    } catch {
      alert("No se pudo reiniciar el contexto");
    } finally {
      setBusy(false);
    }
  };

  if (!state) return null;

  const activeAgentId = state.assignedAgentType === "AI" ? state.assignedAgentId : null;

  return (
    <div className="bg-[#F5F4FF] border-b border-[#E2E0FB] px-6 py-2 flex flex-wrap items-center gap-3 text-sm">
      <span className="font-medium text-[#2C2F4A]">🤖 Agente IA:</span>
      <select
        value={activeAgentId || ""}
        disabled={busy}
        onChange={(e) => patch({ agentId: e.target.value || null })}
        className="px-2 py-1 border border-gray-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#6D5BFA]"
      >
        <option value="">Ninguno (flujos / manual)</option>
        {agents.map((agent) => (
          <option key={agent.id} value={agent.id}>
            {agent.name}
            {agent.isActive ? "" : " (inactivo)"}
          </option>
        ))}
      </select>

      <label className="flex items-center gap-1.5 text-gray-700">
        <input
          type="checkbox"
          disabled={busy}
          checked={!state.aiDisabled}
          onChange={(e) => patch({ aiDisabled: !e.target.checked })}
        />
        IA activa
      </label>
      {state.aiDisabled && <span className="text-xs text-amber-700">IA en pausa para este contacto</span>}

      <button
        onClick={resetContext}
        disabled={busy}
        className="ml-auto px-3 py-1 text-xs rounded-lg border border-gray-300 bg-white hover:bg-gray-50 disabled:opacity-50"
      >
        Reiniciar contexto IA
      </button>
    </div>
  );
}
