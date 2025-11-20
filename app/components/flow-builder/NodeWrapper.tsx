import { Copy, Trash, Move } from "lucide-react";
import { ReactNode } from "react";

interface NodeWrapperProps {
  children: ReactNode;
  nodeId: string;
  onDuplicate?: (nodeId: string) => void;
  onDelete?: (nodeId: string) => void;
}

export function NodeWrapper({ children, nodeId, onDuplicate, onDelete }: NodeWrapperProps) {
  return (
    <div className="relative group">
      <div className="absolute top-1.5 right-2 hidden group-hover:flex gap-1 z-10">
        {onDuplicate && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onDuplicate(nodeId);
            }}
            title="Duplicar"
            className="bg-[#f3f0ff] hover:bg-[#e5dbff] text-[#5f3dc4] border-0 text-xs rounded-md px-2 py-1 cursor-pointer transition-colors"
          >
            <Copy size={14} />
          </button>
        )}
        <button
          onClick={(e) => {
            e.stopPropagation();
          }}
          title="Mover"
          className="bg-[#f3f0ff] hover:bg-[#e5dbff] text-[#5f3dc4] border-0 text-xs rounded-md px-2 py-1 cursor-move transition-colors"
        >
          <Move size={14} />
        </button>
        {onDelete && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onDelete(nodeId);
            }}
            title="Eliminar"
            className="bg-[#f3f0ff] hover:bg-[#e5dbff] text-[#5f3dc4] border-0 text-xs rounded-md px-2 py-1 cursor-pointer transition-colors"
          >
            <Trash size={14} />
          </button>
        )}
      </div>
      {children}
    </div>
  );
}
