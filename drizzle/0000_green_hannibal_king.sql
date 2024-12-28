CREATE TABLE `content_resource_tags` (
	`resource_id` text NOT NULL,
	`tag_id` text NOT NULL,
	`created_at` integer NOT NULL,
	PRIMARY KEY(`resource_id`, `tag_id`),
	FOREIGN KEY (`resource_id`) REFERENCES `content_resources`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`tag_id`) REFERENCES `tags`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `content_resources` (
	`id` text PRIMARY KEY NOT NULL,
	`type` text NOT NULL,
	`created_by_id` text NOT NULL,
	`fields` text,
	`current_version_id` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`deleted_at` integer
);
--> statement-breakpoint
CREATE TABLE `content_versions` (
	`id` text PRIMARY KEY NOT NULL,
	`resource_id` text NOT NULL,
	`content` text NOT NULL,
	`created_at` integer NOT NULL,
	`created_by_id` text NOT NULL,
	FOREIGN KEY (`resource_id`) REFERENCES `content_resources`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `tags` (
	`id` text PRIMARY KEY NOT NULL,
	`label` text NOT NULL,
	`created_at` integer NOT NULL
);
