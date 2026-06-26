import { createClient, type SanityClient } from "@sanity/client";

// Read-only Sanity client for the public site. Returns null when the CMS env is
// not configured, so every consumer can fall back to static content.

export function isSanityConfigured(): boolean {
  return Boolean(process.env.NEXT_PUBLIC_SANITY_PROJECT_ID);
}

let cached: SanityClient | null = null;

function getClient(): SanityClient | null {
  if (!isSanityConfigured()) return null;
  if (!cached) {
    cached = createClient({
      projectId: process.env.NEXT_PUBLIC_SANITY_PROJECT_ID!,
      dataset: process.env.NEXT_PUBLIC_SANITY_DATASET || "production",
      apiVersion: "2024-09-01",
      useCdn: true,
      token: process.env.SANITY_API_READ_TOKEN,
    });
  }
  return cached;
}

/**
 * Fetch from Sanity, returning null on missing config or any error. Never
 * throws — callers render static fallback content when this resolves null.
 */
export async function sanityFetch<T>(
  query: string,
  params: Record<string, unknown> = {}
): Promise<T | null> {
  const client = getClient();
  if (!client) return null;
  try {
    return await client.fetch<T>(query, params);
  } catch (err) {
    console.error("[akanil] sanity fetch failed", err);
    return null;
  }
}
