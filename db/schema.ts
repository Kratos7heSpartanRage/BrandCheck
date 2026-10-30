// Intentionally empty by default.
// Add Drizzle tables here when the site actually needs a database.
// See examples/d1/db/schema.ts for an opt-in example.
import { integer, sqliteTable, text, primaryKey } from "drizzle-orm/sqlite-core";
export const reviewUsage = sqliteTable("review_usage", {
  bucket: text("bucket").primaryKey(),
  count: integer("count").notNull().default(0),
  expiresAt: integer("expires_at").notNull(),
});

export const workspaces = sqliteTable("workspaces", {
  id: text("id").primaryKey(), name: text("name").notNull(), createdAt: text("created_at").notNull(),
});
export const memberships = sqliteTable("memberships", {
  workspaceId: text("workspace_id").notNull().references(() => workspaces.id),
  email: text("email").notNull(), role: text("role").notNull(),
}, table => [primaryKey({ columns: [table.workspaceId, table.email] })]);
export const sharedDrafts = sqliteTable("shared_drafts", {
  id: text("id").primaryKey(), workspaceId: text("workspace_id").notNull().references(() => workspaces.id),
  authorId: text("author_id").notNull(), title: text("title").notNull(), body: text("body").notNull(),
  version: integer("version").notNull(), state: text("state").notNull(), updatedAt: text("updated_at").notNull(),
  mutation: text("mutation").notNull(),
  findings: text("findings").notNull().default("[]"),
  policyVersion: integer("policy_version").notNull().default(0),
  document: text("document"),
  reviewMeta: text("review_meta"),
});
export const workspacePolicies = sqliteTable("workspace_policies", {
  workspaceId: text("workspace_id").primaryKey().references(() => workspaces.id),
  version: integer("version").notNull(), payload: text("payload").notNull(), mutation: text("mutation").notNull(),
});
export const policyProposals = sqliteTable("policy_proposals", {
  id: text("id").primaryKey(), workspaceId: text("workspace_id").notNull().references(() => workspaces.id),
  baseVersion: integer("base_version").notNull(), payload: text("payload").notNull(),
  state: text("state").notNull(), origin: text("origin").notNull(), createdAt: text("created_at").notNull(),
  difference: text("difference"),
});
export const auditEvents = sqliteTable("audit_events", {
  id: text("id").primaryKey(), workspaceId: text("workspace_id").notNull().references(() => workspaces.id),
  draftId: text("draft_id"), actorId: text("actor_id").notNull(), actorEmail: text("actor_email").notNull(),
  action: text("action").notNull(), version: integer("version"), detail: text("detail").notNull(),
  createdAt: text("created_at").notNull(),
});
