import Link from "next/link";
import { AkanilMark } from "./logo";
import { PRIMARY_NODES, DEFERRED_MODULES, NAV, SITE, DISCLAIMER } from "@/lib/site";

export function Footer() {
  const year = new Date().getFullYear();

  return (
    <footer className="border-t border-atlas-line bg-obsidian-900">
      <div className="container-content py-14">
        <div className="grid gap-10 md:grid-cols-2 lg:grid-cols-4">
          <div className="lg:col-span-1">
            <Link href="/" className="inline-flex items-center gap-2.5 text-gold">
              <AkanilMark className="h-9 w-9 text-gold" />
              <span className="font-display text-lg font-semibold tracking-[0.18em] text-ivory">
                AKANIL
              </span>
            </Link>
            <p className="mt-4 max-w-xs text-sm leading-relaxed text-atlas-grey">
              Akanil builds digital and institutional trust layers for mining,
              strategic minerals, and decision-ready mineral ecosystems.
            </p>
            <p className="mt-4 font-display text-sm font-medium tracking-wide text-gold">
              From Earth to Trust.
            </p>
          </div>

          <div>
            <h3 className="text-xs font-semibold uppercase tracking-[0.18em] text-ivory-muted">
              Ecosystem
            </h3>
            <ul className="mt-4 space-y-2.5">
              {[...PRIMARY_NODES, ...DEFERRED_MODULES].map((w) => (
                <li key={w.slug}>
                  <Link
                    href={w.href}
                    className="text-sm text-atlas-grey transition-colors hover:text-gold"
                  >
                    {w.name}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h3 className="text-xs font-semibold uppercase tracking-[0.18em] text-ivory-muted">
              Platform
            </h3>
            <ul className="mt-4 space-y-2.5">
              {NAV.filter((n) =>
                ["Founder", "Mustadam", "Insights", "Data Room", "Contact"].includes(
                  n.label
                )
              ).map((n) => (
                <li key={n.href}>
                  <Link
                    href={n.href}
                    className="text-sm text-atlas-grey transition-colors hover:text-gold"
                  >
                    {n.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h3 className="text-xs font-semibold uppercase tracking-[0.18em] text-ivory-muted">
              Strategic Geography
            </h3>
            <ul className="mt-4 space-y-2.5">
              {SITE.geographies.map((g) => (
                <li key={g} className="text-sm text-atlas-grey">
                  {g}
                </li>
              ))}
            </ul>
            <Link
              href="/data-room"
              className="mt-5 inline-block rounded-md border border-gold/50 px-4 py-2 text-sm font-medium text-gold transition-colors hover:bg-gold hover:text-obsidian"
            >
              Apply for Data Room Access
            </Link>
          </div>
        </div>

        <div className="mt-12 border-t border-atlas-line pt-6">
          <p className="max-w-4xl text-xs leading-relaxed text-atlas-grey/80">
            {DISCLAIMER}
          </p>
          <nav className="mt-5 flex flex-wrap gap-x-5 gap-y-2 text-xs text-atlas-grey/80">
            <Link href="/legal" className="hover:text-gold">Governance &amp; Legal</Link>
            <Link href="/legal/privacy" className="hover:text-gold">Privacy</Link>
            <Link href="/legal/terms" className="hover:text-gold">Terms</Link>
            <Link href="/legal/disclaimer" className="hover:text-gold">Disclaimer</Link>
            <Link href="/legal/data-room-terms" className="hover:text-gold">Data Room Terms</Link>
            <Link href="/legal/claims-disclosure" className="hover:text-gold">Claims &amp; Disclosure</Link>
          </nav>
          <div className="mt-5 flex flex-col items-start justify-between gap-3 text-xs text-atlas-grey/70 sm:flex-row sm:items-center">
            <span>© {year} Akanil. All rights reserved.</span>
            <span className="tracking-wide">
              Strategic Minerals · Mining Intelligence · Trust Governance
            </span>
          </div>
        </div>
      </div>
    </footer>
  );
}
