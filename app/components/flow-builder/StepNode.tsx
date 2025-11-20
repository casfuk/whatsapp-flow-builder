import { memo } from "react";
import { Handle, Position, NodeProps } from "reactflow";

export const StepNode = memo(({ data }: NodeProps) => {
  const getNodeColor = (type: string) => {
    const colors: Record<string, string> = {
      start: "bg-green-100 border-green-500",
      send_message: "bg-blue-100 border-blue-500",
      question_simple: "bg-purple-100 border-purple-500",
      question_multiple: "bg-purple-100 border-purple-500",
      condition: "bg-yellow-100 border-yellow-500",
      wait: "bg-gray-100 border-gray-500",
      template: "bg-pink-100 border-pink-500",
      assign_conversation: "bg-indigo-100 border-indigo-500",
      rotator: "bg-orange-100 border-orange-500",
      start_automation: "bg-teal-100 border-teal-500",
      assign_ai_agent: "bg-cyan-100 border-cyan-500",
    };
    return colors[type] || "bg-gray-100 border-gray-500";
  };

  return (
    <div
      className={`px-4 py-2 shadow-md rounded-md border-2 ${getNodeColor(
        data.config.type
      )}`}
    >
      <Handle type="target" position={Position.Top} />
      <div className="text-sm font-semibold">{data.label}</div>
      <div className="text-xs text-gray-600 mt-1">{data.config.type}</div>
      <Handle type="source" position={Position.Bottom} />
    </div>
  );
});

StepNode.displayName = "StepNode";
