import { enableAutoUnmount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

enableAutoUnmount(afterEach)

// mock driver.js：捕获传入配置，暴露 drive 与 onDestroyed
const driveMock = vi.fn()
const driverMock = vi.fn(() => ({ drive: driveMock }))
vi.mock('driver.js', () => ({ driver: driverMock }))

const TOUR_SEEN_KEY = 'family-finance-tour-seen'

async function loadUseTour() {
  const mod = await import('../../src/composables/useTour')
  return mod
}

describe('useTour', () => {
  beforeEach(() => {
    localStorage.clear()
    driverMock.mockClear()
    driveMock.mockClear()
  })

  it('未看过时 isTourSeen 为 false，标记后为 true', async () => {
    const { isTourSeen, markTourSeen } = await loadUseTour()
    expect(isTourSeen()).toBe(false)
    markTourSeen()
    expect(isTourSeen()).toBe(true)
    expect(localStorage.getItem(TOUR_SEEN_KEY)).toBe('1')
  })

  it('已看过标记独立于方案数据 key', async () => {
    const { markTourSeen } = await loadUseTour()
    markTourSeen()
    expect(localStorage.getItem('family-finance-plan')).toBeNull()
  })

  it('playTour 用对应主题 steps 调用 driver 并 drive', async () => {
    const { playTour } = await loadUseTour()
    const { TOURS } = await import('../../src/data/tours')
    playTour('compare')
    expect(driverMock).toHaveBeenCalledTimes(1)
    const opts = driverMock.mock.calls[0][0]
    expect(opts.steps).toBe(TOURS.compare.steps)
    expect(driveMock).toHaveBeenCalledTimes(1)
  })

  it('playTour("all") 用串联步骤', async () => {
    const { playTour } = await loadUseTour()
    const { buildAllSteps } = await import('../../src/data/tours')
    playTour('all')
    const opts = driverMock.mock.calls[0][0]
    expect(opts.steps).toHaveLength(buildAllSteps().length)
  })

  it('markSeenOnDone=false（默认）时结束不写标记', async () => {
    const { playTour, isTourSeen } = await loadUseTour()
    playTour('quickstart')
    const opts = driverMock.mock.calls[0][0]
    opts.onDestroyed()
    expect(isTourSeen()).toBe(false)
  })

  it('markSeenOnDone=true 时结束写标记', async () => {
    const { playTour, isTourSeen } = await loadUseTour()
    playTour('quickstart', { markSeenOnDone: true })
    const opts = driverMock.mock.calls[0][0]
    opts.onDestroyed()
    expect(isTourSeen()).toBe(true)
  })
})
