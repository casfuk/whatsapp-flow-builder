"use client";

import { useState, useEffect, useMemo } from "react";
import { SidebarLayout } from "@/app/components/SidebarLayout";
import { useGlobal } from "../providers/GlobalProvider";

interface Contact {
  id: string;
  phoneNumber: string;
  name?: string;
  email?: string;
  profilePic?: string;
  source: "whatsapp" | "form" | "manual";
  tags: string;
  createdAt: string;
  updatedAt: string;
}

type Tab = "contactos" | "tablero";

const SOURCE_LABELS = {
  whatsapp: "WhatsApp",
  form: "Formulario",
  manual: "Manual",
};

export default function ContactosPage() {
  const { contacts: globalContacts, setContacts: setGlobalContacts, addContact: addGlobalContact } = useGlobal();
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<Tab>("contactos");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedContacts, setSelectedContacts] = useState<Set<string>>(
    new Set()
  );
  const [showEditModal, setShowEditModal] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [editingContact, setEditingContact] = useState<Contact | null>(null);
  const [editForm, setEditForm] = useState({
    name: "",
    phoneNumber: "",
    email: "",
  });

  useEffect(() => {
    fetchContacts();
  }, []);

  const fetchContacts = async () => {
    try {
      const response = await fetch("/api/contacts");
      const data = await response.json();
      setContacts(data);
      // Sync to Zustand store
      const globalFormat = data.map((c: any) => ({
        id: c.id,
        name: c.name || "",
        phone: c.phoneNumber,
        email: c.email,
        tags: c.tags ? JSON.parse(c.tags) : [],
      }));
      setGlobalContacts(globalFormat);
    } catch (error) {
      console.error("Failed to fetch contacts:", error);
    } finally {
      setLoading(false);
    }
  };

  const createTestContact = async () => {
    try {
      const testContact = {
        name: `Test Contact ${Date.now()}`,
        phoneNumber: `+1${Math.floor(Math.random() * 9000000000 + 1000000000)}`,
        email: `test${Date.now()}@example.com`,
        tags: ["test"],
      };

      const response = await fetch("/api/contacts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(testContact),
      });

      if (!response.ok) throw new Error("Failed to create contact");

      const created = await response.json();

      // Add to local state
      setContacts((prev) => [created, ...prev]);

      // Add to Zustand
      addGlobalContact({
        id: created.id,
        name: created.name || "",
        phone: created.phoneNumber,
        email: created.email,
        tags: created.tags ? JSON.parse(created.tags) : [],
      });
    } catch (error) {
      console.error("Failed to create test contact:", error);
    }
  };

  const filteredContacts = useMemo(() => {
    if (!searchQuery.trim()) return contacts;

    return contacts.filter(
      (contact) =>
        contact.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        contact.phoneNumber.includes(searchQuery) ||
        contact.email?.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [contacts, searchQuery]);

  const toggleSelectAll = () => {
    if (selectedContacts.size === filteredContacts.length) {
      setSelectedContacts(new Set());
    } else {
      setSelectedContacts(new Set(filteredContacts.map((c) => c.id)));
    }
  };

  const toggleSelect = (id: string) => {
    const newSelected = new Set(selectedContacts);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedContacts(newSelected);
  };

  const openEditModal = (contact: Contact) => {
    setEditingContact(contact);
    setEditForm({
      name: contact.name || "",
      phoneNumber: contact.phoneNumber,
      email: contact.email || "",
    });
    setShowEditModal(true);
  };

  const closeEditModal = () => {
    setShowEditModal(false);
    setEditingContact(null);
    setEditForm({ name: "", phoneNumber: "", email: "" });
  };

  const saveContact = async () => {
    if (!editingContact) return;

    try {
      const response = await fetch(`/api/contacts/${editingContact.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: editForm.name,
          phoneNumber: editForm.phoneNumber,
          email: editForm.email,
        }),
      });

      if (response.ok) {
        await fetchContacts();
        closeEditModal();
      } else {
        alert("Error al guardar el contacto");
      }
    } catch (error) {
      console.error("Failed to update contact:", error);
      alert("Error al guardar el contacto");
    }
  };

  const deleteContact = async (id: string) => {
    if (!confirm("¿Estás seguro de eliminar este contacto?")) return;

    try {
      const response = await fetch(`/api/contacts/${id}`, {
        method: "DELETE",
      });

      if (response.ok) {
        await fetchContacts();
        selectedContacts.delete(id);
        setSelectedContacts(new Set(selectedContacts));
      } else {
        alert("Error al eliminar el contacto");
      }
    } catch (error) {
      console.error("Failed to delete contact:", error);
      alert("Error al eliminar el contacto");
    }
  };

  const exportContacts = () => {
    const csvData = [
      ["Nombre", "Teléfono", "Correo", "Origen", "Creado"],
      ...filteredContacts.map((c) => [
        c.name || "",
        c.phoneNumber,
        c.email || "",
        SOURCE_LABELS[c.source],
        new Date(c.createdAt).toLocaleString("es-ES"),
      ]),
    ];

    const csvContent =
      "data:text/csv;charset=utf-8," +
      csvData.map((row) => row.join(",")).join("\n");

    const link = document.createElement("a");
    link.setAttribute("href", encodeURI(csvContent));
    link.setAttribute("download", `contactos_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString("es-ES", {
      day: "numeric",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const getInitials = (name?: string) => {
    if (!name) return "?";
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .substring(0, 2);
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
          <div className="mb-6">
            <div className="flex justify-between items-start mb-6">
              <div>
                <h1 className="text-3xl font-bold text-gray-900">Contactos</h1>
                <p className="text-gray-600 mt-1">
                  Gestiona todos tus contactos de WhatsApp importados o creados
                  por la aplicación.
                </p>
              </div>
              <div className="flex gap-3">
                <button
                  onClick={exportContacts}
                  className="bg-white text-gray-700 border border-gray-300 px-5 py-2.5 rounded-xl hover:bg-gray-50 transition-colors font-medium shadow-sm"
                >
                  Exportar contactos
                </button>
                <button
                  onClick={() => setShowImportModal(true)}
                  className="bg-[#6D5BFA] text-white px-5 py-2.5 rounded-xl hover:bg-[#5B4BD8] transition-colors font-medium shadow-sm"
                >
                  Importar contactos
                </button>
                <button
                  onClick={createTestContact}
                  className="bg-green-600 text-white px-5 py-2.5 rounded-xl hover:bg-green-700 transition-colors font-medium shadow-sm"
                >
                  + Test Contact
                </button>
              </div>
            </div>

            {/* Global Store Contacts */}
            {globalContacts.length > 0 && (
              <div className="bg-green-50 border border-green-200 rounded-xl p-4 mb-6">
                <h3 className="font-semibold text-green-900 mb-3">
                  Contacts from Global Store ({globalContacts.length})
                </h3>
                <div className="space-y-2">
                  {globalContacts.map((c) => (
                    <div key={c.id} className="bg-white rounded-lg p-3 text-sm">
                      <p className="font-medium text-gray-900">{c.name}</p>
                      <p className="text-gray-600">{c.phone}</p>
                      {c.email && <p className="text-gray-500">{c.email}</p>}
                      {c.tags && c.tags.length > 0 && (
                        <div className="flex gap-1 mt-2">
                          {c.tags.map((tag) => (
                            <span key={tag} className="px-2 py-0.5 bg-purple-100 text-purple-700 rounded text-xs">
                              {tag}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Tabs */}
            <div className="border-b border-gray-200 mb-6">
              <div className="flex gap-8">
                <button
                  onClick={() => setActiveTab("contactos")}
                  className={`pb-3 px-1 border-b-2 font-medium text-sm transition-colors ${
                    activeTab === "contactos"
                      ? "border-[#6D5BFA] text-[#6D5BFA]"
                      : "border-transparent text-gray-500 hover:text-gray-700"
                  }`}
                >
                  Contactos
                </button>
                <button
                  onClick={() => setActiveTab("tablero")}
                  className={`pb-3 px-1 border-b-2 font-medium text-sm transition-colors ${
                    activeTab === "tablero"
                      ? "border-[#6D5BFA] text-[#6D5BFA]"
                      : "border-transparent text-gray-500 hover:text-gray-700"
                  }`}
                >
                  Tablero
                </button>
              </div>
            </div>

            {activeTab === "contactos" && (
              <>
                {/* Search & Filter */}
                <div className="flex gap-4 mb-6">
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Buscar por contacto"
                    className="flex-1 px-4 py-2.5 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#6D5BFA] focus:border-transparent"
                  />
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
                </div>

                {/* Stats */}
                <div className="mb-4 flex items-center justify-between">
                  <span className="text-sm text-gray-600">
                    Total de contactos: {contacts.length}
                  </span>
                  <span className="text-sm text-gray-600">
                    {selectedContacts.size} seleccionado del total{" "}
                    {contacts.length}
                  </span>
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
                                filteredContacts.length > 0 &&
                                selectedContacts.size === filteredContacts.length
                              }
                              onChange={toggleSelectAll}
                              className="rounded border-gray-300 text-[#6D5BFA] focus:ring-[#6D5BFA]"
                            />
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                            Nombre
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                            Teléfono
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                            Correo electrónico
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                            Creado
                          </th>
                          <th className="px-6 py-3 text-right text-xs font-semibold text-gray-700 uppercase tracking-wider">
                            Acciones
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-200">
                        {filteredContacts.length === 0 ? (
                          <tr>
                            <td
                              colSpan={6}
                              className="px-6 py-12 text-center text-gray-500"
                            >
                              {searchQuery
                                ? "No se encontraron contactos con el filtro aplicado"
                                : "No hay contactos aún. Los contactos se crearán automáticamente desde WhatsApp o puedes importarlos."}
                            </td>
                          </tr>
                        ) : (
                          filteredContacts.map((contact) => (
                            <tr
                              key={contact.id}
                              className="hover:bg-gray-50 transition-colors"
                            >
                              <td className="px-6 py-4">
                                <input
                                  type="checkbox"
                                  checked={selectedContacts.has(contact.id)}
                                  onChange={() => toggleSelect(contact.id)}
                                  className="rounded border-gray-300 text-[#6D5BFA] focus:ring-[#6D5BFA]"
                                />
                              </td>
                              <td className="px-6 py-4">
                                <div className="flex items-center gap-3">
                                  {contact.profilePic ? (
                                    <img
                                      src={contact.profilePic}
                                      alt={contact.name || "Contact"}
                                      className="w-10 h-10 rounded-full"
                                    />
                                  ) : (
                                    <div className="w-10 h-10 rounded-full bg-[#6D5BFA] flex items-center justify-center text-white font-semibold text-sm">
                                      {getInitials(contact.name)}
                                    </div>
                                  )}
                                  <div>
                                    <div className="font-medium text-gray-900">
                                      {contact.name || "Sin nombre"}
                                    </div>
                                    <div className="text-xs text-gray-500">
                                      {SOURCE_LABELS[contact.source]}
                                    </div>
                                  </div>
                                </div>
                              </td>
                              <td className="px-6 py-4 text-sm text-gray-900">
                                {contact.phoneNumber}
                              </td>
                              <td className="px-6 py-4 text-sm text-gray-600">
                                {contact.email || "-"}
                              </td>
                              <td className="px-6 py-4 text-sm text-gray-600">
                                {formatDate(contact.createdAt)}
                              </td>
                              <td className="px-6 py-4">
                                <div className="flex items-center justify-end gap-2">
                                  <button
                                    onClick={() => openEditModal(contact)}
                                    className="p-2 text-gray-400 hover:text-[#6D5BFA] transition-colors"
                                    title="Editar"
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
                                        d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"
                                      />
                                    </svg>
                                  </button>
                                  <button
                                    className="p-2 text-gray-400 hover:text-[#6D5BFA] transition-colors"
                                    title="Abrir chat"
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
                                        d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
                                      />
                                    </svg>
                                  </button>
                                  <button
                                    onClick={() => deleteContact(contact.id)}
                                    className="p-2 text-gray-400 hover:text-red-600 transition-colors"
                                    title="Eliminar"
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
                                        d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                                      />
                                    </svg>
                                  </button>
                                </div>
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
                      Mostrando {filteredContacts.length} de {contacts.length}{" "}
                      contactos
                    </span>
                  </div>
                </div>
              </>
            )}

            {activeTab === "tablero" && (
              <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
                <p className="text-gray-500">
                  Dashboard de estadísticas próximamente...
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Edit Contact Modal */}
      {showEditModal && editingContact && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl p-6 max-w-md w-full shadow-xl">
            <h2 className="text-xl font-bold text-gray-900 mb-4">
              Editar contacto
            </h2>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Nombre
                </label>
                <input
                  type="text"
                  value={editForm.name}
                  onChange={(e) =>
                    setEditForm({ ...editForm, name: e.target.value })
                  }
                  className="w-full px-3 py-2.5 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#6D5BFA]"
                  placeholder="Nombre del contacto"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Teléfono
                </label>
                <input
                  type="text"
                  value={editForm.phoneNumber}
                  onChange={(e) =>
                    setEditForm({ ...editForm, phoneNumber: e.target.value })
                  }
                  className="w-full px-3 py-2.5 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#6D5BFA]"
                  placeholder="+34 000 000 000"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Correo electrónico
                </label>
                <input
                  type="email"
                  value={editForm.email}
                  onChange={(e) =>
                    setEditForm({ ...editForm, email: e.target.value })
                  }
                  className="w-full px-3 py-2.5 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#6D5BFA]"
                  placeholder="email@ejemplo.com"
                />
              </div>

              <div className="flex gap-3 justify-end pt-4">
                <button
                  onClick={closeEditModal}
                  className="px-5 py-2.5 text-gray-700 border border-gray-300 rounded-xl hover:bg-gray-50 transition-colors font-medium"
                >
                  Cancelar
                </button>
                <button
                  onClick={saveContact}
                  className="px-5 py-2.5 bg-[#6D5BFA] text-white rounded-xl hover:bg-[#5B4BD8] transition-colors font-medium"
                  disabled={!editForm.phoneNumber.trim()}
                >
                  Guardar cambios
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Import Contacts Modal */}
      {showImportModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl p-6 max-w-md w-full shadow-xl">
            <h2 className="text-xl font-bold text-gray-900 mb-2">
              Importar contactos
            </h2>
            <p className="text-sm text-gray-600 mb-6">
              Sube un archivo CSV o XLSX con tus contactos.
            </p>

            <div className="border-2 border-dashed border-gray-300 rounded-xl p-8 text-center mb-4 hover:border-[#6D5BFA] transition-colors cursor-pointer">
              <svg
                className="w-12 h-12 mx-auto text-gray-400 mb-3"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
                />
              </svg>
              <p className="text-sm text-gray-600 mb-1">
                Arrastra y suelta tu archivo aquí
              </p>
              <p className="text-xs text-gray-500">o haz clic para seleccionar</p>
              <p className="text-xs text-gray-400 mt-2">CSV o XLSX</p>
            </div>

            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-6">
              <p className="text-xs text-blue-900">
                <strong>Formato esperado:</strong> Nombre, Teléfono, Email
              </p>
            </div>

            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setShowImportModal(false)}
                className="px-5 py-2.5 text-gray-700 border border-gray-300 rounded-xl hover:bg-gray-50 transition-colors font-medium"
              >
                Cancelar
              </button>
              <button className="px-5 py-2.5 bg-[#6D5BFA] text-white rounded-xl hover:bg-[#5B4BD8] transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed">
                Importar
              </button>
            </div>
          </div>
        </div>
      )}
    </SidebarLayout>
  );
}
