"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { NAV } from "@/lib/site";
import { Logo } from "./logo";

export function Navbar() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => setOpen(false), [pathname]);

  const isActive = (href: string) =>
    href === "/" ? pathname === "/" : pathname.startsWith(href);

  return (
    <header
      className={`sticky top-0 z-50 border-b transition-colors duration-300 ${
        scrolled
          ? "border-atlas-line bg-obsidian/90 backdrop-blur-md"
          : "border-transparent bg-obsidian/40 backdrop-blur-sm"
      }`}
    >
      <div className="container-content flex h-16 items-center justify-between gap-4">
        <Logo />

        <nav className="hidden items-center gap-0.5 lg:flex">
          {NAV.map((item) =>
            item.children ? (
              <div key={item.href} className="group relative">
                <Link
                  href={item.href}
                  className={`flex items-center gap-1 rounded-md px-2 py-2 text-[13px] transition-colors ${
                    isActive(item.href)
                      ? "text-gold"
                      : "text-ivory-muted hover:text-ivory"
                  }`}
                >
                  {item.label}
                  <svg
                    className="h-3 w-3 opacity-60"
                    viewBox="0 0 12 12"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.6"
                  >
                    <path d="M3 4.5 6 7.5 9 4.5" />
                  </svg>
                </Link>
                <div className="invisible absolute left-0 top-full min-w-[200px] translate-y-1 pt-2 opacity-0 transition-all duration-150 group-hover:visible group-hover:translate-y-0 group-hover:opacity-100">
                  <div className="overflow-hidden rounded-lg border border-atlas-line bg-obsidian-800 shadow-xl shadow-black/40">
                    {item.children.map((child) => (
                      <Link
                        key={child.href}
                        href={child.href}
                        className={`block px-4 py-2.5 text-sm transition-colors hover:bg-obsidian-700 ${
                          pathname === child.href
                            ? "text-gold"
                            : "text-ivory-muted hover:text-ivory"
                        }`}
                      >
                        {child.label}
                      </Link>
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              <Link
                key={item.href}
                href={item.href}
                className={`whitespace-nowrap rounded-md px-2 py-2 text-[13px] transition-colors ${
                  isActive(item.href)
                    ? "text-gold"
                    : "text-ivory-muted hover:text-ivory"
                }`}
              >
                {item.label}
              </Link>
            )
          )}
        </nav>

        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="inline-flex items-center justify-center rounded-md p-2 text-ivory lg:hidden"
          aria-label="Toggle navigation"
          aria-expanded={open}
        >
          <svg className="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
            {open ? (
              <path d="M6 6l12 12M18 6L6 18" />
            ) : (
              <path d="M4 7h16M4 12h16M4 17h16" />
            )}
          </svg>
        </button>
      </div>

      {open && (
        <div className="border-t border-atlas-line bg-obsidian-800 lg:hidden">
          <nav className="container-content flex flex-col py-3">
            {NAV.map((item) => (
              <div key={item.href}>
                <Link
                  href={item.href}
                  className={`block py-2.5 text-sm ${
                    isActive(item.href) ? "text-gold" : "text-ivory-muted"
                  }`}
                >
                  {item.label}
                </Link>
                {item.children && (
                  <div className="ml-4 border-l border-atlas-line pl-3">
                    {item.children.map((child) => (
                      <Link
                        key={child.href}
                        href={child.href}
                        className={`block py-2 text-sm ${
                          pathname === child.href ? "text-gold" : "text-atlas-grey"
                        }`}
                      >
                        {child.label}
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            ))}
            <Link
              href="/data-room"
              className="mt-3 rounded-md border border-gold/50 px-4 py-2.5 text-center text-sm font-medium text-gold"
            >
              Request Access
            </Link>
          </nav>
        </div>
      )}
    </header>
  );
}
