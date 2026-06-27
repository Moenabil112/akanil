import Link from "next/link";
import { REQUEST_STATUSES, REQUEST_STATUS_LABELS } from "@/lib/supabase/types";

// Search + status filter bar for request lists (GET form → searchParams).
export function RequestFilters({
  basePath,
  q,
  status,
}: {
  basePath: string;
  q?: string;
  status?: string;
}) {
  return (
    <form method="get" className="mb-5 flex flex-wrap items-end gap-3 rounded-xl border border-atlas-line bg-obsidian-800 p-4">
      <label className="text-xs text-atlas-grey">
        Search
        <input
          name="q"
          defaultValue={q ?? ""}
          placeholder="Name, email, or organization"
          className="mt-1 w-64 rounded-md border border-atlas-line bg-obsidian-900 px-2.5 py-1.5 text-sm text-ivory placeholder-atlas-grey/50 outline-none focus:border-gold/60"
        />
      </label>
      <label className="text-xs text-atlas-grey">
        Status
        <select
          name="status"
          defaultValue={status ?? ""}
          className="mt-1 w-44 rounded-md border border-atlas-line bg-obsidian-900 px-2.5 py-1.5 text-sm text-ivory outline-none focus:border-gold/60"
        >
          <option value="">All statuses</option>
          {REQUEST_STATUSES.map((s) => (
            <option key={s} value={s}>{REQUEST_STATUS_LABELS[s]}</option>
          ))}
        </select>
      </label>
      <button type="submit" className="rounded-md bg-gold px-4 py-2 text-sm font-semibold text-obsidian hover:bg-gold-light">
        Apply
      </button>
      <Link href={basePath} className="rounded-md border border-atlas-line px-4 py-2 text-sm text-ivory-muted hover:border-gold/40 hover:text-gold">
        Reset
      </Link>
    </form>
  );
}
