"use client";

import { useCallback, useState, useEffect, MouseEvent } from "react";
import ReactFlow, {
  Node,
  Edge,
  addEdge,
  Background,
  Controls,
  MiniMap,
  Connection,
  useNodesState,
  useEdgesState,
  NodeTypes,
  BackgroundVariant, 
 Panel,
} from "reactflow";
import "reactflow/dist/style.css";
import { EnviarMensajeNode } from "@/app/components/flow-builder-demo/EnviarMensajeNode";
import { PreguntaNode } from "@/app/components/flow-builder-demo/PreguntaNode";
import { MultipleQuestionNode } from "@/app/components/flow-builder-demo/MultipleQuestionNode";
import { DefaultNode } from "@/app/components/flow-builder-demo/DefaultNode";

const nodeTypes: NodeTypes = {
  enviar_mensaje: EnviarMensajeNode,
  pregunta: PreguntaNode,
  question_simple: PreguntaNode,
  question_multiple: MultipleQuestionNode,
  multipleQuestion: MultipleQuestionNode,
  wait: DefaultNode,
  assign_conversation: DefaultNode,
  condition: DefaultNode,
  rotator: DefaultNode,
  start_automation: DefaultNode,
  template: DefaultNode,
  assign_ai_agent: DefaultNode,
};

const initialEdges: Edge[] = [
  { id: "e1-2", source: "1", target: "2", type: "smoothstep" },
  { id: "e2-3", source: "2", target: "3", type: "smoothstep" },
  { id: "e3-4", source: "3", target: "4", type: "smoothstep" },
];

