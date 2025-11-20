"use client";

import { useState, useMemo, useEffect } from "react";
import { SidebarLayout } from "@/app/components/SidebarLayout";

interface Tag {
  id: string;
  name: string;
  description?: string;
  color: string;
  contactsCount: number;
  createdAt: string;
}

type SortField = "name" | "createdAt";
type SortOrder = "asc" | "desc";

export default function TagsPage() {
  const [tags, setTags] = useState<Tag[]>([]);
  const [loading, setLoading] = useState(true);

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingTag, setEditingTag] = useState<Tag | null>(null);
  const [newTag, setNewTag] = useState({
    name: "",
    description: "",
    color: "#6D5BFA",
  });
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedTags, setSelectedTags] = useState<Set<string>>(new Set());
  const [sortField, setSortField] = useState<SortField>("createdAt");
  const [sortOrder, setSortOrder] = useState<SortOrder>("desc");

  // Load tags from API
  useEffect(() => {
    const fetchTags = async () => {
      try {
        const response = await fetch("/api/tags");
        if (response.ok) {
          const data = await response.json();
          // Map API data to include contactsCount (defaulting to 0 for now)
          const tagsWithCount = data.map((tag: any) => ({
            ...tag,
            contactsCount: 0, // TODO: Calculate from contacts
          }));
          setTags(tagsWithCount);
        }
      } catch (error) {
        console.error("Failed to fetch tags:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchTags();
  }, []);

  // Filtered and sorted tags
  const filteredTags = useMemo(() => {
    let result = tags;

    // Apply search filter
    if (searchQuery.trim()) {
      result = result.filter((tag) =>
        tag.name.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }

    // Apply sorting
    result = [...result].sort((a, b) => {
      let comparison = 0;
      if (sortField === "name") {
        comparison = a.name.localeCompare(b.name);
      } else if (sortField === "createdAt") {
        comparison =
          new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
      }
      return sortOrder === "asc" ? comparison : -comparison;
    });

    return result;
  }, [tags, searchQuery, sortField, sortOrder]);

  const toggleSort = (field: SortField) => {
    if (sortField === field) {
      setSortOrder(sortOrder === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortOrder("asc");
    }
  };

  const toggleSelectAll = () => {
    if (selectedTags.size === filteredTags.length) {
      setSelectedTags(new Set());
    } else {
      setSelectedTags(new Set(filteredTags.map((t) => t.id)));
    }
  };

  const toggleSelect = (id: string) => {
    const newSelected = new Set(selectedTags);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedTags(newSelected);
  };

  const clearFilters = () => {
    setSearchQuery("");
  };

  const openCreateModal = () => {
    setEditingTag(null);
    setNewTag({ name: "", description: "", color: "#6D5BFA" });
    setShowCreateModal(true);
  };

  const openEditModal = (tag: Tag) => {
    setEditingTag(tag);
    setNewTag({
      name: tag.name,
      description: tag.description || "",
      color: tag.color,
    });
    setShowCreateModal(true);
  };

  const createOrUpdateTag = async () => {
    if (!newTag.name.trim()) return;

    try {
      if (editingTag) {
        // TODO: Update existing tag via API (not implemented yet)
        alert("Edit functionality not yet implemented");
        return;
      } else {
        // Create new tag
        const response = await fetch("/api/tags", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: newTag.name.trim(),
            color: newTag.color,
          }),
        });

        if (response.ok) {
          const createdTag = await response.json();
          // Add to local state with contactsCount
          setTags([
            ...tags,
            { ...createdTag, contactsCount: 0, description: "" },
          ]);
          setShowCreateModal(false);
          setNewTag({ name: "", description: "", color: "#6D5BFA" });
        } else {
          const error = await response.json();
          alert(error.error || "Failed to create tag");
        }
      }
    } catch (error) {
      console.error("Failed to create tag:", error);
      alert("Error al crear el tag");
    }
  };

  const deleteTag = async (id: string) => {
    if (!confirm("¿Estás seguro de eliminar este tag?")) return;

    try {
      const response = await fetch(`/api/tags/${id}`, {
        method: "DELETE",
      });

      if (response.ok) {
        setTags(tags.filter((t) => t.id !== id));
        selectedTags.delete(id);
        setSelectedTags(new Set(selectedTags));
      } else {
        const error = await response.json();
        alert(error.error || "Failed to delete tag");
      }
    } catch (error) {
      console.error("Failed to delete tag:", error);
      alert("Error al eliminar el tag");
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString("es-ES", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  if (loading) {
    return (
      <SidebarLayout>
        <div className="p-8 flex items-center justify-center h-96">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#5B5FEF] mx-auto"></div>
            <p className="mt-4 text-gray-600">Cargando tags...</p>
          </div>
        </div>
      </SidebarLayout>
    );
  }

  return (
    <SidebarLayout>
      <div className="p-8">
        <div className="max-w-7xl mx-auto">
          {/* Header */}
          <div className="flex justify-between items-start mb-6">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Tags</h1>
              <p className="text-gray-600 mt-1">
                Crea etiquetas para agrupar a tus contactos, en base a acciones
                o segmentos.
              </p>
            </div>
            <button
              onClick={openCreateModal}
              className="bg-[#6D5BFA] text-white px-6 py-2.5 rounded-xl hover:bg-[#5B4BD8] transition-colors shadow-sm font-medium"
            >
              + Crear Tag
            </button>
          </div>

          {/* Search and Filters */}
          <div className="bg-white rounded-xl border border-gray-200 p-4 mb-4">
            <div className="flex items-center justify-between gap-4">
              <div className="flex-1">
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Buscar por nombre"
                  className="w-full px-4 py-2 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#6D5BFA] focus:border-transparent"
                />
              </div>
              <div className="flex items-center gap-3">
                <button
                  onClick={clearFilters}
                  className="text-sm text-gray-600 hover:text-gray-900 transition-colors"
                >
                  Limpiar todos los filtros
                </button>
                <button className="flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-xl hover:bg-gray-50 transition-colors text-sm font-medium">
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
              </div>
            </div>
          </div>

          {/* Total Count */}
          <div className="mb-3">
            <span className="text-sm text-gray-600">
              Total de Tags: {tags.length}
            </span>
          </div>

          {/* Table */}
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="w-12 px-4 py-3">
                      <input
                        type="checkbox"
                        checked={
                          filteredTags.length > 0 &&
                          selectedTags.size === filteredTags.length
                        }
                        onChange={toggleSelectAll}
                        className="rounded border-gray-300 text-[#6D5BFA] focus:ring-[#6D5BFA]"
                      />
                    </th>
                    <th className="px-4 py-3 text-left">
                      <button
                        onClick={() => toggleSort("name")}
                        className="flex items-center gap-2 font-semibold text-sm text-gray-700 hover:text-gray-900"
                      >
                        Nombre
                        {sortField === "name" && (
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
                        )}
                      </button>
                    </th>
                    <th className="px-4 py-3 text-left font-semibold text-sm text-gray-700">
                      Descripción
                    </th>
                    <th className="px-4 py-3 text-left font-semibold text-sm text-gray-700">
                      Contactos
                    </th>
                    <th className="px-4 py-3 text-left font-semibold text-sm text-gray-700">
                      Color
                    </th>
                    <th className="px-4 py-3 text-left">
                      <button
                        onClick={() => toggleSort("createdAt")}
                        className="flex items-center gap-2 font-semibold text-sm text-gray-700 hover:text-gray-900"
                      >
                        Creado
                        {sortField === "createdAt" && (
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
                        )}
                      </button>
                    </th>
                    <th className="px-4 py-3 text-right font-semibold text-sm text-gray-700">
                      Acciones
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {filteredTags.map((tag) => (
                    <tr
                      key={tag.id}
                      className="hover:bg-gray-50 transition-colors"
                    >
                      <td className="px-4 py-3">
                        <input
                          type="checkbox"
                          checked={selectedTags.has(tag.id)}
                          onChange={() => toggleSelect(tag.id)}
                          className="rounded border-gray-300 text-[#6D5BFA] focus:ring-[#6D5BFA]"
                        />
                      </td>
                      <td className="px-4 py-3 font-medium text-gray-900">
                        {tag.name}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600">
                        {tag.description || "-"}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-900">
                        {tag.contactsCount}
                      </td>
                      <td className="px-4 py-3">
                        <div
                          className="w-6 h-6 rounded-full border border-gray-300"
                          style={{ backgroundColor: tag.color }}
                        />
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600">
                        {formatDate(tag.createdAt)}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => openEditModal(tag)}
                            className="text-sm text-[#6D5BFA] hover:text-[#5B4BD8] font-medium"
                          >
                            Editar
                          </button>
                          <button
                            onClick={() => deleteTag(tag.id)}
                            className="text-sm text-red-600 hover:text-red-700 font-medium"
                          >
                            Eliminar
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination Footer */}
            <div className="px-4 py-3 border-t border-gray-200 bg-gray-50">
              <span className="text-sm text-gray-600">
                Mostrando {filteredTags.length} de {tags.length} registros
              </span>
            </div>
          </div>

          {/* Create/Edit Modal */}
          {showCreateModal && (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
              <div className="bg-white rounded-xl p-6 max-w-md w-full shadow-xl">
                <h2 className="text-2xl font-bold mb-4">
                  {editingTag ? "Editar Tag" : "Crear Nuevo Tag"}
                </h2>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Nombre <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={newTag.name}
                      onChange={(e) =>
                        setNewTag({ ...newTag, name: e.target.value })
                      }
                      className="w-full px-3 py-2 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#6D5BFA]"
                      placeholder="Nombre del tag"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Descripción
                    </label>
                    <textarea
                      value={newTag.description}
                      onChange={(e) =>
                        setNewTag({ ...newTag, description: e.target.value })
                      }
                      className="w-full px-3 py-2 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#6D5BFA] resize-none"
                      placeholder="Descripción del tag (opcional)"
                      rows={3}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Color
                    </label>
                    <input
                      type="color"
                      value={newTag.color}
                      onChange={(e) =>
                        setNewTag({ ...newTag, color: e.target.value })
                      }
                      className="w-full h-10 border border-gray-300 rounded-xl"
                    />
                  </div>
                  <div className="flex gap-2 justify-end pt-2">
                    <button
                      onClick={() => {
                        setShowCreateModal(false);
                        setEditingTag(null);
                      }}
                      className="px-5 py-2.5 text-gray-700 hover:bg-gray-100 rounded-xl transition-colors"
                    >
                      Cancelar
                    </button>
                    <button
                      onClick={createOrUpdateTag}
                      className="px-5 py-2.5 bg-[#6D5BFA] text-white rounded-xl hover:bg-[#5B4BD8] transition-colors disabled:opacity-50"
                      disabled={!newTag.name.trim()}
                    >
                      {editingTag ? "Guardar Cambios" : "Crear"}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </SidebarLayout>
  );
}
