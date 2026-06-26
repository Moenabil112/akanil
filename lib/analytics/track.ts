"use client";

import type { AnalyticsEvent, AnalyticsProps } from "./events";

// Client-side, privacy-respecting event dispatch. Forwards to Plausible or
// PostHog if present on the page; otherwise no-ops (debug log in development).
// No cookies are set here and no cross-site identifiers are used.
export function track(event: AnalyticsEvent, props: AnalyticsProps = {}): void {
  if (typeof window === "undefined") return;
  const w = window as unknown as {
    plausible?: (e: string, opts?: { props?: AnalyticsProps }) => void;
    posthog?: { capture?: (e: string, p?: AnalyticsProps) => void };
  };
  try {
    if (typeof w.plausible === "function") {
      w.plausible(event, { props });
    } else if (w.posthog?.capture) {
      w.posthog.capture(event, props);
    } else if (process.env.NODE_ENV !== "production") {
      // eslint-disable-next-line no-console
      console.debug(`[analytics] ${event}`, props);
    }
  } catch {
    /* analytics must never break UX */
  }
}
