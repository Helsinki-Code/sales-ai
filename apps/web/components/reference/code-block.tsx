"use client";

import { useState } from "react";

interface CodeBlockProps {
  code: string;
  language?: string;
}

export function CodeBlock({ code, language = "bash" }: CodeBlockProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div style={{ position: "relative" }}>
      <pre
        style={{
          fontFamily: "monospace",
          fontSize: "0.85rem",
          overflowX: "auto",
          padding: "1rem",
          backgroundColor: "var(--panel)",
          borderRadius: "4px",
          margin: "0",
          lineHeight: "1.6",
        }}
      >
        {code}
      </pre>
      <button
        onClick={handleCopy}
        style={{
          position: "absolute",
          top: "0.75rem",
          right: "0.75rem",
          background: "var(--accent)",
          color: "white",
          border: "none",
          padding: "0.5rem 1rem",
          borderRadius: "4px",
          fontSize: "0.85rem",
          cursor: "pointer",
          fontWeight: "500",
        }}
      >
        {copied ? "✓ Copied!" : "Copy"}
      </button>
    </div>
  );
}
