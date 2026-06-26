import Link from "next/link";
import { ACCENT_CLASS, type WindowDef } from "@/lib/site";

export function WindowCard({ window }: { window: WindowDef }) {
  const accent = ACCENT_CLASS[window.accent];
  return (
    <Link
      href={window.href}
      className="group relative flex flex-col overflow-hidden rounded-xl border border-atlas-line bg-obsidian-800 p-6 transition-all duration-300 hover:-translate-y-1 hover:border-gold/30 hover:bg-obsidian-700"
    >
      <span
        className={`absolute left-0 top-0 h-full w-0.5 ${accent.dot} opacity-50 transition-opacity group-hover:opacity-100`}
      />
      <div className="flex items-center gap-2">
        <span className={`h-2 w-2 rounded-full ${accent.dot}`} />
        <span className={`text-xs font-medium uppercase tracking-[0.16em] ${accent.text}`}>
          Digital Window
        </span>
      </div>
      <h3 className="heading-md mt-3 text-ivory">{window.name}</h3>
      <p className="mt-3 flex-1 text-sm leading-relaxed text-atlas-grey">
        {window.oneLine}
      </p>
      <span className="mt-5 inline-flex items-center gap-1.5 text-sm font-medium text-gold">
        Enter window
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
