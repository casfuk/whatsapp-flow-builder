"use client";

import { Handle, Position, NodeProps } from "reactflow";
import { useState, useRef, useEffect } from "react";
import { toast } from "sonner";
import { NodeWrapper } from "../NodeWrapper";

// ============ TYPE DEFINITIONS ============

type MessageType = "text" | "media" | "audio" | "document" | "contact";

type BaseMessageData = {
  type: MessageType;
  delaySeconds: number;
};

type TextMessageData = BaseMessageData & {
  type: "text";
  text: string;
};

type MediaMessageData = BaseMessageData & {
  type: "media";
  fileUrl?: string;
  caption?: string;
  mediaUrl?: string;
  mediaType?: string;
  fileName?: string;
};

type AudioMessageData = BaseMessageData & {
  type: "audio";
  fileUrl?: string;
  mediaUrl?: string;
  mediaType?: string;
  fileName?: string;
};

type DocumentMessageData = BaseMessageData & {
  type: "document";
  fileUrl?: string;
  mediaUrl?: string;
  mediaType?: string;
  fileName?: string;
};

type ContactMessageData = BaseMessageData & {
  type: "contact";
  phone: string;
  countryCode: string;
  name: string;
  useConnectedNumber: boolean;
};

export type MessageNodeData =
  | TextMessageData
  | MediaMessageData
  | AudioMessageData
  | DocumentMessageData
  | ContactMessageData;

type MessageNodeProps = {
  onChange?: (data: Partial<MessageNodeData>) => void;
  onDuplicate?: (nodeId: string) => void;
  onDelete?: (nodeId: string) => void;
} & Partial<MessageNodeData>;

// ============ TEXT EDITOR TOOLBAR COMPONENT ============

type CustomField = {
  id: string;
  name: string;
  key: string;
};

