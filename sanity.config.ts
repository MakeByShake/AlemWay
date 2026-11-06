"use client";

import { defineConfig } from "sanity";
import { structureTool } from "sanity/structure";
import { visionTool } from "@sanity/vision";
import { apiVersion, dataset, projectId } from "./src/sanity/env";
import { schemaTypes } from "./src/sanity/schemaTypes";
import { structure } from "./src/sanity/structure";
import { DeleteCabinetAction, NewLinkAction, OpenCabinetFromLeadAction, RegenerateDeclarationAction } from "./src/sanity/cabinet/actions";

// Leads and cabinets get private ids ("leads.…", "cabinets.…") from the server. Studio must never create or
// duplicate them, because a copy would get a normal id and become readable through the public API.
const SERVER_CREATED = ["lead", "cabinet", "feedback"];

export default defineConfig({
  name: "alemway",
  title: "AlemWay Visa — админка",
  basePath: "/studio",
  projectId: projectId || "missing",
  dataset,
  // Token login: lets the Studio prove the manager's identity to the site's /api/admin endpoints.
  auth: { loginMethod: "token" },
  schema: {
    types: schemaTypes,
    // Settings is a single document; leads and cabinets are created by the server only.
    templates: (templates) => templates.filter((t) => t.schemaType !== "siteSettings" && !SERVER_CREATED.includes(t.schemaType)),
  },
  document: {
    newDocumentOptions: (prev) => prev.filter((item) => !SERVER_CREATED.includes(item.templateId)),
    actions: (actions, ctx) => {
      if (ctx.schemaType === "siteSettings") {
        return actions.filter((a) => !["duplicate", "delete", "unpublish"].includes(a.action ?? ""));
      }
      if (ctx.schemaType === "lead") return [...actions.filter((a) => a.action !== "duplicate"), OpenCabinetFromLeadAction];
      if (ctx.schemaType === "cabinet") {
        // The built-in "Delete" would leave the client's files in storage — use the full delete instead.
        return [
          ...actions.filter((a) => a.action !== "duplicate" && a.action !== "delete"),
          NewLinkAction,
          RegenerateDeclarationAction,
          DeleteCabinetAction,
        ];
      }
      // Feedback is created by the server with a private id — a Studio copy would become public.
      if (ctx.schemaType === "feedback") return actions.filter((a) => a.action !== "duplicate");
      return actions;
    },
  },
  plugins: [structureTool({ structure }), visionTool({ defaultApiVersion: apiVersion })],
});
