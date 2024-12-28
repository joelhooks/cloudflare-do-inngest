import { z } from 'zod'
import { ContentResourceRepository, CreateContentResourceInput, UpdateContentResourceInput } from '../db/ContentResourceRepository'

// Validation schemas
const ContentSchema = z.record(z.any())

const CreateInputSchema = z.object({
  type: z.string().min(1),
  createdById: z.string().min(1),
  fields: z.record(z.any()).optional(),
  content: ContentSchema,
  tags: z.array(z.string()).optional()
})

const UpdateInputSchema = z.object({
  fields: z.record(z.any()).optional(),
  content: ContentSchema.optional(),
  tags: z.array(z.string()).optional()
}).refine(data => Object.keys(data).length > 0, {
  message: "At least one field must be provided for update"
})

export class ContentResourceError extends Error {
  constructor(
    message: string,
    public code: 'INVALID_INPUT' | 'NOT_FOUND' | 'SYSTEM_ERROR'
  ) {
    super(message)
    this.name = 'ContentResourceError'
  }
}

export class ContentResourceService {
  constructor(private repository: ContentResourceRepository) {}

  async createResource(input: CreateContentResourceInput) {
    try {
      // Validate input
      CreateInputSchema.parse(input)

      // Create resource
      const resource = await this.repository.create(input)
      return resource

    } catch (error) {
      if (error instanceof z.ZodError) {
        throw new ContentResourceError(
          'Invalid resource data: ' + error.errors.map(e => e.message).join(', '),
          'INVALID_INPUT'
        )
      }

      throw new ContentResourceError(
        'Failed to create resource: ' + this.getErrorMessage(error),
        'SYSTEM_ERROR'
      )
    }
  }

  async getResource(id: string) {
    if (!id?.trim()) {
      throw new ContentResourceError('Invalid resource ID', 'INVALID_INPUT')
    }

    const resource = await this.repository.findById(id)
    
    if (!resource) {
      throw new ContentResourceError('Resource not found', 'NOT_FOUND')
    }

    return resource
  }

  async getResourcesByType(type: string) {
    if (!type?.trim()) {
      throw new ContentResourceError('Invalid resource type', 'INVALID_INPUT')
    }

    return await this.repository.findByType(type)
  }

  async updateResource(id: string, input: UpdateContentResourceInput, updatedById: string) {
    if (!id?.trim()) {
      throw new ContentResourceError('Invalid resource ID', 'INVALID_INPUT')
    }

    if (!updatedById?.trim()) {
      throw new ContentResourceError('Invalid updater ID', 'INVALID_INPUT')
    }

    try {
      // Validate update input
      UpdateInputSchema.parse(input)

      // Check resource exists
      const exists = await this.repository.findById(id)
      if (!exists) {
        throw new ContentResourceError('Resource not found', 'NOT_FOUND')
      }

      // Perform update
      const updated = await this.repository.update(id, input, updatedById)
      return updated

    } catch (error) {
      if (error instanceof ContentResourceError) {
        throw error
      }

      if (error instanceof z.ZodError) {
        throw new ContentResourceError(
          'Invalid update data: ' + error.errors.map(e => e.message).join(', '),
          'INVALID_INPUT'
        )
      }

      throw new ContentResourceError(
        'Failed to update resource: ' + this.getErrorMessage(error),
        'SYSTEM_ERROR'
      )
    }
  }

  async deleteResource(id: string) {
    if (!id?.trim()) {
      throw new ContentResourceError('Invalid resource ID', 'INVALID_INPUT')
    }

    try {
      // Check resource exists
      const exists = await this.repository.findById(id)
      if (!exists) {
        throw new ContentResourceError('Resource not found', 'NOT_FOUND')
      }

      await this.repository.softDelete(id)

    } catch (error) {
      if (error instanceof ContentResourceError) {
        throw error
      }

      throw new ContentResourceError(
        'Failed to delete resource: ' + this.getErrorMessage(error),
        'SYSTEM_ERROR'
      )
    }
  }

  async getVersionHistory(id: string) {
    if (!id?.trim()) {
      throw new ContentResourceError('Invalid resource ID', 'INVALID_INPUT')
    }

    try {
      // Check resource exists
      const exists = await this.repository.findById(id)
      if (!exists) {
        throw new ContentResourceError('Resource not found', 'NOT_FOUND')
      }

      return await this.repository.getVersionHistory(id)

    } catch (error) {
      if (error instanceof ContentResourceError) {
        throw error
      }

      throw new ContentResourceError(
        'Failed to get version history: ' + this.getErrorMessage(error),
        'SYSTEM_ERROR'
      )
    }
  }

  private getErrorMessage(error: unknown): string {
    return error instanceof Error ? error.message : 'Unknown error'
  }
} 