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
    console.log('[SaveFlow] Save button clicked');

    if (!flowBuilderRef.current) {
      console.error('[SaveFlow] FlowBuilder ref is null!');
      showToast("❌ Error: FlowBuilder no está disponible", "error");
      return;
    }

    console.log('[SaveFlow] Getting flow state from FlowBuilder...');
    // Get current flow state and validate
    const result = await flowBuilderRef.current.saveFlow();
    console.log('[SaveFlow] FlowBuilder returned:', {
      isValid: result.isValid,
      nodeCount: result.nodes.length,
      edgeCount: result.edges.length,
      errors: result.errors
    });

    // Log question nodes specifically
    const questionNodes = result.nodes.filter((n: any) =>
      n.type === 'question_multiple' || n.type === 'question_simple'
    );
    questionNodes.forEach((node: any) => {
      console.log(`[SaveFlow] Question node ${node.id}:`, {
        type: node.type,
        questionText: node.data?.questionText,
        buttons: node.data?.buttons,
        allData: node.data
      });
    });

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
      const payload = {
        name: flowName,
        isActive: isActive,
        nodes: result.nodes,
        edges: result.edges,
      };

      console.log('[SaveFlow] Sending PUT request to /api/flows/' + flowId);
      console.log('[SaveFlow] Payload:', JSON.stringify(payload, null, 2));

      const response = await fetch(`/api/flows/${flowId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      console.log('[SaveFlow] Response status:', response.status, response.statusText);

      if (!response.ok) {
        console.error('[SaveFlow] Response not OK:', response.status);
        let payload: any = null;
        try {
          payload = await response.json();
          console.error('[SaveFlow] Error payload:', payload);
        } catch (e) {
          console.error('[SaveFlow] Could not parse error response as JSON:', e);
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
            console.error("[SaveFlow] Backend error details:", payload.details);
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

      console.log('[SaveFlow] Save successful!');
      const savedFlow = await response.json();
      console.log('[SaveFlow] Saved flow response:', {
        id: savedFlow.id,
        name: savedFlow.name,
        nodeCount: savedFlow.nodes?.length,
        edgeCount: savedFlow.edges?.length
      });

      // Show success toast
      showToast("✓ Automatización guardada exitosamente", "success");

      // Refresh the page data
      console.log('[SaveFlow] Calling router.refresh()');
      router.refresh();
    } catch (error) {
      console.error("[SaveFlow] Failed to save flow - exception thrown:", error);
      showToast("❌ Error al guardar la automatización", "error");
    } finally {
      setSaving(false);
      console.log('[SaveFlow] Save flow complete');
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
