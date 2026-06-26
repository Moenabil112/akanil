import { defineType, defineField } from "sanity";

// Reusable content objects shared across the window documents.

export const seo = defineType({
  name: "seo",
  title: "SEO",
  type: "object",
  options: { collapsible: true, collapsed: true },
  fields: [
    defineField({ name: "metaTitle", title: "Meta title", type: "string" }),
    defineField({
      name: "metaDescription",
      title: "Meta description",
      type: "text",
      rows: 2,
      validation: (r) => r.max(180),
    }),
    defineField({ name: "ogImage", title: "Social image", type: "image" }),
  ],
});

export const ctaButton = defineType({
  name: "ctaButton",
  title: "CTA button",
  type: "object",
  fields: [
    defineField({
      name: "label",
      type: "string",
      validation: (r) => r.required(),
    }),
    defineField({
      name: "href",
      title: "Link",
      type: "string",
      validation: (r) => r.required(),
    }),
    defineField({
      name: "variant",
      type: "string",
      initialValue: "primary",
      options: {
        list: [
          { title: "Primary", value: "primary" },
          { title: "Outline", value: "outline" },
          { title: "Ghost", value: "ghost" },
        ],
        layout: "radio",
      },
    }),
  ],
  preview: { select: { title: "label", subtitle: "href" } },
});

export const featureItem = defineType({
  name: "featureItem",
  title: "Feature item",
  type: "object",
  fields: [
    defineField({
      name: "title",
      type: "string",
      validation: (r) => r.required(),
    }),
    defineField({ name: "body", type: "text", rows: 3 }),
  ],
  preview: { select: { title: "title", subtitle: "body" } },
});

export const pillar = defineType({
  name: "pillar",
  title: "Pillar",
  type: "object",
  fields: [
    defineField({
      name: "name",
      type: "string",
      validation: (r) => r.required(),
    }),
    defineField({
      name: "items",
      title: "Indicators / points",
      type: "array",
      of: [{ type: "string" }],
    }),
  ],
  preview: { select: { title: "name" } },
});

export const objectTypes = [seo, ctaButton, featureItem, pillar];
