import Link from "next/link";
import { ACCENT_CLASS, type AccentKey } from "@/lib/site";

/* ---------------------------------- CTA ---------------------------------- */

type CTAVariant = "primary" | "outline" | "ghost";

export function CTAButton({
  href,
  children,
  variant = "primary",
  className = "",
}: {
  href: string;
  children: React.ReactNode;
  variant?: CTAVariant;
  className?: string;
}) {
  const base =
    "inline-flex items-center justify-center gap-2 rounded-md px-5 py-3 text-sm font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-gold/60";
  const styles: Record<CTAVariant, string> = {
    primary: "bg-gold text-obsidian hover:bg-gold-light",
    outline:
      "border border-gold/50 text-gold hover:bg-gold hover:text-obsidian",
    ghost:
      "text-ivory-muted hover:text-gold",
  };
  const internal = href.startsWith("/");
  const cls = `${base} ${styles[variant]} ${className}`;

  if (internal) {
    return (
      <Link href={href} className={cls}>
        {children}
      </Link>
    );
  }
  return (
    <a href={href} className={cls}>
      {children}
    </a>
  );
}

/* -------------------------------- Section -------------------------------- */

export function Section({
  children,
  className = "",
  id,
}: {
  children: React.ReactNode;
  className?: string;
  id?: string;
}) {
  return (
    <section id={id} className={`py-16 md:py-24 ${className}`}>
      <div className="container-content">{children}</div>
    </section>
  );
}

export function Eyebrow({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-3">
      <span className="h-px w-8 bg-gold/60" />
      <span className="eyebrow">{children}</span>
    </div>
  );
}

/* ------------------------------- Page header ------------------------------ */

export function MaturityBadge({
  label,
  accent = "gold",
}: {
  label: string;
  accent?: AccentKey;
}) {
  const a = ACCENT_CLASS[accent];
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium ${a.border} ${a.bg} ${a.text}`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${a.dot}`} />
      {label}
    </span>
  );
}

export function PageHeader({
  eyebrow,
  title,
  intro,
  coreMessage,
  accent = "gold",
  badge,
}: {
  eyebrow: string;
  title: string;
  intro?: string;
  coreMessage?: string;
  accent?: AccentKey;
  badge?: string;
}) {
  return (
    <header className="relative overflow-hidden border-b border-atlas-line bg-obsidian-900">
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.5]"
        style={{
          backgroundImage:
            "linear-gradient(rgba(184,146,74,0.05) 1px, transparent 1px), linear-gradient(90deg, rgba(184,146,74,0.05) 1px, transparent 1px)",
          backgroundSize: "56px 56px",
          maskImage:
            "radial-gradient(120% 80% at 0% 0%, black 30%, transparent 75%)",
        }}
      />
      <div className="container-content relative py-20 md:py-28">
        {badge && (
          <div className="mb-5">
            <MaturityBadge label={badge} accent={accent} />
          </div>
        )}
        <Eyebrow>{eyebrow}</Eyebrow>
        <h1 className="heading-xl mt-5 max-w-4xl text-ivory">{title}</h1>
        {intro && <p className="body-lead mt-6 max-w-2xl">{intro}</p>}
        {coreMessage && (
          <p
            className={`mt-8 max-w-2xl border-l-2 pl-4 font-display text-lg font-medium ${ACCENT_CLASS[accent].border} ${ACCENT_CLASS[accent].text}`}
          >
            {coreMessage}
          </p>
        )}
      </div>
    </header>
  );
}

/* -------------------------------- Bullets -------------------------------- */

export function CheckList({
  items,
  accent = "gold",
  columns = 1,
}: {
  items: string[];
  accent?: AccentKey;
  columns?: 1 | 2;
}) {
  return (
    <ul
      className={`grid gap-3 ${columns === 2 ? "sm:grid-cols-2" : ""}`}
    >
      {items.map((item) => (
        <li key={item} className="flex items-start gap-3">
          <span
            className={`mt-2 h-1.5 w-1.5 flex-shrink-0 rounded-full ${ACCENT_CLASS[accent].dot}`}
          />
          <span className="text-ivory-muted">{item}</span>
        </li>
      ))}
    </ul>
  );
}

/* ---------------------------- Feature / info card ------------------------- */

export function InfoCard({
  title,
  children,
  accent = "gold",
  index,
}: {
  title: string;
  children?: React.ReactNode;
  accent?: AccentKey;
  index?: number;
}) {
  return (
    <div className="group relative rounded-xl border border-atlas-line bg-obsidian-800 p-6 transition-colors hover:border-gold/30">
      {typeof index === "number" && (
        <span className={`font-display text-sm ${ACCENT_CLASS[accent].text}`}>
          {String(index).padStart(2, "0")}
        </span>
      )}
      <h3 className="heading-md mt-1 text-ivory">{title}</h3>
      {children && (
        <div className="mt-3 text-sm leading-relaxed text-atlas-grey">
          {children}
        </div>
      )}
    </div>
  );
}

/* -------------------------- CTA row (page footer) ------------------------- */

export function CTARow({
  ctas,
}: {
  ctas: { label: string; href: string; variant?: CTAVariant }[];
}) {
  return (
    <div className="flex flex-wrap gap-3">
      {ctas.map((c, i) => (
        <CTAButton
          key={c.label}
          href={c.href}
          variant={c.variant ?? (i === 0 ? "primary" : "outline")}
        >
          {c.label}
        </CTAButton>
      ))}
    </div>
  );
}
