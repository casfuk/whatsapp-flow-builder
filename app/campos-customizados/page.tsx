"use client";

import { useState, useMemo, useEffect } from "react";
import { SidebarLayout } from "@/app/components/SidebarLayout";

type FieldType = "text" | "number" | "date" | "url";

interface CustomField {
  id: string;
  name: string;
  type: FieldType;
  createdAt: string;
}

type SortOrder = "asc" | "desc";

const FIELD_TYPE_LABELS: Record<FieldType, string> = {
  text: "Texto",
  number: "Número",
  date: "Fecha",
  url: "URL",
};

export default function CamposCustomizadosPage() {
  const [fields, setFields] = useState<CustomField[]>([]);
  const [loading, setLoading] = useState(true);

  const [searchQuery, setSearchQuery] = useState("");
  const [selectedFields, setSelectedFields] = useState<Set<string>>(new Set());
  const [sortOrder, setSortOrder] = useState<SortOrder>("asc");
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newField, setNewField] = useState({
    name: "",
    type: "text" as FieldType,
  });

  // Load custom fields from API
  useEffect(() => {
    const fetchFields = async () => {
      try {
        const response = await fetch("/api/custom-fields");
        if (response.ok) {
          const data = await response.json();
          setFields(data);
        }
      } catch (error) {
        console.error("Failed to fetch custom fields:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchFields();
  }, []);

  // Filtered and sorted fields
  const filteredFields = useMemo(() => {
    let result = fields;

    // Apply search filter
    if (searchQuery.trim()) {
      result = result.filter((field) =>
        field.name.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }

    // Apply sorting by name
    result = [...result].sort((a, b) => {
      const comparison = a.name.localeCompare(b.name);
      return sortOrder === "asc" ? comparison : -comparison;
    });

    return result;
  }, [fields, searchQuery, sortOrder]);

  const toggleSort = () => {
    setSortOrder(sortOrder === "asc" ? "desc" : "asc");
  };

  const toggleSelectAll = () => {
    if (selectedFields.size === filteredFields.length) {
      setSelectedFields(new Set());
    } else {
      setSelectedFields(new Set(filteredFields.map((f) => f.id)));
    }
  };

  const toggleSelect = (id: string) => {
    const newSelected = new Set(selectedFields);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedFields(newSelected);
  };

  const createField = async () => {
    if (!newField.name.trim()) return;

    try {
      const response = await fetch("/api/custom-fields", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newField.name.trim(),
          type: newField.type,
        }),
      });

      if (response.ok) {
        const createdField = await response.json();
        setFields([...fields, createdField]);
        setShowCreateModal(false);
        setNewField({ name: "", type: "text" });
      } else {
        const error = await response.json();
        alert(error.error || "Failed to create field");
      }
    } catch (error) {
      console.error("Failed to create field:", error);
      alert("Error al crear el campo");
    }
  };

  const isFormValid = newField.name.trim().length > 0 && newField.name.length <= 50;

  if (loading) {
    return (
      <SidebarLayout>
        <div className="p-8 flex items-center justify-center h-96">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#5B5FEF] mx-auto"></div>
            <p className="mt-4 text-gray-600">Cargando campos...</p>
          </div>
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
            <div className="flex justify-between items-start mb-6">
              <div>
                <h1 className="text-3xl font-bold text-gray-900">
                  Campos Customizados
                </h1>
                <p className="text-gray-600 mt-1">
                  Crea campos personalizados para ampliar la información de tus
                  contactos.
                </p>
              </div>
              <div className="flex gap-3">
                <button className="flex items-center gap-2 px-5 py-2.5 bg-white text-gray-700 border border-gray-300 rounded-xl hover:bg-gray-50 transition-colors font-medium shadow-sm">
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
                      d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z"
                    />
                  </svg>
                  Filtrar
                </button>
                <button
                  onClick={() => setShowCreateModal(true)}
                  className="bg-[#6D5BFA] text-white px-5 py-2.5 rounded-xl hover:bg-[#5B4BD8] transition-colors font-medium shadow-sm"
                >
                  + Crear campo
                </button>
              </div>
            </div>

            {/* Search Bar */}
            <div className="mb-4">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Buscar por nombre"
                className="w-full px-4 py-2.5 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#6D5BFA] focus:border-transparent"
              />
            </div>
          </div>

          {/* Table */}
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="w-12 px-6 py-3">
                      <input
                        type="checkbox"
                        checked={
                          filteredFields.length > 0 &&
                          selectedFields.size === filteredFields.length
                        }
                        onChange={toggleSelectAll}
                        className="rounded border-gray-300 text-[#6D5BFA] focus:ring-[#6D5BFA]"
                      />
                    </th>
                    <th className="px-6 py-3 text-left">
                      <button
                        onClick={toggleSort}
                        className="flex items-center gap-2 text-xs font-semibold text-gray-700 uppercase tracking-wider hover:text-gray-900"
                      >
                        Nombre
                        <svg
                          className={`w-4 h-4 transition-transform ${
                            sortOrder === "desc" ? "rotate-180" : ""
                          }`}
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
                      </button>
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                      Tipo
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {filteredFields.length === 0 ? (
                    <tr>
                      <td
                        colSpan={3}
                        className="px-6 py-12 text-center text-gray-500"
                      >
                        {searchQuery
                          ? "No se encontraron campos con el filtro aplicado"
                          : "No hay campos customizados aún. Crea tu primer campo para comenzar."}
                      </td>
                    </tr>
                  ) : (
                    filteredFields.map((field) => (
                      <tr
                        key={field.id}
                        className="hover:bg-gray-50 transition-colors"
                      >
                        <td className="px-6 py-4">
                          <input
                            type="checkbox"
                            checked={selectedFields.has(field.id)}
                            onChange={() => toggleSelect(field.id)}
                            className="rounded border-gray-300 text-[#6D5BFA] focus:ring-[#6D5BFA]"
                          />
                        </td>
                        <td className="px-6 py-4 font-medium text-gray-900">
                          {field.name}
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-600">
                          {FIELD_TYPE_LABELS[field.type]}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Footer */}
            <div className="px-6 py-3 border-t border-gray-200 bg-gray-50">
              <span className="text-sm text-gray-600">
                Mostrando {filteredFields.length} de {fields.length} campos
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Create Field Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl p-6 max-w-md w-full shadow-xl">
            <h2 className="text-xl font-bold text-gray-900 mb-2">
              Crear campo customizado
            </h2>
            <p className="text-sm text-gray-600 mb-6">
              Asigna el nombre y el tipo de campo para ampliar la información de
              tus contactos.
            </p>

            <div className="space-y-5">
              {/* Name Field */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Nombre <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={newField.name}
                  onChange={(e) =>
                    setNewField({ ...newField, name: e.target.value })
                  }
                  className="w-full px-3 py-2.5 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#6D5BFA] focus:border-transparent"
                  placeholder="Escribe el nombre"
                  maxLength={50}
                />
                <div className="text-xs text-gray-500 mt-1 text-right">
                  {newField.name.length}/50
                </div>
              </div>

              {/* Type Field */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Tipo de campo customizado <span className="text-red-500">*</span>
                </label>
                <select
                  value={newField.type}
                  onChange={(e) =>
                    setNewField({
                      ...newField,
                      type: e.target.value as FieldType,
                    })
                  }
                  className="w-full px-3 py-2.5 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#6D5BFA] focus:border-transparent"
                >
                  <option value="text">Texto</option>
                  <option value="number">Número</option>
                  <option value="date">Fecha</option>
                  <option value="url">URL</option>
                </select>
              </div>

              {/* Action Buttons */}
              <div className="flex gap-3 justify-end pt-4">
                <button
                  onClick={() => {
                    setShowCreateModal(false);
                    setNewField({ name: "", type: "text" });
                  }}
                  className="px-5 py-2.5 text-gray-700 border border-gray-300 rounded-xl hover:bg-gray-50 transition-colors font-medium"
                >
                  Cancelar
                </button>
                <button
                  onClick={createField}
                  disabled={!isFormValid}
                  className="px-5 py-2.5 bg-[#6D5BFA] text-white rounded-xl hover:bg-[#5B4BD8] transition-colors font-medium shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Ejecutar acción
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </SidebarLayout>
  );
}
