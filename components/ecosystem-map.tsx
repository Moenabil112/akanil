import Link from "next/link";
import { PRIMARY_NODES, CENTER_NODE, ACCENT_CLASS } from "@/lib/site";

// Percent positions (x,y) around the center, aligned to PRIMARY_NODES order:
// ZYNTRA, QASSAS, HYRION, ATLAS Golden Mining, Mustadam.
const POS = [
  { x: 50, y: 9 }, // ZYNTRA — top
  { x: 88, y: 34 }, // QASSAS — upper right
  { x: 77, y: 88 }, // HYRION — lower right
  { x: 23, y: 88 }, // ATLAS — lower left
  { x: 12, y: 34 }, // Mustadam — upper left
];

export function EcosystemMap() {
  return (
    <div className="relative">
      {/* Desktop radial system map */}
      <div className="relative mx-auto hidden h-[600px] w-full max-w-3xl lg:block">
        {/* connector lines */}
        <svg
          className="absolute inset-0 h-full w-full"
          viewBox="0 0 100 100"
          preserveAspectRatio="none"
          aria-hidden="true"
        >
          {POS.map((p, i) => (
            <line
              key={i}
              x1="50"
              y1="50"
              x2={p.x}
              y2={p.y}
              className={ACCENT_CLASS[PRIMARY_NODES[i].accent].line}
              strokeWidth="0.25"
              strokeDasharray="1.2 1.2"
            />
          ))}
        </svg>

        {/* center node */}
        <div className="absolute left-1/2 top-1/2 z-10 -translate-x-1/2 -translate-y-1/2">
          <div className="flex h-40 w-40 flex-col items-center justify-center rounded-full border border-gold/40 bg-obsidian-800 text-center shadow-[0_0_60px_-12px_rgba(184,146,74,0.4)]">
            <span className="font-display text-xl font-semibold tracking-[0.14em] text-gold">
              AKANIL
            </span>
            <span className="mt-1 px-4 text-[11px] uppercase tracking-[0.16em] text-atlas-grey">
              {CENTER_NODE.role}
            </span>
          </div>
        </div>

        {/* primary ring nodes */}
        {PRIMARY_NODES.map((node, i) => {
          const accent = ACCENT_CLASS[node.accent];
          return (
            <Link
              key={node.slug}
              href={node.href}
              className="group absolute z-20 w-48 -translate-x-1/2 -translate-y-1/2"
              style={{ left: `${POS[i].x}%`, top: `${POS[i].y}%` }}
            >
              <div
                className={`rounded-xl border bg-obsidian-800/95 p-4 backdrop-blur transition-all duration-300 group-hover:-translate-y-0.5 ${accent.border} hover:bg-obsidian-700`}
              >
                <div className="flex items-center gap-2">
                  <span className={`h-2 w-2 rounded-full ${accent.dot}`} />
                  <span className="font-display text-sm font-semibold text-ivory">
                    {node.name}
                  </span>
                </div>
                <p className={`mt-1.5 text-[11px] leading-snug ${accent.text}`}>{node.role}</p>
                {node.note && (
                  <span className="mt-2 inline-block rounded-full border border-atlas-line px-2 py-0.5 text-[9px] uppercase tracking-[0.12em] text-atlas-grey">
                    {node.note}
                  </span>
                )}
              </div>
            </Link>
          );
        })}
      </div>

      {/* Mobile / tablet stacked system view */}
      <div className="lg:hidden">
        <div className="mx-auto mb-4 flex max-w-xs flex-col items-center justify-center rounded-2xl border border-gold/40 bg-obsidian-800 px-6 py-6 text-center">
          <span className="font-display text-lg font-semibold tracking-[0.14em] text-gold">
            AKANIL
          </span>
          <span className="mt-1 text-[11px] uppercase tracking-[0.16em] text-atlas-grey">
            {CENTER_NODE.role}
          </span>
        </div>
        <div className="space-y-3">
          {PRIMARY_NODES.map((node) => {
            const accent = ACCENT_CLASS[node.accent];
            return (
              <Link
                key={node.slug}
                href={node.href}
                className={`flex items-center gap-3 rounded-xl border bg-obsidian-800 p-4 ${accent.border}`}
              >
                <span className={`h-2.5 w-2.5 flex-shrink-0 rounded-full ${accent.dot}`} />
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-display text-sm font-semibold text-ivory">{node.name}</span>
                    {node.note && (
                      <span className="rounded-full border border-atlas-line px-2 py-0.5 text-[9px] uppercase tracking-[0.12em] text-atlas-grey">
                        {node.note}
                      </span>
                    )}
                  </div>
                  <p className={`text-[11px] ${accent.text}`}>{node.role}</p>
                </div>
              </Link>
            );
          })}
        </div>
      </div>
    </div>
  );
}
