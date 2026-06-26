import Link from "next/link";

/**
 * Centralized Akanil logo — the single source of truth for the brand mark.
 *
 * To install the official asset, drop the file into `/public` (e.g.
 * `akanil-logo.svg`) and set `OFFICIAL_MARK_SRC` to its path below. That is the
 * ONLY change required anywhere in the app — every navbar, footer, admin, and
 * 404 usage routes through `AkanilMark`.
 *
 * Until then, `AkanilMark` renders an INTERIM hand-traced reproduction of the
 * gold lotus-and-waves emblem (central spearhead, faceted lotus, three-tier
 * water lines). It is NOT the approved vector and proportions are approximate.
 */
export const OFFICIAL_MARK_SRC: string | null = null; // e.g. "/akanil-logo.svg"

export function AkanilMark({ className = "h-7 w-7" }: { className?: string }) {
  if (OFFICIAL_MARK_SRC) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={OFFICIAL_MARK_SRC} alt="" aria-hidden className={className} />;
  }

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
      {/* central spearhead / crown petal */}
      <path d="M64 8 L78 40 L64 58 L50 40 Z" />
      {/* central blade descending into the lotus */}
      <path d="M56 52 L64 98 L72 52" />
      {/* faceted side lotus petals */}
      <path d="M50 62 L42 90 L60 98" />
      <path d="M78 62 L86 90 L68 98" />
      {/* faceted lotus base */}
      <path d="M40 90 L64 106 L88 90" opacity="0.9" />
      <path d="M52 96 L64 104 L76 96" opacity="0.7" />
      {/* three-tier water / wing lines — left */}
      <path d="M20 34 C34 27 46 32 55 33" opacity="0.95" />
      <path d="M14 52 C30 44 44 50 53 49" opacity="0.7" />
      <path d="M20 66 C34 60 46 64 53 63" opacity="0.5" />
      {/* three-tier water / wing lines — right */}
      <path d="M108 34 C94 27 82 32 73 33" opacity="0.95" />
      <path d="M114 52 C98 44 84 50 75 49" opacity="0.7" />
      <path d="M108 66 C94 60 82 64 75 63" opacity="0.5" />
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
