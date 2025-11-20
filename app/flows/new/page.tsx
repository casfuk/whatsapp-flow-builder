"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import { Node, Edge, ReactFlowProvider } from "reactflow";
import { FlowHeader } from "@/app/components/flow-builder/FlowHeader";
import type { FlowBuilderRef } from "@/app/components/flow-builder/FlowBuilder";
import type { ValidationError } from "@/lib/utils/flowValidation";

const FlowBuilder = dynamic(
  () => import("@/app/components/flow-builder/FlowBuilder"),
  { ssr: false }
);

export default function NewFlowPage() {
  const router = useRouter();
  const flowBuilderRef = useRef<FlowBuilderRef>(null);

  // Default name with current date/time
  const [flowName, setFlowName] = useState(() => {
    const now = new Date();
    const date = now.toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric' });
    const time = now.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    return `Flow del ${date} a las ${time}`;
  });
  const [isActive, setIsActive] = useState(true);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<ValidationError[]>([]);
  const [nodeErrors, setNodeErrors] = useState<Record<string, ValidationError[]>>({});

  // Initial empty flow with start node and placeholder
  const initialNodes: Node[] = [
    {
      id: 'start',
      position: { x: 100, y: 200 },
      type: 'start',
      draggable: false,
      data: {
        title: 'Crea una automatización',
        subtitle: 'Este es el inicio del flujo, puedes comenzar a través de tus campañas o automatizaciones',
        hasTrigger: false,
      },
    },
    {
      id: 'placeholder-initial',
      position: { x: 550, y: 200 },
      type: 'placeholder',
      data: {
        label: '¿Qué desea agregar?',
      },
    },
  ];

  const initialEdges: Edge[] = [
    {
      id: 'start-to-placeholder',
      source: 'start',
      target: 'placeholder-initial',
    },
  ];

  const handleSaveFlow = async () => {
    if (!flowBuilderRef.current) return;

    // Get current flow state and validate
    const result = await flowBuilderRef.current.saveFlow();

    if (!result.isValid) {
      setErrors(result.errors);

      // Build nodeErrors map
      const perNode: Record<string, ValidationError[]> = {};
      for (const err of result.errors) {
        if (!err.nodeId) continue;
        if (!perNode[err.nodeId]) perNode[err.nodeId] = [];
        perNode[err.nodeId].push(err);
      }
      setNodeErrors(perNode);

      // Show error toast
      showToast("❌ El flujo tiene errores. Por favor corríjalos antes de guardar.", "error");
      return;
    }

    setErrors([]);
    setNodeErrors({});
    setSaving(true);

    try {
      const response = await fetch("/api/flows", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: flowName,
          description: "",
          isActive: isActive,
          nodes: result.nodes,
          edges: result.edges,
        }),
      });

      if (!response.ok) {
        let payload: any = null;
        try {
          payload = await response.json();
        } catch {
          // fallback if response is not JSON
        }

        const serverErrors: ValidationError[] = [];

        if (payload?.errors && Array.isArray(payload.errors)) {
          for (const e of payload.errors) {
            serverErrors.push({
              type: "error",
              code: e.code ?? "SERVER_VALIDATION",
              message: e.message ?? "Error de validación en el servidor.",
              nodeId: e.nodeId,
            });
          }
        } else {
          // Show detailed error message from backend
          const errorMsg = payload?.message || payload?.error || "No se pudo guardar la automatización. Inténtalo de nuevo.";
          serverErrors.push({
            type: "error",
            message: errorMsg,
          });

          // Log full error details for debugging
          if (payload?.details) {
            console.error("Backend error details:", payload.details);
          }
        }

        setErrors(serverErrors);

        // Build nodeErrors map for server errors
        const perNode: Record<string, ValidationError[]> = {};
        for (const err of serverErrors) {
          if (!err.nodeId) continue;
          if (!perNode[err.nodeId]) perNode[err.nodeId] = [];
          perNode[err.nodeId].push(err);
        }
        setNodeErrors(perNode);

        showToast(
          serverErrors.length > 0 && serverErrors[0].message
            ? `❌ ${serverErrors[0].message}`
            : "❌ Error al guardar la automatización",
          "error"
        );
        setSaving(false);
        return;
      }

      const newFlow = await response.json();

      // Show success toast
      showToast("✓ Automatización guardada exitosamente", "success");

      // Update URL to edit page but stay in editor
      router.replace(`/flows/${newFlow.id}`);
    } catch (error) {
      console.error("Failed to create flow:", error);
      showToast("❌ Error al guardar la automatización", "error");
    } finally {
      setSaving(false);
    }
  };

  const showToast = (message: string, type: "success" | "error" = "success") => {
    const toast = document.createElement("div");
    toast.className = `fixed top-4 right-4 ${
      type === "success" ? "bg-green-500" : "bg-red-500"
    } text-white px-6 py-3 rounded-xl shadow-lg z-50 animate-fade-in`;
    toast.textContent = message;
    document.body.appendChild(toast);
    setTimeout(() => {
      toast.remove();
    }, 3000);
  };

  const focusNode = (nodeId: string) => {
    if (flowBuilderRef.current) {
      flowBuilderRef.current.focusNode(nodeId);
    }
  };

  return (
    <div className="h-screen flex flex-col">
      {/* Header */}
      <FlowHeader
        flowName={flowName}
        isActive={isActive}
        isSaving={saving}
        onChangeName={setFlowName}
        onToggleActive={() => setIsActive(!isActive)}
        onSave={handleSaveFlow}
      />

      {/* Validation Errors */}
      {errors.length > 0 && (
        <div className="mx-6 mt-2 mb-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
          <p className="font-semibold mb-1">Hay problemas en tu flujo:</p>
          <ul className="list-disc list-inside space-y-1">
            {errors.map((err, i) => (
              <li
                key={err.type + err.message + i}
                className={err.nodeId ? "cursor-pointer hover:text-red-900 hover:underline" : ""}
                onClick={() => err.nodeId && focusNode(err.nodeId)}
              >
                {err.message}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Flow Builder */}
      <div className="flex-1">
        <ReactFlowProvider>
          <FlowBuilder
            ref={flowBuilderRef}
            flowId={undefined as any}
            initialNodes={initialNodes}
            initialEdges={initialEdges}
            nodeErrors={nodeErrors}
          />
        </ReactFlowProvider>
      </div>
    </div>
  );
}
