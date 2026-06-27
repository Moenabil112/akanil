// Trust Pathway — the public-to-private institutional journey.
// Public Trust → Institutional Brief → NDA Data Room → Review → Partnership

const DEFAULT_STEPS = [
  "Public Trust",
  "Institutional Brief",
  "NDA Data Room",
  "Technical / Investment Review",
  "Strategic Partnership",
];

export function TrustPathway({
  steps = DEFAULT_STEPS,
  title = "The Trust Pathway",
}: {
  steps?: string[];
  title?: string;
}) {
  return (
    <div className="rounded-xl border border-atlas-line bg-obsidian-800 p-6 md:p-8">
      <h3 className="text-xs font-semibold uppercase tracking-[0.18em] text-gold/80">
        {title}
      </h3>
      <ol className="mt-6 flex flex-col gap-3 md:flex-row md:items-stretch md:gap-2">
        {steps.map((step, i) => (
          <li key={step} className="flex items-center gap-3 md:flex-1 md:flex-col md:items-start">
            <div className="flex w-full items-center gap-3 rounded-lg border border-atlas-line bg-obsidian-700 px-4 py-3 md:h-full">
              <span className="font-display text-sm text-gold">
                {String(i + 1).padStart(2, "0")}
              </span>
              <span className="text-sm font-medium text-ivory">{step}</span>
            </div>
            {i < steps.length - 1 && (
              <span className="hidden text-gold/50 md:inline" aria-hidden>
                →
              </span>
            )}
          </li>
        ))}
      </ol>
    </div>
  );
}
