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
})
