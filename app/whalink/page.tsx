"use client";

import { useState } from "react";
import { SidebarLayout } from "@/app/components/SidebarLayout";

export default function WhalinkPage() {
  const [config, setConfig] = useState({
    apiKey: "",
    webhookUrl: "",
    enabled: false,
  });

  const handleSave = () => {
    // Here you would save to backend
    alert("Configuración guardada exitosamente");
  };

  return (
    <SidebarLayout>
      <div className="p-8">
        <div className="max-w-2xl mx-auto">
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-gray-900">Configuración de Whalink</h1>
            <p className="text-gray-600 mt-1">Configura la integración con Whalink</p>
          </div>

          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 space-y-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                API Key
              </label>
              <input
                type="password"
                value={config.apiKey}
                onChange={(e) => setConfig({ ...config, apiKey: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#6D5BFA]"
                placeholder="Ingresa tu API Key de Whalink"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Webhook URL
              </label>
              <input
                type="text"
                value={config.webhookUrl}
                onChange={(e) => setConfig({ ...config, webhookUrl: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#6D5BFA]"
                placeholder="https://tu-dominio.com/webhook"
              />
            </div>

            <div className="flex items-center justify-between pt-4 border-t border-gray-200">
              <div>
                <div className="text-sm font-medium text-gray-700">
                  Habilitar integración
                </div>
                <div className="text-xs text-gray-500 mt-1">
                  Activa o desactiva la conexión con Whalink
                </div>
              </div>
              <button
                onClick={() => setConfig({ ...config, enabled: !config.enabled })}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                  config.enabled ? "bg-[#6D5BFA]" : "bg-gray-300"
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    config.enabled ? "translate-x-6" : "translate-x-1"
                  }`}
                />
              </button>
            </div>

            <div className="pt-4">
              <button
                onClick={handleSave}
                className="w-full bg-[#6D5BFA] text-white px-6 py-2.5 rounded-xl hover:bg-[#5B4BD8] transition-colors shadow-sm font-medium"
              >
                Guardar Configuración
              </button>
            </div>
          </div>
        </div>
      </div>
    </SidebarLayout>
  );
}
