"use client";

import { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import { SidebarLayout } from "@/app/components/SidebarLayout";

interface Device {
  id: string;
  name: string;
  phoneNumber: string | null;
  isConnected: boolean;
}

export default function EditarWhalinkPage() {
  const router = useRouter();
  const params = useParams();
  const whalinkId = params?.id as string;

  const [activeTab, setActiveTab] = useState<"general" | "advanced">("general");
  const [devices, setDevices] = useState<Device[]>([]);
  const [formData, setFormData] = useState({
    name: "",
    deviceId: "",
    presetMessage: "",
    image: "",
    description: "",
    emailKey: "",
    nameKey: "",
    trackingPixel: "",
  });
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (whalinkId) {
      loadDevices();
      loadWhalink();
    }
  }, [whalinkId]);

  const loadDevices = async () => {
    try {
      const res = await fetch("/api/devices");
      const data = await res.json();

      // Handle both array and object responses defensively
      const devicesArray = Array.isArray(data)
        ? data
        : Array.isArray(data?.devices)
          ? data.devices
          : [];

      setDevices(devicesArray);
    } catch (error) {
      console.error("Failed to load devices:", error);
      setDevices([]);
    }
  };

  const loadWhalink = async () => {
    try {
      const res = await fetch(`/api/whalinks/${whalinkId}`);
      if (!res.ok) throw new Error("Failed to load");
      const data = await res.json();
      setFormData({
        name: data.name,
        deviceId: data.deviceId,
        presetMessage: data.presetMessage,
        image: data.image || "",
        description: data.description || "",
        emailKey: data.emailKey || "",
        nameKey: data.nameKey || "",
        trackingPixel: data.trackingPixel || "",
      });
    } catch (error) {
      console.error("Failed to load whalink:", error);
      alert("Error al cargar el whalink");
      router.push("/whalink");
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);

    try {
      const res = await fetch(`/api/whalinks/${whalinkId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Failed to update link");
      }

      router.push("/whalink");
    } catch (error: any) {
      alert(error.message || "Error al actualizar el link");
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <SidebarLayout><div className="p-8">Cargando...</div></SidebarLayout>;

  const nameLength = formData.name.length;
  const messageLength = formData.presetMessage.length;

  return (
    <SidebarLayout>
      <div className="p-8">
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-gray-900">Editar link</h1>
          <p className="text-gray-600 mt-1">Modifica tu enlace de WhatsApp</p>
        </div>

        <form onSubmit={handleSubmit}>
          {/* Tabs */}
          <div className="border-b border-gray-200 mb-6">
            <nav className="flex gap-8">
              <button
                type="button"
                onClick={() => setActiveTab("general")}
                className={`py-2 px-1 border-b-2 font-medium text-sm ${
                  activeTab === "general"
                    ? "border-[#6D5BFA] text-[#6D5BFA]"
                    : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
                }`}
              >
                Opciones generales
              </button>
              <button
                type="button"
                onClick={() => setActiveTab("advanced")}
                className={`py-2 px-1 border-b-2 font-medium text-sm ${
                  activeTab === "advanced"
                    ? "border-[#6D5BFA] text-[#6D5BFA]"
                    : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
                }`}
              >
                Opciones avanzadas
              </button>
            </nav>
          </div>

          {/* General Tab */}
          {activeTab === "general" && (
            <div className="grid grid-cols-2 gap-8">
              <div className="space-y-6">
                {/* Device */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Número de WhatsApp <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={formData.deviceId}
                    onChange={(e) => setFormData({ ...formData, deviceId: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#6D5BFA]"
                    required
                  >
                    <option value="">Selecciona un dispositivo</option>
                    {devices.map((device) => (
                      <option key={device.id} value={device.id}>
                        {device.name} ({device.phoneNumber || "Sin número"})
                        {device.isConnected ? " ✓" : " ○"}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Name */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Nombre <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    maxLength={100}
                    placeholder="Escribe el nombre"
                    className="w-full px-3 py-2 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#6D5BFA]"
                    required
                  />
                  <div className="text-xs text-gray-500 mt-1 text-right">{nameLength}/100</div>
                </div>

                {/* Preset Message */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Mensaje predeterminado <span className="text-red-500">*</span>
                  </label>
                  <textarea
                    value={formData.presetMessage}
                    onChange={(e) => setFormData({ ...formData, presetMessage: e.target.value })}
                    maxLength={250}
                    rows={4}
                    placeholder="Escribe el mensaje"
                    className="w-full px-3 py-2 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#6D5BFA] resize-none"
                    required
                  />
                  <div className="text-xs text-gray-500 mt-1 text-right">{messageLength}/250</div>
                  <p className="text-xs text-[#6D5BFA] mt-2 leading-relaxed">
                    Mensaje predeterminado que redirecciona al contacto a iniciar una conversación en WhatsApp.
                    Las palabras de este mensaje se utilizarán para ejecutar acciones automáticas.
                  </p>
                </div>
              </div>

              {/* Preview */}
              <div>
                <div className="sticky top-8">
                  <p className="text-sm font-medium text-gray-700 mb-3">Vista previa</p>
                  <div className="bg-gradient-to-b from-[#075E54] to-[#128C7E] rounded-3xl p-4 shadow-xl">
                    <div className="bg-white rounded-2xl p-4 min-h-[400px] flex flex-col">
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
                        {formData.presetMessage && (
                          <div className="bg-[#E7FFDB] rounded-lg rounded-bl-none px-3 py-2 max-w-[85%]">
                            <p className="text-sm text-gray-900 whitespace-pre-wrap">
                              {formData.presetMessage}
                            </p>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Advanced Tab */}
          {activeTab === "advanced" && (
            <div className="max-w-2xl space-y-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Imagen</label>
                <input
                  type="text"
                  value={formData.image}
                  onChange={(e) => setFormData({ ...formData, image: e.target.value })}
                  placeholder="URL de la imagen"
                  className="w-full px-3 py-2 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#6D5BFA]"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Descripción</label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  rows={3}
                  placeholder="Descripción del link"
                  className="w-full px-3 py-2 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#6D5BFA] resize-none"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Clave de correo electrónico</label>
                <input
                  type="text"
                  value={formData.emailKey}
                  onChange={(e) => setFormData({ ...formData, emailKey: e.target.value })}
                  placeholder="email"
                  className="w-full px-3 py-2 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#6D5BFA]"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Clave de nombre</label>
                <input
                  type="text"
                  value={formData.nameKey}
                  onChange={(e) => setFormData({ ...formData, nameKey: e.target.value })}
                  placeholder="name"
                  className="w-full px-3 py-2 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#6D5BFA]"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Pixel de seguimiento</label>
                <input
                  type="text"
                  value={formData.trackingPixel}
                  onChange={(e) => setFormData({ ...formData, trackingPixel: e.target.value })}
                  placeholder="Código del pixel"
                  className="w-full px-3 py-2 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#6D5BFA]"
                />
              </div>
            </div>
          )}

          {/* Buttons */}
          <div className="mt-8 flex items-center gap-4">
            <button
              type="button"
              onClick={() => router.push("/whalink")}
              className="px-6 py-2.5 border border-gray-300 rounded-xl text-gray-700 hover:bg-gray-50 transition-colors font-medium"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-6 py-2.5 bg-[#6D5BFA] text-white rounded-xl hover:bg-[#5B4BD8] transition-colors font-medium disabled:opacity-50"
            >
              {saving ? "Guardando..." : "Guardar cambios"}
            </button>
          </div>
        </form>
      </div>
    </SidebarLayout>
  );
}
