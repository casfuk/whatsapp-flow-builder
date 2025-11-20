import { Handle, Position, NodeProps } from "reactflow";
import { useState, useRef, useEffect } from "react";

export function DefaultNode({ data, selected, id }: NodeProps) {
  const description = data.description || "";
  const [isEditingDesc, setIsEditingDesc] = useState(false);
  const [descValue, setDescValue] = useState(description);
  const descRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setDescValue(description);
  }, [description]);

  useEffect(() => {
    if (isEditingDesc && descRef.current) {
      descRef.current.focus();
    }
  }, [isEditingDesc]);

  const handleDescriptionBlur = () => {
    setIsEditingDesc(false);
    if (data.onDescriptionChange) {
      data.onDescriptionChange(id, descValue);
    }
  };

  return (
    <div
      className={`bg-white rounded-xl shadow-md p-3 border
                 w-[260px] min-h-[120px] max-h-[300px]
                 flex flex-col gap-2 overflow-hidden transition-all ${
        selected ? "border-[#6D5BFA] border-2 shadow-md" : "border-gray-200"
      }`}
    >
      <p className="text-sm font-medium break-words text-gray-900">{data.label}</p>

      <div className="flex-1 overflow-y-auto overflow-x-hidden break-words">
        <div className="text-gray-500 text-xs mb-2 break-words">
          {data.config?.type || "Acción"}
        </div>
        <div className="nodrag">
          {isEditingDesc ? (
            <input
              ref={descRef}
              type="text"
              value={descValue}
              onChange={(e) => setDescValue(e.target.value)}
              onBlur={handleDescriptionBlur}
              onKeyDown={(e) => e.key === "Enter" && handleDescriptionBlur()}
              className="w-full text-xs px-2 py-1 border border-gray-300 rounded bg-white break-words"
              style={{ color: "#000" }}
              placeholder="Descripción del nodo..."
            />
          ) : (
            <div
              onClick={() => setIsEditingDesc(true)}
              className="w-full text-xs px-2 py-1 border border-gray-200 rounded cursor-text hover:border-gray-400 min-h-[24px] break-words"
              style={{ color: "#000" }}
            >
              {descValue || "Haz clic para agregar descripción..."}
            </div>
          )}
        </div>
      </div>

      <Handle
        type="target"
        position={Position.Left}
        className="w-3 h-3 border-2 border-gray-300 bg-white"
      />
      <Handle
        type="source"
        position={Position.Right}
        className="w-3 h-3 border-2 border-gray-300 bg-white"
      />
    </div>
  );
}
