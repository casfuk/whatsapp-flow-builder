"use client";

import React, { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { SidebarLayout } from "@/app/components/SidebarLayout";

interface Flow {
  id: string;
  name: string;
  key: string;
  description?: string;
  isActive: boolean;
  folderId?: string;
  executions: number;
  createdAt: string;
  updatedAt: string;
  stepsCount: number;
  trigger?: {
    type: string;
    device: string;
    variables: string[];
  };
}

interface Folder {
  id: string;
  name: string;
}

export default function FlowsPage() {
  const router = useRouter();
  const [flows, setFlows] = useState<Flow[]>([]);
  const [folders, setFolders] = useState<Folder[]>([
    { id: "1", name: "Archive" },
    { id: "2", name: "Marketing" },
  ]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedFolder, setSelectedFolder] = useState<string | null>(null);
  const [expandedFlowId, setExpandedFlowId] = useState<string | null>(null);
  const [showCreateFolderModal, setShowCreateFolderModal] = useState(false);
  const [newFolderName, setNewFolderName] = useState("");
  const [togglingFlowId, setTogglingFlowId] = useState<string | null>(null);

  useEffect(() => {
    fetchFlows();
  }, []);

  const fetchFlows = async () => {
    try {
      const response = await fetch("/api/flows");
      const data = await response.json();

      // Enrich with mock data for display
      const enrichedFlows = data.map((flow: any) => ({
        ...flow,
        executions: Math.floor(Math.random() * 500),
        stepsCount: flow.steps?.length || 0,
        trigger: {
          type: "webhook",
          device: "Todos los dispositivos conectados",
          variables: ["Teléfono", "Nombre", "Email"],
        },
      }));

      setFlows(enrichedFlows);
    } catch (error) {
      console.error("Failed to fetch flows:", error);
    } finally {
      setLoading(false);
    }
  };

  const filteredFlows = useMemo(() => {
    let result = flows;

    // Filter by folder
    if (selectedFolder) {
      result = result.filter((flow) => flow.folderId === selectedFolder);
    }

    // Filter by search query
    if (searchQuery.trim()) {
      result = result.filter((flow) =>
        flow.name.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }

    // Sort by creation date (newest first)
    result = [...result].sort(
      (a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );

    return result;
  }, [flows, selectedFolder, searchQuery]);

  const toggleFlowActive = async (flowId: string, currentStatus: boolean) => {
    setTogglingFlowId(flowId);
    const newStatus = !currentStatus;

    try {
      const response = await fetch(`/api/flows/${flowId}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: newStatus }),
      });

      if (!response.ok) {
        throw new Error("Failed to toggle flow status");
      }

      const updatedFlow = await response.json();

      setFlows(
        flows.map((f) => (f.id === flowId ? { ...f, isActive: updatedFlow.isActive } : f))
      );
    } catch (error) {
      console.error("Failed to update flow status:", error);
      alert("Error al cambiar el estado del flujo");
    } finally {
      setTogglingFlowId(null);
    }
  };

  const deleteFlow = async (flowId: string) => {
    if (!confirm("¿Estás seguro de que deseas eliminar este flow?")) return;

    try {
      await fetch(`/api/flows/${flowId}`, { method: "DELETE" });
      setFlows(flows.filter((f) => f.id !== flowId));
      if (expandedFlowId === flowId) {
        setExpandedFlowId(null);
      }
    } catch (error) {
      console.error("Failed to delete flow:", error);
    }
  };

  const createFolder = () => {
    if (!newFolderName.trim()) return;

    const folder: Folder = {
      id: `folder-${Date.now()}`,
      name: newFolderName,
    };
    setFolders([...folders, folder]);
    setShowCreateFolderModal(false);
    setNewFolderName("");
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffDays = Math.floor(
      (now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24)
    );

    const weekdays = [
      "domingo",
      "lunes",
      "martes",
      "miércoles",
      "jueves",
      "viernes",
      "sábado",
    ];
    const weekday = weekdays[date.getDay()];
    const time = date.toLocaleTimeString("es-ES", {
      hour: "2-digit",
      minute: "2-digit",
    });

    if (diffDays === 0) {
      return `Hoy a las ${time}`;
    } else if (diffDays === 1) {
      return `Ayer a las ${time}`;
    } else if (diffDays < 7) {
      return `El ${weekday} a las ${time}`;
    } else {
      return date.toLocaleDateString("es-ES", {
        day: "numeric",
        month: "long",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
    }
  };

  const toggleExpandRow = (flowId: string) => {
    setExpandedFlowId(expandedFlowId === flowId ? null : flowId);
  };

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
          {/* Header */}
          <div className="mb-8">
            <div className="flex justify-between items-start mb-2">
              <div>
                <h1 className="text-3xl font-bold text-gray-900">
                  Mis automatizaciones
                </h1>
                <p className="text-gray-600 mt-1">
                  Administra y gestiona todos tus flows creados en la aplicación.
                </p>
              </div>
              <div className="flex gap-3">
                <button
                  onClick={() => setShowCreateFolderModal(true)}
                  className="bg-white text-gray-700 border border-gray-300 px-5 py-2.5 rounded-xl hover:bg-gray-50 transition-colors font-medium shadow-sm"
                >
                  Crear carpeta
                </button>
                <Link
                  href="/flows/new"
                  className="bg-[#6D5BFA] text-white px-5 py-2.5 rounded-xl hover:bg-[#5B4BD8] transition-colors font-medium shadow-sm"
                >
                  + Crear flow
                </Link>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-12 gap-6">
            {/* Left Column - Carpetas */}
            <div className="col-span-3">
              <div className="bg-white rounded-xl border border-gray-200 p-4">
                <h3 className="font-semibold text-gray-900 mb-3">Carpetas</h3>
                <div className="space-y-1">
                  <button
                    onClick={() => setSelectedFolder(null)}
                    className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-colors text-left ${
                      selectedFolder === null
                        ? "bg-[#6D5BFA]/10 text-[#6D5BFA]"
                        : "text-gray-700 hover:bg-gray-50"
                    }`}
                  >
                    <svg
                      className="w-5 h-5"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z"
                      />
                    </svg>
                    <span className="flex-1 text-sm font-medium">
                      Todos los flows
                    </span>
                  </button>
                  {folders.map((folder) => (
                    <button
                      key={folder.id}
                      onClick={() => setSelectedFolder(folder.id)}
                      className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-colors text-left ${
                        selectedFolder === folder.id
                          ? "bg-[#6D5BFA]/10 text-[#6D5BFA]"
                          : "text-gray-700 hover:bg-gray-50"
                      }`}
                    >
                      <svg
                        className="w-5 h-5"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z"
                        />
                      </svg>
                      <span className="flex-1 text-sm font-medium">
                        {folder.name}
                      </span>
                      <span
                        onClick={(e) => {
                          e.stopPropagation();
                          // Add folder menu logic here
                        }}
                        className="text-gray-400 hover:text-gray-600 cursor-pointer"
                      >
                        <svg
                          className="w-4 h-4"
                          fill="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path d="M12 8c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zm0 2c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm0 6c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2z" />
                        </svg>
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Right Column - Flujos */}
            <div className="col-span-9">
              <div className="bg-white rounded-xl border border-gray-200">
                {/* Flujos Header */}
                <div className="p-6 border-b border-gray-200">
                  <h3 className="font-semibold text-gray-900 mb-4">Flujos</h3>
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Buscar por nombre"
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#6D5BFA] focus:border-transparent"
                  />
                </div>

                {/* Flows Table */}
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-gray-50 border-b border-gray-200">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                          Nombre
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                          Ejecuciones
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                          Fecha de creación
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                          Estado
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                          Detalles
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      {filteredFlows.length === 0 ? (
                        <tr>
                          <td
                            colSpan={5}
                            className="px-6 py-12 text-center text-gray-500"
                          >
                            {searchQuery || selectedFolder
                              ? "No se encontraron flows con los filtros aplicados"
                              : "No hay flows aún. Crea tu primer flow para comenzar."}
                          </td>
                        </tr>
                      ) : (
                        filteredFlows.map((flow) => (
                          <React.Fragment key={flow.id}>
                            {/* Main Row */}
                            <tr
                              className="hover:bg-gray-50 transition-colors"
                            >
                              <td className="px-6 py-4">
                                <div className="font-medium text-gray-900">
                                  {flow.name}
                                </div>
                                {flow.description && (
                                  <div className="text-sm text-gray-500 mt-1">
                                    {flow.description}
                                  </div>
                                )}
                              </td>
                              <td className="px-6 py-4">
                                <span className="text-[#6D5BFA] font-semibold">
                                  {flow.executions}
                                </span>
                              </td>
                              <td className="px-6 py-4 text-sm text-gray-600">
                                {formatDate(flow.createdAt)}
                              </td>
                              <td className="px-6 py-4">
                                <span
                                  className={`inline-flex px-3 py-1 text-xs font-medium rounded-full ${
                                    flow.isActive
                                      ? "bg-green-100 text-green-800"
                                      : "bg-gray-100 text-gray-600"
                                  }`}
                                >
                                  {flow.isActive ? "Activo" : "Inactivo"}
                                </span>
                              </td>
                              <td className="px-6 py-4">
                                <button
                                  onClick={() => toggleExpandRow(flow.id)}
                                  className="text-[#6D5BFA] hover:text-[#5B4BD8] font-medium text-sm flex items-center gap-1 transition-colors"
                                >
                                  {expandedFlowId === flow.id ? (
                                    <>
                                      Ocultar
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
                                          d="M5 15l7-7 7 7"
                                        />
                                      </svg>
                                    </>
                                  ) : (
                                    <>
                                      Ver detalles
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
                                          d="M19 9l-7 7-7-7"
                                        />
                                      </svg>
                                    </>
                                  )}
                                </button>
                              </td>
                            </tr>

                            {/* Expanded Details Row */}
                            {expandedFlowId === flow.id && (
                              <tr>
                                <td colSpan={5} className="px-6 py-6 bg-gray-50">
                                  <div className="bg-white rounded-xl border border-gray-200 p-6">
                                    {/* Header */}
                                    <div className="flex items-start justify-between mb-6 pb-6 border-b border-gray-200">
                                      <div className="flex-1">
                                        <div className="flex items-center gap-2 mb-3">
                                          <input
                                            type="text"
                                            value={flow.name}
                                            className="text-xl font-bold text-gray-900 border-0 border-b-2 border-transparent hover:border-gray-300 focus:border-[#6D5BFA] focus:outline-none px-0 py-1 transition-colors"
                                            onChange={(e) => {
                                              // Update flow name
                                              setFlows(
                                                flows.map((f) =>
                                                  f.id === flow.id
                                                    ? { ...f, name: e.target.value }
                                                    : f
                                                )
                                              );
                                            }}
                                          />
                                          <svg
                                            className="w-5 h-5 text-gray-400"
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
                                        </div>
                                        <div className="flex items-center gap-6 text-sm">
                                          <div>
                                            <span className="text-gray-500">
                                              Ejecuciones:{" "}
                                            </span>
                                            <span className="text-[#6D5BFA] font-semibold">
                                              {flow.executions}
                                            </span>
                                          </div>
                                          <div>
                                            <span className="text-gray-500">
                                              Fecha de creación:{" "}
                                            </span>
                                            <span className="text-gray-900">
                                              {formatDate(flow.createdAt)}
                                            </span>
                                          </div>
                                          <div>
                                            <span className="text-gray-500">
                                              Estado:{" "}
                                            </span>
                                            <span
                                              className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${
                                                flow.isActive
                                                  ? "bg-green-100 text-green-800"
                                                  : "bg-gray-100 text-gray-600"
                                              }`}
                                            >
                                              {flow.isActive ? "Activo" : "Inactivo"}
                                            </span>
                                          </div>
                                        </div>
                                      </div>
                                    </div>

                                    {/* Body - Two Columns */}
                                    <div className="grid grid-cols-2 gap-8">
                                      {/* Left Column - Disparador */}
                                      <div>
                                        <h4 className="text-sm font-semibold text-gray-900 mb-4">
                                          Disparador
                                        </h4>
                                        <div className="space-y-3">
                                          <div>
                                            <div className="text-sm text-gray-600 mb-2">
                                              Dispositivo:
                                            </div>
                                            <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-gray-100 rounded-lg text-sm text-gray-700">
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
                                                  d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z"
                                                />
                                              </svg>
                                              {flow.trigger?.device ||
                                                "Todos los dispositivos conectados"}
                                            </div>
                                          </div>

                                          <div>
                                            <div className="text-sm text-gray-900 mb-2">
                                              Se activa cuando se recibe un webhook de
                                              integración con terceros:
                                            </div>
                                            <div className="flex flex-wrap gap-2">
                                              {flow.trigger?.variables.map((variable) => (
                                                <span
                                                  key={variable}
                                                  className="inline-flex px-2.5 py-1 bg-[#6D5BFA]/10 text-[#6D5BFA] rounded-md text-xs font-medium"
                                                >
                                                  {variable}
                                                </span>
                                              ))}
                                            </div>
                                          </div>

                                          <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
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
                                              Esta automatización se activará cada vez
                                              que se cumpla el disparador.
                                            </p>
                                          </div>
                                        </div>
                                      </div>

                                      {/* Right Column - Flow Controls */}
                                      <div>
                                        <h4 className="text-sm font-semibold text-gray-900 mb-4">
                                          Pasos en el flow: {flow.stepsCount}
                                        </h4>
                                        <div className="space-y-4">
                                          {/* Activar Flow Toggle */}
                                          <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                                            <span className="text-sm font-medium text-gray-700">
                                              Activar Flow
                                            </span>
                                            <button
                                              onClick={() =>
                                                toggleFlowActive(
                                                  flow.id,
                                                  flow.isActive
                                                )
                                              }
                                              disabled={togglingFlowId === flow.id}
                                              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                                                flow.isActive
                                                  ? "bg-[#6D5BFA]"
                                                  : "bg-gray-300"
                                              } ${
                                                togglingFlowId === flow.id
                                                  ? "opacity-50 cursor-wait"
                                                  : "cursor-pointer"
                                              }`}
                                            >
                                              {togglingFlowId === flow.id ? (
                                                <div className="absolute inset-0 flex items-center justify-center">
                                                  <svg
                                                    className="animate-spin h-4 w-4 text-white"
                                                    xmlns="http://www.w3.org/2000/svg"
                                                    fill="none"
                                                    viewBox="0 0 24 24"
                                                  >
                                                    <circle
                                                      className="opacity-25"
                                                      cx="12"
                                                      cy="12"
                                                      r="10"
                                                      stroke="currentColor"
                                                      strokeWidth="4"
                                                    ></circle>
                                                    <path
                                                      className="opacity-75"
                                                      fill="currentColor"
                                                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                                                    ></path>
                                                  </svg>
                                                </div>
                                              ) : (
                                                <span
                                                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform shadow-sm ${
                                                    flow.isActive
                                                      ? "translate-x-6"
                                                      : "translate-x-1"
                                                  }`}
                                                />
                                              )}
                                            </button>
                                          </div>

                                          {/* Action Buttons */}
                                          <div className="space-y-2">
                                            <Link
                                              href={`/flows/${flow.id}`}
                                              className="flex items-center justify-center gap-2 w-full bg-[#6D5BFA] text-white px-4 py-2.5 rounded-xl hover:bg-[#5B4BD8] transition-colors font-medium shadow-sm"
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
                                                  d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                                                />
                                              </svg>
                                              Editar
                                            </Link>

                                            <button
                                              onClick={() => deleteFlow(flow.id)}
                                              className="flex items-center justify-center gap-2 w-full bg-white text-red-600 border border-red-200 px-4 py-2.5 rounded-xl hover:bg-red-50 transition-colors font-medium"
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
                                                  d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                                                />
                                              </svg>
                                              Eliminar
                                            </button>

                                            <button className="flex items-center justify-center gap-2 w-full bg-white text-gray-700 border border-gray-300 px-4 py-2.5 rounded-xl hover:bg-gray-50 transition-colors font-medium">
                                              <svg
                                                className="w-4 h-4"
                                                fill="currentColor"
                                                viewBox="0 0 24 24"
                                              >
                                                <path d="M12 8c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zm0 2c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm0 6c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2z" />
                                              </svg>
                                              Más opciones
                                            </button>
                                          </div>
                                        </div>
                                      </div>
                                    </div>
                                  </div>
                                </td>
                              </tr>
                            )}
                          </React.Fragment>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Create Folder Modal */}
      {showCreateFolderModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl p-6 max-w-md w-full shadow-xl">
            <h2 className="text-xl font-bold mb-4">Crear Nueva Carpeta</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Nombre de la carpeta
                </label>
                <input
                  type="text"
                  value={newFolderName}
                  onChange={(e) => setNewFolderName(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#6D5BFA]"
                  placeholder="Ej: Marketing"
                  autoFocus
                />
              </div>
              <div className="flex gap-2 justify-end">
                <button
                  onClick={() => {
                    setShowCreateFolderModal(false);
                    setNewFolderName("");
                  }}
                  className="px-5 py-2.5 text-gray-700 hover:bg-gray-100 rounded-xl transition-colors"
                >
                  Cancelar
                </button>
                <button
                  onClick={createFolder}
                  className="px-5 py-2.5 bg-[#6D5BFA] text-white rounded-xl hover:bg-[#5B4BD8] transition-colors disabled:opacity-50"
                  disabled={!newFolderName.trim()}
                >
                  Crear
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </SidebarLayout>
  );
}
