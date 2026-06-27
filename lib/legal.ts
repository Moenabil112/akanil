// Governance / legal content registry. Every page is a PLACEHOLDER pending
// formal legal review before launch (see the banner rendered on each page).
// Copy is intentionally conservative and claims-controlled.

export interface LegalDoc {
  slug: string;
  title: string;
  summary: string;
  sections: { heading: string; body: string[] }[];
}

export const LEGAL_DOCS: LegalDoc[] = [
  {
    slug: "privacy",
    title: "Privacy Policy",
    summary:
      "How Akanil collects, uses, and protects information submitted through the platform.",
    sections: [
      {
        heading: "Information we collect",
        body: [
          "Akanil collects the information you submit through institutional forms — including name, work email, organization, role, and the context of your request — to review and respond to institutional enquiries.",
          "We collect limited technical information (such as access logs for the controlled data room) to operate the platform securely.",
        ],
      },
      {
        heading: "How we use information",
        body: [
          "Information is used to review access requests, deliver institutional briefings, manage controlled data room access, and maintain a traceable, governed process.",
          "We do not sell personal data. Information is shared only within the review workflow and with service providers necessary to operate the platform.",
        ],
      },
      {
        heading: "Data retention and your rights",
        body: [
          "Records are retained as required to manage institutional relationships and meet legal obligations. You may request access to, correction of, or deletion of your information, subject to applicable law.",
        ],
      },
    ],
  },
  {
    slug: "terms",
    title: "Terms of Use",
    summary: "The terms governing use of the Akanil platform.",
    sections: [
      {
        heading: "Acceptance",
        body: [
          "By accessing the Akanil platform you agree to these Terms of Use. If you do not agree, do not use the platform.",
        ],
      },
      {
        heading: "Permitted use",
        body: [
          "The platform is provided for institutional communication and controlled access to information. You agree not to misuse the platform, attempt to access non-permitted areas, or circumvent access controls.",
        ],
      },
      {
        heading: "No offer",
        body: [
          "Nothing on this platform constitutes a public offering, investment solicitation, or financial recommendation. See the Disclaimer and the Claims & Disclosure Policy.",
        ],
      },
    ],
  },
  {
    slug: "disclaimer",
    title: "Disclaimer",
    summary: "Important limitations on the information presented by Akanil.",
    sections: [
      {
        heading: "General information only",
        body: [
          "Information presented on this website is for general institutional communication purposes only. It should not be considered a public offering, investment solicitation, reserve statement, technical report, or financial recommendation.",
          "Project-specific information may require formal engagement, NDA, and independent review.",
        ],
      },
      {
        heading: "Forward-looking statements",
        body: [
          "Concepts, frameworks, and potential described on the platform are forward-looking and subject to validation. They do not represent commitments or guaranteed outcomes.",
        ],
      },
    ],
  },
  {
    slug: "cookies",
    title: "Cookie Notice",
    summary: "How Akanil uses cookies and similar technologies.",
    sections: [
      {
        heading: "Essential cookies",
        body: [
          "Akanil uses strictly necessary cookies to operate authenticated sessions and the controlled data room. These are required for the platform to function.",
        ],
      },
      {
        heading: "Analytics",
        body: [
          "Where enabled, Akanil uses privacy-respecting, non-invasive analytics that do not rely on cross-site tracking cookies. Analytics are disabled unless explicitly configured.",
        ],
      },
    ],
  },
  {
    slug: "ip",
    title: "Intellectual Property Notice",
    summary: "Ownership of Akanil names, marks, and materials.",
    sections: [
      {
        heading: "Ownership",
        body: [
          "Akanil, ZYNTRA Deeptech, QASSAS, HYRION, Atlas Mining, and Amusnaw AI names, marks, content, and materials are the property of their respective owners and may not be used without authorization.",
        ],
      },
      {
        heading: "Restricted materials",
        body: [
          "Documents made available through the controlled data room remain the property of their owners and are shared under confidentiality terms. They may not be copied, redistributed, or disclosed without permission.",
        ],
      },
    ],
  },
  {
    slug: "data-room-terms",
    title: "Data Room Access Terms",
    summary: "Terms governing access to the controlled data room.",
    sections: [
      {
        heading: "Controlled access",
        body: [
          "Access to the Akanil data room is granted on a controlled, per-window, per-level basis after review and, where required, an approved NDA.",
          "Access may be time-limited and may be revoked at any time. All access and downloads are logged.",
        ],
      },
      {
        heading: "Confidentiality",
        body: [
          "Materials in the NDA data room and higher layers are confidential. By accessing them you agree to handle them in accordance with the applicable confidentiality agreement.",
        ],
      },
    ],
  },
  {
    slug: "nda-process",
    title: "NDA Process Note",
    summary: "How the NDA workflow operates within Akanil.",
    sections: [
      {
        heading: "NDA states",
        body: [
          "The NDA workflow progresses through pending, sent, signed, and approved states. NDA-level and higher documents are accessible only when NDA status is approved.",
        ],
      },
      {
        heading: "Process",
        body: [
          "After an access request is reviewed, where confidential materials are involved, an NDA is issued. Once executed and approved, the relevant window access level is granted.",
        ],
      },
    ],
  },
  {
    slug: "claims-disclosure",
    title: "Claims & Disclosure Policy",
    summary: "How Akanil controls claims about assets, technology, and impact.",
    sections: [
      {
        heading: "Mineral claims",
        body: [
          "Akanil does not claim mineral reserves or resources unless supported by independent technical reports prepared under recognized reporting standards.",
        ],
      },
      {
        heading: "Technology and sustainability",
        body: [
          "Technology capabilities are described at a conceptual or framework level unless otherwise substantiated. Sustainability impact is presented as a development philosophy and framework; quantified impact claims are made only where supported by metrics and evidence.",
        ],
      },
      {
        heading: "Market references",
        body: [
          "Mineral market and value references are indicative only and should not be treated as final asset valuations.",
        ],
      },
    ],
  },
  {
    slug: "qassas-disclosure",
    title: "QASSAS Disclosure Note",
    summary: "How QASSAS is presented and protected.",
    sections: [
      {
        heading: "Product positioning",
        body: [
          "QASSAS is an active mining intelligence product managed by ZYNTRA Deeptech. It is presented as a product showcase without exposing sensitive internal systems, models, or data.",
        ],
      },
      {
        heading: "Demo access",
        body: [
          "QASSAS demo access is separated from public website access and follows a controlled, approved workflow. Demonstrations are provided in a controlled environment only.",
        ],
      },
    ],
  },
];

export function getLegalDoc(slug: string): LegalDoc | undefined {
  return LEGAL_DOCS.find((d) => d.slug === slug);
}
