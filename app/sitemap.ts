import type { MetadataRoute } from "next";
import { SITE, NAV } from "@/lib/site";
import { LEGAL_DOCS } from "@/lib/legal";

export default function sitemap(): MetadataRoute.Sitemap {
  const routes = [
    "/",
    "/zyntra/qassas",
    ...NAV.map((n) => n.href),
    "/legal",
    ...LEGAL_DOCS.map((d) => `/legal/${d.slug}`),
  ];
  const unique = Array.from(new Set(routes));
  const now = new Date();

  return unique.map((path) => ({
    url: `${SITE.url}${path === "/" ? "" : path}`,
    lastModified: now,
    changeFrequency: "monthly",
    priority: path === "/" ? 1 : path.startsWith("/legal") ? 0.3 : 0.7,
  }));
}