function TextEditorToolbar({
  textareaRef,
  value,
  onChange,
}: {
  textareaRef: React.RefObject<HTMLTextAreaElement | null>;
  value: string;
  onChange: (newValue: string) => void;
}) {
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [showFieldPicker, setShowFieldPicker] = useState(false);
  const [customFields, setCustomFields] = useState<CustomField[]>([]);

  // Common emojis for quick access
  const commonEmojis = [
    "😊", "😂", "❤️", "👍", "🙏", "😍", "🎉", "🔥", "✨", "💪",
    "👏", "🎊", "💯", "🚀", "⭐", "💼", "📱", "✅", "❌", "⚡",
  ];

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

  // Insert text at cursor position
  const insertAtCursor = (textToInsert: string) => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const before = value.substring(0, start);
    const after = value.substring(end);
    const newValue = before + textToInsert + after;

    onChange(newValue);

    // Set cursor position after inserted text
    setTimeout(() => {
      textarea.focus();
      const newCursorPos = start + textToInsert.length;
      textarea.setSelectionRange(newCursorPos, newCursorPos);
    }, 0);
  };

  // Apply formatting (bold, italic, strikethrough)
  const applyFormatting = (type: "bold" | "italic" | "strike") => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selectedText = value.substring(start, end);

    let marker = "";
    if (type === "bold") marker = "*";
    else if (type === "italic") marker = "_";
    else if (type === "strike") marker = "~";

    if (selectedText) {
      // Wrap selected text
      const wrappedText = `${marker}${selectedText}${marker}`;
      const before = value.substring(0, start);
      const after = value.substring(end);
      const newValue = before + wrappedText + after;

      onChange(newValue);

      // Set selection to the wrapped text
      setTimeout(() => {
        textarea.focus();
        textarea.setSelectionRange(start + marker.length, end + marker.length);
      }, 0);
    } else {
      // No selection - insert markers and place cursor between them
      const toInsert = `${marker}${marker}`;
      insertAtCursor(toInsert);

      // Move cursor between markers
      setTimeout(() => {
        textarea.focus();
        const newPos = start + marker.length;
        textarea.setSelectionRange(newPos, newPos);
      }, 0);
    }
  };

  // Insert field placeholder
  const insertField = (fieldKey: string) => {
    insertAtCursor(`{{${fieldKey}}}`);
    setShowFieldPicker(false);
  };

  return (
    <div className="nodrag relative">
      <div className="nodrag flex items-center gap-3">
        {/* Emoji button */}
        <div className="nodrag relative">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setShowEmojiPicker(!showEmojiPicker);
              setShowFieldPicker(false);
            }}
            onMouseDown={(e) => e.stopPropagation()}
            className="nodrag text-base hover:opacity-70 transition-opacity text-gray-700"
            title="Insertar emoji"
          >
            😊
          </button>

          {/* Emoji picker popover */}
          {showEmojiPicker && (
            <div
              className="nodrag absolute z-50 top-8 left-0 bg-white border border-gray-200 rounded-lg shadow-lg p-3 w-64"
              onClick={(e) => e.stopPropagation()}
              onMouseDown={(e) => e.stopPropagation()}
            >
              <div className="nodrag flex flex-wrap gap-2">
                {commonEmojis.map((emoji) => (
                  <button
                    key={emoji}
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      insertAtCursor(emoji);
                      setShowEmojiPicker(false);
                    }}
                    onMouseDown={(e) => e.stopPropagation()}
                    className="nodrag text-xl hover:bg-gray-100 rounded p-1 transition-colors"
                  >
                    {emoji}
                  </button>
                ))}
              </div>
              <div className="nodrag mt-2 pt-2 border-t border-gray-200">
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowEmojiPicker(false);
                  }}
                  onMouseDown={(e) => e.stopPropagation()}
                  className="nodrag text-xs text-gray-500 hover:text-gray-700"
                >
                  Cerrar
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Bold button */}
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            applyFormatting("bold");
          }}
          onMouseDown={(e) => e.stopPropagation()}
          className="nodrag font-bold text-sm text-gray-700 hover:opacity-70 transition-opacity"
          title="Negrita (*texto*)"
        >
          B
        </button>

        {/* Italic button */}
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            applyFormatting("italic");
          }}
          onMouseDown={(e) => e.stopPropagation()}
          className="nodrag italic text-sm text-gray-700 hover:opacity-70 transition-opacity"
          title="Cursiva (_texto_)"
        >
          I
        </button>

        {/* Strikethrough button */}
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            applyFormatting("strike");
          }}
          onMouseDown={(e) => e.stopPropagation()}
          className="nodrag line-through text-sm text-gray-700 hover:opacity-70 transition-opacity"
          title="Tachado (~texto~)"
        >
          S
        </button>

        {/* Field placeholder button */}
        <div className="nodrag relative">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setShowFieldPicker(!showFieldPicker);
              setShowEmojiPicker(false);
            }}
            onMouseDown={(e) => e.stopPropagation()}
            className="nodrag text-sm text-gray-700 hover:opacity-70 transition-opacity font-mono"
            title="Insertar campo de contacto"
          >
            {"{}"}
          </button>

          {/* Field picker popover */}
          {showFieldPicker && (
            <div
              className="nodrag absolute z-50 top-8 left-0 bg-white border border-gray-200 rounded-lg shadow-lg w-64 max-h-80 overflow-y-auto"
              onClick={(e) => e.stopPropagation()}
              onMouseDown={(e) => e.stopPropagation()}
            >
              {/* Standard fields */}
              <div className="nodrag p-2 border-b border-gray-100">
                <div className="nodrag text-xs font-semibold text-gray-500 uppercase px-2 py-1">
                  Campos estándar
                </div>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    insertField("name");
                  }}
                  onMouseDown={(e) => e.stopPropagation()}
                  className="nodrag w-full text-left px-3 py-2 hover:bg-gray-50 rounded text-sm text-gray-700 transition-colors"
                >
                  Nombre
                </button>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    insertField("phone");
                  }}
                  onMouseDown={(e) => e.stopPropagation()}
                  className="nodrag w-full text-left px-3 py-2 hover:bg-gray-50 rounded text-sm text-gray-700 transition-colors"
                >
                  Teléfono
                </button>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    insertField("email");
                  }}
                  onMouseDown={(e) => e.stopPropagation()}
                  className="nodrag w-full text-left px-3 py-2 hover:bg-gray-50 rounded text-sm text-gray-700 transition-colors"
                >
                  Email
                </button>
              </div>

              {/* Custom fields */}
              {customFields.length > 0 && (
                <div className="nodrag p-2">
                  <div className="nodrag text-xs font-semibold text-gray-500 uppercase px-2 py-1">
                    Campos personalizados
                  </div>
                  {customFields.map((field) => (
                    <button
                      key={field.id}
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        insertField(field.key);
                      }}
                      onMouseDown={(e) => e.stopPropagation()}
                      className="nodrag w-full text-left px-3 py-2 hover:bg-gray-50 rounded text-sm text-gray-700 transition-colors"
                    >
                      {field.name}
                    </button>
                  ))}
                </div>
              )}

              <div className="nodrag p-2 border-t border-gray-100">
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowFieldPicker(false);
                  }}
                  onMouseDown={(e) => e.stopPropagation()}
                  className="nodrag text-xs text-gray-500 hover:text-gray-700 px-2"
                >
                  Cerrar
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ============ DELAY CONTROL COMPONENT ============

