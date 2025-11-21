"use client";

import { useCallback, useState, useEffect, useRef, forwardRef, useImperativeHandle } from "react";
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
  reconnectEdge,
  useReactFlow,
  OnConnectEnd,
} from "reactflow";
import "reactflow/dist/style.css";
import "./flow-handles.css";
import { StartNode } from "./nodes/StartNode";
import { MessageNode } from "./nodes/MessageNode";
import { QuestionNode } from "./nodes/QuestionNode";
import { MultipleChoiceNode } from "./nodes/MultipleChoiceNode";
import { DefaultNode } from "./nodes/DefaultNode";
import { WaitNode } from "./nodes/WaitNode";
import { ConditionNode } from "./nodes/ConditionNode";
import { PlaceholderNode } from "./nodes/PlaceholderNode";
import { StartAutomationNode } from "./nodes/StartAutomationNode";
import { RotatorNode } from "./nodes/RotatorNode";
import { AssignConversationNode } from "./nodes/AssignConversationNode";
import { validateFlow, ValidationResult, ValidationError } from "@/lib/utils/flowValidation";

const nodeTypes: NodeTypes = {
  start: StartNode,
  send_message: MessageNode,
  question_simple: QuestionNode,
  question_multiple: QuestionNode,
  multipleChoice: MultipleChoiceNode,
  default: DefaultNode,
  wait: WaitNode,
  condition: ConditionNode,
  assign_conversation: AssignConversationNode,
  rotator: RotatorNode,
  start_automation: StartAutomationNode,
  template: DefaultNode,
  assign_ai_agent: DefaultNode,
  placeholder: PlaceholderNode,
};

interface FlowBuilderProps {
  flowId: string;
  initialNodes: Node[];
  initialEdges: Edge[];
  nodeErrors?: Record<string, ValidationError[]>;
  onSave?: (nodes: Node[], edges: Edge[]) => void;
}

export interface FlowBuilderRef {
  saveFlow: () => Promise<ValidationResult & { nodes: Node[]; edges: Edge[] }>;
  focusNode: (nodeId: string) => void;
}

type AddMenuState = {
  visible: boolean;
  x: number;
  y: number;
  fromNode?: string;
  fromHandle?: string | null;
};

const initialMenu: AddMenuState = {
  visible: false,
  x: 0,
  y: 0,
};

