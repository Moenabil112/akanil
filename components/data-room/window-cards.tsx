import Link from "next/link";
import { ACCESS_LEVELS, type AccessLevel } from "@/lib/supabase/types";

export interface WindowAccessView {
  slug: string;
  label: string;
  grantedLevel: AccessLevel | null;
  hasAccess: boolean;
}

function levelLabel(value: AccessLevel | null) {
  if (!value) return "No access";
  return ACCESS_LEVELS.find((l) => l.value === value)?.label ?? value;
}

export function WindowAccessCards({ windows }: { windows: WindowAccessView[] }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {windows.map((w) => (
        <div
          key={w.slug}
          className={`rounded-xl border bg-obsidian-800 p-5 transition-colors ${
            w.hasAccess ? "border-atlas-line hover:border-teal/40" : "border-atlas-line/60"
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-ivory">{w.label}</span>
            {w.hasAccess ? (
              <span className="rounded-full border border-teal/40 bg-teal/10 px-2 py-0.5 text-[11px] text-teal-light">
                {levelLabel(w.grantedLevel)}
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 rounded-full border border-atlas-line bg-obsidian-700 px-2 py-0.5 text-[11px] text-atlas-grey">
                <LockIcon /> Locked
              </span>
            )}
          </div>

          <div className="mt-5">
            {w.hasAccess ? (
              <Link
                href={`/data-room/${w.slug}`}
                className="text-sm font-medium text-gold hover:underline"
              >
                Enter window →
              </Link>
            ) : (
              <Link
                href={`/data-room/access-control?window=${encodeURIComponent(w.label)}`}
                className="text-sm font-medium text-atlas-grey hover:text-gold"
              >
                Request access →
              </Link>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

function LockIcon() {
  return (
    <svg className="h-3 w-3" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4">
      <rect x="3.5" y="7" width="9" height="6.5" rx="1.2" />
      <path d="M5.5 7V5a2.5 2.5 0 0 1 5 0v2" />
    </svg>
  );
}
