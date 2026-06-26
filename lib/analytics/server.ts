import "server-only";
import type { AnalyticsEvent, AnalyticsProps } from "./events";

function configured(): boolean {
  return Boolean(
    process.env.NEXT_PUBLIC_PLAUSIBLE_DOMAIN ||
      process.env.NEXT_PUBLIC_POSTHOG_KEY
  );
}

/**
 * Record a server-side analytics event (signed-URL decisions, admin actions,
 * access changes). Non-invasive: no PII beyond non-identifying properties. When
 * no provider is configured this is a development log only.
 */
export async function track(
  event: AnalyticsEvent,
  props: AnalyticsProps = {}
): Promise<void> {
  if (!configured()) {
    if (process.env.NODE_ENV !== "production") {
      console.debug(`[analytics] ${event}`, props);
    }
    return;
  }
  // Provider-specific server dispatch can be added here (e.g. PostHog capture).
  // Intentionally left as a no-op network call until a provider is wired.
}
