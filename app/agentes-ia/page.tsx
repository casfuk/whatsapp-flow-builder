"use client";

import { useState, useEffect } from "react";
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
  provider: string;
  model: string;
  temperature: number;
  maxTokens: number;
  knowledge: string | null;
  rules: string | null;
  fallbackMessage: string | null;
  handoverPhone: string | null;
  followupEnabled: boolean;
  followupDelayMinutes: number;
  followupMessages: string | null;
  createdAt: string;
}

const MODELS = [
  { value: "gpt-4o-mini", label: "GPT-4o mini (rápido y económico)" },
  { value: "gpt-4o", label: "GPT-4o" },
  { value: "gpt-4.1-mini", label: "GPT-4.1 mini" },
  { value: "gpt-4.1", label: "GPT-4.1" },
];

const emptyForm = {
  name: "",
  description: "",
  isActive: true,
  provider: "openai",
  model: "gpt-4o-mini",
  temperature: 0.7,
  maxTokens: 500,
  language: "es",
  tone: "professional",
  goal: "",
  systemPrompt: "",
  knowledge: "",
  rules: "",
  maxTurns: 20,
  fallbackMessage: "",
  handoverPhone: "",
  followupEnabled: true,
  followupDelayMinutes: 2,
  followupMessages: "",
};

type FormState = typeof emptyForm;

const inputClass =
  "w-full px-3 py-2 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#6D5BFA] text-sm";

function Section({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="border-t border-gray-200 pt-5">
      <h3 className="text-sm font-semibold text-gray-900">{title}</h3>
      {hint && <p className="text-xs text-gray-500 mt-0.5 mb-3">{hint}</p>}
      <div className={`space-y-4 ${hint ? "" : "mt-3"}`}>{children}</div>
    </div>
  );
}

function Field({ label, required, help, children }: { label: string; required?: boolean; help?: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1.5">
        {label} {required && <span className="text-red-500">*</span>}
      </label>
      {children}
      {help && <p className="text-xs text-gray-500 mt-1">{help}</p>}
    </div>
  );
}

