"use client";

import { SidebarLayout } from "@/app/components/SidebarLayout";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useGlobal } from "../providers/GlobalProvider";

export default function IntegracionesPage() {
  const router = useRouter();
  const { whatsappNumber, setWhatsappNumber, defaultAgent, setDefaultAgent } = useGlobal();
  const [whatsappMode, setWhatsappMode] = useState<"cloud_api" | "qr_session">("cloud_api");
  const [configId, setConfigId] = useState<string>("");

  useEffect(() => {
    const loadSettings = async () => {
      try {
        const res = await fetch("/api/settings");
        if (res.ok) {
          const data = await res.json();
          if (data.whatsappNumber) setWhatsappNumber(data.whatsappNumber);
          if (data.defaultAgent) setDefaultAgent(data.defaultAgent);
        }

        const configRes = await fetch("/api/whatsapp-config");
        if (configRes.ok) {
          const config = await configRes.json();
          setConfigId(config.id);
          setWhatsappMode(config.mode || "cloud_api");
          if (config.phoneNumber) setWhatsappNumber(config.phoneNumber);
        }
      } catch (error) {
        console.error("Failed to load settings:", error);
      }
    };
    loadSettings();
  }, []);

  const saveSettings = async () => {
    try {
      const res = await fetch("/api/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          whatsappNumber,
          defaultAgent,
        }),
      });

      if (!res.ok) {
        alert("Failed to save settings");
        return;
      }

      const configRes = await fetch("/api/whatsapp-config", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: configId,
          mode: whatsappMode,
          phoneNumber: whatsappNumber,
        }),
      });

      if (!configRes.ok) {
        alert("Failed to save WhatsApp config");
        return;
      }

      alert("Settings saved successfully!");
    } catch (error) {
      console.error("Save settings error:", error);
      alert("Error saving settings");
    }
  };
  return (
    <SidebarLayout>
      <div className="p-8 bg-gray-50 min-h-screen">
        <div className="max-w-7xl mx-auto">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            Integraciones
          </h1>
          <p className="text-gray-600 mb-8">
            Conecta FunnelChat con tus aplicaciones favoritas
          </p>

          <div className="mb-6 space-y-4">
            <div className="flex gap-4 items-center">
              <button
                onClick={() => router.push("/contactos")}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                Ir a Contactos
              </button>
              <button
                onClick={() => router.push("/flow-builder")}
                className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
              >
                Ir a Flow Builder
              </button>
            </div>
            <div className="bg-white rounded-xl border border-gray-200 p-4">
              <h3 className="font-semibold mb-3">Global Configuration</h3>
              <div className="space-y-3">
                <div>
                  <label className="block text-sm text-gray-600 mb-1">WhatsApp Mode</label>
                  <select
                    value={whatsappMode}
                    onChange={(e) => setWhatsappMode(e.target.value as "cloud_api" | "qr_session")}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="cloud_api">Cloud API</option>
                    <option value="qr_session">QR Session</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm text-gray-600 mb-1">WhatsApp Number</label>
                  <input
                    type="text"
                    value={whatsappNumber}
                    onChange={(e) => setWhatsappNumber(e.target.value)}
                    placeholder="+1234567890"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm text-gray-600 mb-1">Default Agent</label>
                  <input
                    type="text"
                    value={defaultAgent}
                    onChange={(e) => setDefaultAgent(e.target.value)}
                    placeholder="Agent Name"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <button
                  onClick={saveSettings}
                  className="w-full px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors font-medium"
                >
                  Save Settings
                </button>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {/* Facebook */}
            <Link
              href="/settings/integrations"
              className="bg-white rounded-xl border border-gray-200 p-6 hover:shadow-lg transition-shadow"
            >
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 bg-blue-600 rounded-lg flex items-center justify-center text-white text-2xl font-bold">
                  f
                </div>
                <div className="flex-1">
                  <h3 className="font-semibold text-gray-900 mb-1">Facebook</h3>
                  <p className="text-sm text-gray-600">
                    Conecta tus páginas de Facebook y recibe leads automáticamente
                  </p>
                </div>
              </div>
            </Link>

            {/* WhatsApp */}
            <div className="bg-white rounded-xl border border-gray-200 p-6 opacity-60">
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 bg-green-500 rounded-lg flex items-center justify-center text-white text-xl">
                  📱
                </div>
                <div className="flex-1">
                  <h3 className="font-semibold text-gray-900 mb-1">WhatsApp Business API</h3>
                  <p className="text-sm text-gray-600">
                    Envía mensajes automatizados vía WhatsApp Cloud API
                  </p>
                  <span className="inline-block mt-2 text-xs text-gray-500">Configurado en .env</span>
                </div>
              </div>
            </div>

            {/* More integrations placeholder */}
            <div className="bg-white rounded-xl border border-gray-200 border-dashed p-6">
              <div className="flex flex-col items-center justify-center text-center h-full text-gray-400">
                <svg className="w-8 h-8 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                <p className="text-sm">Más integraciones próximamente</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </SidebarLayout>
  );
}
