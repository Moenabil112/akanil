import Link from "next/link";

// Akanil mark — INTERIM faithful reproduction of the official gold lotus-and-waves
// emblem (central flame petal, lotus cup, flanking water lines), rendered as a
// vector so it inherits `currentColor` (gold-on-dark primary). This is NOT the
// final approved asset: drop the official Akanil SVG in `public/akanil-mark.svg`
// and this component's paths to swap it exactly with correct proportions.
export function AkanilMark({ className = "h-7 w-7" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 128 128"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth="4"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {/* central flame / crown petal */}
      <path d="M64 12 L84 52 L64 80 L44 52 Z" />
      {/* inner lotus petals */}
      <path d="M44 56 L34 88 L64 100 L94 88 L84 56" />
      <path d="M52 64 L64 84 L76 64" />
      {/* left wave / wing lines */}
      <path d="M20 40 C34 33 44 39 52 36" opacity="0.9" />
      <path d="M16 56 C32 49 42 55 50 52" opacity="0.6" />
      {/* right wave / wing lines */}
      <path d="M108 40 C94 33 84 39 76 36" opacity="0.9" />
      <path d="M112 56 C96 49 86 55 78 52" opacity="0.6" />
      {/* lotus base */}
      <path d="M40 96 L64 108 L88 96" opacity="0.85" />
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
