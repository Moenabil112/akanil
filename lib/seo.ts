import type { Metadata } from "next";
import { SITE } from "./site";

/**
 * Build consistent per-page metadata: title, description, canonical, Open Graph,
 * and Twitter card. Claims are controlled at the call site — pass approved copy.
 */
export function pageMeta({
  title,
  description,
  path,
  noindex,
}: {
  title: string;
  description: string;
  path: string;
  noindex?: boolean;
}): Metadata {
  const canonical = path === "/" ? "/" : path;
  return {
    title,
    description,
    alternates: { canonical },
    openGraph: {
      title: `${title} — ${SITE.name}`,
      description,
      url: canonical,
      siteName: SITE.name,
      type: "website",
    },
    twitter: {
      card: "summary_large_image",
      title: `${title} — ${SITE.name}`,
      description,
    },
    robots: noindex ? { index: false, follow: false } : undefined,
  };
}