const FlowBuilder = forwardRef<FlowBuilderRef, FlowBuilderProps>(function FlowBuilder(
  {
    flowId,
    initialNodes,
    initialEdges,
    nodeErrors = {},
    onSave,
  },
  ref
) {
  const { project, fitView, setViewport, setCenter } = useReactFlow();
  const reactFlowWrapper = useRef<HTMLDivElement>(null);
  const [addMenu, setAddMenu] = useState<AddMenuState>(initialMenu);
  const [isConnecting, setIsConnecting] = useState(false);
  const [connectionSource, setConnectionSource] = useState<{ nodeId: string; handleId: string | null } | null>(null);
  const [selectedNode, setSelectedNode] = useState<Node | null>(null);
  const [selectedEdge, setSelectedEdge] = useState<Edge | null>(null);

  // Initialize state hooks first
  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);

  // Expose save method and focusNode via ref
  useImperativeHandle(ref, () => ({
    saveFlow: async () => {
      const validation = validateFlow(nodes, edges);
      return {
        ...validation,
        nodes,
        edges,
      };
    },
    focusNode: (nodeId: string) => {
      const node = nodes.find((n) => n.id === nodeId);
      if (!node) return;
      setCenter(
        node.position.x + 200, // approximate node width/2
        node.position.y + 100, // approximate node height/2
        { zoom: 1.2, duration: 400 }
      );
    },
  }));

  // Define handlers after hooks
  const handleDeleteNode = useCallback((nodeId: string) => {
    // Prevent deletion of start node
    if (nodeId === 'start') {
      alert('No puedes eliminar el nodo de inicio del flujo');
      return;
    }
    setNodes((nds) => nds.filter((n) => n.id !== nodeId));
    setEdges((eds) =>
      eds.filter((e) => e.source !== nodeId && e.target !== nodeId)
    );
    if (selectedNode?.id === nodeId) {
      setSelectedNode(null);
    }
  }, [selectedNode, setNodes, setEdges]);

  const handleDuplicateNode = useCallback((nodeId: string) => {
    setNodes((nds) => {
      const nodeToDuplicate = nds.find((n) => n.id === nodeId);
      if (!nodeToDuplicate) return nds;

      const newNode: Node = {
        ...nodeToDuplicate,
        id: `node-${Date.now()}`,
        position: {
          x: nodeToDuplicate.position.x + 300,
          y: nodeToDuplicate.position.y + 20,
        },
        data: { ...nodeToDuplicate.data },
      };

      return [...nds, newNode];
    });
  }, [setNodes]);

  const handleUpdateNode = useCallback((nodeId: string, updates: any) => {
    setNodes((nds) =>
      nds.map((n) =>
        n.id === nodeId
          ? { ...n, data: { ...n.data, ...updates } }
          : n
      )
    );
  }, [setNodes]);

  const handleReplaceNode = useCallback((placeholderNodeId: string, newNodeType: string) => {
    setNodes((nds) => {
      const placeholderNode = nds.find(n => n.id === placeholderNodeId);
      if (!placeholderNode) return nds;

      // Create the new node data based on type
      const baseData = {
        label: '',
        config: { type: newNodeType },
        description: "",
        questionText: "",
        onUpdateNode: handleUpdateNode,
        onDelete: handleDeleteNode,
        onDuplicate: handleDuplicateNode,
        onReplaceNode: handleReplaceNode,
      };

      // Special data for specific node types
      let nodeData: any = baseData;
      if (newNodeType === "multipleChoice") {
        nodeData = { ...baseData, message: "", options: [{ id: "opt-1", title: "" }] };
      } else if (newNodeType === "send_message") {
        nodeData = { ...baseData, type: "text", text: "", delaySeconds: 3 };
      } else if (newNodeType === "question_simple" || newNodeType === "question_multiple") {
        nodeData = { ...baseData, questionText: "" };
      } else if (newNodeType === "wait") {
        nodeData = { ...baseData, waitConfig: { timeBetweenSeconds: 60 } };
      } else if (newNodeType === "condition") {
        nodeData = { ...baseData, conditions: [] };
      }

      // Replace the placeholder node with the new node
      return nds.map((n) =>
        n.id === placeholderNodeId
          ? {
              ...n,
              type: newNodeType,
              data: nodeData,
            }
          : n
      );
    });
  }, [handleUpdateNode, handleDeleteNode, handleDuplicateNode, setNodes]);

  // Update node data with handlers after initialization
  useEffect(() => {
    setNodes((nds) => nds.map(n => {
      const nodeSpecificErrors = nodeErrors[n.id] ?? [];
      const hasError = nodeSpecificErrors.length > 0;

      return {
        ...n,
        className: hasError ? 'flow-node-error' : undefined,
        data: {
          ...n.data,
          hasError,
          errors: nodeSpecificErrors,
          onDelete: handleDeleteNode,
          onDuplicate: handleDuplicateNode,
          onUpdateNode: handleUpdateNode,
          onReplaceNode: handleReplaceNode,
        onDescriptionChange: (nodeId: string, description: string) => {
          setNodes((nds) =>
            nds.map((node) =>
              node.id === nodeId
                ? { ...node, data: { ...node.data, description } }
                : node
            )
          );
        },
        onWaitConfigChange: (nodeId: string, waitConfig: any) => {
          setNodes((nds) =>
            nds.map((node) =>
              node.id === nodeId
                ? { ...node, data: { ...node.data, waitConfig } }
                : node
            )
          );
        },
        onQuestionChange: (nodeId: string, questionText: string) => {
          setNodes((nds) =>
            nds.map((node) =>
              node.id === nodeId
                ? { ...node, data: { ...node.data, questionText } }
                : node
            )
          );
        },
        onConditionsChange: (nodeId: string, conditions: any) => {
          setNodes((nds) =>
            nds.map((node) =>
              node.id === nodeId
                ? { ...node, data: { ...node.data, conditions } }
                : node
            )
          );
        },
        // Add onChange handler for message nodes
        ...(n.type === 'send_message' && {
          onChange: (partial: any) => {
            setNodes((nds) =>
              nds.map((node) =>
                node.id === n.id
                  ? { ...node, data: { ...node.data, ...partial } }
                  : node
              )
            );
          }
        }),
        // Add onChange handler for rotator nodes
        ...(n.type === 'rotator' && {
          onChange: (partial: any) => {
            setNodes((nds) =>
              nds.map((node) =>
                node.id === n.id
                  ? { ...node, data: { ...node.data, ...partial } }
                  : node
              )
            );
          }
        }),
        // Add onChange handler for assign_conversation nodes
        ...(n.type === 'assign_conversation' && {
          onChange: (partial: any) => {
            setNodes((nds) =>
              nds.map((node) =>
                node.id === n.id
                  ? { ...node, data: { ...node.data, ...partial } }
                  : node
              )
            );
          }
        }),
        // Add onChange handler for wait nodes
        ...(n.type === 'wait' && {
          onChange: (partial: any) => {
            setNodes((nds) =>
              nds.map((node) =>
                node.id === n.id
                  ? { ...node, data: { ...node.data, ...partial } }
                  : node
              )
            );
          }
        })
      }
    };
  }));
  }, [handleDeleteNode, handleDuplicateNode, handleUpdateNode, handleReplaceNode, nodeErrors]);

  const onConnect = useCallback(
    (params: Connection) => {
      setEdges((eds) => addEdge(params, eds));
      setSelectedEdge(null); // Deselect edge when creating new connection
    },
    [setEdges]
  );

  const deleteEdge = useCallback((edgeId: string) => {
    setEdges((eds) => eds.filter((e) => e.id !== edgeId));
    setSelectedEdge(null);
  }, [setEdges]);

  const onEdgeClick = useCallback((_event: React.MouseEvent, edge: Edge) => {
    setSelectedEdge(edge);
    setSelectedNode(null); // Deselect node when selecting edge
  }, []);

  const onReconnect = useCallback(
    (oldEdge: Edge, newConnection: Connection) => {
      setEdges((els) => reconnectEdge(oldEdge, newConnection, els));
    },
    [setEdges]
  );

  // Handle keyboard delete for selected edge
  const handleKeyDown = useCallback((event: KeyboardEvent) => {
    if ((event.key === 'Delete' || event.key === 'Backspace') && selectedEdge) {
      event.preventDefault();
      deleteEdge(selectedEdge.id);
    }
  }, [selectedEdge, deleteEdge]);

  // Add keyboard listener
  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  // Set initial viewport
  useEffect(() => {
    if (nodes.length > 0) {
      fitView({ padding: 0.2, includeHiddenNodes: false });
    } else {
      setViewport({ x: 0, y: 0, zoom: 0.9 });
    }
  }, [nodes.length, fitView, setViewport]);

  const handleDescriptionChange = useCallback((nodeId: string, description: string) => {
    setNodes((nds) =>
      nds.map((n) =>
        n.id === nodeId
          ? { ...n, data: { ...n.data, description } }
          : n
      )
    );
  }, [setNodes]);

  const handleWaitConfigChange = useCallback((nodeId: string, waitConfig: any) => {
    setNodes((nds) =>
      nds.map((n) =>
        n.id === nodeId
          ? { ...n, data: { ...n.data, waitConfig } }
          : n
      )
    );
  }, [setNodes]);

  const handleQuestionChange = useCallback((nodeId: string, questionText: string) => {
    setNodes((nds) =>
      nds.map((n) =>
        n.id === nodeId
          ? { ...n, data: { ...n.data, questionText } }
          : n
      )
    );
  }, [setNodes]);

  const handleConditionsChange = useCallback((nodeId: string, conditions: any) => {
    setNodes((nds) =>
      nds.map((n) =>
        n.id === nodeId
          ? { ...n, data: { ...n.data, conditions } }
          : n
      )
    );
  }, [setNodes]);

  const addNode = (type: string, label: string, position?: { x: number; y: number }) => {
    const baseData = {
      label,
      config: { type },
      description: "",
      questionText: "",
      onUpdateNode: handleUpdateNode,
      onDescriptionChange: handleDescriptionChange,
      onWaitConfigChange: handleWaitConfigChange,
      onQuestionChange: handleQuestionChange,
      onConditionsChange: handleConditionsChange,
      onDelete: handleDeleteNode,
      onDuplicate: handleDuplicateNode,
    };

    // Special data for specific node types
    let nodeData: any = baseData;
    if (type === "multipleChoice") {
      nodeData = { ...baseData, message: "", options: [{ id: "opt-1", title: "" }] };
    } else if (type === "send_message") {
      nodeData = { ...baseData, type: "text", text: "", delaySeconds: 3 };
    } else if (type === "question_simple" || type === "question_multiple") {
      nodeData = { ...baseData, questionText: "" };
    } else if (type === "wait") {
      nodeData = { ...baseData, waitConfig: { timeBetweenSeconds: 60 } };
    } else if (type === "condition") {
      nodeData = { ...baseData, conditions: [] };
    }

    const newNode: Node = {
      id: `node-${Date.now()}`,
      type,
      position: position || { x: 250 + Math.random() * 200, y: 150 + Math.random() * 200 },
      data: nodeData,
    };
    setNodes((nds) => [...nds, newNode]);
  };

  const handleAddNode = useCallback((nodeType: string) => {
    if (!selectedNode) return;

    const newId = `node-${Date.now()}`;
    const position = {
      x: selectedNode.position.x + 300,
      y: selectedNode.position.y,
    };

    const baseData = {
      label: '',
      config: { type: nodeType },
      description: "",
      questionText: "",
      onUpdateNode: handleUpdateNode,
      onDescriptionChange: handleDescriptionChange,
      onWaitConfigChange: handleWaitConfigChange,
      onQuestionChange: handleQuestionChange,
      onConditionsChange: handleConditionsChange,
      onDelete: handleDeleteNode,
      onDuplicate: handleDuplicateNode,
    };

    // Special data for specific node types
    let nodeData: any = baseData;
    if (nodeType === "multipleChoice") {
      nodeData = { ...baseData, message: "", options: [{ id: "opt-1", title: "" }] };
    } else if (nodeType === "send_message") {
      nodeData = { ...baseData, type: "text", text: "", delaySeconds: 3 };
    } else if (nodeType === "question_simple" || nodeType === "question_multiple") {
      nodeData = { ...baseData, questionText: "" };
    } else if (nodeType === "wait") {
      nodeData = { ...baseData, waitConfig: { timeBetweenSeconds: 60 } };
    } else if (nodeType === "condition") {
      nodeData = { ...baseData, conditions: [] };
    }

    setNodes((nds) => nds.concat({
      id: newId,
      type: nodeType,
      position,
      data: nodeData,
    }));

    setEdges((eds) => eds.concat({
      id: `${selectedNode.id}-${newId}`,
      source: selectedNode.id,
      target: newId,
    }));

  }, [selectedNode, handleUpdateNode, handleDescriptionChange, handleWaitConfigChange, handleQuestionChange, handleConditionsChange, handleDeleteNode, handleDuplicateNode, setNodes, setEdges]);

  const onConnectEnd: OnConnectEnd = useCallback(
    (event) => {
      if (!event || !reactFlowWrapper.current || !connectionSource) return;

      const targetElement = event.target as HTMLElement;
      const isOnPane = targetElement.classList.contains('react-flow__pane');

      if (!isOnPane) return;

      const bounds = reactFlowWrapper.current.getBoundingClientRect();
      const position = project({
        x: (event as MouseEvent).clientX - bounds.left,
        y: (event as MouseEvent).clientY - bounds.top,
      });

      // Create a placeholder node at the drop position
      const newPlaceholderId = `placeholder-${Date.now()}`;

      const newPlaceholder: Node = {
        id: newPlaceholderId,
        type: 'placeholder',
        position: { x: position.x - 190, y: position.y - 100 }, // Center the node on cursor
        data: {
          label: '¿Qué desea agregar?',
          onReplaceNode: handleReplaceNode,
          onDelete: handleDeleteNode,
          onDuplicate: handleDuplicateNode,
        },
      };

      // Add the placeholder node
      setNodes((nds) => [...nds, newPlaceholder]);

      // Connect source to placeholder
      setEdges((eds) => [
        ...eds,
        {
          id: `${connectionSource.nodeId}-${newPlaceholderId}`,
          source: connectionSource.nodeId,
          target: newPlaceholderId,
          sourceHandle: connectionSource.handleId,
        },
      ]);

      setConnectionSource(null);
    },
    [project, connectionSource, handleReplaceNode, handleDeleteNode, handleDuplicateNode, setNodes, setEdges]
  );

  const handleAddNodeFromMenu = (type: string, label: string) => {
    const newId = `node-${Date.now()}`;

    const baseData = {
      label,
      config: { type },
      description: "",
      questionText: "",
      onUpdateNode: handleUpdateNode,
      onDescriptionChange: handleDescriptionChange,
      onWaitConfigChange: handleWaitConfigChange,
      onQuestionChange: handleQuestionChange,
      onConditionsChange: handleConditionsChange,
      onDelete: handleDeleteNode,
      onDuplicate: handleDuplicateNode,
    };

    // Special data for specific node types
    let nodeData: any = baseData;
    if (type === "multipleChoice") {
      nodeData = { ...baseData, message: "", options: [{ id: "opt-1", title: "" }] };
    } else if (type === "send_message") {
      nodeData = { ...baseData, type: "text", text: "", delaySeconds: 3 };
    } else if (type === "question_simple" || type === "question_multiple") {
      nodeData = { ...baseData, questionText: "" };
    } else if (type === "wait") {
      nodeData = { ...baseData, waitConfig: { timeBetweenSeconds: 60 } };
    } else if (type === "condition") {
      nodeData = { ...baseData, conditions: [] };
    }

    const newNode: Node = {
      id: newId,
      type,
      position: { x: addMenu.x, y: addMenu.y },
      data: nodeData,
    };

    setNodes((nds) => [...nds, newNode]);

    // Create edge from source node to new node if there's a connection source
    if (addMenu.fromNode) {
      setEdges((eds) => [
        ...eds,
        {
          id: `${addMenu.fromNode}-${newId}`,
          source: addMenu.fromNode!,
          target: newId,
          sourceHandle: addMenu.fromHandle,
        } as Edge,
      ]);
    }

    setAddMenu(initialMenu);
    setConnectionSource(null);
  };

  const updateNodeData = (nodeId: string, updates: any) => {
    setNodes((nds) =>
      nds.map((n) =>
        n.id === nodeId
          ? { ...n, data: { ...n.data, ...updates } }
          : n
      )
    );
    if (selectedNode?.id === nodeId) {
      setSelectedNode((prev) => prev ? { ...prev, data: { ...prev.data, ...updates } } : null);
    }
  };

  const updateNodeConfig = (nodeId: string, configUpdates: any) => {
    setNodes((nds) =>
      nds.map((n) =>
        n.id === nodeId
          ? {
              ...n,
              data: {
                ...n.data,
                config: { ...n.data.config, ...configUpdates }
              }
            }
          : n
      )
    );
    if (selectedNode?.id === nodeId) {
      setSelectedNode((prev) => prev ? {
        ...prev,
        data: {
          ...prev.data,
          config: { ...prev.data.config, ...configUpdates }
        }
      } : null);
    }
  };

  return (
    <div className="flex h-full bg-white">
      {/* Canvas */}
      <div ref={reactFlowWrapper} className="flex-1 relative">
        <ReactFlow
          nodes={nodes}
          edges={edges.map((edge) => ({
            ...edge,
            style: edge.id === selectedEdge?.id
              ? { strokeWidth: 3, stroke: "#FF6B6B" }
              : { strokeWidth: 2, stroke: "#6D5BFA" },
            animated: edge.id === selectedEdge?.id,
          }))}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          onConnectStart={(event, params) => {
            setIsConnecting(true);
            setConnectionSource({
              nodeId: params.nodeId || '',
              handleId: params.handleId,
            });
          }}
          onConnectEnd={(event) => {
            setIsConnecting(false);
            onConnectEnd(event);
          }}
          onReconnect={onReconnect}
          nodeTypes={nodeTypes}
          onNodeClick={(event, node) => {
            // Ignore clicks inside input/textarea/select fields
            const target = event.target as HTMLElement;
            if (target.closest("input, textarea, select, [contenteditable='true']")) {
              return;
            }
            setSelectedNode(node);
            setSelectedEdge(null);
          }}
          onEdgeClick={onEdgeClick}
          onPaneClick={() => {
            setSelectedNode(null);
            setSelectedEdge(null);
            setAddMenu(initialMenu);
          }}
          defaultViewport={{ x: 0, y: 0, zoom: 0.9 }}
          fitView
          defaultEdgeOptions={{
            style: { strokeWidth: 2, stroke: "#6D5BFA" },
            type: "smoothstep",
          }}
        >
          <Background
            color="#e5e7eb"
            gap={24}
            size={1.5}
            variant={BackgroundVariant.Dots}
            className="bg-[#F9FAFB]"
          />
          <Controls
            className="bg-white border border-gray-300 rounded-lg shadow-lg"
            showInteractive={false}
          />
          <MiniMap
            className="bg-white border border-gray-300 rounded-lg shadow-lg"
            nodeStrokeWidth={3}
            maskColor="rgba(0, 0, 0, 0.05)"
          />
        </ReactFlow>

        {/* Context Menu for adding nodes */}
        {addMenu.visible && (
          <div
            className="absolute bg-white shadow-xl rounded-xl p-4 w-72 border border-gray-200"
            style={{
              top: addMenu.y,
              left: addMenu.x,
              transform: "translate(-50%, -50%)",
              zIndex: 999,
            }}
          >
            <h3 className="font-semibold mb-3 text-gray-900">¿Qué deseas agregar?</h3>
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => handleAddNodeFromMenu("send_message", "Enviar mensaje")}
                className="px-3 py-2 text-sm text-left bg-white hover:bg-gray-50 border border-gray-200 rounded-lg transition-colors"
              >
                📨 Mensaje
              </button>
              <button
                onClick={() => handleAddNodeFromMenu("multipleChoice", "Pregunta múltiple")}
                className="px-3 py-2 text-sm text-left bg-white hover:bg-gray-50 border border-gray-200 rounded-lg transition-colors"
              >
                ❓ Múltiple
              </button>
              <button
                onClick={() => handleAddNodeFromMenu("question_simple", "Pregunta simple")}
                className="px-3 py-2 text-sm text-left bg-white hover:bg-gray-50 border border-gray-200 rounded-lg transition-colors"
              >
                💬 Simple
              </button>
              <button
                onClick={() => handleAddNodeFromMenu("wait", "Esperar")}
                className="px-3 py-2 text-sm text-left bg-white hover:bg-gray-50 border border-gray-200 rounded-lg transition-colors"
              >
                ⏱️ Esperar
              </button>
              <button
                onClick={() => handleAddNodeFromMenu("condition", "Condición")}
                className="px-3 py-2 text-sm text-left bg-white hover:bg-gray-50 border border-gray-200 rounded-lg transition-colors"
              >
                🔀 Condición
              </button>
              <button
                onClick={() => setAddMenu(initialMenu)}
                className="px-3 py-2 text-sm text-center bg-gray-100 hover:bg-gray-200 border border-gray-300 rounded-lg transition-colors col-span-2"
              >
                Cancelar
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Right Sidebar - Configuration Panel (edges only) */}
      {selectedEdge && (
        <div className="w-[380px] bg-[#F9FAFB] border-l border-gray-200 overflow-y-auto">
          <div className="p-6">
            {/* Edge Configuration Panel */}
            <div className="flex justify-between items-center mb-4">
              <h4 className="font-semibold text-gray-900">Conexión seleccionada</h4>
              <button
                onClick={() => deleteEdge(selectedEdge.id)}
                className="text-red-500 hover:text-red-700 text-sm font-medium transition-colors flex items-center gap-1"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
                Eliminar
              </button>
            </div>
            <div className="text-sm text-gray-600 space-y-2">
              <div className="flex items-center gap-2">
                <span className="font-medium">Desde:</span>
                <span className="px-2 py-1 bg-white rounded border border-gray-200">
                  {nodes.find(n => n.id === selectedEdge.source)?.data.label || 'Nodo'}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="font-medium">Hacia:</span>
                <span className="px-2 py-1 bg-white rounded border border-gray-200">
                  {nodes.find(n => n.id === selectedEdge.target)?.data.label || 'Nodo'}
                </span>
              </div>
            </div>
            <p className="text-xs text-gray-500 mt-4">
              Arrastra los extremos de la conexión para reconectar, o presiona Delete/Backspace para eliminar.
            </p>
          </div>
        </div>
      )}
    </div>
  );
});

export default FlowBuilder;
