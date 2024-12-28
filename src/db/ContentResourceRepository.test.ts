import { describe, it, expect, beforeEach } from 'vitest'
import { ContentResourceRepository } from './ContentResourceRepository'
import { createTestDb } from '../test/testDb'
import type { CreateContentResourceInput, UpdateContentResourceInput } from './ContentResourceRepository'

describe('ContentResourceRepository', () => {
  let repository: ContentResourceRepository
  let db: any

  beforeEach(() => {
    db = createTestDb()
    repository = new ContentResourceRepository(db)
  })

  describe('create', () => {
    const testResource: CreateContentResourceInput = {
      type: 'article',
      createdById: 'user-1',
      fields: { slug: 'test-article' },
      content: { title: 'Test Article', body: 'Test content' },
      tags: ['test', 'article']
    }

    it('creates a resource with initial version and tags', async () => {
      const resource = await repository.create(testResource)

      expect(resource.id).toBeDefined()
      expect(resource.type).toBe('article')
      expect(resource.createdById).toBe('user-1')
      expect(resource.fields).toEqual({ slug: 'test-article' })
      expect(resource.currentVersionId).toBeDefined()

      const found = await repository.findById(resource.id)
      expect(found).toBeDefined()
      expect(found?.currentVersion?.content).toEqual({
        title: 'Test Article',
        body: 'Test content'
      })
      expect(found?.tags).toHaveLength(2)
      expect(found?.tags.map(t => t.tag.label)).toContain('test')
      expect(found?.tags.map(t => t.tag.label)).toContain('article')
    })

    it('creates a resource without optional fields', async () => {
      const minimalResource: CreateContentResourceInput = {
        type: 'article',
        createdById: 'user-1',
        content: { title: 'Minimal' }
      }

      const resource = await repository.create(minimalResource)
      expect(resource.id).toBeDefined()
      expect(resource.fields).toBeNull()

      const found = await repository.findById(resource.id)
      expect(found?.tags).toHaveLength(0)
    })
  })

  describe('findById', () => {
    it('returns null for non-existent resource', async () => {
      const result = await repository.findById('nonexistent')
      expect(result).toBeNull()
    })

    it('returns null for soft-deleted resource', async () => {
      const resource = await repository.create({
        type: 'article',
        createdById: 'user-1',
        content: { title: 'To Delete' }
      })

      await repository.softDelete(resource.id)
      const result = await repository.findById(resource.id)
      expect(result).toBeNull()
    })
  })

  describe('findByType', () => {
    beforeEach(async () => {
      await repository.create({
        type: 'article',
        createdById: 'user-1',
        content: { title: 'Article 1' }
      })
      await repository.create({
        type: 'article',
        createdById: 'user-1',
        content: { title: 'Article 2' }
      })
      await repository.create({
        type: 'page',
        createdById: 'user-1',
        content: { title: 'Page 1' }
      })
    })

    it('returns resources of specified type', async () => {
      const articles = await repository.findByType('article')
      expect(articles).toHaveLength(2)
      expect(articles.every(a => a.type === 'article')).toBe(true)
    })

    it('excludes soft-deleted resources', async () => {
      const articles = await repository.findByType('article')
      await repository.softDelete(articles[0].id)

      const remaining = await repository.findByType('article')
      expect(remaining).toHaveLength(1)
    })
  })

  describe('update', () => {
    let resourceId: string

    beforeEach(async () => {
      const resource = await repository.create({
        type: 'article',
        createdById: 'user-1',
        fields: { slug: 'original' },
        content: { title: 'Original' },
        tags: ['original']
      })
      resourceId = resource.id
    })

    it('updates fields without affecting content or tags', async () => {
      const update: UpdateContentResourceInput = {
        fields: { slug: 'updated' }
      }

      const updated = await repository.update(resourceId, update, 'user-1')
      expect(updated?.fields).toEqual({ slug: 'updated' })
      expect(updated?.currentVersion?.content).toEqual({ title: 'Original' })
      expect(updated?.tags).toHaveLength(1)
    })

    it('creates new version when updating content', async () => {
      const update: UpdateContentResourceInput = {
        content: { title: 'Updated' }
      }

      const updated = await repository.update(resourceId, update, 'user-1')
      expect(updated?.currentVersion?.content).toEqual({ title: 'Updated' })

      const history = await repository.getVersionHistory(resourceId)
      expect(history).toHaveLength(2)
    })

    it('replaces tags when updating', async () => {
      const update: UpdateContentResourceInput = {
        tags: ['new-tag']
      }

      const updated = await repository.update(resourceId, update, 'user-1')
      expect(updated?.tags).toHaveLength(1)
      expect(updated?.tags[0].tag.label).toBe('new-tag')
    })

    it('throws error for non-existent resource', async () => {
      await expect(
        repository.update('nonexistent', { fields: {} }, 'user-1')
      ).rejects.toThrow('Resource not found')
    })
  })

  describe('getVersionHistory', () => {
    it('returns versions in chronological order', async () => {
      const resource = await repository.create({
        type: 'article',
        createdById: 'user-1',
        content: { version: 1 }
      })

      await repository.update(resource.id, { content: { version: 2 } }, 'user-1')
      await repository.update(resource.id, { content: { version: 3 } }, 'user-1')

      const history = await repository.getVersionHistory(resource.id)
      expect(history).toHaveLength(3)
      expect(history.map(v => v.content.version)).toEqual([1, 2, 3])
    })
  })

  describe('init', () => {
    it('creates required tables', async () => {
      await repository.init()
      // Verify it doesn't throw
      expect(true).toBe(true)
    })
  })
}) 