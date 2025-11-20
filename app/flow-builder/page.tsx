"use client";

import { SidebarLayout } from "@/app/components/SidebarLayout";
import { useGlobal } from "../providers/GlobalProvider";
import Link from "next/link";
import { useState } from "react";

export default function FlowBuilderPage() {
  const { whatsappNumber, defaultAgent, flows, setFlows, addContact, contacts } = useGlobal();
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [flowName, setFlowName] = useState("");

  const handleAddContact = () => {
    if (!name || !phone) return;
    addContact({
      id: crypto.randomUUID(),
      name,
      phone,
      email,
      tags: ["lead", "whatsapp"],
    });
    setName("");
    setPhone("");
    setEmail("");
  };

  const saveFlow = async () => {
    if (!flowName) {
      alert("Please enter a flow name");
      return;
    }

    // Mock nodes and edges - in real app, these come from React Flow
    const mockNodes = [
      { id: "1", type: "start", position: { x: 0, y: 0 }, data: { label: "Start" } },
      { id: "2", type: "message", position: { x: 0, y: 100 }, data: { label: "Welcome" } },
    ];
    const mockEdges = [
      { id: "e1-2", source: "1", target: "2" },
    ];

    try {
      const res = await fetch("/api/flows", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: flowName,
          key: `flow-${Date.now()}`,
          description: "Created from Flow Builder demo",
        }),
      });

      if (!res.ok) {
        alert("Failed to save flow");
        return;
      }

      const saved = await res.json();

      // Update Zustand flows
      setFlows([
        ...flows,
        {
          id: saved.id,
          name: saved.name,
          nodes: mockNodes,
          edges: mockEdges,
        },
      ]);

      setFlowName("");
      alert(`Flow "${saved.name}" saved successfully!`);
    } catch (error) {
      console.error("Save flow error:", error);
      alert("Error saving flow");
    }
  };

  return (
    <SidebarLayout>
      <div className="p-8 bg-gray-50 min-h-screen">
        <div className="max-w-7xl mx-auto">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Flow Builder</h1>
          <p className="text-gray-600 mb-8">Build and manage automation flows</p>

          <div className="bg-white rounded-xl border border-gray-200 p-6 mb-6">
            <h3 className="font-semibold mb-4">Global State (from Integraciones)</h3>
            <div className="space-y-2 text-sm">
              <div>
                <span className="text-gray-600">WhatsApp Number:</span>{" "}
                <span className="font-mono">{whatsappNumber || "Not set"}</span>
              </div>
              <div>
                <span className="text-gray-600">Default Agent:</span>{" "}
                <span className="font-mono">{defaultAgent || "Not set"}</span>
              </div>
              <div>
                <span className="text-gray-600">Flows in store:</span>{" "}
                <span className="font-mono">{flows.length}</span>
              </div>
              <div>
                <span className="text-gray-600">Contacts in store:</span>{" "}
                <span className="font-mono">{contacts.length}</span>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl border border-gray-200 p-6 mb-6">
            <h3 className="font-semibold mb-4">Simulate Lead Creation</h3>
            <div className="grid grid-cols-3 gap-4 mb-4">
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Name"
                className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
              />
              <input
                type="text"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="Phone"
                className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
              />
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Email (optional)"
                className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
              />
            </div>
            <button
              onClick={handleAddContact}
              className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors font-medium"
            >
              Add Contact to Global Store
            </button>
          </div>

          <div className="bg-white rounded-xl border border-gray-200 p-6 mb-6">
            <h3 className="font-semibold mb-4">Save Flow Demo</h3>
            <div className="flex gap-4 items-end">
              <div className="flex-1">
                <label className="block text-sm text-gray-600 mb-1">Flow Name</label>
                <input
                  type="text"
                  value={flowName}
                  onChange={(e) => setFlowName(e.target.value)}
                  placeholder="My Awesome Flow"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                />
              </div>
              <button
                onClick={saveFlow}
                className="px-6 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors font-medium"
              >
                Guardar Flujo
              </button>
            </div>
            <p className="text-xs text-gray-500 mt-2">
              This creates a flow in the database and adds it to Zustand store
            </p>
          </div>

          <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 mb-6">
            <p className="text-sm text-blue-900">
              💡 Go to{" "}
              <Link href="/integraciones" className="underline font-semibold">
                /integraciones
              </Link>{" "}
              to set WhatsApp number and agent. Then come back here to see the state.
            </p>
          </div>

          <Link
            href="/flows"
            className="inline-block px-6 py-3 bg-purple-600 text-white rounded-xl hover:bg-purple-700 transition-colors font-medium"
          >
            Go to Flows (Full Builder)
          </Link>
        </div>
      </div>
    </SidebarLayout>
  );
}
