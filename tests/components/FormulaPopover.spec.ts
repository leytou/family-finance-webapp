import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'

import FormulaPopover from '../../src/components/FormulaPopover.vue'
import type { MonthResult } from '../../src/types'

function createResult(overrides: Partial<MonthResult> = {}): MonthResult {
  return {
    month: 202601,
    incomeItems: [],
    expenseItems: [],
    totalIncome: 0,
    totalExpense: 0,
    investReturn: 0,
    netSavings: 0,
    cumSavings: 0,
    isAnchor: false,
    ...overrides,
  }
}

describe('FormulaPopover', () => {
  it('展示净储蓄公式并定位弹窗', () => {
    const wrapper = mount(FormulaPopover, {
      props: {
        result: createResult({
          month: 202602,
          totalIncome: 12000,
          totalExpense: 3500,
          investReturn: 125.4,
          netSavings: 8625.4,
        }),
        field: 'netSavings',
        x: 20,
        y: 30,
      },
    })

    expect(wrapper.text()).toContain('2026-02 - 净储蓄')
    expect(wrapper.text()).toContain('净储蓄 = 总收入(12,000) - 总支出(3,500) + 理财(125) = 8,625')
    expect(wrapper.attributes('style')).toContain('left: 20px')
    expect(wrapper.attributes('style')).toContain('top: 30px')
  })

  it('展示理财收益中文标题和公式', () => {
    const wrapper = mount(FormulaPopover, {
      props: {
        result: createResult({ month: 202604 }),
        field: 'investReturn',
        x: 80,
        y: 90,
      },
    })

    expect(wrapper.text()).toContain('2026-04 - 理财收益')
    expect(wrapper.text()).toContain('理财收益 = 上月累计储蓄 × 年利率 / 12')
  })

  it('展示锚点累计储蓄公式并在鼠标移出时关闭', async () => {
    const wrapper = mount(FormulaPopover, {
      props: {
        result: createResult({
          month: 202603,
          cumSavings: 108125.4,
          isAnchor: true,
        }),
        field: 'cumSavings',
        x: 50,
        y: 60,
      },
    })

    expect(wrapper.text()).toContain('锚点月份，实际储蓄 = 108,125')

    await wrapper.trigger('mouseleave')

    expect(wrapper.emitted('close')).toHaveLength(1)
  })
})
