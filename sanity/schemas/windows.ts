import { defineType, defineField, type FieldDefinition } from "sanity";

// Factory for a public window page document type. Every window shares a base
// field set (hero, body, CTAs, SEO) and adds its own structured fields. This
// keeps the eight window schemas DRY while remaining distinct document types.
function windowPage(
  name: string,
  title: string,
  extraFields: FieldDefinition[] = []
) {
  return defineType({
    name,
    title,
    type: "document",
    groups: [
      { name: "content", title: "Content", default: true },
      { name: "structured", title: "Structured" },
      { name: "seo", title: "SEO" },
    ],
    fields: [
      defineField({
        name: "title",
        title: "Page title",
        type: "string",
        group: "content",
        validation: (r) => r.required(),
      }),
      defineField({
        name: "slug",
        type: "slug",
        group: "content",
        options: { source: "title", maxLength: 96 },
        validation: (r) => r.required(),
      }),
      defineField({ name: "eyebrow", type: "string", group: "content" }),
      defineField({
        name: "heroIntro",
        title: "Hero intro",
        type: "text",
        rows: 3,
        group: "content",
      }),
      defineField({
        name: "coreMessage",
        title: "Core message",
        type: "text",
        rows: 2,
        group: "content",
      }),
      defineField({
        name: "body",
        title: "Body",
        type: "array",
        group: "content",
        of: [{ type: "block" }, { type: "featureItem" }],
      }),
      ...extraFields,
      defineField({
        name: "ctas",
        title: "Call to action buttons",
        type: "array",
        group: "structured",
        of: [{ type: "ctaButton" }],
      }),
      defineField({ name: "seo", type: "seo", group: "seo" }),
    ],
    preview: { select: { title: "title", subtitle: "eyebrow" } },
  });
}

const strList = (name: string, title: string) =>
  defineField({
    name,
    title,
    type: "array",
    group: "structured",
    of: [{ type: "string" }],
  });

// The eight structured windows (Insights is a separate article type).
export const windowTypes = [
  windowPage("akanilPage", "Akanil (Window)", [
    strList("trustPathway", "Trust pathway steps"),
    strList("whatAkanilOrganizes", "What Akanil organizes"),
  ]),

  windowPage("founderPage", "Founder (Window)", [
    defineField({ name: "founderName", type: "string", group: "structured" }),
    defineField({
      name: "statement",
      title: "Founder statement",
      type: "text",
      rows: 4,
      group: "structured",
    }),
    strList("focusAreas", "Focus areas"),
  ]),

  windowPage("atlasMiningPage", "Atlas Mining (Window)", [
    strList("operatingFocus", "Operating focus"),
    strList("evidenceLayer", "Evidence layer"),
    defineField({
      name: "mobileProcessing",
      title: "Mobile processing concept",
      type: "text",
      rows: 3,
      group: "structured",
    }),
  ]),

  windowPage("hyrionPage", "HYRION (Window)", [
    strList("organizes", "What HYRION organizes"),
    strList("dataRoomLayers", "Data room layers"),
    defineField({
      name: "accessModel",
      title: "Access model",
      type: "array",
      group: "structured",
      of: [{ type: "featureItem" }],
    }),
  ]),

  windowPage("zyntraPage", "ZYNTRA Deeptech (Window)", [
    strList("monitors", "What ZYNTRA monitors"),
    strList("fuelCostIntelligence", "Fuel & cost intelligence"),
    strList("deploymentSteps", "Deployment model"),
  ]),

  windowPage("qassasPage", "QASSAS (Window)", [
    strList("keySections", "Key sections"),
    strList("miningOsViews", "Mining OS views"),
    defineField({
      name: "useCase",
      title: "Current use case",
      type: "text",
      rows: 3,
      group: "structured",
    }),
    defineField({
      name: "ownership",
      title: "Ownership & governance",
      type: "array",
      group: "structured",
      of: [{ type: "featureItem" }],
    }),
  ]),

  windowPage("amusnawAiPage", "Amusnaw AI (Window)", [
    strList("whyMorocco", "Why Morocco"),
    strList("coreModules", "Core modules"),
    strList("minerals", "Mineral value intelligence"),
    defineField({
      name: "coreCases",
      title: "Core cases",
      type: "array",
      group: "structured",
      of: [{ type: "featureItem" }],
    }),
  ]),

  windowPage("sustainabilityPage", "Sustainability (Window)", [
    defineField({
      name: "definition",
      title: "Sustainability definition",
      type: "text",
      rows: 3,
      group: "structured",
    }),
    defineField({
      name: "pillars",
      title: "Impact pillars",
      type: "array",
      group: "structured",
      of: [{ type: "pillar" }],
    }),
  ]),
];
