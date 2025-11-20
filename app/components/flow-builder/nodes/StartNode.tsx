"use client";

import { useState, useEffect } from "react";
import { Handle, Position, NodeProps } from "reactflow";
import { TriggerConfig, getTriggerTypeLabel } from "@/lib/types/trigger";
import { TriggerModal } from "@/app/components/flow-builder/TriggerModal";

export function StartNode({ data, selected, id }: NodeProps) {
  const [showTriggerModal, setShowTriggerModal] = useState(false);
  const [trigger, setTrigger] = useState<TriggerConfig | null>(data.trigger || null);

  // Sync trigger state with data.trigger prop
  useEffect(() => {
    if (data.trigger) {
      setTrigger(data.trigger);
    }
  }, [data.trigger]);

  const handleSaveTrigger = (newTrigger: TriggerConfig) => {
    setTrigger(newTrigger);
    // Update parent node data
    if (data.onUpdateNode) {
      data.onUpdateNode(id, { trigger: newTrigger });
    }
    setShowTriggerModal(false);
  };

  const getTriggerDisplay = () => {
    if (!trigger || trigger.type === 'none') {
      return <p className="text-sm text-white/70">Sin disparador asignado</p>;
    }

    const typeLabel = getTriggerTypeLabel(trigger.type);

    if (trigger.type === 'message_received' || trigger.type === 'third_party') {
      return (
        <div className="space-y-1">
          <p className="text-sm text-white/90 font-medium">{typeLabel}</p>
          {(trigger as any).phoneKeyword && (
            <p className="text-sm text-white/80">
              Se activa cuando el mensaje contiene la palabra "<span className="font-semibold">{(trigger as any).phoneKeyword}</span>"
            </p>
          )}
          {(trigger as any).channelId && (
            <p className="text-sm text-white/80">
              Dispositivo: {(trigger as any).channelId}
            </p>
          )}
        </div>
      );
    }

    if (trigger.type === 'tag_added') {
      return (
        <div className="space-y-1">
          <p className="text-sm text-white/90 font-medium">{typeLabel}</p>
          {(trigger as any).phoneKeyword && (
            <p className="text-sm text-white/80">Tag: {(trigger as any).phoneKeyword}</p>
          )}
        </div>
      );
    }

    return <p className="text-sm text-white/70">{typeLabel}</p>;
  };

  return (
    <>
      <div
        className={`bg-[#5C4CFF] text-white rounded-3xl shadow-lg w-[360px] ${
          selected ? "ring-2 ring-offset-2 ring-[#5C4CFF]" : ""
        }`}
      >
        <div className="px-6 py-5">
          {/* Top row: play icon (left) + "Próximo paso" (right) */}
          <div className="flex items-center justify-between mb-3">
            <div className="flex-shrink-0 w-8 h-8 rounded-full bg-white/20 flex items-center justify-center">
              <svg className="w-4 h-4 text-white ml-0.5" fill="currentColor" viewBox="0 0 16 16">
                <path d="M3 2l10 6-10 6V2z" />
              </svg>
            </div>
            <div className="text-xs text-white/70">Próximo paso</div>
          </div>

          {/* Title */}
          <h3 className="text-xl font-bold mb-2">Crea una automatización</h3>

          {/* Description */}
          <p className="text-sm text-white/80 mb-4">
            Este es el inicio del flujo, puedes comenzar a través de tus campañas o automatizaciones.
          </p>

          {/* Error indicator */}
          {data.hasError && data.errors && data.errors.length > 0 && (
            <div className="mb-3 p-2 rounded-lg bg-red-500/20 border border-red-300/30">
              <div className="flex items-center gap-2 text-xs text-white">
                <span>⚠</span>
                <span className="font-medium">Error en este paso:</span>
              </div>
              {data.errors.map((err: any, i: number) => (
                <p key={i} className="text-xs text-white/90 mt-1 ml-5">
                  {err.message}
                </p>
              ))}
            </div>
          )}

          {/* Divider */}
          <div className="border-t border-white/20 my-4"></div>

          {/* Trigger status */}
          <div className="mb-3">
            {getTriggerDisplay()}
          </div>

          {/* Button */}
          <button
            onClick={() => setShowTriggerModal(true)}
            className="w-full rounded-lg bg-white text-sm font-medium text-[#5C4CFF] py-2.5 text-center hover:bg-white/90 transition-colors"
          >
            {trigger && trigger.type !== 'none' ? 'Editar disparador' : '+ Nuevo disparador'}
          </button>
        </div>

        {/* Connection dot */}
        <Handle
          type="source"
          position={Position.Right}
          className="w-3 h-3 bg-white border-2 border-white"
        />
      </div>

      {showTriggerModal && (
        <TriggerModal
          trigger={trigger}
          onSave={handleSaveTrigger}
          onClose={() => setShowTriggerModal(false)}
        />
      )}
    </>
  );
}
