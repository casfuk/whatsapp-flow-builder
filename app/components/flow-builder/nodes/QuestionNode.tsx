import { Handle, Position, NodeProps } from "reactflow";
import { useState, useEffect } from "react";
import { NodeWrapper } from "../NodeWrapper";

interface CustomField {
  id: string;
  name: string;
  key: string;
  type: string;
}

export function QuestionNode({ data, selected, id }: NodeProps) {
  const isMultiple = data.config?.type === "question_multiple";
  const [questionValue, setQuestionValue] = useState(data.questionText || "");
  const [saveToFieldId, setSaveToFieldId] = useState(data.saveToFieldId || "");
  const [customFields, setCustomFields] = useState<CustomField[]>([]);

  // Fetch custom fields on mount
  useEffect(() => {
    const fetchCustomFields = async () => {
      try {
        const response = await fetch("/api/custom-fields");
        if (response.ok) {
          const fields = await response.json();
          setCustomFields(fields);
        }
      } catch (error) {
        console.error("Failed to fetch custom fields:", error);
      }
    };

    fetchCustomFields();
  }, []);

  useEffect(() => {
    setQuestionValue(data.questionText || "");
  }, [data.questionText]);

  useEffect(() => {
    setSaveToFieldId(data.saveToFieldId || "");
  }, [data.saveToFieldId]);

  const handleQuestionChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newValue = e.target.value;
    setQuestionValue(newValue);
    if (data.onUpdateNode) {
      data.onUpdateNode(id, { questionText: newValue });
    }
  };

  const handleFieldChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newValue = e.target.value;
    setSaveToFieldId(newValue);
    if (data.onUpdateNode) {
      data.onUpdateNode(id, { saveToFieldId: newValue || undefined });
    }
  };

  return (
    <NodeWrapper nodeId={id} onDuplicate={data.onDuplicate} onDelete={data.onDelete}>
      <Handle
        type="target"
        position={Position.Left}
        className="w-3 h-3 border-2 border-gray-300 bg-white"
      />

      <div
        className={`rounded-xl border bg-white shadow-sm w-[360px] transition-all ${
          selected ? "border-[#6D5BFA] border-2 shadow-md" : "border-[#E2E4F0]"
        }`}
      >
        {/* Header */}
        <div className="flex items-center gap-2 px-4 pt-3 pb-2">
          <div className="flex h-6 w-6 items-center justify-center rounded-full border border-[#C2C4F5] text-[#5B5FEF] text-sm font-semibold">
            ?
          </div>
          <span className="text-sm font-semibold text-[#2C2F4A]">
            {isMultiple ? "Pregunta múltiple" : "Pregunta"}
          </span>
        </div>

        {/* Body */}
        <div className="px-4 pb-4 pt-1 flex flex-col gap-3">
          {/* Textarea */}
          <div className="rounded-lg bg-[#F7F8FC] border border-[#E2E4F0] px-3 py-2">
            <textarea
              className="w-full resize-none bg-transparent text-sm text-[#373955] placeholder:text-[#B0B3C6] outline-none"
              rows={3}
              placeholder="Escribe un mensaje..."
              value={questionValue}
              onChange={handleQuestionChange}
              onClick={(e) => e.stopPropagation()}
              onMouseDown={(e) => e.stopPropagation()}
              onDoubleClick={(e) => e.stopPropagation()}
            />
            {/* Toolbar */}
            <div className="mt-1 flex items-center gap-3 text-xs text-[#8C8FAB]">
              <span>😊</span>
              <span className="font-bold">B</span>
              <span className="italic">I</span>
              <span className="line-through">S</span>
              <span>{"{}"}</span>
            </div>
          </div>

          {/* Guardar respuesta en */}
          <div className="flex flex-col gap-1">
            <span className="text-xs text-[#656889]">Guardar respuesta en</span>
            <select
              className="w-full rounded-md border border-[#D2D4E4] bg-white px-2 py-1.5 text-xs text-[#373955] outline-none focus:border-[#5B5FEF] focus:ring-1 focus:ring-[#5B5FEF]"
              value={saveToFieldId}
              onChange={handleFieldChange}
              onClick={(e) => e.stopPropagation()}
              onMouseDown={(e) => e.stopPropagation()}
            >
              <option value="">Seleccionar campo</option>
              {customFields.map((field) => (
                <option key={field.id} value={field.id}>
                  {field.name}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      <Handle
        type="source"
        position={Position.Right}
        className="w-3 h-3 border-2 border-gray-300 bg-white"
      />
    </NodeWrapper>
  );
}
