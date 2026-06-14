import { describe, expect, it } from 'vitest'
import { computePopoverX, POPOVER_WIDTH, POPOVER_MARGIN } from '../../src/utils/popover'

describe('computePopoverX', () => {
  it('右侧空间充足时，弹窗放在鼠标右侧（clientX + 边距）', () => {
    // 视口 1280，鼠标在 100，足够放下 384 宽的弹窗
    expect(computePopoverX(100, { viewportWidth: 1280 })).toBe(110)
  })

  it('鼠标靠右、右侧放不下时，整体左移并贴近视口右边（留出边距）', () => {
    // 视口 1280，鼠标 1200：默认会到 1210，但 1210+384 已超出右边
    // 期望左移到 1280 - 384 - 10 = 886
    expect(computePopoverX(1200, { viewportWidth: 1280 })).toBe(886)
  })

  it('极端窄屏（视口比弹窗还窄）时不溢出左边，回退到左边距', () => {
    // 视口 300，鼠标 100，弹窗 384 根本放不下：左移会变负数，兜底为 margin(10)
    expect(computePopoverX(100, { viewportWidth: 300 })).toBe(POPOVER_MARGIN)
  })

  it('恰好能放下时不额外左移（边界相等）', () => {
    // 视口 1280，鼠标 876：x=886，maxX=886，相等不触发左移
    expect(computePopoverX(876, { viewportWidth: 1280 })).toBe(886)
  })

  it('可通过 opts 自定义期望宽度与边距', () => {
    // 视口 1000，期望宽 200，边距 8：鼠标 900 → 908 > 1000-200-8=792 → 左移到 792
    expect(computePopoverX(900, { viewportWidth: 1000, expectedWidth: 200, margin: 8 })).toBe(792)
  })

  it('导出的默认期望宽度等于 max-w-96（384）以匹配弹窗上限', () => {
    expect(POPOVER_WIDTH).toBe(384)
    expect(POPOVER_MARGIN).toBe(10)
  })
})
