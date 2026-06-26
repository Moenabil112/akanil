import Link from "next/link";

// Akanil mark — a stylized lotus/diamond with water-line motifs, echoing the
// official brand symbol (gold-on-dark primary version). Replace `mark` with the
// approved SVG asset when available; the wordmark stays as set type.
export function AkanilMark({ className = "h-7 w-7" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 64 64"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth="2.4"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {/* central diamond / lotus crown */}
      <path d="M32 6 L43 26 L32 40 L21 26 Z" />
      {/* lower lotus petals */}
      <path d="M21 30 L14 44 L32 52 L50 44 L43 30" />
      {/* water lines */}
      <path d="M10 22 C18 18 24 22 30 20" opacity="0.85" />
      <path d="M54 22 C46 18 40 22 34 20" opacity="0.85" />
      <path d="M12 34 C19 31 24 34 29 33" opacity="0.6" />
      <path d="M52 34 C45 31 40 34 35 33" opacity="0.6" />
    </svg>
  );
}

export function Logo({
  className = "",
  markClass,
}: {
  className?: string;
  markClass?: string;
}) {
  return (
    <Link
      href="/"
      className={`group inline-flex items-center gap-2.5 text-gold ${className}`}
      aria-label="Akanil — home"
    >
      <AkanilMark className={markClass ?? "h-8 w-8 text-gold"} />
      <span className="font-display text-lg font-semibold tracking-[0.18em] text-ivory transition-colors group-hover:text-gold">
        AKANIL
      </span>
    </Link>
  );
}
