"use client";

import { useState, useEffect } from "react";
import { SidebarLayout } from "@/app/components/SidebarLayout";

interface MetricsData {
  period: string;
  startDate: string;
  endDate: string;
  metrics: {
    contacts: {
      total: number;
      new: number;
      byDay: Array<{ date: Date; count: number }>;
    };
    messages: {
      total: number;
      new: number;
      byDay: Array<{ date: Date; count: number }>;
    };
    automations: {
      total: number;
      executions: number;
    };
  };
}

interface Device {
  id: string;
  name: string;
  color: string;
  whatsappPhoneNumberId?: string;
  phoneNumber?: string;
  isConnected: boolean;
  accessToken?: string;
  businessAccountId?: string;
  createdAt: string;
  updatedAt: string;
}

const COLORS = [
  "#6D5BFA", "#10B981", "#F59E0B", "#EF4444", "#3B82F6",
  "#8B5CF6", "#EC4899", "#14B8A6", "#F97316", "#06B6D4",
];

export default function DashboardPage() {
  const [devices, setDevices] = useState<Device[]>([]);
  const [loading, setLoading] = useState(true);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showConnectModal, setShowConnectModal] = useState(false);
  const [showApiSetupModal, setShowApiSetupModal] = useState(false);
  const [editingDevice, setEditingDevice] = useState<Device | null>(null);
  const [editForm, setEditForm] = useState({ name: "", color: "" });
  const [apiForm, setApiForm] = useState({
    name: "",
    phoneNumberId: "",
    accessToken: "",
    businessAccountId: "",
    phoneNumber: "",
  });
  const [metrics, setMetrics] = useState<MetricsData | null>(null);
  const [metricsPeriod, setMetricsPeriod] = useState<"day" | "week" | "month">("month");
  const [metricsLoading, setMetricsLoading] = useState(true);

  useEffect(() => {
    fetchDevices();
    fetchMetrics();
  }, []);

  useEffect(() => {
    fetchMetrics();
  }, [metricsPeriod]);

  const fetchDevices = async () => {
    try {
      const response = await fetch("/api/devices");
      const data = await response.json();

      // Handle both array and object responses defensively
      const devicesArray = Array.isArray(data)
        ? data
        : Array.isArray(data?.devices)
          ? data.devices
          : [];

      setDevices(devicesArray);
    } catch (error) {
      console.error("Failed to fetch devices:", error);
      setDevices([]);
    } finally {
      setLoading(false);
    }
  };

  const fetchMetrics = async () => {
    try {
      setMetricsLoading(true);
      const response = await fetch(`/api/metrics?period=${metricsPeriod}`);
      const data = await response.json();
      setMetrics(data);
    } catch (error) {
      console.error("Failed to fetch metrics:", error);
    } finally {
      setMetricsLoading(false);
    }
  };

  const openEditModal = (device: Device) => {
    setEditingDevice(device);
    setEditForm({ name: device.name, color: device.color });
    setShowEditModal(true);
  };

  const closeEditModal = () => {
    setShowEditModal(false);
    setEditingDevice(null);
    setEditForm({ name: "", color: "" });
  };

  const saveDeviceEdit = async () => {
    if (!editingDevice) return;

    try {
      const response = await fetch(`/api/devices/${editingDevice.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: editForm.name,
          color: editForm.color,
        }),
      });

      if (response.ok) {
        await fetchDevices();
        closeEditModal();
      } else {
        alert("Error al guardar los cambios");
      }
    } catch (error) {
      console.error("Failed to update device:", error);
      alert("Error al guardar los cambios");
    }
  };

  const toggleConnection = async (device: Device) => {
    if (!device.isConnected) {
      // Can't connect if no credentials
      if (!device.whatsappPhoneNumberId || !device.accessToken) {
        alert("Este dispositivo no tiene credenciales configuradas");
        return;
      }
    }

    try {
      const response = await fetch(`/api/devices/${device.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          isConnected: !device.isConnected,
        }),
      });

      if (response.ok) {
        await fetchDevices();
      } else {
        const data = await response.json();
        alert(data.error || "Error al cambiar el estado de conexión");
      }
    } catch (error) {
      console.error("Failed to toggle connection:", error);
      alert("Error al cambiar el estado de conexión");
    }
  };

  const deleteDevice = async (deviceId: string, deviceName: string) => {
    if (!confirm(`¿Estás seguro de eliminar el dispositivo "${deviceName}"?`)) {
      return;
    }

    try {
      const response = await fetch(`/api/devices/${deviceId}`, {
        method: "DELETE",
      });

      if (response.ok) {
        await fetchDevices();
      } else {
        const data = await response.json();
        alert(data.error || "Error al eliminar el dispositivo");
      }
    } catch (error) {
      console.error("Failed to delete device:", error);
      alert("Error al eliminar el dispositivo");
    }
  };

  const openConnectModal = () => {
    setShowConnectModal(true);
  };

  const continueToApiSetup = () => {
    setShowConnectModal(false);
    setShowApiSetupModal(true);
  };

  const createDevice = async () => {
    try {
      const response = await fetch("/api/devices", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: apiForm.name,
          whatsappPhoneNumberId: apiForm.phoneNumberId,
          accessToken: apiForm.accessToken,
          businessAccountId: apiForm.businessAccountId,
          phoneNumber: apiForm.phoneNumber,
          color: COLORS[devices.length % COLORS.length],
        }),
      });

      if (response.ok) {
        await fetchDevices();
        setShowApiSetupModal(false);
        setApiForm({
          name: "",
          phoneNumberId: "",
          accessToken: "",
          businessAccountId: "",
          phoneNumber: "",
        });
      } else {
        const data = await response.json();
        alert(data.error || "Error al crear el dispositivo");
      }
    } catch (error) {
      console.error("Failed to create device:", error);
      alert("Error al crear el dispositivo");
    }
  };

  const canAddMore = devices.length < 5; // Max 5 devices

  if (loading) {
    return (
      <SidebarLayout>
        <div className="min-h-screen bg-gray-50 flex items-center justify-center">
          <div className="text-gray-600">Cargando...</div>
        </div>
      </SidebarLayout>
    );
  }

  return (
    <SidebarLayout>
      <div className="p-8 bg-gray-50 min-h-screen">
        <div className="max-w-7xl mx-auto">
          <h1 className="text-3xl font-bold text-gray-900 mb-8">
            Tablero Principal
          </h1>

          {/* Conexiones Section */}
          <div className="mb-8">
            <h2 className="text-2xl font-bold text-gray-900 mb-6">Conexiones</h2>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {/* Existing Devices */}
              {Array.isArray(devices) && devices.length > 0 ? (
                devices.map((device) => (
                  <div
                    key={device.id}
                    className="bg-white rounded-xl border border-gray-200 p-6 hover:shadow-md transition-shadow"
                  >
                  {/* Avatar & Name */}
                  <div className="flex items-start gap-4 mb-4">
                    <div
                      className="w-16 h-16 rounded-full flex items-center justify-center text-white text-2xl font-bold"
                      style={{ backgroundColor: device.color }}
                    >
                      {device.name ? device.name.charAt(0).toUpperCase() : "?"}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="font-semibold text-gray-900">
                          {device.name || "Unnamed Device"}
                        </h3>
                        <button
                          onClick={() => openEditModal(device)}
                          className="text-gray-400 hover:text-gray-600"
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
                              d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"
                            />
                          </svg>
                        </button>
                      </div>
                      {device.phoneNumber && (
                        <p className="text-sm text-[#6D5BFA] hover:underline cursor-pointer">
                          {device.phoneNumber}
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Status Badge */}
                  <div className="mb-4">
                    <span
                      className={`inline-flex px-3 py-1 text-xs font-medium rounded-full ${
                        device.isConnected
                          ? "bg-green-100 text-green-800"
                          : "bg-gray-100 text-gray-600"
                      }`}
                    >
                      {device.isConnected ? "Conectado" : "Sin uso"}
                    </span>
                  </div>

                  {/* Connection Type Icons */}
                  <div className="flex items-center gap-2 mb-4">
                    <svg
                      className="w-5 h-5 text-green-600"
                      fill="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z" />
                    </svg>
                    <span className="text-xs text-gray-500">
                      WhatsApp Cloud API
                    </span>
                  </div>

                  {/* Action Buttons */}
                  <div className="space-y-2">
                    <button
                      onClick={() => toggleConnection(device)}
                      className={`w-full py-2.5 rounded-xl font-medium transition-colors ${
                        device.isConnected
                          ? "bg-red-50 text-red-600 hover:bg-red-100 border border-red-200"
                          : "bg-[#6D5BFA] text-white hover:bg-[#5B4BD8]"
                      }`}
                    >
                      {device.isConnected
                        ? "Desconectar número"
                        : "Conectar número"}
                    </button>
                    <button
                      onClick={() => deleteDevice(device.id, device.name || "Unnamed Device")}
                      className="w-full py-2 rounded-xl font-medium text-sm text-gray-600 hover:text-red-600 hover:bg-red-50 border border-gray-200 hover:border-red-200 transition-colors"
                    >
                      Eliminar dispositivo
                    </button>
                  </div>
                </div>
                ))
              ) : (
                <div className="col-span-full bg-white rounded-xl border border-gray-200 p-8 text-center">
                  <p className="text-gray-500">No hay dispositivos conectados.</p>
                  <p className="text-sm text-gray-400 mt-2">Agrega un nuevo dispositivo para comenzar.</p>
                </div>
              )}

              {/* Add New Device Card */}
              {canAddMore && (
                <button
                  onClick={openConnectModal}
                  className="bg-white rounded-xl border-2 border-dashed border-gray-300 p-6 hover:border-[#6D5BFA] hover:bg-gray-50 transition-all flex flex-col items-center justify-center min-h-[280px]"
                >
                  <div className="w-16 h-16 rounded-full bg-gray-100 flex items-center justify-center text-gray-400 mb-4">
                    <svg
                      className="w-8 h-8"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M12 4v16m8-8H4"
                      />
                    </svg>
                  </div>
                  <p className="text-gray-600 font-medium">Conectar número</p>
                </button>
              )}

              {/* Upgrade Plan Card (when limit reached) */}
              {!canAddMore && (
                <div className="bg-gradient-to-br from-[#6D5BFA] to-[#5B4BD8] rounded-xl border border-gray-200 p-6 text-white flex flex-col items-center justify-center min-h-[280px]">
                  <div className="w-16 h-16 rounded-full bg-white/20 flex items-center justify-center mb-4">
                    <svg
                      className="w-8 h-8"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M13 10V3L4 14h7v7l9-11h-7z"
                      />
                    </svg>
                  </div>
                  <p className="font-semibold mb-2">Límite alcanzado</p>
                  <p className="text-sm text-white/80 text-center mb-4">
                    Actualiza tu plan para conectar más números
                  </p>
                  <button className="bg-white text-[#6D5BFA] px-6 py-2 rounded-xl font-medium hover:bg-gray-100 transition-colors">
                    Mejorar plan
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Metrics Section */}
          <div className="mt-12">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold text-gray-900">Métricas</h2>

              {/* Period Selector */}
              <div className="flex gap-2 bg-gray-100 p-1 rounded-xl">
                <button
                  onClick={() => setMetricsPeriod("day")}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                    metricsPeriod === "day"
                      ? "bg-white text-[#6D5BFA] shadow-sm"
                      : "text-gray-600 hover:text-gray-900"
                  }`}
                >
                  Hoy
                </button>
                <button
                  onClick={() => setMetricsPeriod("week")}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                    metricsPeriod === "week"
                      ? "bg-white text-[#6D5BFA] shadow-sm"
                      : "text-gray-600 hover:text-gray-900"
                  }`}
                >
                  7 días
                </button>
                <button
                  onClick={() => setMetricsPeriod("month")}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                    metricsPeriod === "month"
                      ? "bg-white text-[#6D5BFA] shadow-sm"
                      : "text-gray-600 hover:text-gray-900"
                  }`}
                >
                  30 días
                </button>
              </div>
            </div>

            {metricsLoading ? (
              <div className="text-center py-12 text-gray-500">
                Cargando métricas...
              </div>
            ) : metrics ? (
              <>
                {/* Metric Cards */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                  {/* Contacts Card */}
                  <div className="bg-white rounded-xl border border-gray-200 p-6">
                    <div className="flex items-center justify-between mb-4">
                      <div className="w-12 h-12 rounded-xl bg-blue-100 flex items-center justify-center">
                        <svg
                          className="w-6 h-6 text-blue-600"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"
                          />
                        </svg>
                      </div>
                      <span className="text-sm font-medium text-gray-500">
                        Total: {metrics.metrics.contacts.total}
                      </span>
                    </div>
                    <h3 className="text-sm font-medium text-gray-600 mb-1">
                      Nuevos Contactos
                    </h3>
                    <div className="text-3xl font-bold text-gray-900">
                      {metrics.metrics.contacts.new}
                    </div>
                    <p className="text-sm text-gray-500 mt-2">
                      En los últimos {metricsPeriod === "day" ? "24 horas" : metricsPeriod === "week" ? "7 días" : "30 días"}
                    </p>
                  </div>

                  {/* Messages Card */}
                  <div className="bg-white rounded-xl border border-gray-200 p-6">
                    <div className="flex items-center justify-between mb-4">
                      <div className="w-12 h-12 rounded-xl bg-green-100 flex items-center justify-center">
                        <svg
                          className="w-6 h-6 text-green-600"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
                          />
                        </svg>
                      </div>
                      <span className="text-sm font-medium text-gray-500">
                        Total: {metrics.metrics.messages.total}
                      </span>
                    </div>
                    <h3 className="text-sm font-medium text-gray-600 mb-1">
                      Mensajes Recibidos
                    </h3>
                    <div className="text-3xl font-bold text-gray-900">
                      {metrics.metrics.messages.new}
                    </div>
                    <p className="text-sm text-gray-500 mt-2">
                      En los últimos {metricsPeriod === "day" ? "24 horas" : metricsPeriod === "week" ? "7 días" : "30 días"}
                    </p>
                  </div>

                  {/* Automations Card */}
                  <div className="bg-white rounded-xl border border-gray-200 p-6">
                    <div className="flex items-center justify-between mb-4">
                      <div className="w-12 h-12 rounded-xl bg-purple-100 flex items-center justify-center">
                        <svg
                          className="w-6 h-6 text-purple-600"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M13 10V3L4 14h7v7l9-11h-7z"
                          />
                        </svg>
                      </div>
                      <span className="text-sm font-medium text-gray-500">
                        Flows: {metrics.metrics.automations.total}
                      </span>
                    </div>
                    <h3 className="text-sm font-medium text-gray-600 mb-1">
                      Ejecuciones
                    </h3>
                    <div className="text-3xl font-bold text-gray-900">
                      {metrics.metrics.automations.executions}
                    </div>
                    <p className="text-sm text-gray-500 mt-2">
                      Total de automatizaciones ejecutadas
                    </p>
                  </div>
                </div>

                {/* Charts */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {/* Contacts Chart */}
                  <div className="bg-white rounded-xl border border-gray-200 p-6">
                    <h3 className="text-lg font-semibold text-gray-900 mb-4">
                      Contactos Nuevos
                    </h3>
                    <div className="h-64 flex items-end justify-between gap-2">
                      {metrics.metrics.contacts.byDay.length > 0 ? (
                        metrics.metrics.contacts.byDay.map((day: any, index: number) => {
                          const maxCount = Math.max(
                            ...metrics.metrics.contacts.byDay.map((d: any) => d.count),
                            1
                          );
                          const heightPercentage = (day.count / maxCount) * 100;

                          return (
                            <div key={index} className="flex-1 flex flex-col items-center">
                              <div
                                className="w-full bg-blue-500 rounded-t-lg hover:bg-blue-600 transition-colors relative group"
                                style={{ height: `${heightPercentage}%` }}
                              >
                                <span className="absolute -top-6 left-1/2 transform -translate-x-1/2 text-xs font-medium text-gray-900 opacity-0 group-hover:opacity-100 transition-opacity">
                                  {day.count}
                                </span>
                              </div>
                              <span className="text-xs text-gray-500 mt-2">
                                {new Date(day.date).getDate()}
                              </span>
                            </div>
                          );
                        })
                      ) : (
                        <div className="w-full text-center text-gray-500">
                          No hay datos para mostrar
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Messages Chart */}
                  <div className="bg-white rounded-xl border border-gray-200 p-6">
                    <h3 className="text-lg font-semibold text-gray-900 mb-4">
                      Mensajes Recibidos
                    </h3>
                    <div className="h-64 flex items-end justify-between gap-2">
                      {metrics.metrics.messages.byDay.length > 0 ? (
                        metrics.metrics.messages.byDay.map((day: any, index: number) => {
                          const maxCount = Math.max(
                            ...metrics.metrics.messages.byDay.map((d: any) => d.count),
                            1
                          );
                          const heightPercentage = (day.count / maxCount) * 100;

                          return (
                            <div key={index} className="flex-1 flex flex-col items-center">
                              <div
                                className="w-full bg-green-500 rounded-t-lg hover:bg-green-600 transition-colors relative group"
                                style={{ height: `${heightPercentage}%` }}
                              >
                                <span className="absolute -top-6 left-1/2 transform -translate-x-1/2 text-xs font-medium text-gray-900 opacity-0 group-hover:opacity-100 transition-opacity">
                                  {day.count}
                                </span>
                              </div>
                              <span className="text-xs text-gray-500 mt-2">
                                {new Date(day.date).getDate()}
                              </span>
                            </div>
                          );
                        })
                      ) : (
                        <div className="w-full text-center text-gray-500">
                          No hay datos para mostrar
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </>
            ) : (
              <div className="text-center py-12 text-gray-500">
                Error al cargar las métricas
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Edit Device Modal */}
      {showEditModal && editingDevice && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl p-6 max-w-md w-full shadow-xl">
            <h2 className="text-xl font-bold text-gray-900 mb-4">
              Editar dispositivo
            </h2>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Nombre del dispositivo
                </label>
                <input
                  type="text"
                  value={editForm.name}
                  onChange={(e) =>
                    setEditForm({ ...editForm, name: e.target.value })
                  }
                  className="w-full px-3 py-2.5 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#6D5BFA]"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Color identificador
                </label>
                <div className="grid grid-cols-5 gap-3">
                  {COLORS.map((color) => (
                    <button
                      key={color}
                      onClick={() => setEditForm({ ...editForm, color })}
                      className={`w-12 h-12 rounded-full transition-all ${
                        editForm.color === color
                          ? "ring-4 ring-offset-2 ring-gray-300"
                          : "hover:scale-110"
                      }`}
                      style={{ backgroundColor: color }}
                    />
                  ))}
                </div>
              </div>

              <div className="flex gap-3 justify-end pt-4">
                <button
                  onClick={closeEditModal}
                  className="px-5 py-2.5 text-gray-700 border border-gray-300 rounded-xl hover:bg-gray-50 transition-colors font-medium"
                >
                  Cancelar
                </button>
                <button
                  onClick={saveDeviceEdit}
                  className="px-5 py-2.5 bg-[#6D5BFA] text-white rounded-xl hover:bg-[#5B4BD8] transition-colors font-medium"
                  disabled={!editForm.name.trim()}
                >
                  Guardar cambios
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Connect Number Modal (Step 1) */}
      {showConnectModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl p-6 max-w-md w-full shadow-xl">
            <h2 className="text-xl font-bold text-gray-900 mb-2">
              Números extras y API
            </h2>
            <p className="text-sm text-gray-600 mb-6">
              Conecta un número de WhatsApp Business API / Cloud API para
              gestionar conversaciones a escala.
            </p>

            <div className="mb-6">
              <button className="w-full flex items-center gap-4 p-4 border-2 border-gray-200 rounded-xl hover:border-[#6D5BFA] hover:bg-gray-50 transition-all">
                <svg
                  className="w-12 h-12 text-green-600"
                  fill="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z" />
                </svg>
                <div className="text-left">
                  <div className="font-semibold text-gray-900">
                    WhatsApp Cloud API
                  </div>
                  <div className="text-sm text-gray-500">
                    Conecta vía Meta Business
                  </div>
                </div>
              </button>
            </div>

            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setShowConnectModal(false)}
                className="px-5 py-2.5 text-gray-700 border border-gray-300 rounded-xl hover:bg-gray-50 transition-colors font-medium"
              >
                Cancelar
              </button>
              <button
                onClick={continueToApiSetup}
                className="px-5 py-2.5 bg-[#6D5BFA] text-white rounded-xl hover:bg-[#5B4BD8] transition-colors font-medium"
              >
                Continuar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* API Setup Modal (Step 2) */}
      {showApiSetupModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50 overflow-y-auto">
          <div className="bg-white rounded-xl p-6 max-w-lg w-full shadow-xl my-8">
            <h2 className="text-xl font-bold text-gray-900 mb-2">
              Configurar WhatsApp Cloud API
            </h2>
            <p className="text-sm text-gray-600 mb-6">
              Ingresa las credenciales de tu cuenta de WhatsApp Business API.
            </p>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Nombre del dispositivo <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={apiForm.name}
                  onChange={(e) =>
                    setApiForm({ ...apiForm, name: e.target.value })
                  }
                  className="w-full px-3 py-2.5 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#6D5BFA]"
                  placeholder="Ej: David"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Número de WhatsApp
                </label>
                <input
                  type="text"
                  value={apiForm.phoneNumber}
                  onChange={(e) =>
                    setApiForm({ ...apiForm, phoneNumber: e.target.value })
                  }
                  className="w-full px-3 py-2.5 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#6D5BFA]"
                  placeholder="+34 644 412 937"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Phone Number ID <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={apiForm.phoneNumberId}
                  onChange={(e) =>
                    setApiForm({ ...apiForm, phoneNumberId: e.target.value })
                  }
                  className="w-full px-3 py-2.5 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#6D5BFA]"
                  placeholder="De Meta Developer Console"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Access Token <span className="text-red-500">*</span>
                </label>
                <input
                  type="password"
                  value={apiForm.accessToken}
                  onChange={(e) =>
                    setApiForm({ ...apiForm, accessToken: e.target.value })
                  }
                  className="w-full px-3 py-2.5 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#6D5BFA]"
                  placeholder="Token de Meta Developer Console"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Business Account ID
                </label>
                <input
                  type="text"
                  value={apiForm.businessAccountId}
                  onChange={(e) =>
                    setApiForm({
                      ...apiForm,
                      businessAccountId: e.target.value,
                    })
                  }
                  className="w-full px-3 py-2.5 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#6D5BFA]"
                  placeholder="Opcional"
                />
              </div>
            </div>

            <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
              <p className="text-xs text-blue-900">
                <svg
                  className="w-4 h-4 inline mr-1"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
                Las credenciales se verificarán antes de guardar. Asegúrate de
                que sean válidas.
              </p>
            </div>

            <div className="flex gap-3 justify-end mt-6">
              <button
                onClick={() => {
                  setShowApiSetupModal(false);
                  setApiForm({
                    name: "",
                    phoneNumberId: "",
                    accessToken: "",
                    businessAccountId: "",
                    phoneNumber: "",
                  });
                }}
                className="px-5 py-2.5 text-gray-700 border border-gray-300 rounded-xl hover:bg-gray-50 transition-colors font-medium"
              >
                Cancelar
              </button>
              <button
                onClick={createDevice}
                disabled={
                  !apiForm.name.trim() ||
                  !apiForm.phoneNumberId.trim() ||
                  !apiForm.accessToken.trim()
                }
                className="px-5 py-2.5 bg-[#6D5BFA] text-white rounded-xl hover:bg-[#5B4BD8] transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Crear y verificar
              </button>
            </div>
          </div>
        </div>
      )}
    </SidebarLayout>
  );
}
