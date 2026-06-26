import Link from "next/link";
import { RELATIONSHIP_FLOW } from "@/lib/site";

// The ordered logic across the ecosystem:
// ATLAS Golden Mining → QASSAS → HYRION → Institutional Review / Data Room → Mustadam,
// with AKANIL as the central organizing architecture.
export function RelationshipFlow() {
  return (
    <div className="rounded-2xl border border-atlas-line bg-obsidian-800 p-6 md:p-8">
      <div className="mb-6 flex items-center gap-3">
        <span className="rounded-full border border-gold/40 bg-gold/10 px-3 py-1 text-xs font-medium text-gold">
          AKANIL · central organizing architecture
        </span>
      </div>

      <ol className="flex flex-col gap-3 md:flex-row md:items-stretch">
        {RELATIONSHIP_FLOW.map((step, i) => (
          <li key={step.label} className="flex items-center gap-3 md:flex-1 md:flex-col md:items-stretch md:gap-2">
            <Link
              href={step.href}
              className="group block w-full rounded-xl border border-atlas-line bg-obsidian-700 px-4 py-3.5 transition-colors hover:border-gold/30 md:h-full"
            >
              <div className="flex items-center gap-2">
                <span className="font-display text-sm text-gold">{String(i + 1).padStart(2, "0")}</span>
                <span className="text-sm font-semibold text-ivory group-hover:text-gold">
                  {step.label}
                </span>
              </div>
              <p className="mt-1 text-xs text-atlas-grey">{step.sub}</p>
            </Link>
            {i < RELATIONSHIP_FLOW.length - 1 && (
              <span className="hidden self-center text-gold/50 md:inline" aria-hidden>
                →
              </span>
            )}
          </li>
        ))}
      </ol>
    </div>
  );
}
