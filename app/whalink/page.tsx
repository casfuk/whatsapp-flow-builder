"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { SidebarLayout } from "@/app/components/SidebarLayout";

interface Whalink {
  id: string;
  name: string;
  slug: string;
  fullUrl: string;
  deviceId: string;
  presetMessage: string;
  createdAt: string;
}

interface Device {
  id: string;
  name: string;
  phoneNumber: string | null;
}

export default function WhalinkPage() {
  const router = useRouter();
  const [whalinks, setWhalinks] = useState<Whalink[]>([]);
  const [devices, setDevices] = useState<Device[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [whalinksRes, devicesRes] = await Promise.all([
        fetch("/api/whalinks"),
        fetch("/api/devices"),
      ]);
      const whalinksData = await whalinksRes.json();
      const devicesData = await devicesRes.json();
      setWhalinks(whalinksData);
      setDevices(devicesData);
    } catch (error) {
      console.error("Failed to load data:", error);
    } finally {
      setLoading(false);
    }
  };

  const loadWhalinks = async () => {
    try {
      const res = await fetch("/api/whalinks");
      const data = await res.json();
      setWhalinks(data);
    } catch (error) {
      console.error("Failed to load whalinks:", error);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("¿Estás seguro de eliminar este link?")) return;

    try {
      await fetch(`/api/whalinks/${id}`, { method: "DELETE" });
      loadWhalinks();
    } catch (error) {
      console.error("Failed to delete:", error);
      alert("Error al eliminar el link");
    }
  };

  const handleCopy = (url: string) => {
    navigator.clipboard.writeText(url);
    alert("Link copiado!");
  };

  return (
    <SidebarLayout>
      <div className="p-8">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Whalinks</h1>
            <p className="text-gray-600 mt-1">Gestiona tus enlaces de WhatsApp</p>
          </div>
          <button
            onClick={() => router.push("/whalink/crear")}
            className="bg-[#6D5BFA] text-white px-6 py-2.5 rounded-xl hover:bg-[#5B4BD8] transition-colors font-medium"
          >
            + Crear link
          </button>
        </div>

        {loading ? (
          <div className="text-center py-12">Cargando...</div>
        ) : whalinks.length === 0 ? (
          <div className="bg-white rounded-lg border border-gray-200 p-12 text-center">
            <p className="text-gray-500">No hay links creados aún</p>
            <button
              onClick={() => router.push("/whalink/crear")}
              className="mt-4 text-[#6D5BFA] hover:underline"
            >
              Crear tu primer link
            </button>
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
                    Link
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Dispositivo
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Fecha de creación
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Acciones
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {whalinks.map((link) => {
                  const device = devices.find((d) => d.id === link.deviceId);
                  return (
                    <tr key={link.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                        {link.name}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm">
                        <a
                          href={link.fullUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-blue-600 hover:underline"
                        >
                          {link.slug}
                        </a>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {device ? `${device.name} (${device.phoneNumber || "Sin número"})` : link.deviceId}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {new Date(link.createdAt).toLocaleDateString("es-ES")}
                      </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      <div className="flex items-center gap-3">
                        <button
                          onClick={() => router.push(`/whalink/${link.id}`)}
                          className="text-gray-600 hover:text-gray-900"
                          title="Ver"
                        >
                          👁
                        </button>
                        <button
                          onClick={() => router.push(`/whalink/${link.id}/editar`)}
                          className="text-gray-600 hover:text-gray-900"
                          title="Editar"
                        >
                          ✏️
                        </button>
                        <button
                          onClick={() => handleCopy(link.fullUrl)}
                          className="text-gray-600 hover:text-gray-900"
                          title="Copiar link"
                        >
                          📋
                        </button>
                        <button
                          onClick={() => handleDelete(link.id)}
                          className="text-red-600 hover:text-red-900"
                          title="Eliminar"
                        >
                          🗑
                        </button>
                      </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </SidebarLayout>
  );
}
