"use client";

import { useRef, useEffect, useState } from "react";
import { RichTextToolbar } from "./RichTextToolbar";

interface WysiwygEditorProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  rows?: number;
}

export function WysiwygEditor({ value, onChange, placeholder = "Escribe tu pregunta aquí...", className = "", rows = 3 }: WysiwygEditorProps) {
  const editorRef = useRef<HTMLDivElement>(null!);
  const [isFocused, setIsFocused] = useState(false);

  // Initialize editor content
  useEffect(() => {
    if (editorRef.current && editorRef.current.innerHTML !== value) {
      editorRef.current.innerHTML = value || "";
    }
  }, [value]);

  const handleInput = () => {
    if (editorRef.current) {
      onChange(editorRef.current.innerHTML);
    }
  };

  const handleBold = () => {
    document.execCommand("bold", false);
    editorRef.current?.focus();
    if (editorRef.current) {
      onChange(editorRef.current.innerHTML);
    }
  };

  const handleItalic = () => {
    document.execCommand("italic", false);
    editorRef.current?.focus();
    if (editorRef.current) {
      onChange(editorRef.current.innerHTML);
    }
  };

  const handleStrikethrough = () => {
    document.execCommand("strikeThrough", false);
    editorRef.current?.focus();
    if (editorRef.current) {
      onChange(editorRef.current.innerHTML);
    }
  };

  const insertAtCursor = (text: string) => {
    if (!editorRef.current) return;

    editorRef.current.focus();

    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) return;

    const range = selection.getRangeAt(0);
    range.deleteContents();

    const textNode = document.createTextNode(text);
    range.insertNode(textNode);

    // Move cursor after inserted text
    range.setStartAfter(textNode);
    range.setEndAfter(textNode);
    selection.removeAllRanges();
    selection.addRange(range);

    if (editorRef.current) {
      onChange(editorRef.current.innerHTML);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    // Ctrl+B for bold
    if (e.ctrlKey && e.key === 'b') {
      e.preventDefault();
      handleBold();
    }
    // Ctrl+I for italic
    else if (e.ctrlKey && e.key === 'i') {
      e.preventDefault();
      handleItalic();
    }
    // Ctrl+Shift+S for strikethrough
    else if (e.ctrlKey && e.shiftKey && e.key === 'S') {
      e.preventDefault();
      handleStrikethrough();
    }
  };

  // Calculate approximate height based on rows
  const minHeight = rows * 1.5 + 1.5; // 1.5rem per row + padding

  return (
    <div>
      <RichTextToolbar
        editorRef={editorRef}
        onBold={handleBold}
        onItalic={handleItalic}
        onStrikethrough={handleStrikethrough}
        onInsertText={insertAtCursor}
        showMarkdownButtons={true}
        isWysiwyg={true}
      />
      <div
        ref={editorRef}
        contentEditable
        onInput={handleInput}
        onFocus={() => setIsFocused(true)}
        onBlur={() => setIsFocused(false)}
        onKeyDown={handleKeyDown}
        className={`w-full p-3 bg-purple-50 rounded-lg border border-purple-100 text-xs leading-relaxed outline-none transition-all text-black ${
          isFocused ? "ring-2 ring-[#6D5BFA] ring-opacity-20 border-[#6D5BFA]" : ""
        } ${className}`}
        style={{ minHeight: `${minHeight}rem` }}
        data-placeholder={placeholder}
      />
      <style jsx>{`
        [contentEditable]:empty:before {
          content: attr(data-placeholder);
          color: #9ca3af;
          pointer-events: none;
        }
        [contentEditable] {
          overflow-y: auto;
        }
        [contentEditable] b,
        [contentEditable] strong {
          font-weight: 700;
        }
        [contentEditable] i,
        [contentEditable] em {
          font-style: italic;
        }
        [contentEditable] s,
        [contentEditable] strike {
          text-decoration: line-through;
        }
      `}</style>
    </div>
  );
}
