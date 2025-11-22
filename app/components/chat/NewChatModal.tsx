"use client";

import { useState } from "react";
import { Device, Chat } from "@/app/types/chat";

interface NewChatModalProps {
  devices: Device[];
  onClose: () => void;
  onChatCreated: (chat: Chat) => void;
}

const COUNTRY_CODES = [
  { code: "+34", name: "España", flag: "🇪🇸" },
  { code: "+1", name: "Estados Unidos", flag: "🇺🇸" },
  { code: "+44", name: "Reino Unido", flag: "🇬🇧" },
  { code: "+33", name: "Francia", flag: "🇫🇷" },
  { code: "+49", name: "Alemania", flag: "🇩🇪" },
  { code: "+39", name: "Italia", flag: "🇮🇹" },
  { code: "+351", name: "Portugal", flag: "🇵🇹" },
  { code: "+52", name: "México", flag: "🇲🇽" },
  { code: "+54", name: "Argentina", flag: "🇦🇷" },
  { code: "+56", name: "Chile", flag: "🇨🇱" },
  { code: "+57", name: "Colombia", flag: "🇨🇴" },
  { code: "+58", name: "Venezuela", flag: "🇻🇪" },
];

export function NewChatModal({
  devices,
  onClose,
  onChatCreated,
}: NewChatModalProps) {
  const [selectedDeviceId, setSelectedDeviceId] = useState<string>("");
  const [countryCode, setCountryCode] = useState<string>("+34");
  const [phoneNumber, setPhoneNumber] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!selectedDeviceId) {
      setError("Por favor selecciona un dispositivo");
      return;
    }

    if (!phoneNumber.trim()) {
      setError("Por favor ingresa un número de teléfono");
      return;
    }

    // Validate phone number (only digits)
    if (!/^\d+$/.test(phoneNumber.trim())) {
      setError("El número de teléfono solo puede contener dígitos");
      return;
    }

    try {
      setLoading(true);

      // Compose full E.164 phone number
      const fullPhoneNumber = `${countryCode}${phoneNumber.trim()}`;

      const response = await fetch("/api/chats", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          deviceId: selectedDeviceId,
          phoneNumber: fullPhoneNumber,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Error al crear el chat");
      }

      const chat = await response.json();
      onChatCreated(chat);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al crear el chat");
    } finally {
      setLoading(false);
    }
  };

  const getDeviceLabel = (device: Device) => {
    if (device.alias) {
      const lastDigits = device.phoneNumber?.slice(-4) || device.id.slice(-4);
      return `${device.alias} (${lastDigits})`;
    }
    return `Sin alias (${device.phoneNumber?.slice(-4) || device.id.slice(-4)})`;
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-xl p-6 max-w-md w-full shadow-xl">
        <h2 className="text-xl font-bold text-gray-900 mb-4">
          Iniciar nueva conversación
        </h2>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Device Selection */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Dispositivo <span className="text-red-500">*</span>
            </label>
            <select
              value={selectedDeviceId}
              onChange={(e) => setSelectedDeviceId(e.target.value)}
              className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#6D5BFA] focus:border-transparent"
              disabled={loading}
            >
              <option value="">selecciona una opción</option>
              {devices.map((device) => (
                <option key={device.id} value={device.id}>
                  {device.isOnline ? "🟢" : "⚫"} {getDeviceLabel(device)}
                </option>
              ))}
            </select>
            {devices.length === 0 && (
              <p className="text-xs text-red-600 mt-1">
                No hay dispositivos disponibles
              </p>
            )}
          </div>

          {/* Phone Number */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Número de teléfono <span className="text-red-500">*</span>
            </label>
            <div className="flex gap-2">
              {/* Country Code Selector */}
              <select
                value={countryCode}
                onChange={(e) => setCountryCode(e.target.value)}
                className="w-32 px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#6D5BFA] focus:border-transparent"
                disabled={loading}
              >
                {COUNTRY_CODES.map((country) => (
                  <option key={country.code} value={country.code}>
                    {country.flag} {country.code}
                  </option>
                ))}
              </select>

              {/* Phone Number Input */}
              <input
                type="tel"
                value={phoneNumber}
                onChange={(e) => {
                  // Only allow digits
                  const value = e.target.value.replace(/\D/g, "");
                  setPhoneNumber(value);
                }}
                placeholder="612345678"
                className="flex-1 px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#6D5BFA] focus:border-transparent"
                disabled={loading}
              />
            </div>
            <p className="text-xs text-gray-500 mt-1">
              Ingresa el número sin el código de país
            </p>
          </div>

          {/* Error Message */}
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3">
              <p className="text-sm text-red-800">{error}</p>
            </div>
          )}

          {/* Preview */}
          {phoneNumber && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
              <p className="text-xs text-blue-900">
                <strong>Número completo:</strong> {countryCode}
                {phoneNumber}
              </p>
            </div>
          )}

          {/* Buttons */}
          <div className="flex gap-3 justify-end pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2.5 text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors font-medium"
              disabled={loading}
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="px-5 py-2.5 bg-[#6D5BFA] text-white rounded-lg hover:bg-[#5B4BD8] transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
              disabled={loading || !selectedDeviceId || !phoneNumber.trim()}
            >
              {loading ? "Creando..." : "Crear nuevo chat"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
