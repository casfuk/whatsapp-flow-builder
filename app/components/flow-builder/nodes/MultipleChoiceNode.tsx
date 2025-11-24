import { useState, useEffect } from "react";
import { Handle, Position, NodeProps } from "reactflow";
import { NodeWrapper } from "../NodeWrapper";

type MCOption = { id: string; title: string };

type MultipleChoiceNodeData = {
  message?: string;
  options?: MCOption[];
  validateWithAI?: boolean;
  onChange?: (data: Partial<MultipleChoiceNodeData>) => void;
  onDuplicate?: (nodeId: string) => void;
  onDelete?: (nodeId: string) => void;
};

export function MultipleChoiceNode({ id, data }: NodeProps<MultipleChoiceNodeData>) {
  const [message, setMessage] = useState(data.message ?? "");
  const [options, setOptions] = useState<MCOption[]>(
    data.options?.length ? data.options : [{ id: "option-1", title: "" }]
  );
  const [validateWithAI, setValidateWithAI] = useState(
    data.validateWithAI ?? false
  );

  // Notificar cambios al parent (para guardar en el flow)
  useEffect(() => {
    data.onChange?.({ message, options, validateWithAI });
  }, [message, options, validateWithAI]);

  const handleOptionChange = (id: string, value: string) => {
    setOptions((prev) =>
      prev.map((opt) => (opt.id === id ? { ...opt, title: value } : opt))
    );
  };

  const addOption = () => {
    // Generate stable sequential ID by finding the highest existing number
    const maxNum = options.reduce((max, opt) => {
      const match = opt.id.match(/option-(\d+)/);
      return match ? Math.max(max, parseInt(match[1], 10)) : max;
    }, 0);
    const newId = `option-${maxNum + 1}`;
    setOptions((prev) => [
      ...prev,
      { id: newId, title: "" },
    ]);
  };

  const removeOption = (id: string) => {
    setOptions((prev) => prev.filter((opt) => opt.id !== id));
  };

  return (
    <NodeWrapper nodeId={id} onDuplicate={data.onDuplicate} onDelete={data.onDelete}>
      <Handle type="target" position={Position.Left} className="node-handle" />
      <div className="bg-white rounded-xl shadow-md p-3 border border-[#d5d9e2]
                      w-[260px] min-h-[120px]
                      flex flex-col gap-2">
        <div className="flex items-center gap-2">
          <div className="flex h-6 w-6 items-center justify-center rounded-full border border-[#c7d0e5] text-sm flex-shrink-0">
            ?
          </div>
          <p className="text-sm font-semibold text-[#13161f] break-words">
            Pregunta múltiple
          </p>
        </div>

        {/* Caja de mensaje */}
        <div className="rounded-xl bg-[#f5f7fb] p-3">
          <textarea
            className="w-full text-sm rounded-md border-0 p-0 resize-none break-words bg-transparent text-[#13161f] outline-none"
            placeholder="Escribe un mensaje..."
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            onClick={(e) => e.stopPropagation()}
            onMouseDown={(e) => e.stopPropagation()}
            onDoubleClick={(e) => e.stopPropagation()}
            rows={3}
          />
          {/* Toolbar simple – solo visual por ahora */}
          <div className="mt-2 flex items-center gap-3 text-xs text-[#9aa1b4]">
            <button type="button">😊</button>
            <button type="button" className="font-bold">B</button>
            <button type="button" className="italic">I</button>
            <button type="button" className="line-through">S</button>
            <button type="button">{`{}`}</button>
          </div>
        </div>

        {/* Validar con IA */}
        <div className="flex items-center gap-2 text-xs text-[#4b4f5c]">
          <input
            type="checkbox"
            className="h-4 w-4 flex-shrink-0"
            checked={validateWithAI}
            onChange={(e) => setValidateWithAI(e.target.checked)}
          />
          <span className="break-words">
            <span className="font-semibold">IA✦</span> Validar con IA
          </span>
          <span className="ml-auto text-[#c0c4d4]">🔒</span>
        </div>

        {/* Scrollable options list + add button */}
        <div className="flex flex-col gap-2 max-h-[260px] overflow-y-auto pr-1">
          {options.map((opt) => (
            <div key={opt.id} className="relative flex items-center gap-2">
              <input
                className="flex-1 rounded-xl border border-[#d5d9e2] bg-white px-3 py-2 text-sm text-[#13161f] outline-none break-words min-w-0"
                placeholder="Ingresa el título del botón"
                value={opt.title}
                onChange={(e) => handleOptionChange(opt.id, e.target.value)}
                onClick={(e) => e.stopPropagation()}
                onMouseDown={(e) => e.stopPropagation()}
                onDoubleClick={(e) => e.stopPropagation()}
              />
              <button
                type="button"
                className="text-xs text-[#c0392b] flex-shrink-0"
                onClick={() => removeOption(opt.id)}
              >
                🗑
              </button>
              {/* Per-option connector */}
              <Handle
                type="source"
                position={Position.Right}
                id={opt.id}
                className="node-handle"
                style={{
                  top: '50%',
                  transform: 'translateY(-50%)',
                  right: '-8px',
                }}
              />
            </div>
          ))}

          <button
            type="button"
            className="w-full rounded-full bg-[#5ac230] py-2 text-sm font-semibold text-white"
            onClick={addOption}
          >
            Agregar nueva opción
          </button>
        </div>
      </div>
    </NodeWrapper>
  );
}
