import { sanityFetch } from "./client";

export interface CmsInsight {
  title: string;
  slug: string;
  tag?: string;
  excerpt?: string;
}

export interface CmsWindowHero {
  title?: string;
  eyebrow?: string;
  heroIntro?: string;
  coreMessage?: string;
}

// Insights list (newest first).
export async function getInsights(): Promise<CmsInsight[] | null> {
  return sanityFetch<CmsInsight[]>(
    `*[_type == "insight"] | order(publishedAt desc){
      title, "slug": slug.current, tag, excerpt
    }`
  );
}

// Hero fields for a given window document type (e.g. "akanilPage").
export async function getWindowHero(type: string): Promise<CmsWindowHero | null> {
  return sanityFetch<CmsWindowHero>(
    `*[_type == $type][0]{ title, eyebrow, heroIntro, coreMessage }`,
    { type }
  );
}
