"use client";

import { useState, useEffect } from "react";
import * as React from "react";
import { TriggerConfig, TriggerType, TagAddedTrigger, MessageReceivedTrigger, MatchMode } from "@/lib/types/trigger";
import { useTagsStore } from "@/lib/stores/useTagsStore";
import { useDevicesStore } from "@/lib/stores/useDevicesStore";

interface TriggerModalProps {
  trigger: TriggerConfig | null;
  onSave: (trigger: TriggerConfig) => void;
  onClose: () => void;
}

// Helper function to format time ago
function getTimeAgo(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return "menos de 1 minuto";
  if (diffMins < 60) return `${diffMins} minuto${diffMins > 1 ? "s" : ""}`;
  if (diffHours < 24) return `${diffHours} hora${diffHours > 1 ? "s" : ""}`;
  return `${diffDays} día${diffDays > 1 ? "s" : ""}`;
}

export function TriggerModal({ trigger, onSave, onClose }: TriggerModalProps) {
  const [type, setType] = useState<TriggerType>(trigger?.type || "none");
  const [oncePerContact, setOncePerContact] = useState(trigger?.oncePerContact || false);

  // Use zustand stores for tags and devices
  const tags = useTagsStore((s) => s.tags);
  const loadingTags = useTagsStore((s) => s.loading);
  const fetchTags = useTagsStore((s) => s.fetchTags);

  const devices = useDevicesStore((s) => s.devices);
  const loadingDevices = useDevicesStore((s) => s.loading);
  const fetchDevices = useDevicesStore((s) => s.fetchDevices);

  // Ensure devices is always an array to prevent .map() crashes
  const safeDevices = Array.isArray(devices) ? devices : [];

  // Fetch data on mount
  useEffect(() => {
    fetchTags();
    fetchDevices();
  }, [fetchTags, fetchDevices]);

  // Tag added fields
  const [tagId, setTagId] = useState<string | null>(
    trigger?.type === "tag_added" ? trigger.tagId : null
  );
  const [deviceId, setDeviceId] = useState<string | null>(
    trigger?.type === "tag_added" || trigger?.type === "message_received" || trigger?.type === "third_party"
      ? trigger.deviceId ?? null
      : null
  );

  // Message received fields
  const [matchMode, setMatchMode] = useState<MatchMode>(
    trigger?.type === "message_received" ? trigger.matchMode : "contains"
  );
  const [keywords, setKeywords] = useState<string[]>(
    trigger?.type === "message_received" ? trigger.keywords : []
  );
  const [smartTrigger, setSmartTrigger] = useState(
    trigger?.type === "message_received" ? trigger.smartTrigger ?? false : false
  );

  // Update form when trigger changes (for editing)
  React.useEffect(() => {
    if (trigger) {
      setType(trigger.type || "none");
      setOncePerContact(trigger.oncePerContact || false);

      if (trigger.type === "tag_added") {
        setTagId(trigger.tagId);
        setDeviceId(trigger.deviceId);
      } else if (trigger.type === "message_received") {
        setDeviceId(trigger.deviceId);
        setMatchMode(trigger.matchMode);
        setKeywords(trigger.keywords);
        setSmartTrigger(trigger.smartTrigger ?? false);
      } else if (trigger.type === "third_party") {
        setDeviceId(trigger.deviceId ?? null);
        setThirdPartyTriggerId((trigger as any).thirdPartyTriggerId ?? null);
        // Load field mappings if they exist
        if ((trigger as any).fieldMappings) {
          setFieldMappings((trigger as any).fieldMappings);
        }
        // Load available source fields
        if ((trigger as any).availableSourceFields) {
          setAvailableSourceFields((trigger as any).availableSourceFields);
        }
        // Load last received timestamp
        if ((trigger as any).lastReceivedAt) {
          setLastReceivedAt(new Date((trigger as any).lastReceivedAt));
        }
      }
    }
  }, [trigger]);

  // Reset fields when type changes
  const handleTypeChange = (newType: TriggerType) => {
    setType(newType);
    // Reset fields
    setTagId(null);
    setDeviceId(null);
    setMatchMode("contains");
    setKeywords([]);
    setSmartTrigger(false);
  };

  // Third-party trigger state
  const [thirdPartyTriggerId, setThirdPartyTriggerId] = useState<string | null>(
    trigger?.type === "third_party" && (trigger as any).thirdPartyTriggerId
      ? (trigger as any).thirdPartyTriggerId
      : null
  );

  const [availableSourceFields, setAvailableSourceFields] = useState<string[]>(
    trigger?.type === "third_party" && (trigger as any).availableSourceFields
      ? (trigger as any).availableSourceFields
      : []
  );

  const [lastReceivedAt, setLastReceivedAt] = useState<Date | null>(
    trigger?.type === "third_party" && (trigger as any).lastReceivedAt
      ? new Date((trigger as any).lastReceivedAt)
      : null
  );

  // Field mapping state
  type FieldMapping = {
    id: string;
    sourceKey: string;
    targetType: "standard" | "custom";
    targetKey: string;
  };

  const [fieldMappings, setFieldMappings] = useState<FieldMapping[]>([]);
  const [customFields, setCustomFields] = useState<any[]>([]);

  // Fetch custom fields on mount
  useEffect(() => {
    const fetchCustomFields = async () => {
      try {
        const response = await fetch("/api/custom-fields");
        if (response.ok) {
          const fields = await response.json();
          setCustomFields(fields);
        }
      } catch (error) {
        console.error("Failed to fetch custom fields:", error);
      }
    };

    fetchCustomFields();
  }, []);

  // Generate webhook URL if we have a third-party trigger ID
  const webhookUrl = thirdPartyTriggerId
    ? `${process.env.NEXT_PUBLIC_APP_URL || "https://flows-api.funnelchat.app"}/api/v1/integrations/${thirdPartyTriggerId}/webhook`
    : "";

  const handleCopyWebhook = () => {
    navigator.clipboard.writeText(webhookUrl).then(() => {
      alert("URL copiada al portapapeles!");
    }).catch(() => {
      alert("Error al copiar la URL");
    });
  };

  // Field mapping functions
  const addFieldMapping = () => {
    setFieldMappings([
      ...fieldMappings,
      {
        id: `mapping-${Date.now()}`,
        sourceKey: availableSourceFields[0] || "",
        targetType: "standard",
        targetKey: "name",
      },
    ]);
  };

  const removeFieldMapping = (id: string) => {
    setFieldMappings(fieldMappings.filter((m) => m.id !== id));
  };

  const updateFieldMapping = (id: string, updates: Partial<FieldMapping>) => {
    setFieldMappings(
      fieldMappings.map((m) => (m.id === id ? { ...m, ...updates } : m))
    );
  };

  // Keyword input for message_received - textarea with parsing
  const [keywordInput, setKeywordInput] = useState(
    trigger?.type === "message_received" ? trigger.keywords.join("\n") : ""
  );

  // Parse keywords from textarea (split by newlines or commas)
  const parseKeywords = (raw: string): string[] => {
    return raw
      .split(/[\n,]/)
      .map((k) => k.trim())
      .filter((k) => k.length > 0);
  };

  const removeKeyword = (keyword: string) => {
    const filtered = keywords.filter((k) => k !== keyword);
    setKeywords(filtered);
    setKeywordInput(filtered.join("\n"));
  };

  const handleSave = async () => {
    // Validation
    if (type === "tag_added") {
      if (!tagId || !deviceId) {
        alert("Por favor selecciona un tag y un dispositivo");
        return;
      }
      const newTrigger: TagAddedTrigger = {
        id: trigger?.id || `trigger-${Date.now()}`,
        name: "",
        type: "tag_added",
        tagId,
        deviceId,
        oncePerContact,
      };
      onSave(newTrigger);
    } else if (type === "message_received") {
      if (keywords.length === 0) {
        alert("Por favor ingresa al menos una palabra clave");
        return;
      }
      const newTrigger: MessageReceivedTrigger = {
        id: trigger?.id || `trigger-${Date.now()}`,
        name: "",
        type: "message_received",
        deviceId,
        matchMode,
        keywords,
        oncePerContact,
        smartTrigger,
      };
      onSave(newTrigger);
    } else if (type === "third_party") {
      // Validate device is selected
      if (!deviceId) {
        alert("Por favor selecciona un dispositivo");
        return;
      }

      // We need a flowId to create the trigger - we'll pass a placeholder
      // and the parent component (FlowBuilder) will update it with the real flowId after saving
      const newTrigger: TriggerConfig = {
        id: trigger?.id || `trigger-${Date.now()}`,
        name: "",
        type: "third_party",
        deviceId: deviceId ?? undefined,
        webhookUrl,
        fields: [],
        oncePerContact,
        thirdPartyTriggerId, // Pass the DB trigger ID if it exists
        fieldMappings, // Include field mappings
      } as any;

      onSave(newTrigger);
    } else {
      const newTrigger: TriggerConfig = {
        id: trigger?.id || `trigger-${Date.now()}`,
        name: "",
        type: "none",
        oncePerContact,
      };
      onSave(newTrigger);
    }
  };

  return (
    <>
      {/* Overlay */}
      <div
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/20"
        onClick={onClose}
      >
        {/* Modal Card - Single scrolling container */}
        <div
          className="relative mx-auto w-full max-w-2xl max-h-[90vh] overflow-y-scroll rounded-2xl bg-white p-6 shadow-xl"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Close button */}
          <button
            onClick={onClose}
            className="absolute right-4 top-4 text-gray-400 hover:text-gray-600 transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>

          {/* Header */}
          <h2 className="text-xl font-semibold text-gray-900 mb-1">
            Configurar disparador
          </h2>

          {/* Content */}
          <div className="flex flex-col gap-4 mt-4">
              {/* Subtitle */}
              <p className="text-xs text-gray-600">
                Escribe un título descriptivo y selecciona la opción que mejor se adapte a tus objetivos
              </p>

              {/* Trigger type select */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Tipo de disparador
                </label>
                <select
                  value={type}
                  onChange={(e) => handleTypeChange(e.target.value as TriggerType)}
                  className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#6D5BFA] focus:border-[#6D5BFA]"
                >
                  <option value="none">Sin disparador</option>
                  <option value="tag_added">Tag agregado</option>
                  <option value="message_received">Mensaje recibido</option>
                  <option value="third_party">Integración con terceros</option>
                </select>
              </div>

              {/* Content based on type */}
              {type === "none" && (
                <p className="text-sm text-gray-400">
                  Ningún valor seleccionado por el momento
                </p>
              )}

              {/* TAG AGREGADO */}
              {type === "tag_added" && (
                <>
                  {/* Tag select */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Selecciona un tag
                    </label>
                    <select
                      value={tagId ?? ""}
                      onChange={(e) => setTagId(e.target.value || null)}
                      className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#6D5BFA] focus:border-[#6D5BFA]"
                    >
                      <option value="">
                        {loadingTags ? "Cargando tags..." : "Selecciona un tag"}
                      </option>
                      {tags.map((tag) => (
                        <option key={tag.id} value={tag.id}>
                          {tag.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Device select */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Selecciona un dispositivo
                    </label>
                    <select
                      value={deviceId ?? ""}
                      onChange={(e) => setDeviceId(e.target.value || null)}
                      className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#6D5BFA] focus:border-[#6D5BFA]"
                    >
                      <option value="">Selecciona un dispositivo</option>
                      {safeDevices.map((device) => (
                        <option key={device.id} value={device.id}>
                          {device.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </>
              )}

              {/* MENSAJE RECIBIDO */}
              {type === "message_received" && (
                <>
                  {/* Device select */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Dispositivo
                    </label>
                    <select
                      value={deviceId ?? ""}
                      onChange={(e) => setDeviceId(e.target.value || null)}
                      className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#6D5BFA] focus:border-[#6D5BFA]"
                    >
                      <option value="">Enviar en cualquier dispositivo</option>
                      {safeDevices.map((device) => (
                        <option key={device.id} value={device.id}>
                          {device.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Match mode radio group */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Modo de coincidencia
                    </label>
                    <div className="flex flex-col gap-2">
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="radio"
                          checked={matchMode === "contains"}
                          onChange={() => setMatchMode("contains")}
                          className="w-4 h-4 text-[#6D5BFA]"
                        />
                        <span className="text-sm text-gray-700">Contiene</span>
                      </label>
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="radio"
                          checked={matchMode === "exact"}
                          onChange={() => setMatchMode("exact")}
                          className="w-4 h-4 text-[#6D5BFA]"
                        />
                        <span className="text-sm text-gray-700">Exacto</span>
                      </label>
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="radio"
                          checked={matchMode === "all"}
                          onChange={() => setMatchMode("all")}
                          className="w-4 h-4 text-[#6D5BFA]"
                        />
                        <span className="text-sm text-gray-700">Todos</span>
                      </label>
                    </div>
                  </div>

                  {/* Keywords textarea */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Palabras clave
                    </label>
                    <textarea
                      value={keywordInput}
                      onChange={(e) => {
                        const value = e.target.value;
                        setKeywordInput(value);
                        const parsed = parseKeywords(value);
                        setKeywords(parsed);
                      }}
                      placeholder="Ingrese palabras o frases clave (una por línea o separadas por comas)"
                      rows={4}
                      className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[#6D5BFA] focus:border-[#6D5BFA] resize-none"
                    />
                    {/* Keywords list */}
                    {keywords.length > 0 && (
                      <div className="flex flex-wrap gap-2 mt-2">
                        {keywords.map((keyword) => (
                          <span
                            key={keyword}
                            className="inline-flex items-center gap-1 px-2 py-1 bg-[#6D5BFA]/10 text-[#6D5BFA] text-xs rounded-md"
                          >
                            {keyword}
                            <button
                              onClick={() => removeKeyword(keyword)}
                              className="hover:text-[#5B4BD8]"
                            >
                              ×
                            </button>
                          </span>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Smart trigger checkbox */}
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={smartTrigger}
                      onChange={(e) => setSmartTrigger(e.target.checked)}
                      className="w-4 h-4 text-[#6D5BFA]"
                    />
                    <label className="text-sm text-gray-700">
                      IA✨ Disparador Inteligente
                    </label>
                    <span className="text-gray-400">🔒</span>
                  </div>
                </>
              )}

              {/* INTEGRACIÓN CON TERCEROS (don't touch) */}
              {type === "third_party" && (
                <>
                  {/* Device select */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Dispositivo
                    </label>
                    <select
                      value={deviceId ?? ""}
                      onChange={(e) => setDeviceId(e.target.value || null)}
                      className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#6D5BFA] focus:border-[#6D5BFA]"
                    >
                      <option value="">Selecciona un dispositivo</option>
                      {safeDevices.map((device) => (
                        <option key={device.id} value={device.id}>
                          {device.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Webhook URL */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      URL del webhook
                    </label>
                    <div className="relative">
                      <input
                        type="text"
                        value={webhookUrl}
                        placeholder="Guarda el flujo para generar la URL"
                        readOnly
                        className="w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 pr-10 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[#6D5BFA] focus:border-[#6D5BFA]"
                      />
                      <button
                        type="button"
                        onClick={handleCopyWebhook}
                        className="absolute inset-y-0 right-0 flex items-center pr-3 hover:opacity-70 transition-opacity"
                        title="Copiar URL"
                        disabled={!thirdPartyTriggerId}
                      >
                        <svg
                          className="w-4 h-4 text-gray-500"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 2 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
                          />
                        </svg>
                      </button>
                    </div>
                    <p className="text-xs text-gray-600 mt-2 leading-relaxed">
                      {thirdPartyTriggerId ? (
                        <>
                          Configura esta URL como webhook en tu Facebook Leads Center. Cada nuevo lead activará este flujo para el dispositivo seleccionado.
                        </>
                      ) : (
                        <>
                          Guarda el flujo primero para generar la URL del webhook.
                        </>
                      )}
                    </p>
                  </div>

                  {/* Field Mapping Section */}
                  <section className="mt-4">
                    <h3 className="text-sm font-medium text-gray-900 mb-2">
                      Mapeo de campos
                    </h3>

                    {/* Waiting for data message */}
                    {availableSourceFields.length === 0 && (
                      <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg">
                        <p className="text-sm text-amber-800">
                          ⏳ En espera de datos… Envía un POST a la URL del webhook para detectar los campos disponibles.
                        </p>
                      </div>
                    )}

                    {/* Mapping card - simple vertical flow */}
                    {availableSourceFields.length > 0 && (
                      <div className="rounded-md bg-[#F7F7FF] p-3 border border-gray-200">
                        {/* Last received timestamp */}
                        {lastReceivedAt && (
                          <div className="p-2 bg-green-50 border border-green-200 rounded-lg">
                            <p className="text-xs text-green-800">
                              ✓ Último lead recibido hace {getTimeAgo(lastReceivedAt)}
                            </p>
                          </div>
                        )}

                        {/* Mapping rows */}
                        <div className="mt-2 space-y-2">
                          {/* Field mapping rows */}
                          {fieldMappings.map((mapping) => (
                            <div key={mapping.id} className="flex gap-2 items-start">
                              {/* Source key dropdown */}
                              <div className="flex-1">
                                <select
                                  value={mapping.sourceKey}
                                  onChange={(e) =>
                                    updateFieldMapping(mapping.id, {
                                      sourceKey: e.target.value,
                                    })
                                  }
                                  className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#6D5BFA] focus:border-[#6D5BFA]"
                                >
                                  {availableSourceFields.map((field) => (
                                    <option key={field} value={field}>
                                      {field}
                                    </option>
                                  ))}
                                </select>
                              </div>

                              {/* Arrow */}
                              <div className="flex items-center pt-2">
                                <svg
                                  className="w-4 h-4 text-gray-400"
                                  fill="none"
                                  stroke="currentColor"
                                  viewBox="0 0 24 24"
                                >
                                  <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeWidth={2}
                                    d="M9 5l7 7-7 7"
                                  />
                                </svg>
                              </div>

                              {/* Target dropdown */}
                              <div className="flex-1">
                                <select
                                  value={`${mapping.targetType}:${mapping.targetKey}`}
                                  onChange={(e) => {
                                    const [targetType, targetKey] = e.target.value.split(":");
                                    updateFieldMapping(mapping.id, {
                                      targetType: targetType as "standard" | "custom",
                                      targetKey,
                                    });
                                  }}
                                  className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#6D5BFA] focus:border-[#6D5BFA]"
                                >
                                  <optgroup label="Campos estándar">
                                    <option value="standard:name">Nombre</option>
                                    <option value="standard:phone">Teléfono</option>
                                    <option value="standard:email">Email</option>
                                  </optgroup>
                                  {customFields.length > 0 && (
                                    <optgroup label="Campos personalizados">
                                      {customFields.map((field) => (
                                        <option
                                          key={field.id}
                                          value={`custom:${field.key}`}
                                        >
                                          {field.name}
                                        </option>
                                      ))}
                                    </optgroup>
                                  )}
                                </select>
                              </div>

                              {/* Delete button */}
                              <button
                                type="button"
                                onClick={() => removeFieldMapping(mapping.id)}
                                className="mt-2 text-gray-400 hover:text-red-500 transition-colors"
                                title="Eliminar"
                              >
                                <svg
                                  className="w-4 h-4"
                                  fill="none"
                                  stroke="currentColor"
                                  viewBox="0 0 24 24"
                                >
                                  <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeWidth={2}
                                    d="M6 18L18 6M6 6l12 12"
                                  />
                                </svg>
                              </button>
                            </div>
                          ))}

                          {/* Add field button */}
                          <button
                            type="button"
                            onClick={addFieldMapping}
                            className="w-full inline-flex items-center justify-center gap-1 rounded-lg px-3 py-2 text-sm font-medium bg-[#6D5BFA] text-white hover:bg-[#5B4BD8]"
                          >
                            + Agregar campo
                          </button>
                        </div>

                        {/* Helper text - outside scroll, inside card */}
                        <p className="mt-2 text-[11px] text-gray-500">
                          Mapea los campos del webhook a los campos de contacto. Si no configuras ningún mapeo, se usarán los campos por defecto (full_name, phone_number, email).
                        </p>
                      </div>
                    )}
                  </section>
                </>
              )}

              {/* Toggle - shown for all types except none */}
              {type !== "none" && (
                <div className="flex items-center justify-between">
                  <label className="text-sm text-gray-700">
                    Activar esta automatización una sola vez por contacto
                  </label>
                  <button
                    onClick={() => setOncePerContact(!oncePerContact)}
                    className={`relative inline-flex h-5 w-10 items-center rounded-full transition-colors ${
                      oncePerContact ? "bg-[#6D5BFA]" : "bg-gray-200"
                    }`}
                  >
                    <span
                      className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                        oncePerContact ? "translate-x-5" : "translate-x-0"
                      }`}
                    />
                  </button>
                </div>
              )}

            {/* Footer Buttons */}
            <div className="mt-6 pt-4 flex gap-3 justify-end border-t border-gray-200">
              <button
                onClick={onClose}
                className="px-5 py-2.5 text-gray-700 hover:bg-gray-100 rounded-xl transition-colors font-medium"
              >
                Cancelar
              </button>
              <button
                onClick={handleSave}
                className="px-5 py-2.5 bg-[#6D5BFA] text-white rounded-xl hover:bg-[#5B4BD8] transition-colors shadow-sm font-medium"
              >
                Agregar disparador
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