function DelayControl({
  value,
  onChange,
  min,
  max,
}: {
  value: number;
  onChange: (val: number) => void;
  min: number;
  max: number;
}) {
  return (
    <div className="mt-3 flex flex-col gap-1">
      <div className="flex items-center gap-2 text-xs text-[#2C2F4A]">
        <span className="font-medium">Tiempo entre mensaje</span>
        <input
          type="number"
          min={min}
          max={max}
          value={value ?? ""}
          onChange={(e) => onChange(Number(e.target.value) || 0)}
          onClick={(e) => e.stopPropagation()}
          onMouseDown={(e) => e.stopPropagation()}
          className="w-16 rounded-md border border-[#D2D4E4] px-2 py-1 text-xs text-right focus:outline-none focus:ring-2 focus:ring-[#5B5FEF]"
        />
        <span>Segundos</span>
        <span className="text-sm">⏱</span>
      </div>
      <p className="text-[11px] text-[#656889]">
        Nota: mínimo de {min} y un máximo de {max}
      </p>
    </div>
  );
}

// ============ MAIN COMPONENT ============

export function MessageNode({ data, selected, id }: NodeProps<MessageNodeProps>) {
  const messageType = (data.type ?? "text") as MessageType;
  const delaySeconds = data.delaySeconds ?? 3;

  const setType = (type: MessageType) => {
    data.onChange?.({ type, delaySeconds: type === "text" ? 3 : 5 });
  };

  const updateData = (partial: Partial<MessageNodeData>) => {
    data.onChange?.(partial);
  };

  const [isUploading, setIsUploading] = useState(false);
  const [uploadedFileName, setUploadedFileName] = useState<string | null>((data as any).fileName || null);

  const handleFileUpload = async (
    file: File,
    kind: "media" | "audio" | "document"
  ) => {
    try {
      setIsUploading(true);
      setUploadedFileName(null);

      const formData = new FormData();
      formData.append("file", file);

      const res = await fetch("/api/upload", {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        const text = await res.text();
        console.error("[MessageNode] Upload failed:", text);
        toast.error("No se ha podido subir el archivo. Inténtalo de nuevo.");
        return;
      }

      const json = await res.json(); // { url, mimeType, fileName }

      updateData({
        type: kind,
        mediaType: kind === "media" ? "image" : kind,
        mediaUrl: json.url,
        fileName: json.fileName,
      } as any);

      setUploadedFileName(json.fileName);
    } catch (err) {
      console.error("[MessageNode] Upload error:", err);
      toast.error("Ha ocurrido un error al subir el archivo.");
    } finally {
      setIsUploading(false);
    }
  };

  const typeButton = (type: MessageType, label: string) => {
    const isSelected = messageType === type;
    return (
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          setType(type);
        }}
        className={`flex flex-col items-center justify-center gap-1 px-3 py-2.5 text-xs border rounded-lg min-w-[70px] transition-colors ${
          isSelected
            ? "border-[#5B5FEF] bg-[#F3F3FF] text-[#2C2F4A] font-medium"
            : "border-dashed border-[#D2D4E4] text-[#656889] hover:border-[#5B5FEF] hover:bg-[#F9F9FF]"
        }`}
      >
        <span>{label}</span>
      </button>
    );
  };

  return (
    <NodeWrapper nodeId={id} onDuplicate={data.onDuplicate} onDelete={data.onDelete}>
      <div className="relative">
        <div
          className={`rounded-2xl border bg-white shadow-sm w-[460px] px-6 py-4 flex flex-col gap-4 transition-all ${
            selected ? "border-[#5B5FEF] border-2 shadow-md" : "border-[#E2E4F0]"
          }`}
        >
          {/* Header */}
          <div className="flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-full border border-[#C2C4F5] text-[#5B5FEF] text-sm">
              💬
            </div>
            <span className="text-sm font-semibold text-[#2C2F4A]">Enviar mensaje</span>
          </div>

          {/* Tipo de mensaje - ALWAYS VISIBLE */}
          <div className="flex flex-col gap-2">
            <span className="text-xs font-semibold text-[#2C2F4A]">Tipo de mensaje</span>
            <div className="flex flex-wrap gap-2">
              {typeButton("text", "Texto")}
              {typeButton("media", "Multimedia")}
              {typeButton("audio", "Audio")}
              {typeButton("document", "Documento")}
              {typeButton("contact", "Contacto")}
            </div>
          </div>

          {/* SUB-FORMS - Conditional on messageType */}
          {messageType === "text" && <TextForm data={data} updateData={updateData} delaySeconds={delaySeconds} />}
          {messageType === "media" && <MediaForm data={data} updateData={updateData} delaySeconds={delaySeconds} handleFileUpload={handleFileUpload} isUploading={isUploading} uploadedFileName={uploadedFileName} />}
          {messageType === "audio" && <AudioForm data={data} updateData={updateData} delaySeconds={delaySeconds} handleFileUpload={handleFileUpload} isUploading={isUploading} uploadedFileName={uploadedFileName} setUploadedFileName={setUploadedFileName} />}
          {messageType === "document" && <DocumentForm data={data} updateData={updateData} delaySeconds={delaySeconds} handleFileUpload={handleFileUpload} isUploading={isUploading} uploadedFileName={uploadedFileName} />}
          {messageType === "contact" && <ContactForm data={data} updateData={updateData} delaySeconds={delaySeconds} />}

          {/* Próximo paso label */}
          <span className="absolute right-10 bottom-4 text-[11px] text-[#656889]">Próximo paso</span>
        </div>

        <Handle type="target" position={Position.Left} className="w-3 h-3 border-2 border-gray-300 bg-white" />
        <Handle type="source" position={Position.Right} className="w-3 h-3 border-2 border-gray-300 bg-white" />
      </div>
    </NodeWrapper>
  );
}

