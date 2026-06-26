import Link from "next/link";
import { ACCENT_CLASS, type EcosystemNode } from "@/lib/site";

// Card for an ecosystem layer / node. Shows the role within the system,
// the layer name, and (for QASSAS) the "A ZYNTRA Product" note.
export function WindowCard({
  node,
  kicker = "Core Layer",
}: {
  node: EcosystemNode;
  kicker?: string;
}) {
  const accent = ACCENT_CLASS[node.accent];
  return (
    <Link
      href={node.href}
      className="group relative flex flex-col overflow-hidden rounded-xl border border-atlas-line bg-obsidian-800 p-6 transition-all duration-300 hover:-translate-y-1 hover:border-gold/30 hover:bg-obsidian-700"
    >
      <span
        className={`absolute left-0 top-0 h-full w-0.5 ${accent.dot} opacity-50 transition-opacity group-hover:opacity-100`}
      />
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className={`h-2 w-2 rounded-full ${accent.dot}`} />
          <span className={`text-xs font-medium uppercase tracking-[0.16em] ${accent.text}`}>
            {kicker}
          </span>
        </div>
        {node.note && (
          <span className="rounded-full border border-atlas-line px-2 py-0.5 text-[10px] uppercase tracking-[0.12em] text-atlas-grey">
            {node.note}
          </span>
        )}
      </div>
      <h3 className="heading-md mt-3 text-ivory">
        {node.name}
        {node.nameAr && (
          <span className="ml-2 align-middle text-base text-atlas-grey">{node.nameAr}</span>
        )}
      </h3>
      <p className="mt-2 flex-1 text-sm leading-relaxed text-atlas-grey">{node.role}</p>
      <span className="mt-5 inline-flex items-center gap-1.5 text-sm font-medium text-gold">
        Enter layer
        <svg
          className="h-4 w-4 transition-transform group-hover:translate-x-1"
          viewBox="0 0 16 16"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.6"
        >
          <path d="M3 8h10M9 4l4 4-4 4" />
        </svg>
      </span>
    </Link>
  );
}
