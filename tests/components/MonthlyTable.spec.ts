import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'

import MonthlyTable from '../../src/components/MonthlyTable.vue'
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

describe('MonthlyTable', () => {
  it('按月份展示动态收支明细并突出锚点和负净储蓄', () => {
    const wrapper = mount(MonthlyTable, {
      props: {
        results: [
          createResult({
            month: 202601,
            incomeItems: [{ name: '工资', amount: 12000 }],
            expenseItems: [{ name: '房租', amount: 3000 }],
            investReturn: 125.4,
            netSavings: 8125.4,
            cumSavings: 108125.4,
          }),
          createResult({
            month: 202602,
            incomeItems: [{ name: '奖金', amount: 5000 }],
            expenseItems: [{ name: '餐饮', amount: 1200 }],
            investReturn: 110,
            netSavings: -900.2,
            cumSavings: 107225.2,
            isAnchor: true,
          }),
        ],
      },
    })

    const headers = wrapper.findAll('th').map((cell) => cell.text())
    expect(headers).toEqual(['月份', '工资', '奖金', '房租', '餐饮', '理财', '净储蓄', '累计'])

    const rows = wrapper.findAll('tbody tr')
    expect(rows).toHaveLength(2)
    expect(rows[0].findAll('td').map((cell) => cell.text())).toEqual([
      '2026-01',
      '12,000',
      '0',
      '3,000',
      '0',
      '125',
      '8,125',
      '108,125',
    ])
    expect(rows[1].classes()).toContain('bg-blue-50')
    expect(rows[1].findAll('td').map((cell) => cell.text())).toEqual([
      '2026-02',
      '0',
      '5,000',
      '0',
      '1,200',
      '110',
      '-900',
      '107,225',
    ])
    expect(rows[1].findAll('td')[6].classes()).toContain('text-red-600')
    expect(rows[1].findAll('td')[7].classes()).toContain('font-bold')
  })

  it('通过公式按钮展示弹窗并提供可访问标签', async () => {
    const wrapper = mount(MonthlyTable, {
      props: {
        results: [
          createResult({
            month: 202601,
            totalIncome: 12000,
            totalExpense: 3000,
            investReturn: 125,
            netSavings: 9125,
            cumSavings: 109125,
          }),
        ],
      },
    })

    const buttons = wrapper.findAll('tbody button')
    expect(buttons).toHaveLength(2)
    expect(buttons.map((button) => button.attributes('aria-label'))).toEqual([
      '查看 2026-01 理财收益公式',
      '查看 2026-01 净储蓄公式',
    ])

    await buttons[0].trigger('click', { clientX: 100, clientY: 120 })
    expect(wrapper.text()).toContain('2026-01 - 理财收益')
    expect(wrapper.text()).toContain('理财收益 = 上月累计储蓄 × 年利率 / 12')

    await buttons[1].trigger('click', { clientX: 200, clientY: 220 })
    expect(wrapper.text()).toContain('2026-01 - 净储蓄')
    expect(wrapper.text()).toContain('净储蓄 = 总收入(12,000) - 总支出(3,000) + 理财(125) = 9,125')
  })

  it('使用紧凑表格样式并保持金额列等宽右对齐', () => {
    const wrapper = mount(MonthlyTable, {
      props: {
        results: [
          createResult({
            month: 202601,
            incomeItems: [{ name: '工资', amount: 12000 }],
            expenseItems: [{ name: '房租', amount: 3000 }],
            investReturn: 125,
            netSavings: -900,
            cumSavings: 99100,
          }),
        ],
      },
    })

    expect(wrapper.get('table').classes()).toEqual(
      expect.arrayContaining(['text-[11px]', 'leading-tight'])
    )
    expect(wrapper.get('thead').classes()).toEqual(expect.arrayContaining(['sticky', 'top-0', 'bg-gray-50']))
    expect(wrapper.get('th').classes()).toEqual(expect.arrayContaining(['px-1', 'py-0']))

    const cells = wrapper.findAll('tbody td')
    expect(cells[1].classes()).toEqual(expect.arrayContaining(['px-1', 'py-0', 'text-right', 'tabular-nums']))
    expect(cells[4].classes()).toEqual(expect.arrayContaining(['text-red-600', 'text-right', 'tabular-nums']))
  })

  it('点击累计值进入编辑态并 emit 确认值', async () => {
    const wrapper = mount(MonthlyTable, {
      props: {
        results: [
          createResult({
            month: 202601,
            cumSavings: 100000,
          }),
        ],
      },
    })

    const cumCell = wrapper.findAll('tbody td').at(-1)!
    await cumCell.find('span').trigger('click')

    const input = cumCell.find('input')
    expect(input.exists()).toBe(true)
    expect((input.element as HTMLInputElement).value).toBe('100000')

    await input.setValue('120000')
    await input.trigger('keyup.enter')

    expect(wrapper.emitted('update-anchor')).toEqual([[202601, 120000]])
  })

  it('编辑累计值后清空表示移除锚点', async () => {
    const wrapper = mount(MonthlyTable, {
      props: {
        results: [
          createResult({
            month: 202601,
            cumSavings: 100000,
            isAnchor: true,
          }),
        ],
      },
    })

    const cumCell = wrapper.findAll('tbody td').at(-1)!
    await cumCell.find('span').trigger('click')

    const input = cumCell.find('input')
    await input.setValue('')
    await input.trigger('keyup.enter')

    expect(wrapper.emitted('remove-anchor')).toEqual([[202601]])
  })

  it('编辑累计值按 Escape 取消编辑', async () => {
    const wrapper = mount(MonthlyTable, {
      props: {
        results: [
          createResult({
            month: 202601,
            cumSavings: 100000,
          }),
        ],
      },
    })

    const cumCell = wrapper.findAll('tbody td').at(-1)!
    await cumCell.find('span').trigger('click')

    const input = cumCell.find('input')
    await input.setValue('999999')
    await input.trigger('keyup.escape')

    expect(cumCell.find('input').exists()).toBe(false)
    expect(wrapper.emitted('update-anchor')).toBeUndefined()
  })

  it('hover 累计值显示公式弹窗', async () => {
    const wrapper = mount(MonthlyTable, {
      props: {
        results: [
          createResult({
            month: 202601,
            totalIncome: 12000,
            totalExpense: 3000,
            investReturn: 125,
            netSavings: 9125,
            cumSavings: 109125,
          }),
        ],
      },
    })

    const cumCell = wrapper.findAll('tbody td').at(-1)!
    await cumCell.find('span').trigger('mouseenter', { clientX: 100, clientY: 120 })

    expect(wrapper.text()).toContain('累计储蓄')
    expect(wrapper.text()).toContain('累计储蓄 = 上月累计 + 当月净储蓄(9,125)')

    await cumCell.find('span').trigger('mouseleave')
    expect(wrapper.text()).not.toContain('累计储蓄 = 上月累计')
  })
})
