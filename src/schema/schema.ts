import { integer, primaryKey, sqliteTable, text } from 'drizzle-orm/sqlite-core'
import { relations } from 'drizzle-orm'

export const contentResources = sqliteTable('content_resources', {
	id: text('id').primaryKey(),
	type: text('type').notNull(),
	createdById: text('created_by_id').notNull(),
	fields: text('fields', {mode: 'json'}).$type<Record<string, any>>(),
	currentVersionId: text('current_version_id'),
	state: text('state', { enum: ['draft', 'in_review', 'approved', 'published', 'archived'] }).notNull().default('draft'),
	createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
	updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull(),
	deletedAt: integer('deleted_at', { mode: 'timestamp' })
})

export const contentVersions = sqliteTable('content_versions', {
	id: text('id').primaryKey(),
	resourceId: text('resource_id').notNull().references(() => contentResources.id),
	content: text('content', {mode: 'json'}).$type<Record<string, any>>().notNull(),
	createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
	createdById: text('created_by_id').notNull()
})

export const tags = sqliteTable('tags', {
	id: text('id').primaryKey(),
	label: text('label').notNull(),
	createdAt: integer('created_at', { mode: 'timestamp' }).notNull()
})

export const contentResourceTags = sqliteTable('content_resource_tags', {
	resourceId: text('resource_id').notNull().references(() => contentResources.id),
	tagId: text('tag_id').notNull().references(() => tags.id),
	createdAt: integer('created_at', { mode: 'timestamp' }).notNull()
}, (table) => ({
	pk: primaryKey({ columns: [table.resourceId, table.tagId] })
}))

// Relations
export const contentResourceRelations = relations(contentResources, ({ one, many }) => ({
	currentVersion: one(contentVersions, {
		fields: [contentResources.currentVersionId],
		references: [contentVersions.id],
	}),
	versions: many(contentVersions),
	tags: many(contentResourceTags)
}))

export const contentVersionRelations = relations(contentVersions, ({ one }) => ({
	resource: one(contentResources, {
		fields: [contentVersions.resourceId],
		references: [contentResources.id],
	})
}))

export const contentResourceTagRelations = relations(contentResourceTags, ({ one }) => ({
	resource: one(contentResources, {
		fields: [contentResourceTags.resourceId],
		references: [contentResources.id],
	}),
	tag: one(tags, {
		fields: [contentResourceTags.tagId],
		references: [tags.id],
	})
}))

// Type inference helpers
export type ContentResource = typeof contentResources.$inferSelect
export type NewContentResource = typeof contentResources.$inferInsert

export type ContentVersion = typeof contentVersions.$inferSelect
export type NewContentVersion = typeof contentVersions.$inferInsert

export type Tag = typeof tags.$inferSelect
export type NewTag = typeof tags.$inferInsert
