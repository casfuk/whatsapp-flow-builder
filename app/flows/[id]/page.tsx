"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter, useParams } from "next/navigation";
import dynamic from "next/dynamic";
import { Node, Edge, ReactFlowProvider } from "reactflow";
import { FlowHeader } from "@/app/components/flow-builder/FlowHeader";
import type { FlowBuilderRef } from "@/app/components/flow-builder/FlowBuilder";
import type { ValidationError } from "@/lib/utils/flowValidation";

const FlowBuilder = dynamic(
  () => import("@/app/components/flow-builder/FlowBuilder"),
  { ssr: false }
);

export default function EditFlowPage() {
  const router = useRouter();
  const params = useParams();
  const flowId = params?.id as string;
  const flowBuilderRef = useRef<FlowBuilderRef>(null);

  const [flowName, setFlowName] = useState("");
  const [isActive, setIsActive] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [errors, setErrors] = useState<ValidationError[]>([]);
  const [nodeErrors, setNodeErrors] = useState<Record<string, ValidationError[]>>({});
  const [initialNodes, setInitialNodes] = useState<Node[]>([]);
  const [initialEdges, setInitialEdges] = useState<Edge[]>([]);

  // Load flow data
  useEffect(() => {
    const loadFlow = async () => {
      try {
        const response = await fetch(`/api/flows/${flowId}`);
        const flow = await response.json();

        setFlowName(flow.name);
        setIsActive(flow.isActive);
        setInitialNodes(flow.nodes || []);
        setInitialEdges(flow.edges || []);
      } catch (error) {
        console.error("Failed to load flow:", error);
        alert("Error al cargar el flow");
        router.push("/flows");
      } finally {
        setLoading(false);
      }
    };

    if (flowId) {
      loadFlow();
    }
  }, [flowId, router]);

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
      const response = await fetch(`/api/flows/${flowId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: flowName,
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

      // Show success toast
      showToast("✓ Automatización guardada exitosamente", "success");

      // Refresh the page data
      router.refresh();
    } catch (error) {
      console.error("Failed to save flow:", error);
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

  if (loading) {
    return (
      <div className="h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#5B5FEF] mx-auto"></div>
          <p className="mt-4 text-gray-600">Cargando flow...</p>
        </div>
      </div>
    );
  }

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
            flowId={flowId}
            initialNodes={initialNodes}
            initialEdges={initialEdges}
            nodeErrors={nodeErrors}
          />
        </ReactFlowProvider>
      </div>
    </div>
  );
}
