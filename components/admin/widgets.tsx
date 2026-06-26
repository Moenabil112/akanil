import Link from "next/link";
import { updateStatusAction } from "@/app/admin/actions";
import { REQUEST_STATUSES, type RequestStatus } from "@/lib/supabase/types";

const STATUS_STYLE: Record<RequestStatus, string> = {
  pending: "border-gold/40 bg-gold/10 text-gold",
  in_review: "border-teal/40 bg-teal/10 text-teal-light",
  approved: "border-emerald/40 bg-emerald/10 text-emerald-light",
  declined: "border-copper/40 bg-copper/10 text-copper-light",
  closed: "border-atlas-line bg-obsidian-700 text-atlas-grey",
};

export function StatusBadge({ status }: { status: RequestStatus }) {
  return (
    <span
      className={`inline-flex rounded-full border px-2.5 py-0.5 text-xs font-medium capitalize ${STATUS_STYLE[status]}`}
    >
      {status.replace("_", " ")}
    </span>
  );
}

export function StatCard({
  label,
  value,
  href,
  accent = "gold",
}: {
  label: string;
  value: number | string;
  href?: string;
  accent?: "gold" | "teal" | "emerald" | "copper";
}) {
  const dot =
    accent === "teal"
      ? "bg-teal"
      : accent === "emerald"
        ? "bg-emerald"
        : accent === "copper"
          ? "bg-copper"
          : "bg-gold";
  const inner = (
    <div className="rounded-xl border border-atlas-line bg-obsidian-800 p-5 transition-colors hover:border-gold/30">
      <div className="flex items-center gap-2">
        <span className={`h-2 w-2 rounded-full ${dot}`} />
        <p className="text-xs uppercase tracking-[0.14em] text-atlas-grey">
          {label}
        </p>
      </div>
      <p className="mt-3 font-display text-3xl font-semibold text-ivory">{value}</p>
    </div>
  );
  return href ? <Link href={href}>{inner}</Link> : inner;
}

/** Inline status selector backed by a server action. */
export function StatusSelect({
  table,
  id,
  status,
  path,
}: {
  table: string;
  id: string;
  status: RequestStatus;
  path: string;
}) {
  return (
    <form action={updateStatusAction} className="inline-flex items-center gap-2">
      <input type="hidden" name="table" value={table} />
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="path" value={path} />
      <select
        name="status"
        defaultValue={status}
        className="rounded-md border border-atlas-line bg-obsidian-900 px-2.5 py-1.5 text-xs text-ivory outline-none focus:border-gold/60"
      >
        {REQUEST_STATUSES.map((s) => (
          <option key={s} value={s} className="bg-obsidian-800">
            {s.replace("_", " ")}
          </option>
        ))}
      </select>
      <button
        type="submit"
        className="rounded-md border border-gold/40 px-2.5 py-1.5 text-xs font-medium text-gold transition-colors hover:bg-gold hover:text-obsidian"
      >
        Save
      </button>
    </form>
  );
}

/** One-click approve / decline backed by the status server action. */
export function QuickStatus({
  table,
  id,
  path,
}: {
  table: string;
  id: string;
  path: string;
}) {
  return (
    <div className="flex gap-1.5">
      {(["approved", "declined"] as const).map((s) => (
        <form key={s} action={updateStatusAction}>
          <input type="hidden" name="table" value={table} />
          <input type="hidden" name="id" value={id} />
          <input type="hidden" name="path" value={path} />
          <input type="hidden" name="status" value={s} />
          <button
            type="submit"
            className={`rounded-md border px-2.5 py-1 text-xs font-medium transition-colors ${
              s === "approved"
                ? "border-emerald/40 text-emerald-light hover:bg-emerald hover:text-ivory"
                : "border-copper/40 text-copper-light hover:bg-copper hover:text-ivory"
            }`}
          >
            {s === "approved" ? "Approve" : "Decline"}
          </button>
        </form>
      ))}
    </div>
  );
}

export function EmptyState({ message }: { message: string }) {
  return (
    <div className="rounded-xl border border-dashed border-atlas-line bg-obsidian-800/50 p-10 text-center text-sm text-atlas-grey">
      {message}
    </div>
  );
}

/** Minimal table primitives. */
export function Table({ children }: { children: React.ReactNode }) {
  return (
    <div className="overflow-x-auto rounded-xl border border-atlas-line">
      <table className="w-full min-w-[640px] border-collapse text-left text-sm">
        {children}
      </table>
    </div>
  );
}

export function Th({ children }: { children: React.ReactNode }) {
  return (
    <th className="border-b border-atlas-line bg-obsidian-900 px-4 py-3 text-xs font-semibold uppercase tracking-[0.12em] text-atlas-grey">
      {children}
    </th>
  );
}

export function Td({ children }: { children: React.ReactNode }) {
  return (
    <td className="border-b border-atlas-line/60 px-4 py-3 align-top text-ivory-muted">
      {children}
    </td>
  );
}

export function formatDate(value: string | null): string {
  if (!value) return "—";
  return new Date(value).toLocaleString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}
