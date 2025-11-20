"use client";

import { Handle, Position, NodeProps } from "reactflow";
import { NodeWrapper } from "../NodeWrapper";

export function PlaceholderNode({ data, id }: NodeProps) {
  const handleAddNode = (nodeType: string) => {
    if (data.onReplaceNode) {
      data.onReplaceNode(id, nodeType);
    }
  };

  return (
    <NodeWrapper nodeId={id} onDuplicate={data.onDuplicate} onDelete={data.onDelete}>
      <Handle type="target" position={Position.Left} className="w-3 h-3 border-2 border-gray-300 bg-white" />

      <div className="bg-white rounded-[20px] shadow-xl w-[380px] max-h-[85vh] overflow-hidden border border-gray-200">
        {/* Content */}
        <div className="p-6 overflow-y-auto max-h-[85vh]">
          <h2 className="text-lg font-semibold text-gray-900 mb-5">¿Qué desea agregar?</h2>

          {/* Texto */}
          <div className="mb-5">
            <p className="text-xs font-semibold text-[#6B7280] uppercase tracking-wide mb-3">Texto</p>
            <button
              onClick={() => handleAddNode("send_message")}
              className="w-full h-12 px-4 bg-[#F5F7FA] hover:bg-[#E5E7EB] text-[#1C1C1C] rounded-xl font-medium text-sm transition-colors flex items-center gap-3"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
              </svg>
              Enviar mensaje
            </button>
          </div>

          {/* Preguntas */}
          <div className="mb-5">
            <p className="text-xs font-semibold text-[#6B7280] uppercase tracking-wide mb-3">Preguntas</p>
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => handleAddNode("multipleChoice")}
                className="h-12 px-3 bg-[#F5F7FA] hover:bg-[#E5E7EB] text-[#1C1C1C] rounded-xl font-medium text-sm transition-colors flex items-center justify-center gap-2"
              >
                <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
                </svg>
                <span className="truncate">Múltiple</span>
              </button>
              <button
                onClick={() => handleAddNode("question_simple")}
                className="h-12 px-3 bg-[#F5F7FA] hover:bg-[#E5E7EB] text-[#1C1C1C] rounded-xl font-medium text-sm transition-colors flex items-center justify-center gap-2"
              >
                <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span className="truncate">Simple</span>
              </button>
            </div>
          </div>

          {/* Acciones */}
          <div className="mb-5">
            <p className="text-xs font-semibold text-[#6B7280] uppercase tracking-wide mb-3">Acciones</p>
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => handleAddNode("wait")}
                className="h-12 px-3 bg-[#F5F7FA] hover:bg-[#E5E7EB] text-[#1C1C1C] rounded-xl font-medium text-sm transition-colors flex items-center justify-center gap-2"
              >
                <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span className="truncate">Esperar</span>
              </button>
              <button
                onClick={() => handleAddNode("assign_conversation")}
                className="h-12 px-2 bg-[#F5F7FA] hover:bg-[#E5E7EB] text-[#1C1C1C] rounded-xl font-medium text-xs transition-colors flex items-center justify-center gap-1.5"
              >
                <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
                <span className="truncate">Asignar conv.</span>
              </button>
              <button
                onClick={() => handleAddNode("condition")}
                className="h-12 px-3 bg-[#F5F7FA] hover:bg-[#E5E7EB] text-[#1C1C1C] rounded-xl font-medium text-sm transition-colors flex items-center justify-center gap-2"
              >
                <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16l2.879-2.879m0 0a3 3 0 104.243-4.242 3 3 0 00-4.243 4.242zM21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span className="truncate">Condición</span>
              </button>
              <button
                onClick={() => handleAddNode("start_automation")}
                className="h-12 px-2 bg-[#F5F7FA] hover:bg-[#E5E7EB] text-[#1C1C1C] rounded-xl font-medium text-xs transition-colors flex items-center justify-center gap-1.5"
              >
                <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span className="truncate">Iniciar autom.</span>
              </button>
              <button
                onClick={() => handleAddNode("rotator")}
                className="h-12 px-3 bg-[#F5F7FA] hover:bg-[#E5E7EB] text-[#1C1C1C] rounded-xl font-medium text-sm transition-colors flex items-center justify-center gap-2"
              >
                <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                <span className="truncate">Rotador</span>
              </button>
              <button
                onClick={() => handleAddNode("template")}
                className="h-12 px-3 bg-[#F5F7FA] hover:bg-[#E5E7EB] text-[#1C1C1C] rounded-xl font-medium text-sm transition-colors flex items-center justify-center gap-2"
              >
                <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                </svg>
                <span className="truncate">Templates</span>
              </button>
            </div>
          </div>

          {/* Asignar Agente IA - disabled */}
          <div>
            <button
              disabled
              className="w-full h-12 px-4 bg-gray-100 text-gray-400 rounded-xl font-medium text-sm cursor-not-allowed flex items-center gap-3 opacity-60"
            >
              <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
              Asignar Agente IA
            </button>
          </div>
        </div>
      </div>

      <Handle type="source" position={Position.Right} className="w-3 h-3 border-2 border-gray-300 bg-white" />
    </NodeWrapper>
  );
}
