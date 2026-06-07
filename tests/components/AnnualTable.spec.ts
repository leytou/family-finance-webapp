import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'

import AnnualTable from '../../src/components/AnnualTable.vue'
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

function rowText(wrapper: ReturnType<typeof mount>, label: string): string[] {
  const row = wrapper
    .findAll('tbody tr')
    .find((item) => item.find('td').text() === label)

  if (!row) {
    throw new Error(`找不到行：${label}`)
  }

  return row.findAll('td').map((cell) => cell.text())
}

describe('AnnualTable', () => {
  it('首个展示月份是锚点时使用锚点累计值作为首年年初储蓄', () => {
    const wrapper = mount(AnnualTable, {
      props: {
        results: [
          createResult({
            month: 202601,
            incomeItems: [{ name: '工资', amount: 10000 }],
            expenseItems: [{ name: '房租', amount: 3000 }],
            investReturn: 100,
            netSavings: 7100,
            cumSavings: 150000,
            isAnchor: true,
          }),
        ],
      },
    })

    expect(rowText(wrapper, '年初储蓄')).toEqual(['年初储蓄', '150,000'])
  })

  it('按年份汇总收支并展示后续年份才出现的项目', () => {
    const wrapper = mount(AnnualTable, {
      props: {
        results: [
          createResult({
            month: 202601,
            incomeItems: [{ name: '工资', amount: 10000 }],
            expenseItems: [{ name: '房租', amount: 3000 }],
            investReturn: 100,
            netSavings: 7100,
            cumSavings: 107100,
          }),
          createResult({
            month: 202602,
            incomeItems: [{ name: '工资', amount: 12000 }],
            expenseItems: [{ name: '房租', amount: 3000 }],
            investReturn: 120,
            netSavings: 9120,
            cumSavings: 116220,
          }),
          createResult({
            month: 202701,
            incomeItems: [{ name: '奖金', amount: 5000 }],
            expenseItems: [{ name: '育儿', amount: 7000 }],
            investReturn: 80,
            netSavings: -1920,
            cumSavings: 114300,
          }),
        ],
      },
    })

    const headers = wrapper.findAll('th').map((cell) => cell.text())
    expect(headers).toEqual(['项目', '2026', '2027'])

    expect(rowText(wrapper, '年初储蓄')).toEqual(['年初储蓄', '100,000', '116,220'])
    expect(rowText(wrapper, '工资')).toEqual(['工资', '22,000', '0'])
    expect(rowText(wrapper, '奖金')).toEqual(['奖金', '0', '5,000'])
    expect(rowText(wrapper, '理财收益')).toEqual(['理财收益', '220', '80'])
    expect(rowText(wrapper, '收入合计')).toEqual(['收入合计', '22,220', '5,080'])
    expect(rowText(wrapper, '房租')).toEqual(['房租', '6,000', '0'])
    expect(rowText(wrapper, '育儿')).toEqual(['育儿', '0', '7,000'])
    expect(rowText(wrapper, '支出合计')).toEqual(['支出合计', '6,000', '7,000'])
    expect(rowText(wrapper, '年度结余')).toEqual(['年度结余', '16,220', '-1,920'])
    expect(rowText(wrapper, '年末储蓄')).toEqual(['年末储蓄', '116,220', '114,300'])

    const balanceRow = wrapper.findAll('tbody tr').find((row) => row.find('td').text() === '年度结余')
    expect(balanceRow?.findAll('td')[2].classes()).toContain('text-red-600')

    const endSavingsRow = wrapper.findAll('tbody tr').find((row) => row.find('td').text() === '年末储蓄')
    expect(endSavingsRow?.classes()).toContain('bg-gray-50')
    expect(endSavingsRow?.classes()).toContain('font-bold')
  })
})
