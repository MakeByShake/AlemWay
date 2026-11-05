"use client";

import { defineConfig } from "sanity";
import { structureTool } from "sanity/structure";
import { visionTool } from "@sanity/vision";
import { apiVersion, dataset, projectId } from "./src/sanity/env";
import { schemaTypes } from "./src/sanity/schemaTypes";
import { structure } from "./src/sanity/structure";

export default defineConfig({
  name: "alemway",
  title: "AlemWay Visa — админка",
  basePath: "/studio",
  projectId: projectId || "missing",
  dataset,
  schema: {
    types: schemaTypes,
    // Settings is a single document: hide it from "create new".
    templates: (templates) => templates.filter((t) => t.schemaType !== "siteSettings" && t.schemaType !== "lead"),
  },
  document: {
    actions: (actions, ctx) => {
      if (ctx.schemaType === "siteSettings") {
        return actions.filter((a) => !["duplicate", "delete", "unpublish"].includes(a.action ?? ""));
      }
      // A duplicated lead would get a normal (public) _id, exposing client data. See api/lead.
      if (ctx.schemaType === "lead") return actions.filter((a) => a.action !== "duplicate");
      return actions;
    },
  },
  plugins: [structureTool({ structure }), visionTool({ defaultApiVersion: apiVersion })],
});