// ============ SUB-FORM COMPONENTS ============

function TextForm({
  data,
  updateData,
  delaySeconds,
}: {
  data: any;
  updateData: (p: any) => void;
  delaySeconds: number;
}) {
  const text = (data as TextMessageData).text ?? "";
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  return (
    <div className="flex flex-col gap-3 border-t border-[#E4E6F2] pt-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-sm">📝</span>
          <span className="text-xs font-semibold text-[#2C2F4A]">Texto</span>
        </div>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            updateData({ text: "" });
          }}
          className="text-sm hover:opacity-70"
        >
          🗑
        </button>
      </div>

      {/* Textarea */}
      <textarea
        ref={textareaRef}
        placeholder="Escribe un mensaje…"
        value={text}
        onChange={(e) => updateData({ text: e.target.value })}
        onClick={(e) => e.stopPropagation()}
        onMouseDown={(e) => e.stopPropagation()}
        className="nodrag w-full min-h-[100px] rounded-md border border-[#D2D4E4] bg-white px-3 py-2 text-xs placeholder:text-[#B0B3C6] text-[#373955] focus:outline-none focus:ring-2 focus:ring-[#5B5FEF] resize-none"
      />

      {/* Toolbar */}
      <TextEditorToolbar
        textareaRef={textareaRef}
        value={text}
        onChange={(newValue) => updateData({ text: newValue })}
      />

      {/* Delay Control (3-60) */}
      <DelayControl
        value={delaySeconds}
        onChange={(val) => updateData({ delaySeconds: val })}
        min={3}
        max={60}
      />
    </div>
  );
}

