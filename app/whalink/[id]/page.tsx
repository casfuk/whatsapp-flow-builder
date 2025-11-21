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
  image?: string;
  description?: string;
  emailKey?: string;
  nameKey?: string;
  trackingPixel?: string;
  createdAt: string;
}

export default function ViewWhalinkPage({ params }: { params: { id: string } }) {
  const router = useRouter();
  const [whalink, setWhalink] = useState<Whalink | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadWhalink();
  }, []);

  const loadWhalink = async () => {
    try {
      const res = await fetch(`/api/whalinks/${params.id}`);
      if (!res.ok) throw new Error("Failed to load");
      const data = await res.json();
      setWhalink(data);
    } catch (error) {
      console.error("Failed to load whalink:", error);
      alert("Error al cargar el whalink");
      router.push("/whalink");
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = (url: string) => {
    navigator.clipboard.writeText(url);
    alert("Link copiado!");
  };

  if (loading) return <SidebarLayout><div className="p-8">Cargando...</div></SidebarLayout>;
  if (!whalink) return <SidebarLayout><div className="p-8">No encontrado</div></SidebarLayout>;

  return (
    <SidebarLayout>
      <div className="p-8">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">{whalink.name}</h1>
            <p className="text-gray-600 mt-1">Vista del whalink</p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => handleCopy(whalink.fullUrl)}
              className="px-4 py-2 border border-gray-300 rounded-xl text-gray-700 hover:bg-gray-50 transition-colors"
            >
              📋 Copiar link
            </button>
            <button
              onClick={() => router.push(`/whalink/${whalink.id}/editar`)}
              className="px-4 py-2 bg-[#6D5BFA] text-white rounded-xl hover:bg-[#5B4BD8] transition-colors"
            >
              ✏️ Editar
            </button>
            <button
              onClick={() => router.push("/whalink")}
              className="px-4 py-2 border border-gray-300 rounded-xl text-gray-700 hover:bg-gray-50 transition-colors"
            >
              Volver
            </button>
          </div>
        </div>

        <div className="bg-white rounded-lg border border-gray-200 p-6 space-y-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Link completo</label>
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={whalink.fullUrl}
                readOnly
                className="flex-1 px-3 py-2 bg-gray-50 border border-gray-300 rounded-xl text-sm"
              />
              <button
                onClick={() => handleCopy(whalink.fullUrl)}
                className="px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded-xl text-sm"
              >
                Copiar
              </button>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Slug</label>
            <p className="text-sm text-gray-900">{whalink.slug}</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Dispositivo</label>
            <p className="text-sm text-gray-900">{whalink.deviceId}</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Mensaje predeterminado</label>
            <div className="p-3 bg-gray-50 border border-gray-200 rounded-xl">
              <p className="text-sm text-gray-900 whitespace-pre-wrap">{whalink.presetMessage}</p>
            </div>
          </div>

          {whalink.description && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Descripción</label>
              <p className="text-sm text-gray-900">{whalink.description}</p>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Fecha de creación</label>
            <p className="text-sm text-gray-900">{new Date(whalink.createdAt).toLocaleString("es-ES")}</p>
          </div>
        </div>
      </div>
    </SidebarLayout>
  );
}
