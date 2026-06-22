import { driver } from 'driver.js'
import { TOURS, buildAllSteps, type TourTopic } from '../data/tours'

// 「已看过」标记 key：独立于方案数据，仅控制首次是否自动播
const TOUR_SEEN_KEY = 'family-finance-tour-seen'

/** 是否已看过首次引导 */
export function isTourSeen(): boolean {
  return localStorage.getItem(TOUR_SEEN_KEY) === '1'
}

/** 标记已看过（首次引导看毕 / 跳过后写入） */
export function markTourSeen(): void {
  localStorage.setItem(TOUR_SEEN_KEY, '1')
}

export interface PlayOptions {
  // 结束时是否写入「已看过」标记；仅首次自动播放传 true
  markSeenOnDone?: boolean
}

/**
 * 播放某个主题的教程。
 * - 纯讲解式：只高亮 + 气泡，不修改任何业务状态。
 * - 手动播放（默认）不改变「已看过」标记；首次自动播放传 markSeenOnDone。
 */
export function playTour(topic: TourTopic, opts: PlayOptions = {}): void {
  const steps = topic === 'all' ? buildAllSteps() : TOURS[topic].steps
  const driverObj = driver({
    showProgress: topic !== 'all',
    steps,
    popoverClass: 'fp-tour-popover',
    onDestroyed: () => {
      if (opts.markSeenOnDone) markTourSeen()
    },
  })
  driverObj.drive()
}

// re-export 菜单元数据：TourMenu 单从本模块取用，测试也只 mock 本模块即可
export { TOUR_TOPICS } from '../data/tours'
