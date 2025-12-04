"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { SidebarLayout } from "@/app/components/SidebarLayout";

interface AiAgent {
  id: string;
  name: string;
  description: string | null;
  language: string;
  tone: string;
  goal: string | null;
  systemPrompt: string;
  maxTurns: number;
  isActive: boolean;
  createdAt: string;
}

export default function AiAgentsPage() {
  const router = useRouter();
  const [agents, setAgents] = useState<AiAgent[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [editingAgent, setEditingAgent] = useState<AiAgent | null>(null);
  const [saving, setSaving] = useState(false);

  const [formData, setFormData] = useState({
    name: "",
    description: "",
    language: "es",
    tone: "professional",
    goal: "",
    systemPrompt: "",
    maxTurns: 20, // Updated default from 10 to 20
  });

  useEffect(() => {
    loadAgents();
  }, []);

  const loadAgents = async () => {
    try {
      // ⚠️ IMPORTANT: Always fetch agents from database via API
      // This ensures UI displays current database values (not hard-coded)
      // The API reads from Prisma/PostgreSQL, including maxTurns field
      const res = await fetch("/api/ai-agents");
      const data = await res.json();
      // API returns { success: true, agents: [...], count: X }
      setAgents(data.agents || data);
    } catch (error) {
      console.error("Failed to load AI agents:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = () => {
    setEditingAgent(null);
    setFormData({
      name: "",
      description: "",
      language: "es",
      tone: "professional",
      goal: "",
      systemPrompt: "",
      maxTurns: 20, // Updated default from 10 to 20
    });
    setShowModal(true);
  };

  const handleEdit = (agent: AiAgent) => {
    setEditingAgent(agent);
    setFormData({
      name: agent.name,
      description: agent.description || "",
      language: agent.language,
      tone: agent.tone,
      goal: agent.goal || "",
      systemPrompt: agent.systemPrompt,
      maxTurns: agent.maxTurns,
    });
    setShowModal(true);
  };

  const handleSave = async () => {
    // Validation
    if (!formData.name || !formData.systemPrompt) {
      alert("Nombre y System Prompt son requeridos");
      return;
    }

    if (formData.maxTurns < 1 || formData.maxTurns > 20) {
      alert("El máximo de turnos debe estar entre 1 y 20");
      return;
    }

    setSaving(true);
    try {
      const url = editingAgent
        ? `/api/ai-agents/${editingAgent.id}`
        : "/api/ai-agents";
      const method = editingAgent ? "PUT" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Failed to save AI agent");
      }

      // Success!
      alert(
        editingAgent
          ? "✅ Agente actualizado correctamente. Los cambios se aplicarán en las próximas conversaciones."
          : "✅ Agente creado correctamente"
      );

      setShowModal(false);
      loadAgents();
    } catch (error: any) {
      alert(error.message || "Error al guardar el agente");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("¿Estás seguro de eliminar este agente de IA?")) return;

    try {
      await fetch(`/api/ai-agents/${id}`, { method: "DELETE" });
      loadAgents();
    } catch (error) {
      console.error("Failed to delete:", error);
      alert("Error al eliminar el agente");
    }
  };

  const handleToggleActive = async (agent: AiAgent) => {
    try {
      await fetch(`/api/ai-agents/${agent.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...agent, isActive: !agent.isActive }),
      });
      loadAgents();
    } catch (error) {
      console.error("Failed to toggle active:", error);
    }
  };

  const filteredAgents = agents.filter((agent) =>
    agent.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <SidebarLayout>
      <div className="p-8">
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-gray-900">Agentes de IA</h1>
          <p className="text-gray-600 mt-1">
            Gestiona tus agentes de inteligencia artificial para automatizar conversaciones
          </p>
        </div>

        <div className="mb-6 flex items-center justify-between">
          <div className="flex-1 max-w-md">
            <input
              type="text"
              placeholder="Buscar agentes"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#6D5BFA]"
            />
          </div>
          <button
            onClick={handleCreate}
            className="bg-[#6D5BFA] text-white px-6 py-2.5 rounded-xl hover:bg-[#5B4BD8] transition-colors font-medium"
          >
            + Crear agente de IA
          </button>
        </div>

        {loading ? (
          <div className="text-center py-12">Cargando...</div>
        ) : filteredAgents.length === 0 ? (
          <div className="bg-white rounded-lg border border-gray-200 p-12 text-center">
            <div className="text-gray-400 text-5xl mb-4">🤖</div>
            <p className="text-gray-500 mb-2">No hay agentes de IA configurados</p>
            {searchTerm && (
              <p className="text-gray-400 text-sm">
                No se encontraron registros con "{searchTerm}"
              </p>
            )}
            <button
              onClick={handleCreate}
              className="mt-4 text-[#6D5BFA] hover:underline"
            >
              Crear tu primer agente
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredAgents.map((agent) => (
              <div
                key={agent.id}
                className="bg-white rounded-lg border border-gray-200 p-6 hover:shadow-lg transition-shadow"
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="flex-1">
                    <h3 className="font-semibold text-lg text-gray-900">
                      {agent.name}
                    </h3>
                    {agent.description && (
                      <p className="text-sm text-gray-600 mt-1">
                        {agent.description}
                      </p>
                    )}
                  </div>
                  <button
                    onClick={() => handleToggleActive(agent)}
                    className={`px-3 py-1 text-xs font-medium rounded-full ${
                      agent.isActive
                        ? "bg-green-100 text-green-800"
                        : "bg-gray-100 text-gray-800"
                    }`}
                  >
                    {agent.isActive ? "Activo" : "Inactivo"}
                  </button>
                </div>

                <div className="space-y-2 text-sm mb-4">
                  <div className="flex items-center gap-2">
                    <span className="text-gray-500">Idioma:</span>
                    <span className="font-medium">{agent.language.toUpperCase()}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-gray-500">Tono:</span>
                    <span className="font-medium capitalize">{agent.tone}</span>
                  </div>
                  {/* ⚠️ Displays maxTurns from database (not hard-coded) */}
                  <div className="flex items-center gap-2">
                    <span className="text-gray-500">Max turnos:</span>
                    <span className="font-medium">{agent.maxTurns}</span>
                  </div>
                  {agent.goal && (
                    <div>
                      <span className="text-gray-500">Objetivo:</span>
                      <p className="text-gray-700 mt-1">{agent.goal}</p>
                    </div>
                  )}
                </div>

                <div className="flex items-center gap-2 pt-4 border-t border-gray-200">
                  <button
                    onClick={() => handleEdit(agent)}
                    className="flex-1 px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded-xl text-sm font-medium transition-colors"
                  >
                    Editar
                  </button>
                  <button
                    onClick={() => handleDelete(agent.id)}
                    className="px-4 py-2 bg-red-50 hover:bg-red-100 text-red-600 rounded-xl text-sm font-medium transition-colors"
                  >
                    Eliminar
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Modal */}
        {showModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto p-8">
              <h2 className="text-2xl font-bold text-gray-900 mb-6">
                {editingAgent ? "Editar agente de IA" : "Crear agente de IA"}
              </h2>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Nombre <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) =>
                      setFormData({ ...formData, name: e.target.value })
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#6D5BFA]"
                    placeholder="Ej: Agente de Soporte"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Descripción
                  </label>
                  <textarea
                    value={formData.description}
                    onChange={(e) =>
                      setFormData({ ...formData, description: e.target.value })
                    }
                    rows={2}
                    className="w-full px-3 py-2 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#6D5BFA] resize-none"
                    placeholder="Breve descripción del agente"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Idioma
                    </label>
                    <select
                      value={formData.language}
                      onChange={(e) =>
                        setFormData({ ...formData, language: e.target.value })
                      }
                      className="w-full px-3 py-2 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#6D5BFA]"
                    >
                      <option value="es">Español</option>
                      <option value="en">English</option>
                      <option value="fr">Français</option>
                      <option value="de">Deutsch</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Tono
                    </label>
                    <select
                      value={formData.tone}
                      onChange={(e) =>
                        setFormData({ ...formData, tone: e.target.value })
                      }
                      className="w-full px-3 py-2 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#6D5BFA]"
                    >
                      <option value="professional">Profesional</option>
                      <option value="friendly">Amigable</option>
                      <option value="casual">Casual</option>
                      <option value="formal">Formal</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Objetivo del agente
                  </label>
                  <textarea
                    value={formData.goal}
                    onChange={(e) =>
                      setFormData({ ...formData, goal: e.target.value })
                    }
                    rows={2}
                    className="w-full px-3 py-2 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#6D5BFA] resize-none"
                    placeholder="Ej: Ayudar a los clientes con preguntas sobre productos"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    System Prompt <span className="text-red-500">*</span>
                  </label>
                  <textarea
                    value={formData.systemPrompt}
                    onChange={(e) =>
                      setFormData({ ...formData, systemPrompt: e.target.value })
                    }
                    rows={8}
                    className="w-full px-3 py-2 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#6D5BFA] resize-none font-mono text-sm"
                    placeholder="Eres un asistente de atención al cliente especializado en..."
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Define el comportamiento y contexto del agente de IA
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Máximo de turnos antes de derivar a humano
                  </label>
                  <input
                    type="number"
                    value={formData.maxTurns}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        maxTurns: parseInt(e.target.value),
                      })
                    }
                    min="1"
                    max="20"
                    className="w-full px-3 py-2 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#6D5BFA]"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Después de este número de mensajes, la conversación se derivará automáticamente a un humano (máximo: 20)
                  </p>
                </div>
              </div>

              <div className="mt-8 flex items-center gap-4 justify-end">
                <button
                  onClick={() => setShowModal(false)}
                  className="px-6 py-2.5 border border-gray-300 rounded-xl text-gray-700 hover:bg-gray-50 transition-colors font-medium"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="px-6 py-2.5 bg-[#6D5BFA] text-white rounded-xl hover:bg-[#5B4BD8] transition-colors font-medium disabled:opacity-50"
                >
                  {saving
                    ? "Guardando..."
                    : editingAgent
                    ? "Guardar cambios"
                    : "Crear agente"}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </SidebarLayout>
  );
}
