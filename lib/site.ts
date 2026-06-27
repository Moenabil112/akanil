// Akanil — single source of truth for the ecosystem model, navigation, and
// shared copy. The ecosystem is presented as a connected institutional system:
// AKANIL at the center, a primary ring of five layers around it, and Amusnaw AI
// as a deferred/extended module. The Founder is a separate leadership identity,
// NOT an ecosystem node.

export const SITE = {
  name: "Akanil",
  title: "AKANIL TRUST ARCHITECTURE",
  supporting:
    "Mining Intelligence, Governance, Field Evidence & Sustainable Impact",
  tagline: "From Earth to Trust.",
  extendedTagline: "From Mineral Data to Institutional Decision.",
  description:
    "Akanil is a strategic minerals and trust architecture house connecting AI infrastructure, mining intelligence products, evidence governance, field portfolios, and sustainable impact across an institutional ecosystem.",
  url: process.env.NEXT_PUBLIC_SITE_URL || "https://akanil.com",
  geographies: ["Morocco", "Sudan", "Saudi Arabia"],
} as const;

export type AccentKey = "gold" | "copper" | "teal" | "emerald";

export interface EcosystemNode {
  slug: string;
  href: string;
  name: string;
  nameAr?: string;
  label: string; // short label
  role: string; // role within the ecosystem
  note?: string; // e.g. "A ZYNTRA Product"
  accent: AccentKey;
}

// The center of the ecosystem.
export const CENTER_NODE = {
  name: "Akanil",
  href: "/",
  role: "Trust Architecture",
} as const;

// Primary ring — the five core layers around Akanil.
export const PRIMARY_NODES: EcosystemNode[] = [
  {
    slug: "zyntra",
    href: "/zyntra",
    name: "ZYNTRA Deeptech",
    label: "ZYNTRA",
    role: "AI Infrastructure & Automation Layer",
    accent: "teal",
  },
  {
    slug: "qassas",
    href: "/zyntra/qassas",
    name: "QASSAS",
    label: "QASSAS",
    role: "Mining Intelligence Operating Product",
    note: "A ZYNTRA Product",
    accent: "copper",
  },
  {
    slug: "hyrion",
    href: "/hyrion",
    name: "HYRION",
    label: "HYRION",
    role: "Evidence, Governance & Data Room Layer",
    accent: "teal",
  },
  {
    slug: "atlas",
    href: "/atlas-mining",
    name: "ATLAS Golden Mining",
    label: "Atlas Golden Mining",
    role: "Mining Portfolio / Field Use Case Layer",
    accent: "copper",
  },
  {
    slug: "mustadam",
    href: "/sustainability",
    name: "Mustadam",
    nameAr: "مُستدام",
    label: "Mustadam",
    role: "Sustainability & Local Impact Layer",
    accent: "emerald",
  },
];

// Deferred / extended modules — present but not part of the primary system map.
export const DEFERRED_MODULES: EcosystemNode[] = [
  {
    slug: "amusnaw-ai",
    href: "/amusnaw-ai",
    name: "Amusnaw AI",
    label: "Amusnaw AI",
    role: "Morocco Intelligence Layer · Extended Ecosystem",
    note: "Deferred Module",
    accent: "emerald",
  },
];

// The ordered relationship flow across the ecosystem.
export const RELATIONSHIP_FLOW = [
  { label: "ATLAS Golden Mining", sub: "Field / portfolio", href: "/atlas-mining" },
  { label: "QASSAS", sub: "Mining intelligence", href: "/zyntra/qassas" },
  { label: "HYRION", sub: "Evidence & governance", href: "/hyrion" },
  { label: "Institutional Review / Data Room", sub: "Controlled access", href: "/data-room" },
  { label: "Mustadam", sub: "Sustainable impact", href: "/sustainability" },
] as const;

export interface NavItem {
  label: string;
  href: string;
  children?: { label: string; href: string }[];
}

// Primary navigation reflecting the ecosystem-first experience.
export const NAV: NavItem[] = [
  { label: "Ecosystem", href: "/" },
  { label: "ZYNTRA", href: "/zyntra" },
  { label: "QASSAS", href: "/zyntra/qassas" },
  { label: "HYRION", href: "/hyrion" },
  { label: "ATLAS GM", href: "/atlas-mining" }, // nav-only short label; page title stays "ATLAS Golden Mining"
  { label: "Mustadam", href: "/sustainability" },
  { label: "Data Room", href: "/data-room" },
  { label: "Founder", href: "/founder" },
  { label: "Insights", href: "/insights" },
  { label: "Contact", href: "/contact" },
  {
    label: "More",
    href: "/amusnaw-ai",
    children: [
      { label: "Amusnaw AI — Extended Ecosystem", href: "/amusnaw-ai" },
      { label: "About Akanil", href: "/akanil" },
    ],
  },
];

export const REQUEST_TYPES = [
  "Institutional Briefing",
  "Technical Review",
  "Product Brief",
  "Data Room Access",
  "Strategic Conversation",
  "QASSAS Demo / Product Brief",
] as const;

export const ACCENT_CLASS: Record<
  AccentKey,
  { text: string; border: string; bg: string; dot: string; line: string }
> = {
  gold: {
    text: "text-gold",
    border: "border-gold/40",
    bg: "bg-gold/10",
    dot: "bg-gold",
    line: "stroke-gold/40",
  },
  copper: {
    text: "text-copper-light",
    border: "border-copper/40",
    bg: "bg-copper/10",
    dot: "bg-copper",
    line: "stroke-copper/40",
  },
  teal: {
    text: "text-teal-light",
    border: "border-teal/40",
    bg: "bg-teal/10",
    dot: "bg-teal",
    line: "stroke-teal/40",
  },
  emerald: {
    text: "text-emerald-light",
    border: "border-emerald/40",
    bg: "bg-emerald/10",
    dot: "bg-emerald",
    line: "stroke-emerald/40",
  },
};

export const DISCLAIMER =
  "Information presented on this website is for general institutional communication purposes only. It should not be considered a public offering, investment solicitation, reserve statement, technical report, or financial recommendation. Project-specific information may require formal engagement, NDA, and independent review.";
