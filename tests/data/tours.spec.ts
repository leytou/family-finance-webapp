import { describe, expect, it } from 'vitest'
import { TOURS, TOUR_TOPICS, buildAllSteps, type TourTopic } from '../../src/data/tours'

const REQUIRED_TOPICS: TourTopic[] = ['quickstart', 'fund', 'compare', 'correction']

describe('tours 数据', () => {
  it('四个主题均存在且每步含 element 与 popover', () => {
    for (const key of REQUIRED_TOPICS) {
      const def = TOURS[key]
      expect(def).toBeDefined()
      expect(def.label.length).toBeGreaterThan(0)
      expect(def.steps.length).toBeGreaterThan(0)
      for (const step of def.steps) {
        expect(typeof step.element).toBe('string')
        expect(step.element).toContain('[data-tour=')
        expect(step.popover).toBeDefined()
        expect((step.popover as any).title.length).toBeGreaterThan(0)
        expect((step.popover as any).description.length).toBeGreaterThan(0)
      }
    }
  })

  it('快速入门正好 5 步', () => {
    expect(TOURS.quickstart.steps).toHaveLength(5)
  })

  it('TOUR_TOPICS 菜单含 4 主题 + 重看全部', () => {
    const keys = TOUR_TOPICS.map(t => t.key)
    expect(keys).toEqual(['quickstart', 'fund', 'compare', 'correction', 'all'])
  })

  it('buildAllSteps 串联全部主题步骤', () => {
    const all = buildAllSteps()
    const sum = REQUIRED_TOPICS.reduce((n, k) => n + TOURS[k].steps.length, 0)
    expect(all).toHaveLength(sum)
  })
})
