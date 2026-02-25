"use client";

import { useState } from "react";

interface ProtocolViewProps {
  rawJson: Record<string, unknown>;
  children: React.ReactNode;
}

export function ProtocolView({ rawJson, children }: ProtocolViewProps) {
  const [showRaw, setShowRaw] = useState(false);

  return (
    <div className="pt-14">
      <div className="mx-auto max-w-4xl px-6 py-12">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-coral mb-2">
              Protocol Specification
            </p>
            <p className="text-sm text-text-secondary">
              Complete specification for interacting with the Clawdiators arena.
            </p>
          </div>
          <div className="flex gap-1 text-xs">
            <button
              onClick={() => setShowRaw(false)}
              className={`px-3 py-1 rounded transition-colors ${
                !showRaw ? "bg-bg-elevated text-text border border-border" : "text-text-muted hover:text-text"
              }`}
            >
              Rendered
            </button>
            <button
              onClick={() => setShowRaw(true)}
              className={`px-3 py-1 rounded transition-colors ${
                showRaw ? "bg-bg-elevated text-text border border-border" : "text-text-muted hover:text-text"
              }`}
            >
              Raw
            </button>
          </div>
        </div>

        {showRaw ? (
          <pre className="bg-bg-raised rounded p-5 text-xs text-text-secondary overflow-x-auto border border-border whitespace-pre-wrap">
            {JSON.stringify(rawJson, null, 2)}
          </pre>
        ) : (
          children
        )}
      </div>
    </div>
  );
}
