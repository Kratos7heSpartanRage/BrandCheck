CREATE TABLE `policy_proposals` (
	`id` text PRIMARY KEY NOT NULL,
	`workspace_id` text NOT NULL,
	`base_version` integer NOT NULL,
	`payload` text NOT NULL,
	`state` text NOT NULL,
	`origin` text NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`workspace_id`) REFERENCES `workspaces`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `workspace_policies` (
	`workspace_id` text PRIMARY KEY NOT NULL,
	`version` integer NOT NULL,
	`payload` text NOT NULL,
	`mutation` text NOT NULL,
	FOREIGN KEY (`workspace_id`) REFERENCES `workspaces`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
ALTER TABLE `shared_drafts` ADD `findings` text DEFAULT '[]' NOT NULL;--> statement-breakpoint
ALTER TABLE `shared_drafts` ADD `policy_version` integer DEFAULT 0 NOT NULL;