import { eq, and, isNull } from 'drizzle-orm'
import { DrizzleDatabaseWithSchema, contentResources, contentVersions, contentResourceTags, tags } from '../schema'
import { migrate } from 'drizzle-orm/durable-sqlite/migrator'
import migrations from '../../drizzle/migrations'
import { WorkflowState } from '../statemachine/types'

export type CreateContentResourceInput = {
  type: string
  createdById: string
  fields?: Record<string, any>
  content: Record<string, any>
  tags?: string[]
}

export type UpdateContentResourceInput = {
  fields?: Record<string, any>
  content?: Record<string, any>
  tags?: string[]
  state?: WorkflowState
}

export class ContentResourceRepository {
  constructor(private db: DrizzleDatabaseWithSchema) {}

  async init() {
    await migrate(this.db, migrations)
  }

  async create(input: CreateContentResourceInput) {
    return await this.db.transaction(async (tx) => {
      // Create the resource
      const [resource] = await tx
        .insert(contentResources)
        .values({
          id: crypto.randomUUID(),
          type: input.type,
          createdById: input.createdById,
          fields: input.fields,
          createdAt: new Date(),
          updatedAt: new Date(),
        })
        .returning()

      // Create initial version
      const [version] = await tx
        .insert(contentVersions)
        .values({
          id: crypto.randomUUID(),
          resourceId: resource.id,
          content: input.content,
          createdById: input.createdById,
          createdAt: new Date(),
        })
        .returning()

      // Update resource with current version
      await tx
        .update(contentResources)
        .set({ currentVersionId: version.id })
        .where(eq(contentResources.id, resource.id))

      // Add tags if provided
      if (input.tags?.length) {
        await this.addTags(tx, resource.id, input.tags)
      }

      return resource
    })
  }

  async findById(id: string) {
    const result = await this.db.query.contentResources.findFirst({
      where: and(
        eq(contentResources.id, id),
        isNull(contentResources.deletedAt)
      ),
      with: {
        currentVersion: true,
        tags: {
          with: {
            tag: true
          }
        }
      }
    })
    return result || null
  }

  async findByType(type: string) {
    return await this.db.query.contentResources.findMany({
      where: and(
        eq(contentResources.type, type),
        isNull(contentResources.deletedAt)
      ),
      with: {
        currentVersion: true,
        tags: {
          with: {
            tag: true
          }
        }
      }
    })
  }

  async update(id: string, input: UpdateContentResourceInput, updatedById: string) {
    return await this.db.transaction(async (tx) => {
      const resource = await this.findById(id)
      if (!resource) throw new Error('Resource not found')

      // Update fields if provided
      if (input.fields) {
        await tx
          .update(contentResources)
          .set({
            fields: input.fields,
            updatedAt: new Date()
          })
          .where(eq(contentResources.id, id))
      }

      // Create new version if content provided
      if (input.content) {
        const [version] = await tx
          .insert(contentVersions)
          .values({
            id: crypto.randomUUID(),
            resourceId: id,
            content: input.content,
            createdById: updatedById,
            createdAt: new Date(),
          })
          .returning()

        await tx
          .update(contentResources)
          .set({
            currentVersionId: version.id,
            updatedAt: new Date()
          })
          .where(eq(contentResources.id, id))
      }

      // Update tags if provided
      if (input.tags) {
        // Remove existing tags
        await tx
          .delete(contentResourceTags)
          .where(eq(contentResourceTags.resourceId, id))

        // Add new tags
        await this.addTags(tx, id, input.tags)
      }

      return await this.findById(id)
    })
  }

  async softDelete(id: string) {
    await this.db
      .update(contentResources)
      .set({
        deletedAt: new Date(),
        updatedAt: new Date()
      })
      .where(eq(contentResources.id, id))
  }

  async getVersionHistory(id: string) {
    return await this.db.query.contentVersions.findMany({
      where: eq(contentVersions.resourceId, id),
      orderBy: (versions) => versions.createdAt,
    })
  }

  private async addTags(tx: DrizzleDatabaseWithSchema, resourceId: string, tagLabels: string[]) {
    for (const label of tagLabels) {
      // Find or create tag
      let tag = await tx.query.tags.findFirst({
        where: eq(tags.label, label)
      })

      if (!tag) {
        const [newTag] = await tx
          .insert(tags)
          .values({
            id: crypto.randomUUID(),
            label,
            createdAt: new Date()
          })
          .returning()
        tag = newTag
      }

      // Add tag to resource
      await tx
        .insert(contentResourceTags)
        .values({
          resourceId,
          tagId: tag.id,
          createdAt: new Date()
        })
    }
  }
} 