function MediaForm({
  data,
  updateData,
  delaySeconds,
  handleFileUpload,
  isUploading,
  uploadedFileName,
}: {
  data: any;
  updateData: (p: any) => void;
  delaySeconds: number;
  handleFileUpload: (file: File, kind: "media" | "audio" | "document") => Promise<void>;
  isUploading: boolean;
  uploadedFileName: string | null;
}) {
  const fileUrl = (data as MediaMessageData).fileUrl ?? "";
  const caption = (data as MediaMessageData).caption ?? "";
  const fileInputRef = useRef<HTMLInputElement>(null);
  const captionTextareaRef = useRef<HTMLTextAreaElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFileUpload(file, "media");
  };

  return (
    <div className="flex flex-col gap-3 border-t border-[#E4E6F2] pt-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-sm">🖼️</span>
          <span className="text-xs font-semibold text-[#2C2F4A]">Multimedia</span>
        </div>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            updateData({ fileUrl: "", caption: "" });
          }}
          className="text-sm hover:opacity-70"
        >
          🗑
        </button>
      </div>

      {/* Upload panel */}
      <div className="flex flex-col gap-2 p-3 bg-[#F9FAFB] rounded-lg border border-[#E2E4F0]">
        <p className="text-[11px] text-[#656889]">
          Tu archivo no debe superar los 80MB. Si se envía por WhatsApp API, el límite es de 16MB.
        </p>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*,video/*"
          onChange={handleFileChange}
          onClick={(e) => e.stopPropagation()}
          className="hidden"
        />
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            fileInputRef.current?.click();
          }}
          className="w-full py-2 px-4 bg-[#10B981] text-white rounded-lg text-xs font-medium hover:bg-[#059669]"
        >
          Cargar archivo
        </button>
        <p className="text-[11px] text-[#656889] mt-1">
          {isUploading
            ? "Archivo: Subiendo..."
            : uploadedFileName
            ? `Archivo: ${uploadedFileName}`
            : "Ningún archivo seleccionado"}
        </p>
      </div>

      {/* Caption textarea */}
      <textarea
        ref={captionTextareaRef}
        placeholder="Escribe un mensaje…"
        value={caption}
        onChange={(e) => updateData({ caption: e.target.value })}
        onClick={(e) => e.stopPropagation()}
        onMouseDown={(e) => e.stopPropagation()}
        className="nodrag w-full min-h-[80px] rounded-md border border-[#D2D4E4] bg-white px-3 py-2 text-xs placeholder:text-[#B0B3C6] text-[#373955] focus:outline-none focus:ring-2 focus:ring-[#5B5FEF] resize-none"
      />

      {/* Toolbar */}
      <TextEditorToolbar
        textareaRef={captionTextareaRef}
        value={caption}
        onChange={(newValue) => updateData({ caption: newValue })}
      />

      {/* Delay Control (5-60) */}
      <DelayControl
        value={delaySeconds}
        onChange={(val) => updateData({ delaySeconds: val })}
        min={5}
        max={60}
      />
    </div>
  );
}

