import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'

import FormulaPopover from '../../src/components/FormulaPopover.vue'
import type { MonthResult } from '../../src/types'

function createResult(overrides: Partial<MonthResult> = {}): MonthResult {
  return {
    month: 202601,
    columnValues: [],
    totalFlow: 0,
    investReturn: 0,
    netSavings: 0,
    cumSavings: 0,
    isAnchor: false,
    ...overrides,
  }
}

describe('FormulaPopover', () => {
  it('展示净储蓄公式（新格式：现金流合计）并定位弹窗', () => {
    const wrapper = mount(FormulaPopover, {
      props: {
        result: createResult({
          month: 202602,
          columnValues: [
            { id: 'col1', name: '工资', amount: 12000, isEdited: true },
            { id: 'col2', name: '房租', amount: -3500, isEdited: true },
          ],
          totalFlow: 8500,
          investReturn: 125.4,
          netSavings: 8625.4,
        }),
        field: 'netSavings',
        x: 20,
        y: 30,
      },
    })

    expect(wrapper.text()).toContain('2026-02 - 净储蓄')
    expect(wrapper.text()).toContain('净储蓄 = 现金流合计(8,500) + 理财(125) = 8,625')
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

  it('展示累计储蓄公式（非锚点）', () => {
    const wrapper = mount(FormulaPopover, {
      props: {
        result: createResult({
          month: 202603,
          netSavings: 8625.4,
          cumSavings: 108125.4,
          isAnchor: false,
        }),
        field: 'cumSavings',
        x: 50,
        y: 60,
      },
    })

    expect(wrapper.text()).toContain('累计储蓄 = 上月累计 + 当月净储蓄(8,625)')
  })

  it('展示现金流合计公式细节（多列）', () => {
    const wrapper = mount(FormulaPopover, {
      props: {
        result: createResult({
          month: 202601,
          columnValues: [
            { id: 'col1', name: '工资', amount: 10000, isEdited: true },
            { id: 'col2', name: '房租', amount: -3000, isEdited: true },
            { id: 'col3', name: '奖金', amount: 5000, isEdited: true },
          ],
          totalFlow: 12000,
          investReturn: 100,
          netSavings: 12100,
        }),
        field: 'netSavings',
        x: 20,
        y: 30,
      },
    })

    expect(wrapper.text()).toContain('净储蓄 = 现金流合计(12,000) + 理财(100) = 12,100')
  })
})
