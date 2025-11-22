"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { SidebarLayout } from "@/app/components/SidebarLayout";

interface Device {
  id: string;
  name: string;
  phoneNumber: string | null;
}

interface Tag {
  id: string;
  name: string;
  color: string;
}

interface CustomField {
  id: string;
  name: string;
  key: string;
  type: string;
}

interface FormData {
  // Step 1
  name: string;
  deviceId: string;
  mediaType: "NONE" | "IMAGE" | "VIDEO";
  mediaUrl: string;
  body: string;

  // Step 2
  includeTags: string[];
  excludeTags: string[];
  contactsFrom: string;
  contactsTo: string;

  // Step 3
  sendOption: "NOW" | "SCHEDULED";
  scheduledAt: string;
  speed: "SLOW" | "MEDIUM" | "FAST";
}

export default function CreateMassSendPage() {
  const router = useRouter();
  const [currentStep, setCurrentStep] = useState(1);
  const [devices, setDevices] = useState<Device[]>([]);
  const [tags, setTags] = useState<Tag[]>([]);
  const [customFields, setCustomFields] = useState<CustomField[]>([]);
  const [previewCount, setPreviewCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [showFieldsDropdown, setShowFieldsDropdown] = useState(false);
  const [fieldSearchTerm, setFieldSearchTerm] = useState("");

  const [formData, setFormData] = useState<FormData>({
    name: "",
    deviceId: "",
    mediaType: "NONE",
    mediaUrl: "",
    body: "",
    includeTags: [],
    excludeTags: [],
    contactsFrom: "",
    contactsTo: "",
    sendOption: "SCHEDULED",
    scheduledAt: "",
    speed: "SLOW",
  });

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    if (currentStep === 2) {
      updatePreviewCount();
    }
  }, [formData.includeTags, formData.excludeTags, formData.contactsFrom, formData.contactsTo, currentStep]);

  const loadData = async () => {
    try {
      const [devicesRes, tagsRes, fieldsRes] = await Promise.all([
        fetch("/api/devices"),
        fetch("/api/tags"),
        fetch("/api/custom-fields"),
      ]);
      const devicesData = await devicesRes.json();
      const tagsData = await tagsRes.json();
      const fieldsData = await fieldsRes.json();
      setDevices(devicesData);
      setTags(tagsData);
      setCustomFields(fieldsData);
    } catch (error) {
      console.error("Failed to load data:", error);
    }
  };

  const updatePreviewCount = async () => {
    try {
      const params = new URLSearchParams({
        includeTags: JSON.stringify(formData.includeTags),
        excludeTags: JSON.stringify(formData.excludeTags),
      });
      if (formData.contactsFrom) params.append("contactsFrom", formData.contactsFrom);
      if (formData.contactsTo) params.append("contactsTo", formData.contactsTo);

      const res = await fetch(`/api/mass-sends/preview-count?${params}`);
      const data = await res.json();
      setPreviewCount(data.count);
    } catch (error) {
      console.error("Failed to get preview count:", error);
    }
  };

  const canProceedStep1 = () => {
    return formData.name && formData.deviceId && (formData.body || formData.mediaUrl);
  };

  const canProceedStep2 = () => {
    return (formData.includeTags.length > 0 || formData.contactsFrom || formData.contactsTo) && previewCount > 0;
  };

  const canSubmit = () => {
    if (formData.sendOption === "SCHEDULED" && !formData.scheduledAt) {
      return false;
    }
    if (formData.sendOption === "SCHEDULED") {
      const scheduledDate = new Date(formData.scheduledAt);
      if (scheduledDate <= new Date()) {
        return false;
      }
    }
    return true;
  };

  const handleNext = () => {
    if (currentStep < 3) {
      setCurrentStep(currentStep + 1);
    }
  };

  const handleBack = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
    } else {
      router.push("/envio-masivo");
    }
  };

  const handleSubmit = async () => {
    if (!canSubmit()) return;

    setLoading(true);
    try {
      const res = await fetch("/api/mass-sends", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: formData.name,
          deviceId: formData.deviceId,
          body: formData.body,
          mediaType: formData.mediaType,
          mediaUrl: formData.mediaUrl || null,
          includeTags: formData.includeTags,
          excludeTags: formData.excludeTags,
          contactsFrom: formData.contactsFrom || null,
          contactsTo: formData.contactsTo || null,
          sendOption: formData.sendOption,
          scheduledAt: formData.scheduledAt || null,
          speed: formData.speed,
          totalContacts: previewCount,
        }),
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Failed to create mass send");
      }

      router.push("/envio-masivo");
    } catch (error: any) {
      alert(error.message || "Error al crear el envío masivo");
    } finally {
      setLoading(false);
    }
  };

  const insertField = (fieldKey: string) => {
    const textarea = document.querySelector('textarea') as HTMLTextAreaElement;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const text = formData.body;
    const before = text.substring(0, start);
    const after = text.substring(end);
    const newText = before + `{{${fieldKey}}}` + after;

    setFormData({ ...formData, body: newText });
    setShowFieldsDropdown(false);

    // Set cursor position after inserted text
    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(start + fieldKey.length + 4, start + fieldKey.length + 4);
    }, 0);
  };

  const wrapSelection = (prefix: string, suffix: string) => {
    const textarea = document.querySelector('textarea') as HTMLTextAreaElement;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const text = formData.body;
    const selectedText = text.substring(start, end);
    const before = text.substring(0, start);
    const after = text.substring(end);
    const newText = before + prefix + selectedText + suffix + after;

    setFormData({ ...formData, body: newText });

    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(start + prefix.length, end + prefix.length);
    }, 0);
  };

  const systemFields = [
    { key: "nombre_completo", label: "Nombre completo" },
    { key: "primer_nombre", label: "Primer nombre" },
    { key: "correo", label: "Correo" },
    { key: "telefono", label: "Teléfono" },
  ];

  const filteredSystemFields = systemFields.filter((f) =>
    f.label.toLowerCase().includes(fieldSearchTerm.toLowerCase())
  );

  const filteredCustomFields = customFields.filter((f) =>
    f.name.toLowerCase().includes(fieldSearchTerm.toLowerCase())
  );

  return (
    <SidebarLayout>
      <div className="p-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Crear envío masivo</h1>
          <p className="text-gray-600 mt-1">
            Configura tu mensaje y audiencia en 3 simples pasos
          </p>
        </div>

        {/* Stepper */}
        <div className="mb-8">
          <div className="flex items-center justify-between max-w-3xl mx-auto">
            {[
              { num: 1, title: "Enviar mensaje", desc: "Selecciona una plantilla o crea un mensaje nuevo" },
              { num: 2, title: "Seleccionar audiencia", desc: "Selecciona los contactos que recibirán el envío masivo" },
              { num: 3, title: "Programar envío", desc: "Selecciona una fecha y hora para el envío" },
            ].map((step, idx) => (
              <div key={step.num} className="flex items-center flex-1">
                <div className="flex flex-col items-center flex-1">
                  <div
                    className={`w-10 h-10 rounded-full flex items-center justify-center font-semibold ${
                      currentStep > step.num
                        ? "bg-[#6D5BFA] text-white"
                        : currentStep === step.num
                        ? "bg-[#6D5BFA] text-white"
                        : "bg-gray-200 text-gray-500"
                    }`}
                  >
                    {currentStep > step.num ? "✓" : step.num}
                  </div>
                  <p className="mt-2 text-sm font-medium text-gray-700">{step.title}</p>
                  <p className="text-xs text-gray-500 text-center max-w-[150px]">
                    {step.desc}
                  </p>
                </div>
                {idx < 2 && (
                  <div className={`h-0.5 w-full mx-4 ${currentStep > step.num + 1 ? "bg-[#6D5BFA]" : "bg-gray-200"}`}></div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Step Content */}
        <div className="bg-white rounded-lg border border-gray-200 p-8">
          {/* Step 1: Message Creation */}
          {currentStep === 1 && (
            <div className="grid grid-cols-2 gap-8">
              {/* Left Column */}
              <div className="space-y-6">
                {/* Title */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Título del envío <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="Ej: Oferta Navidad"
                    className="w-full px-3 py-2 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#6D5BFA]"
                  />
                </div>

                {/* Device */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Dispositivo <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={formData.deviceId}
                    onChange={(e) => setFormData({ ...formData, deviceId: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#6D5BFA]"
                  >
                    <option value="">Selecciona un dispositivo</option>
                    {devices.map((device) => (
                      <option key={device.id} value={device.id}>
                        {device.name} ({device.phoneNumber || "Sin número"})
                      </option>
                    ))}
                  </select>
                </div>

                {/* Warning */}
                <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4">
                  <p className="text-sm text-yellow-800">
                    ⚠️ Evita enviar difusiones masivas a contactos que podrían considerar el mensaje como spam, para evitar que WhatsApp bloquee tu número.
                  </p>
                </div>

                {/* Media */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Adjuntar multimedia (opcional)
                  </label>
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      type="button"
                      onClick={() => setFormData({ ...formData, mediaType: "IMAGE" })}
                      className={`p-4 border-2 border-dashed rounded-xl text-center hover:border-[#6D5BFA] hover:bg-purple-50 transition-colors ${
                        formData.mediaType === "IMAGE" ? "border-[#6D5BFA] bg-purple-50" : "border-gray-300"
                      }`}
                    >
                      <div className="text-2xl mb-2">🖼️</div>
                      <p className="text-sm font-medium">Imagen</p>
                    </button>
                    <button
                      type="button"
                      onClick={() => setFormData({ ...formData, mediaType: "VIDEO" })}
                      className={`p-4 border-2 border-dashed rounded-xl text-center hover:border-[#6D5BFA] hover:bg-purple-50 transition-colors ${
                        formData.mediaType === "VIDEO" ? "border-[#6D5BFA] bg-purple-50" : "border-gray-300"
                      }`}
                    >
                      <div className="text-2xl mb-2">🎥</div>
                      <p className="text-sm font-medium">Video</p>
                    </button>
                  </div>
                  {formData.mediaType !== "NONE" && (
                    <input
                      type="url"
                      value={formData.mediaUrl}
                      onChange={(e) => setFormData({ ...formData, mediaUrl: e.target.value })}
                      placeholder="URL del archivo multimedia"
                      className="mt-3 w-full px-3 py-2 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#6D5BFA]"
                    />
                  )}
                </div>

                {/* Message */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Mensaje <span className="text-red-500">*</span>
                  </label>
                  <div className="border border-gray-300 rounded-xl overflow-hidden">
                    {/* Toolbar */}
                    <div className="bg-gray-50 border-b border-gray-300 px-3 py-2 flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => wrapSelection("*", "*")}
                        className="p-1.5 hover:bg-gray-200 rounded"
                        title="Negrita"
                      >
                        <strong>B</strong>
                      </button>
                      <button
                        type="button"
                        onClick={() => wrapSelection("_", "_")}
                        className="p-1.5 hover:bg-gray-200 rounded"
                        title="Cursiva"
                      >
                        <em>I</em>
                      </button>
                      <button
                        type="button"
                        onClick={() => wrapSelection("~", "~")}
                        className="p-1.5 hover:bg-gray-200 rounded"
                        title="Tachado"
                      >
                        <s>S</s>
                      </button>
                      <div className="relative">
                        <button
                          type="button"
                          onClick={() => setShowFieldsDropdown(!showFieldsDropdown)}
                          className="p-1.5 hover:bg-gray-200 rounded"
                          title="Campos customizados"
                        >
                          {"{"}{"}"}
                        </button>
                        {showFieldsDropdown && (
                          <div className="absolute top-full left-0 mt-1 w-80 bg-white border border-gray-300 rounded-xl shadow-lg z-10 max-h-96 overflow-auto">
                            <div className="p-3 border-b border-gray-200">
                              <input
                                type="text"
                                value={fieldSearchTerm}
                                onChange={(e) => setFieldSearchTerm(e.target.value)}
                                placeholder="Buscar"
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#6D5BFA]"
                              />
                            </div>
                            <div className="p-2">
                              {filteredSystemFields.length > 0 && (
                                <>
                                  <p className="text-xs font-medium text-gray-500 uppercase px-2 py-1">
                                    Campos del sistema
                                  </p>
                                  {filteredSystemFields.map((field) => (
                                    <button
                                      key={field.key}
                                      type="button"
                                      onClick={() => insertField(field.key)}
                                      className="w-full text-left px-3 py-2 hover:bg-gray-100 rounded-lg text-sm"
                                    >
                                      {field.label}
                                    </button>
                                  ))}
                                </>
                              )}
                              {filteredCustomFields.length > 0 && (
                                <>
                                  <p className="text-xs font-medium text-gray-500 uppercase px-2 py-1 mt-2">
                                    Campos customizados
                                  </p>
                                  {filteredCustomFields.map((field) => (
                                    <button
                                      key={field.id}
                                      type="button"
                                      onClick={() => insertField(field.key)}
                                      className="w-full text-left px-3 py-2 hover:bg-gray-100 rounded-lg text-sm"
                                    >
                                      {field.name}
                                    </button>
                                  ))}
                                </>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                    <textarea
                      value={formData.body}
                      onChange={(e) => setFormData({ ...formData, body: e.target.value })}
                      placeholder="Escribe un mensaje..."
                      rows={6}
                      className="w-full px-3 py-2 focus:outline-none resize-none"
                    />
                  </div>
                </div>
              </div>

              {/* Right Column - Preview */}
              <div>
                <p className="text-sm font-medium text-gray-700 mb-3">Vista previa</p>
                <div className="bg-gradient-to-b from-[#075E54] to-[#128C7E] rounded-3xl p-4 shadow-xl">
                  <div className="bg-white rounded-2xl p-4 min-h-[500px] flex flex-col">
                    <div className="flex items-center gap-3 pb-4 border-b border-gray-200">
                      <div className="w-10 h-10 rounded-full bg-gray-300"></div>
                      <div className="flex-1">
                        <p className="font-semibold text-sm text-gray-900">
                          {devices.find((d) => d.id === formData.deviceId)?.phoneNumber || "WhatsApp"}
                        </p>
                        <p className="text-xs text-green-600">En línea</p>
                      </div>
                    </div>
                    <div className="flex-1 flex items-end py-4">
                      {formData.body && (
                        <div className="bg-[#E7FFDB] rounded-lg rounded-bl-none px-3 py-2 max-w-[85%]">
                          {formData.mediaType !== "NONE" && formData.mediaUrl && (
                            <div className="mb-2 text-xs text-gray-500">
                              {formData.mediaType === "IMAGE" ? "📷 Imagen" : "🎥 Video"}
                            </div>
                          )}
                          <p className="text-sm text-gray-900 whitespace-pre-wrap">
                            {formData.body.replace(/\{\{(\w+)\}\}/g, "$1")}
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Step 2: Audience Selection */}
          {currentStep === 2 && (
            <div className="space-y-6">
              {/* Preview Count */}
              <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 flex items-center gap-3">
                <div className="text-3xl">👥</div>
                <div>
                  <p className="font-semibold text-blue-900">
                    Vista previa: {previewCount} contactos
                  </p>
                  <p className="text-sm text-blue-700">
                    Que recibirán este envío masivo
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-8">
                {/* Include Audience */}
                <div className="space-y-4">
                  <div>
                    <h3 className="font-semibold text-gray-900 mb-1">Incluir audiencia</h3>
                    <p className="text-sm text-gray-600">Con CUALQUIERA de estos tags</p>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Tags</label>
                    <select
                      multiple
                      value={formData.includeTags}
                      onChange={(e) => {
                        const selected = Array.from(e.target.selectedOptions, (option) => option.value);
                        setFormData({ ...formData, includeTags: selected });
                      }}
                      className="w-full px-3 py-2 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#6D5BFA] min-h-[120px]"
                    >
                      {tags.map((tag) => (
                        <option key={tag.id} value={tag.id}>
                          {tag.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Contactos desde
                    </label>
                    <input
                      type="datetime-local"
                      value={formData.contactsFrom}
                      onChange={(e) => setFormData({ ...formData, contactsFrom: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#6D5BFA]"
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      Contactos añadidos entre estas fechas
                    </p>
                    <p className="text-xs text-gray-500">Europe/Madrid (UTC+1)</p>
                  </div>
                </div>

                {/* Exclude Audience */}
                <div className="space-y-4">
                  <div>
                    <h3 className="font-semibold text-gray-900 mb-1">Excluir audiencia</h3>
                    <p className="text-sm text-gray-600">Con CUALQUIERA de estos tags</p>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Tags</label>
                    <select
                      multiple
                      value={formData.excludeTags}
                      onChange={(e) => {
                        const selected = Array.from(e.target.selectedOptions, (option) => option.value);
                        setFormData({ ...formData, excludeTags: selected });
                      }}
                      className="w-full px-3 py-2 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#6D5BFA] min-h-[120px]"
                    >
                      {tags.map((tag) => (
                        <option key={tag.id} value={tag.id}>
                          {tag.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Hasta</label>
                    <input
                      type="datetime-local"
                      value={formData.contactsTo}
                      onChange={(e) => setFormData({ ...formData, contactsTo: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#6D5BFA]"
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      Contactos añadidos entre estas fechas
                    </p>
                    <p className="text-xs text-gray-500">Europe/Madrid (UTC+1)</p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Step 3: Schedule */}
          {currentStep === 3 && (
            <div className="max-w-2xl mx-auto space-y-6">
              <div>
                <h3 className="font-semibold text-gray-900 mb-4">Opciones de envío</h3>
                <div className="space-y-3">
                  <label className="flex items-center gap-3 p-4 border border-gray-300 rounded-xl cursor-pointer hover:border-[#6D5BFA] transition-colors">
                    <input
                      type="radio"
                      name="sendOption"
                      checked={formData.sendOption === "NOW"}
                      onChange={() => setFormData({ ...formData, sendOption: "NOW" })}
                      className="w-4 h-4 text-[#6D5BFA]"
                    />
                    <span className="font-medium">Enviar mensaje ahora</span>
                  </label>
                  <label className="flex items-center gap-3 p-4 border border-gray-300 rounded-xl cursor-pointer hover:border-[#6D5BFA] transition-colors">
                    <input
                      type="radio"
                      name="sendOption"
                      checked={formData.sendOption === "SCHEDULED"}
                      onChange={() => setFormData({ ...formData, sendOption: "SCHEDULED" })}
                      className="w-4 h-4 text-[#6D5BFA]"
                    />
                    <span className="font-medium">Programar envío masivo</span>
                  </label>
                </div>
              </div>

              {formData.sendOption === "SCHEDULED" && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Programar <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="datetime-local"
                    value={formData.scheduledAt}
                    onChange={(e) => setFormData({ ...formData, scheduledAt: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#6D5BFA]"
                  />
                  <p className="text-xs text-gray-500 mt-1">Europe/Madrid (UTC+1)</p>
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-4">
                  Velocidad de envío
                </label>
                <div className="space-y-2">
                  <input
                    type="range"
                    min="0"
                    max="2"
                    value={formData.speed === "SLOW" ? 0 : formData.speed === "MEDIUM" ? 1 : 2}
                    onChange={(e) => {
                      const value = parseInt(e.target.value);
                      const speed = value === 0 ? "SLOW" : value === 1 ? "MEDIUM" : "FAST";
                      setFormData({ ...formData, speed });
                    }}
                    className="w-full"
                  />
                  <div className="flex justify-between text-sm">
                    <span>🐢 Lento</span>
                    <span>Medio</span>
                    <span>🤖 Rápido</span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Navigation Buttons */}
        <div className="mt-8 flex items-center justify-between">
          <button
            onClick={handleBack}
            className="px-6 py-2.5 border border-gray-300 rounded-xl text-gray-700 hover:bg-gray-50 transition-colors font-medium"
          >
            Volver
          </button>
          {currentStep < 3 ? (
            <button
              onClick={handleNext}
              disabled={
                (currentStep === 1 && !canProceedStep1()) ||
                (currentStep === 2 && !canProceedStep2())
              }
              className="px-6 py-2.5 bg-[#6D5BFA] text-white rounded-xl hover:bg-[#5B4BD8] transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Siguiente
            </button>
          ) : (
            <button
              onClick={handleSubmit}
              disabled={!canSubmit() || loading}
              className="px-6 py-2.5 bg-[#6D5BFA] text-white rounded-xl hover:bg-[#5B4BD8] transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? "Creando..." : "Crear envío masivo"}
            </button>
          )}
        </div>
      </div>
    </SidebarLayout>
  );
}