function AudioForm({
  data,
  updateData,
  delaySeconds,
  handleFileUpload,
  isUploading,
  uploadedFileName,
  setUploadedFileName,
}: {
  data: any;
  updateData: (p: any) => void;
  delaySeconds: number;
  handleFileUpload: (file: File, kind: "media" | "audio" | "document") => Promise<void>;
  isUploading: boolean;
  uploadedFileName: string | null;
  setUploadedFileName: (name: string | null) => void;
}) {
  const fileUrl = (data as AudioMessageData).fileUrl ?? "";
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFileUpload(file, "audio");
  };

  const showRecordingInstructions = () => {
    // Show informative message about how to record audio manually
    alert(`Cómo grabar tu audio

Para grabar un audio compatible con WhatsApp, sigue estos pasos:

1️⃣ Usa la extensión "Chrome Audio Capture" en tu navegador para grabar tu mensaje.

2️⃣ Descarga el archivo como MP3 en tu ordenador.

3️⃣ Vuelve aquí y súbelo con el botón "Cargar archivo".`);
  };

  return (
    <div className="flex flex-col gap-3 border-t border-[#E4E6F2] pt-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-sm">🔊</span>
          <span className="text-xs font-semibold text-[#2C2F4A]">Audio</span>
        </div>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            updateData({ fileUrl: "" });
          }}
          className="text-sm hover:opacity-70"
        >
          🗑
        </button>
      </div>

      {/* Upload panel */}
      <div className="flex flex-col gap-2 p-3 bg-[#F9FAFB] rounded-lg border border-[#E2E4F0]">
        <p className="text-[11px] text-[#656889]">
          Tu archivo no debe superar los 80MB. Si se envía por WhatsApp API, el límite es de 16MB.
        </p>
        <input
          ref={fileInputRef}
          type="file"
          accept="audio/*"
          onChange={handleFileChange}
          onClick={(e) => e.stopPropagation()}
          className="hidden"
        />
        <div className="flex gap-2">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              fileInputRef.current?.click();
            }}
            className="flex-1 py-2 px-4 bg-[#10B981] text-white rounded-lg text-xs font-medium hover:bg-[#059669]"
          >
            Cargar archivo
          </button>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              showRecordingInstructions();
            }}
            className="flex-1 py-2 px-4 bg-[#6B7280] text-white rounded-lg text-xs font-medium hover:bg-[#4B5563]"
          >
            🎤 Grabar audio
          </button>
        </div>

        <p className="text-[11px] text-[#656889] mt-1">
          {isUploading
            ? "Archivo: Subiendo..."
            : uploadedFileName
            ? `Archivo: ${uploadedFileName}`
            : "Ningún archivo seleccionado"}
        </p>
      </div>

      {/* Delay Control (5-60) */}
      <DelayControl
        value={delaySeconds}
        onChange={(val) => updateData({ delaySeconds: val })}
        min={5}
        max={60}
      />
    </div>
  );
}

function DocumentForm({
  data,
  updateData,
  delaySeconds,
  handleFileUpload,
  isUploading,
  uploadedFileName,
}: {
  data: any;
  updateData: (p: any) => void;
  delaySeconds: number;
  handleFileUpload: (file: File, kind: "media" | "audio" | "document") => Promise<void>;
  isUploading: boolean;
  uploadedFileName: string | null;
}) {
  const fileUrl = (data as DocumentMessageData).fileUrl ?? "";
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFileUpload(file, "document");
  };

  return (
    <div className="flex flex-col gap-3 border-t border-[#E4E6F2] pt-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-sm">📄</span>
          <span className="text-xs font-semibold text-[#2C2F4A]">Documento</span>
        </div>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            updateData({ fileUrl: "" });
          }}
          className="text-sm hover:opacity-70"
        >
          🗑
        </button>
      </div>

      {/* Upload panel */}
      <div className="flex flex-col gap-2 p-3 bg-[#F9FAFB] rounded-lg border border-[#E2E4F0]">
        <p className="text-[11px] text-[#656889]">
          Tu archivo no debe superar los 80MB. Si se envía por WhatsApp API, el límite es de 16MB.
        </p>
        <input
          ref={fileInputRef}
          type="file"
          accept=".pdf,.doc,.docx,.xls,.xlsx,.txt"
          onChange={handleFileChange}
          onClick={(e) => e.stopPropagation()}
          className="hidden"
        />
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            fileInputRef.current?.click();
          }}
          className="w-full py-2 px-4 bg-[#10B981] text-white rounded-lg text-xs font-medium hover:bg-[#059669]"
        >
          Cargar archivo
        </button>
        <p className="text-[11px] text-[#656889] mt-1">
          {isUploading
            ? "Archivo: Subiendo..."
            : uploadedFileName
            ? `Archivo: ${uploadedFileName}`
            : "Ningún archivo seleccionado"}
        </p>
      </div>

      {/* Delay Control (5-60) */}
      <DelayControl
        value={delaySeconds}
        onChange={(val) => updateData({ delaySeconds: val })}
        min={5}
        max={60}
      />
    </div>
  );
}

