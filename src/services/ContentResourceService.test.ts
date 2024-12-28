import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ContentResourceService, ContentResourceError } from './ContentResourceService'
import { ContentResourceRepository } from '../db/ContentResourceRepository'
import { WorkflowState } from '../statemachine/types'

describe('ContentResourceService', () => {
  let service: ContentResourceService
  let mockRepository: ContentResourceRepository

  const mockDate = new Date()

  // Helper to create a valid mock resource
  const createMockResource = (overrides = {}) => ({
    id: 'resource-1',
    type: 'article',
    createdById: 'user-1',
    fields: null,
    currentVersionId: null,
    createdAt: mockDate,
    updatedAt: mockDate,
    deletedAt: null,
    tags: [],
    currentVersion: null,
    state: 'draft' as WorkflowState,
    ...overrides
  })

  // Helper to create a valid mock version
  const createMockVersion = (overrides = {}) => ({
    id: 'version-1',
    resourceId: 'resource-1',
    content: { version: 1 },
    createdById: 'user-1',
    createdAt: mockDate,
    ...overrides
  })

  beforeEach(() => {
    mockRepository = {
      create: vi.fn(),
      findById: vi.fn(),
      findByType: vi.fn(),
      update: vi.fn(),
      softDelete: vi.fn(),
      getVersionHistory: vi.fn(),
    } as unknown as ContentResourceRepository

    service = new ContentResourceService(mockRepository)
  })

  describe('createResource', () => {
    const validInput = {
      type: 'article',
      createdById: 'user-1',
      content: { title: 'Test' },
      fields: { slug: 'test' },
      tags: ['test'],
      state: 'draft'
    }

    it('creates a resource with valid input', async () => {
      const mockResource = createMockResource({
        fields: validInput.fields,
        currentVersion: createMockVersion({ content: validInput.content })
      })
      vi.mocked(mockRepository.create).mockResolvedValue(mockResource)

      const result = await service.createResource(validInput)
      expect(result).toEqual(mockResource)
      expect(mockRepository.create).toHaveBeenCalledWith(validInput)
    })

    it('throws on invalid input', async () => {
      const invalidInput = {
        ...validInput,
        type: ''  // Empty type should fail validation
      }

      await expect(service.createResource(invalidInput))
        .rejects.toThrow(ContentResourceError)
      expect(mockRepository.create).not.toHaveBeenCalled()
    })

    it('propagates repository errors', async () => {
      vi.mocked(mockRepository.create).mockRejectedValue(new Error('DB Error'))

      await expect(service.createResource(validInput))
        .rejects.toThrow(ContentResourceError)
      expect(mockRepository.create).toHaveBeenCalled()
    })
  })

  describe('getResource', () => {
    const mockResource = createMockResource({
      currentVersion: createMockVersion({ content: { title: 'Test' } })
    })

    it('returns resource when found', async () => {
      vi.mocked(mockRepository.findById).mockResolvedValue(mockResource)

      const result = await service.getResource('resource-1')
      expect(result).toEqual(mockResource)
      expect(mockRepository.findById).toHaveBeenCalledWith('resource-1')
    })

    it('throws on empty id', async () => {
      await expect(service.getResource('')).rejects.toThrow(ContentResourceError)
      expect(mockRepository.findById).not.toHaveBeenCalled()
    })

    it('throws NOT_FOUND when resource doesnt exist', async () => {
      vi.mocked(mockRepository.findById).mockResolvedValue(null)

      const error = await service.getResource('nonexistent').catch(e => e)
      expect(error).toBeInstanceOf(ContentResourceError)
      expect(error.code).toBe('NOT_FOUND')
    })
  })

  describe('getResourcesByType', () => {
    it('returns resources of specified type', async () => {
      const mockResources = [
        createMockResource({ id: '1' }),
        createMockResource({ id: '2' })
      ]
      vi.mocked(mockRepository.findByType).mockResolvedValue(mockResources)

      const result = await service.getResourcesByType('article')
      expect(result).toEqual(mockResources)
      expect(mockRepository.findByType).toHaveBeenCalledWith('article')
    })

    it('throws on empty type', async () => {
      await expect(service.getResourcesByType('')).rejects.toThrow(ContentResourceError)
      expect(mockRepository.findByType).not.toHaveBeenCalled()
    })
  })

  describe('updateResource', () => {
    const validUpdate = {
      content: { title: 'Updated' },
      tags: ['new-tag']
    }

    beforeEach(() => {
      vi.mocked(mockRepository.findById).mockResolvedValue(createMockResource())
    })

    it('updates resource with valid input', async () => {
      const mockUpdated = createMockResource({
        currentVersion: createMockVersion({ content: validUpdate.content })
      })
      vi.mocked(mockRepository.update).mockResolvedValue(mockUpdated)

      const result = await service.updateResource('resource-1', validUpdate, 'user-1')
      expect(result).toEqual(mockUpdated)
      expect(mockRepository.update).toHaveBeenCalledWith('resource-1', validUpdate, 'user-1')
    })

    it('throws on empty update data', async () => {
      await expect(
        service.updateResource('resource-1', {}, 'user-1')
      ).rejects.toThrow(ContentResourceError)
      expect(mockRepository.update).not.toHaveBeenCalled()
    })

    it('throws on non-existent resource', async () => {
      vi.mocked(mockRepository.findById).mockResolvedValue(null)

      const error = await service.updateResource('nonexistent', validUpdate, 'user-1')
        .catch(e => e)
      expect(error).toBeInstanceOf(ContentResourceError)
      expect(error.code).toBe('NOT_FOUND')
    })

    it('throws on empty updatedById', async () => {
      await expect(
        service.updateResource('resource-1', validUpdate, '')
      ).rejects.toThrow(ContentResourceError)
      expect(mockRepository.update).not.toHaveBeenCalled()
    })
  })

  describe('deleteResource', () => {
    beforeEach(() => {
      vi.mocked(mockRepository.findById).mockResolvedValue(createMockResource())
    })

    it('soft deletes existing resource', async () => {
      await service.deleteResource('resource-1')
      expect(mockRepository.softDelete).toHaveBeenCalledWith('resource-1')
    })

    it('throws on non-existent resource', async () => {
      vi.mocked(mockRepository.findById).mockResolvedValue(null)

      const error = await service.deleteResource('nonexistent').catch(e => e)
      expect(error).toBeInstanceOf(ContentResourceError)
      expect(error.code).toBe('NOT_FOUND')
    })

    it('throws on empty id', async () => {
      await expect(service.deleteResource('')).rejects.toThrow(ContentResourceError)
      expect(mockRepository.softDelete).not.toHaveBeenCalled()
    })
  })

  describe('getVersionHistory', () => {
    const mockVersions = [
      createMockVersion({ id: 'v1', content: { version: 1 } }),
      createMockVersion({ id: 'v2', content: { version: 2 } })
    ]

    beforeEach(() => {
      vi.mocked(mockRepository.findById).mockResolvedValue(createMockResource())
      vi.mocked(mockRepository.getVersionHistory).mockResolvedValue(mockVersions)
    })

    it('returns version history for existing resource', async () => {
      const result = await service.getVersionHistory('resource-1')
      expect(result).toEqual(mockVersions)
      expect(mockRepository.getVersionHistory).toHaveBeenCalledWith('resource-1')
    })

    it('throws on non-existent resource', async () => {
      vi.mocked(mockRepository.findById).mockResolvedValue(null)

      const error = await service.getVersionHistory('nonexistent').catch(e => e)
      expect(error).toBeInstanceOf(ContentResourceError)
      expect(error.code).toBe('NOT_FOUND')
    })

    it('throws on empty id', async () => {
      await expect(service.getVersionHistory('')).rejects.toThrow(ContentResourceError)
      expect(mockRepository.getVersionHistory).not.toHaveBeenCalled()
    })
  })
}) 