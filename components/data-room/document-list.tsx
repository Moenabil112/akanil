"use client";

import { useState } from "react";
import Link from "next/link";
import { ACCESS_LEVELS, type AccessLevel } from "@/lib/supabase/types";

export type LockReason = "none" | "no_permission" | "nda_required";

export interface ClientDocument {
  id: string;
  title: string;
  description: string | null;
  document_type: string | null;
  access_level: AccessLevel;
  version: string | null;
  language: string | null;
  hasFile: boolean;
  locked: boolean;
  lockReason: LockReason;
}

function levelLabel(value: AccessLevel) {
  return ACCESS_LEVELS.find((l) => l.value === value)?.label ?? value;
}

export function DocumentList({
  documents,
  windowLabel,
}: {
  documents: ClientDocument[];
  windowLabel: string;
}) {
  if (documents.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-atlas-line bg-obsidian-800/50 p-10 text-center text-sm text-atlas-grey">
        No documents are available in this window yet.
      </div>
    );
  }

  return (
    <ul className="space-y-3">
      {documents.map((doc) => (
        <DocumentRow key={doc.id} doc={doc} windowLabel={windowLabel} />
      ))}
    </ul>
  );
}

function DocumentRow({ doc, windowLabel }: { doc: ClientDocument; windowLabel: string }) {
  const [state, setState] = useState<"idle" | "loading" | "error">("idle");
  const [error, setError] = useState<string | null>(null);

  async function requestDownload() {
    setState("loading");
    setError(null);
    try {
      const res = await fetch("/api/data-room/download", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ documentId: doc.id }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        const map: Record<string, string> = {
          unauthenticated: "Please sign in to download.",
          no_window_permission: "You don’t have access to this document.",
          nda_required: "An approved NDA is required for this document.",
        };
        throw new Error(map[body.reason] || body.error || "Download is unavailable.");
      }
      window.open(body.url, "_blank", "noopener,noreferrer");
      setState("idle");
    } catch (err) {
      setState("error");
      setError(err instanceof Error ? err.message : "Something went wrong.");
    }
  }

  return (
    <li
      className={`flex flex-col gap-3 rounded-xl border p-5 sm:flex-row sm:items-center sm:justify-between ${
        doc.locked ? "border-atlas-line/60 bg-obsidian-800/60" : "border-atlas-line bg-obsidian-800"
      }`}
    >
      <div>
        <div className="flex flex-wrap items-center gap-2">
          {doc.locked && <LockIcon />}
          <span className={doc.locked ? "font-medium text-ivory-muted" : "font-medium text-ivory"}>
            {doc.title}
          </span>
          <span className="rounded-full border border-teal/40 bg-teal/10 px-2 py-0.5 text-[11px] text-teal-light">
            {levelLabel(doc.access_level)}
          </span>
        </div>
        {doc.description && !doc.locked && (
          <p className="mt-1 max-w-xl text-sm text-atlas-grey">{doc.description}</p>
        )}
        <p className="mt-1 text-xs text-atlas-grey/70">
          {doc.document_type ?? "Document"} · v{doc.version ?? "1"} ·{" "}
          {(doc.language ?? "en").toUpperCase()}
        </p>
        {state === "error" && error && (
          <p className="mt-2 text-xs text-copper-light">{error}</p>
        )}
      </div>

      <div className="shrink-0">
        {doc.locked ? (
          doc.lockReason === "nda_required" ? (
            <Link
              href="/data-room/access-control"
              className="rounded-md border border-gold/50 px-4 py-2 text-sm font-medium text-gold transition-colors hover:bg-gold hover:text-obsidian"
            >
              Complete NDA
            </Link>
          ) : (
            <Link
              href={`/data-room/access-control?window=${encodeURIComponent(windowLabel)}`}
              className="rounded-md border border-atlas-line px-4 py-2 text-sm font-medium text-atlas-grey transition-colors hover:border-gold/40 hover:text-gold"
            >
              Request access
            </Link>
          )
        ) : doc.hasFile ? (
          <button
            type="button"
            onClick={requestDownload}
            disabled={state === "loading"}
            className="rounded-md border border-gold/50 px-4 py-2 text-sm font-medium text-gold transition-colors hover:bg-gold hover:text-obsidian disabled:opacity-60"
          >
            {state === "loading" ? "Preparing…" : "Request secure download"}
          </button>
        ) : (
          <span className="text-xs text-atlas-grey">Metadata only</span>
        )}
      </div>
    </li>
  );
}

function LockIcon() {
  return (
    <svg className="h-3.5 w-3.5 text-atlas-grey" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4">
      <rect x="3.5" y="7" width="9" height="6.5" rx="1.2" />
      <path d="M5.5 7V5a2.5 2.5 0 0 1 5 0v2" />
    </svg>
  );
}
