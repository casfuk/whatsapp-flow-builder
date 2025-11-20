"use client";

import { useState, useRef, useEffect } from "react";

interface RichTextToolbarProps {
  textareaRef?: React.RefObject<HTMLTextAreaElement>;
  editorRef?: React.RefObject<HTMLDivElement>;
  onInsert?: (text: string) => void;
  onInsertText?: (text: string) => void;
  onBold?: () => void;
  onItalic?: () => void;
  onStrikethrough?: () => void;
  dynamicFields?: { label: string; value: string }[];
  showMarkdownButtons?: boolean;
  isWysiwyg?: boolean;
}

export function RichTextToolbar({
  textareaRef,
  editorRef,
  onInsert,
  onInsertText,
  onBold,
  onItalic,
  onStrikethrough,
  dynamicFields = [],
  showMarkdownButtons = true,
  isWysiwyg = false
}: RichTextToolbarProps) {
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [showVariablePicker, setShowVariablePicker] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const emojiPickerRef = useRef<HTMLDivElement>(null);
  const variablePickerRef = useRef<HTMLDivElement>(null);

  // System fields - common fields available in all flows
  const systemFields = [
    { label: "Nombre completo", value: "nombre_completo" },
    { label: "Primer nombre", value: "primer_nombre" },
    { label: "Apellido", value: "apellido" },
    { label: "Correo", value: "correo" },
    { label: "Teléfono", value: "telefono" },
    { label: "Tag", value: "tag" },
    { label: "Canal", value: "canal" },
  ];

  // Custom fields - fields from trigger or custom data
  const customFields = [
    { label: "Guiado", value: "guiado" },
    { label: "Cuenta", value: "cuenta" },
    ...dynamicFields,
  ];

  // Filter fields based on search query
  const filteredSystemFields = systemFields.filter(field =>
    field.label.toLowerCase().includes(searchQuery.toLowerCase()) ||
    field.value.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const filteredCustomFields = customFields.filter(field =>
    field.label.toLowerCase().includes(searchQuery.toLowerCase()) ||
    field.value.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Common emojis for quick access
  const commonEmojis = [
    "😊", "👋", "❤️", "🎉", "✨", "👍", "🙏", "💪",
    "🔥", "⭐", "✅", "❌", "📱", "💼", "🎯", "📧"
  ];

  // Close pickers when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (emojiPickerRef.current && !emojiPickerRef.current.contains(event.target as Node)) {
        setShowEmojiPicker(false);
      }
      if (variablePickerRef.current && !variablePickerRef.current.contains(event.target as Node)) {
        setShowVariablePicker(false);
        setSearchQuery("");
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Keyboard shortcuts (only for markdown mode with textarea)
  useEffect(() => {
    if (isWysiwyg) return; // WYSIWYG handles its own shortcuts

    const textarea = textareaRef?.current;
    if (!textarea) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      // Ctrl+B for bold
      if (e.ctrlKey && e.key === 'b') {
        e.preventDefault();
        wrapSelection("**", "**");
      }
      // Ctrl+I for italic
      else if (e.ctrlKey && e.key === 'i') {
        e.preventDefault();
        wrapSelection("_", "_");
      }
      // Ctrl+Shift+S for strikethrough
      else if (e.ctrlKey && e.shiftKey && e.key === 'S') {
        e.preventDefault();
        wrapSelection("~~", "~~");
      }
    };

    textarea.addEventListener("keydown", handleKeyDown);
    return () => textarea.removeEventListener("keydown", handleKeyDown);
  }, [textareaRef, isWysiwyg]);

  const wrapSelection = (prefix: string, suffix: string) => {
    const textarea = textareaRef?.current;
    if (!textarea || !onInsert) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selectedText = textarea.value.substring(start, end);
    const wrappedText = prefix + selectedText + suffix;

    // Insert wrapped text
    const newValue = textarea.value.substring(0, start) + wrappedText + textarea.value.substring(end);
    onInsert(newValue);

    // Set cursor position after the wrapped text
    setTimeout(() => {
      textarea.focus();
      const newCursorPos = start + prefix.length + selectedText.length + suffix.length;
      textarea.setSelectionRange(newCursorPos, newCursorPos);
    }, 0);
  };

  const insertAtCursor = (text: string) => {
    // For WYSIWYG mode
    if (isWysiwyg && onInsertText) {
      onInsertText(text);
      return;
    }

    // For markdown mode
    const textarea = textareaRef?.current;
    if (!textarea || !onInsert) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;

    const newValue = textarea.value.substring(0, start) + text + textarea.value.substring(end);
    onInsert(newValue);

    // Set cursor position after inserted text
    setTimeout(() => {
      textarea.focus();
      const newCursorPos = start + text.length;
      textarea.setSelectionRange(newCursorPos, newCursorPos);
    }, 0);
  };

  const handleBold = () => {
    if (isWysiwyg && onBold) {
      onBold();
    } else {
      wrapSelection("**", "**");
    }
  };

  const handleItalic = () => {
    if (isWysiwyg && onItalic) {
      onItalic();
    } else {
      wrapSelection("_", "_");
    }
  };

  const handleStrikethrough = () => {
    if (isWysiwyg && onStrikethrough) {
      onStrikethrough();
    } else {
      wrapSelection("~~", "~~");
    }
  };

  const handleEmojiClick = (emoji: string) => {
    insertAtCursor(emoji);
    setShowEmojiPicker(false);
  };

  const handleVariableClick = (variable: string) => {
    insertAtCursor(`{{${variable}}}`);
    setShowVariablePicker(false);
    setSearchQuery("");
  };

  const handleVariablePickerToggle = () => {
    setShowVariablePicker(!showVariablePicker);
    if (!showVariablePicker) {
      setSearchQuery("");
    }
  };

  return (
    <div className="flex items-center gap-1 mb-2 flex-wrap relative">
      {/* Emoji Picker Button */}
      <div className="relative" ref={emojiPickerRef}>
        <button
          type="button"
          onClick={() => setShowEmojiPicker(!showEmojiPicker)}
          className="p-1.5 hover:bg-gray-100 rounded transition-colors"
          title="Insertar emoji"
        >
          <svg className="w-4 h-4 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.828 14.828a4 4 0 01-5.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </button>

        {showEmojiPicker && (
          <div className="absolute top-full left-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg p-2 z-50 grid grid-cols-8 gap-1 w-64">
            {commonEmojis.map((emoji, index) => (
              <button
                key={index}
                type="button"
                onClick={() => handleEmojiClick(emoji)}
                className="text-xl hover:bg-gray-100 rounded p-1 transition-colors"
              >
                {emoji}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Bold Button */}
      {showMarkdownButtons && (
        <button
          type="button"
          onClick={handleBold}
          className="p-1.5 hover:bg-gray-100 rounded transition-colors font-bold text-gray-700"
          title="Negrita (Ctrl+B)"
        >
          <span className="text-sm">B</span>
        </button>
      )}

      {/* Italic Button */}
      {showMarkdownButtons && (
        <button
          type="button"
          onClick={handleItalic}
          className="p-1.5 hover:bg-gray-100 rounded transition-colors italic text-gray-700"
          title="Cursiva (Ctrl+I)"
        >
          <span className="text-sm">I</span>
        </button>
      )}

      {/* Strikethrough Button */}
      {showMarkdownButtons && (
        <button
          type="button"
          onClick={handleStrikethrough}
          className="p-1.5 hover:bg-gray-100 rounded transition-colors line-through text-gray-700"
          title="Tachado (Ctrl+Shift+S)"
        >
          <span className="text-sm">S</span>
        </button>
      )}

      {/* Variable Picker Button */}
      <div className="relative" ref={variablePickerRef}>
        <button
          type="button"
          onClick={handleVariablePickerToggle}
          className="p-1.5 hover:bg-gray-100 rounded transition-colors flex items-center gap-1"
          title="Insertar variable"
        >
          <svg className="w-4 h-4 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
          </svg>
          <svg className="w-3 h-3 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>

        {showVariablePicker && (
          <div className="absolute top-full left-0 mt-1 bg-white border border-gray-200 rounded-xl shadow-xl z-50 w-80 max-h-96 overflow-hidden flex flex-col">
            {/* Search Bar */}
            <div className="p-3 border-b border-gray-200">
              <div className="relative">
                <svg
                  className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                  />
                </svg>
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Buscar campos..."
                  className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#6D5BFA] focus:border-transparent"
                  autoFocus
                />
              </div>
            </div>

            {/* Scrollable Content */}
            <div className="overflow-y-auto flex-1">
              {/* System Fields Section */}
              {filteredSystemFields.length > 0 && (
                <div className="py-2">
                  <div className="px-3 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                    Campos del sistema
                  </div>
                  <div>
                    {filteredSystemFields.map((field, index) => (
                      <button
                        key={`system-${index}`}
                        type="button"
                        onClick={() => handleVariableClick(field.value)}
                        className="w-full text-left px-3 py-2 hover:bg-purple-50 transition-colors text-sm flex items-center justify-between group"
                      >
                        <span className="text-gray-700 font-medium">{field.label}</span>
                        <span className="text-xs text-gray-400 font-mono group-hover:text-[#6D5BFA]">
                          {`{{${field.value}}}`}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Custom Fields Section */}
              {filteredCustomFields.length > 0 && (
                <div className="py-2 border-t border-gray-100">
                  <div className="px-3 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                    Campos customizados
                  </div>
                  <div>
                    {filteredCustomFields.map((field, index) => (
                      <button
                        key={`custom-${index}`}
                        type="button"
                        onClick={() => handleVariableClick(field.value)}
                        className="w-full text-left px-3 py-2 hover:bg-purple-50 transition-colors text-sm flex items-center justify-between group"
                      >
                        <span className="text-gray-700 font-medium">{field.label}</span>
                        <span className="text-xs text-gray-400 font-mono group-hover:text-[#6D5BFA]">
                          {`{{${field.value}}}`}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* No Results */}
              {filteredSystemFields.length === 0 && filteredCustomFields.length === 0 && (
                <div className="px-3 py-8 text-center text-sm text-gray-500">
                  No se encontraron campos
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {showMarkdownButtons && (
        <div className="ml-2 text-xs text-gray-400">
          Markdown: **negrita** _cursiva_ ~~tachado~~
        </div>
      )}
    </div>
  );
}
