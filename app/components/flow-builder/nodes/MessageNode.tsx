"use client";

import { Handle, Position, NodeProps } from "reactflow";
import { useState, useRef } from "react";
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
  mediaId?: string;
  mediaType?: string;
  fileName?: string;
};

type AudioMessageData = BaseMessageData & {
  type: "audio";
  fileUrl?: string;
  mediaId?: string;
  mediaType?: string;
  fileName?: string;
};

type DocumentMessageData = BaseMessageData & {
  type: "document";
  fileUrl?: string;
  mediaId?: string;
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

      const json = await res.json();

      updateData({
        type: kind,
        mediaType: kind === "media" ? "image" : kind,
        mediaId: json.fileId,
        fileName: json.fileName,
      });

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
        placeholder="Escribe un mensaje…"
        value={text}
        onChange={(e) => updateData({ text: e.target.value })}
        onClick={(e) => e.stopPropagation()}
        onMouseDown={(e) => e.stopPropagation()}
        className="w-full min-h-[100px] rounded-md border border-[#D2D4E4] bg-white px-3 py-2 text-xs placeholder:text-[#B0B3C6] text-[#373955] focus:outline-none focus:ring-2 focus:ring-[#5B5FEF] resize-none"
      />

      {/* Toolbar */}
      <div className="flex items-center gap-2 text-sm">
        <button type="button" className="hover:opacity-70" onClick={(e) => e.stopPropagation()}>
          😊
        </button>
        <button type="button" className="hover:opacity-70 font-bold" onClick={(e) => e.stopPropagation()}>
          B
        </button>
        <button type="button" className="hover:opacity-70 italic" onClick={(e) => e.stopPropagation()}>
          I
        </button>
        <button type="button" className="hover:opacity-70 line-through" onClick={(e) => e.stopPropagation()}>
          S
        </button>
        <button type="button" className="hover:opacity-70" onClick={(e) => e.stopPropagation()}>
          {"{}"}
        </button>
      </div>

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
        placeholder="Escribe un mensaje…"
        value={caption}
        onChange={(e) => updateData({ caption: e.target.value })}
        onClick={(e) => e.stopPropagation()}
        onMouseDown={(e) => e.stopPropagation()}
        className="w-full min-h-[80px] rounded-md border border-[#D2D4E4] bg-white px-3 py-2 text-xs placeholder:text-[#B0B3C6] text-[#373955] focus:outline-none focus:ring-2 focus:ring-[#5B5FEF] resize-none"
      />

      {/* Toolbar */}
      <div className="flex items-center gap-2 text-sm">
        <button type="button" className="hover:opacity-70" onClick={(e) => e.stopPropagation()}>
          😊
        </button>
        <button type="button" className="hover:opacity-70 font-bold" onClick={(e) => e.stopPropagation()}>
          B
        </button>
        <button type="button" className="hover:opacity-70 italic" onClick={(e) => e.stopPropagation()}>
          I
        </button>
        <button type="button" className="hover:opacity-70 line-through" onClick={(e) => e.stopPropagation()}>
          S
        </button>
        <button type="button" className="hover:opacity-70" onClick={(e) => e.stopPropagation()}>
          {"{}"}
        </button>
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
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const timerIntervalRef = useRef<NodeJS.Timeout | null>(null);

  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [recordingError, setRecordingError] = useState<string | null>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFileUpload(file, "audio");
  };

  const startRecording = async () => {
    try {
      setRecordingError(null);

      // Request microphone permission
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });

      // Create MediaRecorder
      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: 'audio/webm',
      });

      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      // Collect audio chunks
      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      // Handle recording stop
      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });

        // Convert blob to File and upload using centralized handler
        const audioFile = new File([audioBlob], "recording.webm", { type: 'audio/webm' });
        await handleFileUpload(audioFile, "audio");
        setUploadedFileName("grabación.webm");

        // Stop all tracks
        stream.getTracks().forEach(track => track.stop());

        // Clear timer
        if (timerIntervalRef.current) {
          clearInterval(timerIntervalRef.current);
          timerIntervalRef.current = null;
        }
      };

      // Start recording
      mediaRecorder.start();
      setIsRecording(true);
      setRecordingTime(0);

      // Start timer
      timerIntervalRef.current = setInterval(() => {
        setRecordingTime(prev => prev + 1);
      }, 1000);

    } catch (error) {
      console.error('Error starting recording:', error);
      setRecordingError('No se pudo acceder al micrófono. Por favor, permite el acceso.');
      setIsRecording(false);
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
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
            disabled={isRecording}
            className={`flex-1 py-2 px-4 bg-[#10B981] text-white rounded-lg text-xs font-medium ${
              isRecording ? 'opacity-50 cursor-not-allowed' : 'hover:bg-[#059669]'
            }`}
          >
            Cargar archivo
          </button>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              if (isRecording) {
                stopRecording();
              } else {
                startRecording();
              }
            }}
            className={`flex-1 py-2 px-4 text-white rounded-lg text-xs font-medium ${
              isRecording
                ? 'bg-[#EF4444] hover:bg-[#DC2626]'
                : 'bg-[#6B7280] hover:bg-[#4B5563]'
            }`}
          >
            {isRecording ? '⏹ Detener' : '🎤 Grabar audio'}
          </button>
        </div>

        {/* Recording indicator */}
        {isRecording && (
          <div className="flex items-center gap-2 p-2 bg-[#FEE2E2] border border-[#FCA5A5] rounded-lg">
            <div className="w-3 h-3 bg-[#EF4444] rounded-full animate-pulse"></div>
            <span className="text-xs font-medium text-[#991B1B]">
              Grabando... {formatTime(recordingTime)}
            </span>
          </div>
        )}

        {/* Error message */}
        {recordingError && (
          <div className="p-2 bg-[#FEE2E2] border border-[#FCA5A5] rounded-lg">
            <p className="text-xs text-[#991B1B]">{recordingError}</p>
          </div>
        )}

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
