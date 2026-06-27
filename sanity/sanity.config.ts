import { defineConfig } from "sanity";
import { structureTool } from "sanity/structure";
import { visionTool } from "@sanity/vision";
import { schemaTypes } from "./schemas";
import { projectId, dataset } from "./env";

// Akanil Sanity Studio. Run with `npm install && npm run dev` inside /sanity.
// Set SANITY_STUDIO_PROJECT_ID (or reuse NEXT_PUBLIC_SANITY_PROJECT_ID).
export default defineConfig({
  name: "akanil",
  title: "Akanil Studio",
  projectId,
  dataset,
  plugins: [structureTool(), visionTool()],
  schema: { types: schemaTypes },
});