export default function AiAgentsPage() {
  const [agents, setAgents] = useState<AiAgent[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [editingAgent, setEditingAgent] = useState<AiAgent | null>(null);
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState<FormState>(emptyForm);

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) => setFormData((f) => ({ ...f, [key]: value }));

  useEffect(() => {
    loadAgents();
  }, []);

  const loadAgents = async () => {
    try {
      const res = await fetch("/api/ai-agents");
      const data = await res.json();
      setAgents(data.agents || []);
    } catch (error) {
      console.error("Failed to load AI agents:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = () => {
    setEditingAgent(null);
    setFormData(emptyForm);
    setShowModal(true);
  };

  const handleEdit = (agent: AiAgent) => {
    setEditingAgent(agent);
    setFormData({
      name: agent.name,
      description: agent.description || "",
      isActive: agent.isActive,
      provider: agent.provider,
      model: agent.model,
      temperature: agent.temperature,
      maxTokens: agent.maxTokens,
      language: agent.language,
      tone: agent.tone,
      goal: agent.goal || "",
      systemPrompt: agent.systemPrompt,
      knowledge: agent.knowledge || "",
      rules: agent.rules || "",
      maxTurns: agent.maxTurns,
      fallbackMessage: agent.fallbackMessage || "",
      handoverPhone: agent.handoverPhone || "",
      followupEnabled: agent.followupEnabled,
      followupDelayMinutes: agent.followupDelayMinutes,
      followupMessages: agent.followupMessages || "",
    });
    setShowModal(true);
  };

  const handleSave = async () => {
    if (!formData.name.trim() || !formData.systemPrompt.trim()) {
      alert("Nombre e instrucciones son obligatorios");
      return;
    }

    setSaving(true);
    try {
      const res = await fetch(editingAgent ? `/api/ai-agents/${editingAgent.id}` : "/api/ai-agents", {
        method: editingAgent ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Error al guardar el agente");

      setShowModal(false);
      loadAgents();
    } catch (error) {
      alert(error instanceof Error ? error.message : "Error al guardar el agente");
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
        body: JSON.stringify({ isActive: !agent.isActive }),
      });
      loadAgents();
    } catch (error) {
      console.error("Failed to toggle active:", error);
    }
  };

  const filteredAgents = agents.filter((agent) => agent.name.toLowerCase().includes(searchTerm.toLowerCase()));

  return (
    <SidebarLayout>
      <div className="p-8">
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-gray-900">Agentes de IA</h1>
          <p className="text-gray-600 mt-1">
            Cada agente tiene su propia personalidad, conocimiento y configuración. Los flujos deciden qué agente
            atiende cada conversación (acción &quot;Activar agente IA&quot;).
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
            <button onClick={handleCreate} className="mt-4 text-[#6D5BFA] hover:underline">
              Crear tu primer agente
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredAgents.map((agent) => (
              <div key={agent.id} className="bg-white rounded-lg border border-gray-200 p-6 hover:shadow-lg transition-shadow">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex-1">
                    <h3 className="font-semibold text-lg text-gray-900">{agent.name}</h3>
                    {agent.description && <p className="text-sm text-gray-600 mt-1">{agent.description}</p>}
                  </div>
                  <button
                    onClick={() => handleToggleActive(agent)}
                    className={`px-3 py-1 text-xs font-medium rounded-full ${
                      agent.isActive ? "bg-green-100 text-green-800" : "bg-gray-100 text-gray-800"
                    }`}
                  >
                    {agent.isActive ? "Activo" : "Inactivo"}
                  </button>
                </div>

                <div className="space-y-1.5 text-sm mb-4 text-gray-600">
                  <div>Modelo: <span className="font-medium text-gray-900">{agent.model}</span></div>
                  <div>Idioma: <span className="font-medium text-gray-900">{agent.language.toUpperCase()}</span> · Tono: <span className="font-medium text-gray-900">{agent.tone}</span></div>
                  <div>Máx. turnos: <span className="font-medium text-gray-900">{agent.maxTurns}</span></div>
                  <div>
                    Seguimientos:{" "}
                    <span className="font-medium text-gray-900">
                      {agent.followupEnabled ? `a los ${agent.followupDelayMinutes} min` : "desactivados"}
                    </span>
                  </div>
                  <div>Conocimiento: <span className="font-medium text-gray-900">{agent.knowledge ? "configurado" : "—"}</span></div>
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

        {showModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-xl max-w-3xl w-full max-h-[92vh] overflow-y-auto p-8">
              <h2 className="text-2xl font-bold text-gray-900 mb-6">
                {editingAgent ? "Editar agente de IA" : "Crear agente de IA"}
              </h2>

              <div className="space-y-5">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Field label="Nombre" required>
                    <input className={inputClass} value={formData.name} onChange={(e) => set("name", e.target.value)} placeholder="Ej: Asesor Englishacker" />
                  </Field>
                  <Field label="Estado">
                    <label className="flex items-center gap-2 mt-2 text-sm text-gray-700">
                      <input type="checkbox" checked={formData.isActive} onChange={(e) => set("isActive", e.target.checked)} />
                      Agente activo
                    </label>
                  </Field>
                </div>
                <Field label="Descripción">
                  <input className={inputClass} value={formData.description} onChange={(e) => set("description", e.target.value)} placeholder="Para qué negocio / uso es este agente" />
                </Field>

                <Section title="Modelo de IA">
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <Field label="Proveedor">
                      <select className={inputClass} value={formData.provider} onChange={(e) => set("provider", e.target.value)}>
                        <option value="openai">OpenAI</option>
                      </select>
                    </Field>
                    <Field label="Modelo">
                      <select className={inputClass} value={formData.model} onChange={(e) => set("model", e.target.value)}>
                        {MODELS.map((m) => (
                          <option key={m.value} value={m.value}>{m.label}</option>
                        ))}
                        {!MODELS.some((m) => m.value === formData.model) && <option value={formData.model}>{formData.model}</option>}
                      </select>
                    </Field>
                    <Field label="Creatividad" help="0 = preciso · 1 = creativo">
                      <input type="number" min={0} max={2} step={0.1} className={inputClass} value={formData.temperature} onChange={(e) => set("temperature", parseFloat(e.target.value))} />
                    </Field>
                    <Field label="Longitud máx." help="Tokens por respuesta">
                      <input type="number" min={50} max={4000} step={50} className={inputClass} value={formData.maxTokens} onChange={(e) => set("maxTokens", parseInt(e.target.value, 10))} />
                    </Field>
                  </div>
                </Section>

                <Section title="Personalidad e instrucciones" hint="Quién es el agente, cómo habla y qué debe conseguir en la conversación.">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <Field label="Idioma">
                      <select className={inputClass} value={formData.language} onChange={(e) => set("language", e.target.value)}>
                        <option value="es">Español</option>
                        <option value="en">English</option>
                        <option value="pt">Português</option>
                        <option value="fr">Français</option>
                        <option value="de">Deutsch</option>
                        <option value="it">Italiano</option>
                      </select>
                    </Field>
                    <Field label="Tono">
                      <select className={inputClass} value={formData.tone} onChange={(e) => set("tone", e.target.value)}>
                        <option value="professional">Profesional</option>
                        <option value="friendly">Amigable</option>
                        <option value="casual">Casual</option>
                        <option value="formal">Formal</option>
                      </select>
                    </Field>
                  </div>
                  <Field label="Objetivo">
                    <textarea rows={2} className={`${inputClass} resize-none`} value={formData.goal} onChange={(e) => set("goal", e.target.value)} placeholder="Ej: Cualificar al lead y reservar una clase de prueba" />
                  </Field>
                  <Field label="Instrucciones / personalidad (system prompt)" required>
                    <textarea rows={8} className={`${inputClass} font-mono`} value={formData.systemPrompt} onChange={(e) => set("systemPrompt", e.target.value)} placeholder="Eres Laura, asesora de ... Hablas de forma cercana..." />
                  </Field>
                </Section>

                <Section title="Conocimiento del negocio" hint="Información que el agente puede usar: servicios, precios, horarios, direcciones, preguntas frecuentes...">
                  <textarea rows={8} className={`${inputClass} font-mono`} value={formData.knowledge} onChange={(e) => set("knowledge", e.target.value)} placeholder="Servicios: ...&#10;Precios: ...&#10;Horarios: ..." />
                </Section>

                <Section title="Reglas de comportamiento" hint="Qué debe y qué no debe hacer. Incluye aquí cuándo derivar a un humano y qué datos enviar en el [[HANDOVER]].">
                  <textarea rows={5} className={`${inputClass} font-mono`} value={formData.rules} onChange={(e) => set("rules", e.target.value)} placeholder="- No des precios cerrados&#10;- Deriva a un humano cuando..." />
                </Section>

                <Section title="Conversación y fallback">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <Field label="Máximo de turnos" help="Al llegar, el agente cierra y deriva a un humano (1-50)">
                      <input type="number" min={1} max={50} className={inputClass} value={formData.maxTurns} onChange={(e) => set("maxTurns", parseInt(e.target.value, 10))} />
                    </Field>
                    <Field label="Teléfono para avisos de handover" help="Recibe el resumen del lead por WhatsApp. Vacío = número de administración">
                      <input className={inputClass} value={formData.handoverPhone} onChange={(e) => set("handoverPhone", e.target.value)} placeholder="34600000000" />
                    </Field>
                  </div>
                  <Field label="Mensaje de fallback" help="Se envía si la IA no puede responder (error del proveedor). Vacío = mensaje genérico">
                    <input className={inputClass} value={formData.fallbackMessage} onChange={(e) => set("fallbackMessage", e.target.value)} placeholder="Ahora mismo no puedo responder, te escribimos enseguida 🙏" />
                  </Field>
                </Section>

                <Section title="Seguimientos" hint="Recordatorio si el cliente deja de responder a una pregunta del agente.">
                  <label className="flex items-center gap-2 text-sm text-gray-700">
                    <input type="checkbox" checked={formData.followupEnabled} onChange={(e) => set("followupEnabled", e.target.checked)} />
                    Enviar seguimientos automáticos
                  </label>
                  {formData.followupEnabled && (
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <Field label="Esperar (minutos)">
                        <input type="number" min={1} max={1440} className={inputClass} value={formData.followupDelayMinutes} onChange={(e) => set("followupDelayMinutes", parseInt(e.target.value, 10))} />
                      </Field>
                      <div className="md:col-span-2">
                        <Field label="Mensajes de seguimiento" help="Uno por línea; se elige uno al azar. Vacío = mensajes genéricos">
                          <textarea rows={3} className={`${inputClass} resize-none`} value={formData.followupMessages} onChange={(e) => set("followupMessages", e.target.value)} placeholder="¿Sigues ahí? 😊&#10;¿Tienes alguna duda?" />
                        </Field>
                      </div>
                    </div>
                  )}
                </Section>
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
                  {saving ? "Guardando..." : editingAgent ? "Guardar cambios" : "Crear agente"}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </SidebarLayout>
  );
}