export default function FlowBuilderDemoPage() {
  // Initialize nodes with empty array, will be set in useEffect
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);
  const [selectedNode, setSelectedNode] = useState<Node | null>(null);
  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
    nodeId: string;
  } | null>(null);
  const [handleMenu, setHandleMenu] = useState<{
    x: number;
    y: number;
    sourceNodeId: string;
  } | null>(null);
  const [flowName, setFlowName] = useState("Mi Flujo de Automatización");

  // Handle node data changes
  const handleNodeDataChange = useCallback(
    (nodeId: string, updates: any) => {
      setNodes((nds) =>
        nds.map((node) =>
          node.id === nodeId
            ? { ...node, data: { ...node.data, ...updates } }
            : node
        )
      );
    },
    [setNodes]
  );

  // Handle connection handle clicks
  const handleHandleClick = useCallback(
    (nodeId: string, event: React.MouseEvent) => {
      setHandleMenu({
        x: event.clientX,
        y: event.clientY,
        sourceNodeId: nodeId,
      });
      setContextMenu(null);
    },
    []
  );

  // Initialize nodes with onChange callback
  useEffect(() => {
    const initialNodesData: Node[] = [
      {
        id: "1",
        type: "enviar_mensaje",
        position: { x: 100, y: 250 },
        data: {
          message: "Muy buenas, {primer_nombre}! Soy Claudia de FunnelChat.\n\nTe escribo porque te has registrado a nuestra masterclass gratuita de WhatsApp Marketing.",
          timeBetween: 1,
          messageType: "text",
          onChange: handleNodeDataChange,
          onHandleClick: handleHandleClick,
        },
      },
      {
        id: "2",
        type: "enviar_mensaje",
        position: { x: 550, y: 250 },
        data: {
          message: "Te agradezco que hayas tomado la decisión de invertir en tu formación.\n\nVamos a hacer un par de preguntas rápidas para personalizar tu experiencia...",
          timeBetween: 2,
          messageType: "text",
          onChange: handleNodeDataChange,
          onHandleClick: handleHandleClick,
        },
      },
      {
        id: "3",
        type: "pregunta",
        position: { x: 1000, y: 250 },
        data: {
          question: "Por cierto… ¿Es tu primera vez entrenando?\n\nA) Sí, es mi primera vez\nB) No, ya he entrenado antes",
          fallbackText: "Por favor, responde A o B",
          saveAs: "primera_vez",
          onChange: handleNodeDataChange,
          onHandleClick: handleHandleClick,
        },
      },
      {
        id: "4",
        type: "pregunta",
        position: { x: 1450, y: 250 },
        data: {
          question: "¿Tienes alguna lesión o condición física que deba saber?\n\nEscribe 'No' si no tienes ninguna, o descríbeme tu situación.",
          fallbackText: "Por favor, cuéntame sobre tu condición física",
          saveAs: "condicion_fisica",
          onChange: handleNodeDataChange,
          onHandleClick: handleHandleClick,
        },
      },
    ];
    setNodes(initialNodesData);
  }, [handleNodeDataChange, handleHandleClick, setNodes]);

  const onConnect = useCallback(
    (params: Connection) =>
      setEdges((eds) =>
        addEdge(
          {
            ...params,
            type: "smoothstep",
            style: { strokeWidth: 2, stroke: "#6D5BFA" },
          },
          eds
        )
      ),
    [setEdges]
  );

  // Handle node click (single click to select)
  const onNodeClick = useCallback((_: MouseEvent, node: Node) => {
    setSelectedNode(node);
    setContextMenu(null);
  }, []);

  // Handle node double-click (open edit mode)
  const onNodeDoubleClick = useCallback((_: MouseEvent, node: Node) => {
    const newLabel = prompt("Edit node label:", node.data.label);
    if (newLabel !== null) {
      setNodes((nds) =>
        nds.map((n) =>
          n.id === node.id ? { ...n, data: { ...n.data, label: newLabel } } : n
        )
      );
    }
  }, [setNodes]);

  // Handle node right-click (context menu)
  const onNodeContextMenu = useCallback(
    (event: MouseEvent, node: Node) => {
      event.preventDefault();
      setContextMenu({
        x: event.clientX,
        y: event.clientY,
        nodeId: node.id,
      });
    },
    []
  );

  // Handle pane click (deselect and close context menu)
  const onPaneClick = useCallback(() => {
    setSelectedNode(null);
    setContextMenu(null);
    setHandleMenu(null);
  }, []);

  // Duplicate node from context menu
  const duplicateNode = useCallback(() => {
    if (!contextMenu) return;
    const nodeToDuplicate = nodes.find((n) => n.id === contextMenu.nodeId);
    if (nodeToDuplicate) {
      const newNode: Node = {
        ...nodeToDuplicate,
        id: `node-${Date.now()}`,
        position: {
          x: nodeToDuplicate.position.x + 50,
          y: nodeToDuplicate.position.y + 50,
        },
        data: {
          ...nodeToDuplicate.data,
          onChange: handleNodeDataChange,
          onHandleClick: handleHandleClick,
        },
      };
      setNodes((nds) => [...nds, newNode]);
    }
    setContextMenu(null);
  }, [contextMenu, nodes, setNodes, handleNodeDataChange, handleHandleClick]);

  // Delete node from context menu
  const deleteNode = useCallback(() => {
    if (!contextMenu) return;
    setNodes((nds) => nds.filter((n) => n.id !== contextMenu.nodeId));
    setEdges((eds) =>
      eds.filter(
        (e) => e.source !== contextMenu.nodeId && e.target !== contextMenu.nodeId
      )
    );
    setContextMenu(null);
  }, [contextMenu, setNodes, setEdges]);

  // Add node from handle menu and connect it
  const addNodeFromHandle = useCallback(
    (type: string, label: string) => {
      if (!handleMenu) return;

      const sourceNode = nodes.find((n) => n.id === handleMenu.sourceNodeId);
      if (!sourceNode) return;

      const newNodeId = `node-${Date.now()}`;

      // Define default data based on node type
      let nodeData: any = {
        onChange: handleNodeDataChange,
        onHandleClick: handleHandleClick,
      };

      switch (type) {
        case "enviar_mensaje":
          nodeData = {
            ...nodeData,
            message: "Nuevo mensaje...",
            timeBetween: 1,
            messageType: "text",
          };
          break;
        case "pregunta":
        case "question_simple":
          nodeData = {
            ...nodeData,
            question: "¿Cuál es tu pregunta?",
            fallbackText: "No entendí...",
            saveAs: "respuesta",
          };
          break;
        case "question_multiple":
        case "multipleQuestion":
          nodeData = {
            ...nodeData,
            message: "",
            options: [{ id: `option-${Date.now()}`, label: "" }],
          };
          break;
        default:
          nodeData = {
            ...nodeData,
            label: label,
          };
      }

      const newNode: Node = {
        id: newNodeId,
        type,
        position: {
          x: sourceNode.position.x + 450,
          y: sourceNode.position.y,
        },
        data: nodeData,
      };

      // Add node
      setNodes((nds) => [...nds, newNode]);

      // Add edge
      setEdges((eds) =>
        addEdge(
          {
            id: `${handleMenu.sourceNodeId}-${newNodeId}-${Date.now()}`,
            source: handleMenu.sourceNodeId,
            target: newNodeId,
            type: "smoothstep",
            style: { strokeWidth: 2, stroke: "#6D5BFA" },
          },
          eds
        )
      );

      setHandleMenu(null);
    },
    [handleMenu, nodes, setNodes, setEdges, handleNodeDataChange, handleHandleClick]
  );

  // Add new message node
  const addMessageNode = useCallback(() => {
    const newNode: Node = {
      id: `node-${Date.now()}`,
      type: "enviar_mensaje",
      position: { x: 300, y: 200 },
      data: {
        message: "Nuevo mensaje...",
        timeBetween: 1,
        messageType: "text",
        onChange: handleNodeDataChange,
        onHandleClick: handleHandleClick,
      },
    };
    setNodes((nds) => [...nds, newNode]);
  }, [setNodes, handleNodeDataChange, handleHandleClick]);

  // Add new question node
  const addQuestionNode = useCallback(() => {
    const newNode: Node = {
      id: `node-${Date.now()}`,
      type: "pregunta",
      position: { x: 300, y: 300 },
      data: {
        question: "¿Cuál es tu pregunta?",
        fallbackText: "No entendí...",
        saveAs: "respuesta",
        onChange: handleNodeDataChange,
        onHandleClick: handleHandleClick,
      },
    };
    setNodes((nds) => [...nds, newNode]);
  }, [setNodes, handleNodeDataChange, handleHandleClick]);

  // Add new multiple question node
  const addMultipleQuestionNode = useCallback(() => {
    const newNode: Node = {
      id: `node-${Date.now()}`,
      type: "multipleQuestion",
      position: { x: 300, y: 400 },
      data: {
        message: "",
        options: [{ id: `option-${Date.now()}`, label: "" }],
        onChange: handleNodeDataChange,
        onHandleClick: handleHandleClick,
      },
    };
    setNodes((nds) => [...nds, newNode]);
  }, [setNodes, handleNodeDataChange, handleHandleClick]);

  // Save flow
  const handleSave = useCallback(() => {
    console.log("Saving flow:", { name: flowName, nodes, edges });
    alert("Flow guardado! (Ver consola para detalles)");
  }, [flowName, nodes, edges]);

  return (
    <div className="h-screen flex flex-col bg-[#F9FAFB]">
      {/* Top Bar */}
      <div className="bg-white border-b border-gray-200 px-6 py-3.5 shadow-sm">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4 flex-1">
            <input
              type="text"
              value={flowName}
              onChange={(e) => setFlowName(e.target.value)}
              className="text-xl font-semibold text-gray-900 border-0 focus:outline-none focus:ring-0 px-0 bg-transparent"
              placeholder="Nombre del flow"
            />
          </div>
          <button
            onClick={handleSave}
            className="bg-[#6D5BFA] text-white px-6 py-2 rounded-xl hover:bg-[#5B4BD8] transition-colors shadow-sm font-medium"
          >
            Guardar flow
          </button>
        </div>
      </div>

      {/* Canvas Area */}
      <div className="flex-1 relative">
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          nodeTypes={nodeTypes}
          onNodeClick={onNodeClick}
          onNodeDoubleClick={onNodeDoubleClick}
          onNodeContextMenu={onNodeContextMenu}
          onPaneClick={onPaneClick}
          fitView
          snapToGrid
          snapGrid={[15, 15]}
          defaultEdgeOptions={{
            style: { strokeWidth: 2, stroke: "#6D5BFA" },
            type: "smoothstep",
          }}
          className="cursor-grab active:cursor-grabbing"
          panOnDrag
          zoomOnScroll
          minZoom={0.2}
          maxZoom={2}
        >
          <Background
            color="#d1d5db"
            gap={24}
            size={1.5}
            variant={BackgroundVariant.Dots}
            className="bg-[#F9FAFB]"
          />
          <Controls className="bg-white border border-gray-300 rounded-lg shadow-lg" />
          <MiniMap
            className="bg-white border border-gray-300 rounded-lg shadow-lg"
            nodeStrokeWidth={3}
            maskColor="rgba(0, 0, 0, 0.05)"
          />

          {/* Toolbar Panel */}
          <Panel position="top-left" className="bg-white rounded-xl shadow-lg border border-gray-200 p-4">
            <div className="space-y-2">
              <div className="text-xs font-semibold text-gray-600 uppercase tracking-wide mb-3">
                Agregar nodo
              </div>
              <button
                onClick={addMessageNode}
                className="w-full text-left px-4 py-2.5 bg-white hover:bg-blue-50 border border-gray-200 rounded-lg text-sm font-medium transition-colors flex items-center gap-2"
              >
                <svg
                  className="w-4 h-4 text-blue-600"
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
                Enviar mensaje
              </button>
              <button
                onClick={addQuestionNode}
                className="w-full text-left px-4 py-2.5 bg-white hover:bg-purple-50 border border-gray-200 rounded-lg text-sm font-medium transition-colors flex items-center gap-2"
              >
                <svg
                  className="w-4 h-4 text-purple-600"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
                Pregunta
              </button>
              <button
                onClick={addMultipleQuestionNode}
                className="w-full text-left px-4 py-2.5 bg-white hover:bg-purple-50 border border-gray-200 rounded-lg text-sm font-medium transition-colors flex items-center gap-2"
              >
                <svg
                  className="w-4 h-4 text-purple-600"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
                Pregunta múltiple
              </button>
            </div>
          </Panel>
        </ReactFlow>

        {/* Context Menu */}
        {contextMenu && (
          <>
            <div
              className="fixed inset-0 z-40"
              onClick={() => setContextMenu(null)}
            />
            <div
              className="fixed z-50 bg-white rounded-lg shadow-lg border border-gray-200 py-1 min-w-[160px]"
              style={{ left: contextMenu.x, top: contextMenu.y }}
            >
              <button
                onClick={duplicateNode}
                className="w-full text-left px-4 py-2 hover:bg-gray-100 text-sm text-gray-700 flex items-center gap-2"
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
                    d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
                  />
                </svg>
                Duplicar
              </button>
              <button
                onClick={deleteNode}
                className="w-full text-left px-4 py-2 hover:bg-red-50 text-sm text-red-600 flex items-center gap-2"
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
            </div>
          </>
        )}

        {/* Handle Menu - "¿Qué desea agregar?" Modal */}
        {handleMenu && (
          <>
            <div
              className="fixed inset-0 bg-black bg-opacity-50 z-40 transition-opacity duration-200"
              onClick={() => setHandleMenu(null)}
            />
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
              <div className="bg-white rounded-2xl shadow-2xl border border-gray-200 p-6 max-w-md w-full transform transition-all duration-200 scale-100">
                <h3 className="font-semibold text-lg mb-6 text-gray-900">
                  ¿Qué desea agregar?
                </h3>

                <div className="space-y-6">
                  {/* Texto Section */}
                  <div>
                    <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">
                      Texto
                    </div>
                    <button
                      onClick={() => addNodeFromHandle("enviar_mensaje", "Enviar mensaje")}
                      className="w-full text-left px-4 py-2.5 bg-white hover:bg-gray-50 border border-gray-200 rounded-xl text-sm font-medium transition-colors shadow-sm hover:shadow"
                    >
                      Enviar mensaje
                    </button>
                  </div>

                  {/* Preguntas Section */}
                  <div>
                    <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">
                      Preguntas
                    </div>
                    <div className="space-y-2">
                      <button
                        onClick={() => addNodeFromHandle("question_multiple", "Pregunta múltiple")}
                        className="w-full text-left px-4 py-2.5 bg-white hover:bg-gray-50 border border-gray-200 rounded-xl text-sm font-medium transition-colors shadow-sm hover:shadow"
                      >
                        Múltiple
                      </button>
                      <button
                        onClick={() => addNodeFromHandle("question_simple", "Pregunta simple")}
                        className="w-full text-left px-4 py-2.5 bg-white hover:bg-gray-50 border border-gray-200 rounded-xl text-sm font-medium transition-colors shadow-sm hover:shadow"
                      >
                        Simple
                      </button>
                    </div>
                  </div>

                  {/* Acciones Section */}
                  <div>
                    <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">
                      Acciones
                    </div>
                    <div className="space-y-2">
                      <button
                        onClick={() => addNodeFromHandle("wait", "Esperar")}
                        className="w-full text-left px-4 py-2.5 bg-white hover:bg-gray-50 border border-gray-200 rounded-xl text-sm font-medium transition-colors shadow-sm hover:shadow"
                      >
                        Esperar
                      </button>
                      <button
                        onClick={() => addNodeFromHandle("assign_conversation", "Asignar conversación")}
                        className="w-full text-left px-4 py-2.5 bg-white hover:bg-gray-50 border border-gray-200 rounded-xl text-sm font-medium transition-colors shadow-sm hover:shadow"
                      >
                        Asignar conversación
                      </button>
                      <button
                        onClick={() => addNodeFromHandle("condition", "Condición")}
                        className="w-full text-left px-4 py-2.5 bg-white hover:bg-gray-50 border border-gray-200 rounded-xl text-sm font-medium transition-colors shadow-sm hover:shadow"
                      >
                        Condición
                      </button>
                      <button
                        onClick={() => addNodeFromHandle("rotator", "Rotador")}
                        className="w-full text-left px-4 py-2.5 bg-white hover:bg-gray-50 border border-gray-200 rounded-xl text-sm font-medium transition-colors shadow-sm hover:shadow"
                      >
                        Rotador
                      </button>
                      <button
                        onClick={() => addNodeFromHandle("start_automation", "Iniciar automatización")}
                        className="w-full text-left px-4 py-2.5 bg-white hover:bg-gray-50 border border-gray-200 rounded-xl text-sm font-medium transition-colors shadow-sm hover:shadow"
                      >
                        Iniciar automatización
                      </button>
                      <button
                        onClick={() => addNodeFromHandle("template", "Templates")}
                        className="w-full text-left px-4 py-2.5 bg-white hover:bg-gray-50 border border-gray-200 rounded-xl text-sm font-medium transition-colors shadow-sm hover:shadow"
                      >
                        Templates
                      </button>
                      <button
                        onClick={() => addNodeFromHandle("assign_ai_agent", "Asignar Agente IA")}
                        className="w-full text-left px-4 py-2.5 bg-white hover:bg-gray-50 border border-gray-200 rounded-xl text-sm font-medium transition-colors shadow-sm hover:shadow"
                      >
                        Asignar Agente IA
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Info Panel */}
      {selectedNode && (
        <div className="bg-white border-t border-gray-200 px-6 py-4">
          <div className="max-w-6xl mx-auto">
            <div className="text-sm">
              <span className="font-semibold text-gray-700">Nodo seleccionado:</span>{" "}
              <span className="text-gray-600">
                {selectedNode.type === "enviar_mensaje" ? "Enviar mensaje" : "Pregunta"} (ID: {selectedNode.id})
              </span>
              <span className="ml-4 text-gray-500">
                • Haz doble clic para editar • Clic derecho para más opciones
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
