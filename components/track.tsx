"use client";

import Link from "next/link";
import { track } from "@/lib/analytics/track";
import type { AnalyticsEvent } from "@/lib/analytics/events";

/** A Link that emits a (non-invasive) analytics event on click. */
export function TrackedLink({
  href,
  event,
  className,
  children,
}: {
  href: string;
  event: AnalyticsEvent;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <Link href={href} className={className} onClick={() => track(event)}>
      {children}
    </Link>
  );
}
