// 弹窗定位常量
export const POPOVER_WIDTH = 384 // 约等于 FormulaPopover 的 max-w-96（24rem），作为期望宽度
export const POPOVER_MARGIN = 10 // 弹窗与鼠标、视口边之间的间距

export interface PopoverPosOptions {
  /** 视口宽度，默认取 window.innerWidth */
  viewportWidth?: number
  /** 弹窗期望宽度，默认 POPOVER_WIDTH */
  expectedWidth?: number
  /** 与鼠标/视口边的间距，默认 POPOVER_MARGIN */
  margin?: number
}

/**
 * 计算 hover 弹窗的横向起始 x 坐标，避免鼠标靠右时弹窗被视口右边压缩变窄：
 * - 默认放在鼠标右侧（clientX + margin）
 * - 若右侧空间不足以容纳弹窗，整体左移至贴近视口右边（留出 margin），保证完整可见
 *   （left 变小后，shrink-to-fit 的可用宽度随之增大，弹窗不再被压窄）
 * - 极端窄屏（视口比弹窗还窄）兜底：贴近视口左边，不溢出
 */
export function computePopoverX(clientX: number, opts: PopoverPosOptions = {}): number {
  const viewportWidth = opts.viewportWidth ?? window.innerWidth
  const expectedWidth = opts.expectedWidth ?? POPOVER_WIDTH
  const margin = opts.margin ?? POPOVER_MARGIN

  let x = clientX + margin
  const maxX = viewportWidth - expectedWidth - margin
  if (x > maxX) {
    x = maxX
  }
  // 极端窄屏：maxX 可能为负，兜底贴近视口左边，避免溢出到视口左侧之外
  if (x < margin) {
    x = margin
  }
  return x
}
