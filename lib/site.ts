// Akanil — single source of truth for site metadata, navigation, and the
// digital windows ecosystem. Content is drawn from the Akanil Website Copy Pack.

export const SITE = {
  name: "Akanil",
  tagline: "From Earth to Trust.",
  extendedTagline: "From Mineral Data to Institutional Decision.",
  description:
    "Akanil is a strategic minerals and trust architecture house connecting field intelligence, mineral data, governance, AI-enabled mining concepts, and institutional readiness across Morocco, Sudan, and Saudi Arabia.",
  url: process.env.NEXT_PUBLIC_SITE_URL || "https://akanil.com",
  geographies: ["Morocco", "Sudan", "Saudi Arabia"],
} as const;

export type AccentKey = "gold" | "copper" | "teal" | "emerald";

export interface WindowDef {
  slug: string;
  href: string;
  name: string;
  label: string; // short nav label
  oneLine: string;
  accent: AccentKey;
  ecosystem?: boolean; // shown in the ecosystem grid
}

// The connected digital windows of the Akanil ecosystem.
export const WINDOWS: WindowDef[] = [
  {
    slug: "akanil",
    href: "/akanil",
    name: "Akanil",
    label: "Akanil",
    oneLine: "The parent trust and strategic minerals architecture.",
    accent: "gold",
    ecosystem: true,
  },
  {
    slug: "atlas-mining",
    href: "/atlas-mining",
    name: "Atlas Mining",
    label: "Atlas Mining",
    oneLine:
      "The field-operating proof layer for copper development and mobile processing concepts.",
    accent: "copper",
    ecosystem: true,
  },
  {
    slug: "hyrion",
    href: "/hyrion",
    name: "HYRION",
    label: "HYRION",
    oneLine: "The governance, evidence, and data room layer.",
    accent: "teal",
    ecosystem: true,
  },
  {
    slug: "zyntra",
    href: "/zyntra",
    name: "ZYNTRA Deeptech",
    label: "ZYNTRA",
    oneLine: "The mining operations intelligence and plant optimization layer.",
    accent: "teal",
    ecosystem: true,
  },
  {
    slug: "amusnaw-ai",
    href: "/amusnaw-ai",
    name: "Amusnaw AI",
    label: "Amusnaw AI",
    oneLine: "The Moroccan smart mining intelligence infrastructure concept.",
    accent: "emerald",
    ecosystem: true,
  },
];

export const QASSAS = {
  slug: "qassas",
  href: "/zyntra/qassas",
  name: "QASSAS",
  oneLine:
    "A ZYNTRA product showcase — a local experimental operating system for mining operations management.",
  accent: "teal" as AccentKey,
};

// Primary navigation (Recommended Main Navigation from the Copy Pack).
export interface NavItem {
  label: string;
  href: string;
  children?: { label: string; href: string }[];
}

export const NAV: NavItem[] = [
  { label: "Akanil", href: "/akanil" },
  { label: "Founder", href: "/founder" },
  { label: "Atlas Mining", href: "/atlas-mining" },
  { label: "HYRION", href: "/hyrion" },
  {
    label: "ZYNTRA",
    href: "/zyntra",
    children: [
      { label: "ZYNTRA Deeptech", href: "/zyntra" },
      { label: "QASSAS", href: "/zyntra/qassas" },
    ],
  },
  { label: "Amusnaw AI", href: "/amusnaw-ai" },
  { label: "Sustainability", href: "/sustainability" },
  { label: "Insights", href: "/insights" },
  { label: "Data Room", href: "/data-room" },
  { label: "Contact", href: "/contact" },
];

// Request types used across access request / contact forms.
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
  { text: string; border: string; bg: string; dot: string }
> = {
  gold: {
    text: "text-gold",
    border: "border-gold/40",
    bg: "bg-gold/10",
    dot: "bg-gold",
  },
  copper: {
    text: "text-copper-light",
    border: "border-copper/40",
    bg: "bg-copper/10",
    dot: "bg-copper",
  },
  teal: {
    text: "text-teal-light",
    border: "border-teal/40",
    bg: "bg-teal/10",
    dot: "bg-teal",
  },
  emerald: {
    text: "text-emerald-light",
    border: "border-emerald/40",
    bg: "bg-emerald/10",
    dot: "bg-emerald",
  },
};

export const DISCLAIMER =
  "Information presented on this website is for general institutional communication purposes only. It should not be considered a public offering, investment solicitation, reserve statement, technical report, or financial recommendation. Project-specific information may require formal engagement, NDA, and independent review.";
