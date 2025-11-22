"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { SidebarLayout } from "@/app/components/SidebarLayout";

interface MassSend {
  id: string;
  name: string;
  deviceId: string;
  scheduledAt: string | null;
  totalContacts: number;
  status: string;
  createdAt: string;
}

interface Device {
  id: string;
  name: string;
  phoneNumber: string | null;
}

export default function MassSendsPage() {
  const router = useRouter();
  const [massSends, setMassSends] = useState<MassSend[]>([]);
  const [devices, setDevices] = useState<Device[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [massSendsRes, devicesRes] = await Promise.all([
        fetch("/api/mass-sends"),
        fetch("/api/devices"),
      ]);
      const massSendsData = await massSendsRes.json();
      const devicesData = await devicesRes.json();

      // Handle both array and object responses defensively
      const massSendsArray = Array.isArray(massSendsData)
        ? massSendsData
        : Array.isArray(massSendsData?.massSends)
          ? massSendsData.massSends
          : [];

      const devicesArray = Array.isArray(devicesData)
        ? devicesData
        : Array.isArray(devicesData?.devices)
          ? devicesData.devices
          : [];

      setMassSends(massSendsArray);
      setDevices(devicesArray);
    } catch (error) {
      console.error("Failed to load data:", error);
      setMassSends([]);
      setDevices([]);
    } finally {
      setLoading(false);
    }
  };

  const filteredMassSends = massSends.filter((ms) =>
    ms.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const getDeviceName = (deviceId: string) => {
    const device = devices.find((d) => d.id === deviceId);
    return device ? `${device.name} (${device.phoneNumber || "Sin número"})` : deviceId;
  };

  const getStatusBadge = (status: string) => {
    const statusMap: Record<string, { text: string; color: string }> = {
      DRAFT: { text: "Borrador", color: "bg-gray-100 text-gray-800" },
      SCHEDULED: { text: "Programado", color: "bg-blue-100 text-blue-800" },
      SENDING: { text: "Enviando", color: "bg-yellow-100 text-yellow-800" },
      COMPLETED: { text: "Completado", color: "bg-green-100 text-green-800" },
      CANCELLED: { text: "Cancelado", color: "bg-red-100 text-red-800" },
    };

    const statusInfo = statusMap[status] || statusMap.DRAFT;
    return (
      <span
        className={`px-2 py-1 text-xs font-medium rounded-full ${statusInfo.color}`}
      >
        {statusInfo.text}
      </span>
    );
  };

  return (
    <SidebarLayout>
      <div className="p-8">
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-gray-900">
            Envíos masivos a contactos
          </h1>
          <p className="text-gray-600 mt-1">
            Envía mensajes a todos tus contactos de forma segmentada.
          </p>
        </div>

        <div className="mb-6 flex items-center justify-between">
          <div className="flex-1 max-w-md">
            <input
              type="text"
              placeholder="Buscar por nombre"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#6D5BFA]"
            />
          </div>
          <div className="flex items-center gap-3">
            <button className="px-4 py-2 border border-gray-300 rounded-xl text-gray-700 hover:bg-gray-50 transition-colors">
              Filtrar
            </button>
            <button
              onClick={() => router.push("/envio-masivo/crear")}
              className="bg-[#6D5BFA] text-white px-6 py-2.5 rounded-xl hover:bg-[#5B4BD8] transition-colors font-medium"
            >
              Crear envío masivo
            </button>
          </div>
        </div>

        {loading ? (
          <div className="text-center py-12">Cargando...</div>
        ) : filteredMassSends.length === 0 ? (
          <div className="bg-white rounded-lg border border-gray-200 p-12 text-center">
            <div className="text-gray-400 text-5xl mb-4">📭</div>
            <p className="text-gray-500 mb-2">No hay datos para mostrar</p>
            {searchTerm && (
              <p className="text-gray-400 text-sm">
                No se encontraron registros con "{searchTerm}"
              </p>
            )}
          </div>
        ) : (
          <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Nombre
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Dispositivo
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Fecha para envío
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Contactos
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Estado
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredMassSends.map((ms) => (
                  <tr key={ms.id} className="hover:bg-gray-50 cursor-pointer">
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      {ms.name}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {getDeviceName(ms.deviceId)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {ms.scheduledAt
                        ? new Date(ms.scheduledAt).toLocaleString("es-ES")
                        : "Envío inmediato"}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {ms.totalContacts}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {getStatusBadge(ms.status)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </SidebarLayout>
  );
}