function ContactForm({
  data,
  updateData,
  delaySeconds,
}: {
  data: any;
  updateData: (p: any) => void;
  delaySeconds: number;
}) {
  const contactData = data as ContactMessageData;
  const useConnectedNumber = contactData.useConnectedNumber ?? false;
  const countryCode = contactData.countryCode ?? "+34";
  const phone = contactData.phone ?? "";
  const name = contactData.name ?? "";

  return (
    <div className="flex flex-col gap-3 border-t border-[#E4E6F2] pt-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-sm">👤</span>
          <span className="text-xs font-semibold text-[#2C2F4A]">Contacto</span>
        </div>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            updateData({ phone: "", name: "", useConnectedNumber: false });
          }}
          className="text-sm hover:opacity-70"
        >
          🗑
        </button>
      </div>

      {/* Checkbox */}
      <label className="flex items-center gap-2 cursor-pointer">
        <input
          type="checkbox"
          checked={useConnectedNumber}
          onChange={(e) => updateData({ useConnectedNumber: e.target.checked })}
          onClick={(e) => e.stopPropagation()}
          className="w-4 h-4 rounded border-[#D2D4E4] text-[#5B5FEF] focus:ring-2 focus:ring-[#5B5FEF]"
        />
        <span className="text-xs text-[#2C2F4A]">Usar número de WhatsApp conectado</span>
      </label>

      {/* Phone input (only if not using connected number) */}
      {!useConnectedNumber && (
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-[#2C2F4A]">
            Número del contacto <span className="text-red-500">*</span>
          </label>
          <div className="flex gap-2">
            <select
              value={countryCode}
              onChange={(e) => updateData({ countryCode: e.target.value })}
              onClick={(e) => e.stopPropagation()}
              onMouseDown={(e) => e.stopPropagation()}
              className="w-24 rounded-md border border-[#D2D4E4] bg-white px-2 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-[#5B5FEF]"
            >
              <option value="+34">🇪🇸 +34</option>
              <option value="+1">🇺🇸 +1</option>
              <option value="+52">🇲🇽 +52</option>
              <option value="+54">🇦🇷 +54</option>
              <option value="+56">🇨🇱 +56</option>
              <option value="+57">🇨🇴 +57</option>
            </select>
            <input
              type="tel"
              placeholder="Número del contacto"
              value={phone}
              onChange={(e) => updateData({ phone: e.target.value })}
              onClick={(e) => e.stopPropagation()}
              onMouseDown={(e) => e.stopPropagation()}
              className="flex-1 rounded-md border border-[#D2D4E4] bg-white px-3 py-2 text-xs placeholder:text-[#B0B3C6] text-[#373955] focus:outline-none focus:ring-2 focus:ring-[#5B5FEF]"
            />
          </div>
        </div>
      )}

      {/* Name input */}
      <div className="flex flex-col gap-1">
        <label className="text-xs font-medium text-[#2C2F4A]">
          Nombre del contacto <span className="text-red-500">*</span>
        </label>
        <input
          type="text"
          placeholder="Escribe el nombre del contacto"
          value={name}
          onChange={(e) => updateData({ name: e.target.value })}
          onClick={(e) => e.stopPropagation()}
          onMouseDown={(e) => e.stopPropagation()}
          className="w-full rounded-md border border-[#D2D4E4] bg-white px-3 py-2 text-xs placeholder:text-[#B0B3C6] text-[#373955] focus:outline-none focus:ring-2 focus:ring-[#5B5FEF]"
        />
      </div>

      {/* Delay Control (5-60) */}
      <DelayControl
        value={delaySeconds}
        onChange={(val) => updateData({ delaySeconds: val })}
        min={5}
        max={60}
      />
    </div>
  );
}
