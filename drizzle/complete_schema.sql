-- BrandCheck D1 SQL Initialization Script
-- Run this in Cloudflare D1 Console (Console tab of brandcheck-db)

CREATE TABLE IF NOT EXISTS `review_usage` (
	`bucket` text PRIMARY KEY NOT NULL,
	`count` integer DEFAULT 0 NOT NULL,
	`expires_at` integer NOT NULL
);

CREATE TABLE IF NOT EXISTS `workspaces` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`created_at` text NOT NULL
);

CREATE TABLE IF NOT EXISTS `memberships` (
	`workspace_id` text NOT NULL,
	`email` text NOT NULL,
	`role` text NOT NULL,
	PRIMARY KEY(`workspace_id`, `email`),
	FOREIGN KEY (`workspace_id`) REFERENCES `workspaces`(`id`) ON UPDATE no action ON DELETE no action
);

CREATE TABLE IF NOT EXISTS `audit_events` (
	`id` text PRIMARY KEY NOT NULL,
	`workspace_id` text NOT NULL,
	`draft_id` text,
	`actor_id` text NOT NULL,
	`actor_email` text NOT NULL,
	`action` text NOT NULL,
	`version` integer,
	`detail` text NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`workspace_id`) REFERENCES `workspaces`(`id`) ON UPDATE no action ON DELETE no action
);

CREATE TABLE IF NOT EXISTS `shared_drafts` (
	`id` text PRIMARY KEY NOT NULL,
	`workspace_id` text NOT NULL,
	`author_id` text NOT NULL,
	`title` text NOT NULL,
	`body` text NOT NULL,
	`version` integer NOT NULL,
	`state` text NOT NULL,
	`updated_at` text NOT NULL,
	`mutation` text NOT NULL,
	`findings` text DEFAULT '[]' NOT NULL,
	`policy_version` integer DEFAULT 0 NOT NULL,
	`document` text,
	`review_meta` text,
	`image` text,
	`reviewer_email` text,
	FOREIGN KEY (`workspace_id`) REFERENCES `workspaces`(`id`) ON UPDATE no action ON DELETE no action
);

CREATE TABLE IF NOT EXISTS `policy_proposals` (
	`id` text PRIMARY KEY NOT NULL,
	`workspace_id` text NOT NULL,
	`base_version` integer NOT NULL,
	`payload` text NOT NULL,
	`state` text NOT NULL,
	`origin` text NOT NULL,
	`created_at` text NOT NULL,
	`difference` text,
	FOREIGN KEY (`workspace_id`) REFERENCES `workspaces`(`id`) ON UPDATE no action ON DELETE no action
);

CREATE TABLE IF NOT EXISTS `workspace_policies` (
	`workspace_id` text PRIMARY KEY NOT NULL,
	`version` integer NOT NULL,
	`payload` text NOT NULL,
	`mutation` text NOT NULL,
	FOREIGN KEY (`workspace_id`) REFERENCES `workspaces`(`id`) ON UPDATE no action ON DELETE no action
);
