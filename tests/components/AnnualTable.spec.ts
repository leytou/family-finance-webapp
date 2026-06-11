import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'

import AnnualTable from '../../src/components/AnnualTable.vue'
import type { MonthResult } from '../../src/types'

function createResult(overrides: Partial<MonthResult> = {}): MonthResult {
  return {
    month: 202601,
    columnValues: [],
    totalFlow: 0,
    investReturn: 0,
    monthlyIncome: 0,
    monthlyExpense: 0,
    monthlyBalance: 0,
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
  it('首个展示月份是锚点时使用锚点累计值作为首年年初余额', () => {
    const wrapper = mount(AnnualTable, {
      props: {
        results: [
          createResult({
            month: 202601,
            columnValues: [{ id: 'col1', name: '工资', amount: 10000, isEdited: true }],
            totalFlow: 10000,
            investReturn: 100,
            monthlyIncome: 10100,
            monthlyExpense: 0,
            monthlyBalance: 10100,
            cumSavings: 150000,
            isAnchor: true,
          }),
        ],
      },
    })

    expect(rowText(wrapper, '年初存款')).toEqual(['年初存款', '150,000'])
  })

  it('按年份汇总现金流并展示后续年份才出现的列', () => {
    const wrapper = mount(AnnualTable, {
      props: {
        results: [
          createResult({
            month: 202601,
            columnValues: [{ id: 'col1', name: '工资', amount: 10000, isEdited: true }],
            totalFlow: 10000,
            investReturn: 100,
            monthlyIncome: 10100,
            monthlyExpense: 0,
            monthlyBalance: 10100,
            cumSavings: 10100,
          }),
          createResult({
            month: 202602,
            columnValues: [{ id: 'col1', name: '工资', amount: 12000, isEdited: true }],
            totalFlow: 12000,
            investReturn: 120,
            monthlyIncome: 12120,
            monthlyExpense: 0,
            monthlyBalance: 12120,
            cumSavings: 22220,
          }),
          createResult({
            month: 202701,
            columnValues: [
              { id: 'col1', name: '工资', amount: 10000, isEdited: false },
              { id: 'col2', name: '奖金', amount: 5000, isEdited: true },
              { id: 'col3', name: '育儿', amount: -7000, isEdited: true },
            ],
            totalFlow: 8000,
            investReturn: 80,
            monthlyIncome: 8080,
            monthlyExpense: 0,
            monthlyBalance: 8080,
            cumSavings: 30300,
          }),
          createResult({
            month: 202702,
            columnValues: [
              { id: 'col1', name: '工资', amount: 10000, isEdited: false },
              { id: 'col2', name: '奖金', amount: 5000, isEdited: false },
              { id: 'col3', name: '育儿', amount: -7000, isEdited: false },
            ],
            totalFlow: 8000,
            investReturn: 90,
            monthlyIncome: 8090,
            monthlyExpense: 0,
            monthlyBalance: 8090,
            cumSavings: 38390,
          }),
        ],
      },
    })

    const headers = wrapper.findAll('th').map((cell) => cell.text())
    expect(headers).toEqual(['项目', '2026', '2027'])

    expect(rowText(wrapper, '年初存款')).toEqual(['年初存款', '0', '22,220'])
    expect(rowText(wrapper, '工资')).toEqual(['工资', '22,000', '20,000'])
    expect(rowText(wrapper, '奖金')).toEqual(['奖金', '0', '10,000'])
    expect(rowText(wrapper, '育儿')).toEqual(['育儿', '0', '-14,000'])
    expect(rowText(wrapper, '理财收益')).toEqual(['理财收益', '220', '170'])
    expect(rowText(wrapper, '年度结余')).toEqual(['年度结余', '22,220', '16,170'])
    expect(rowText(wrapper, '年末存款')).toEqual(['年末存款', '22,220', '38,390'])

    const endSavingsRow = wrapper.findAll('tbody tr').find((row) => row.find('td').text() === '年末存款')
    expect(endSavingsRow?.classes()).toContain('bg-gray-50')
    expect(endSavingsRow?.classes()).toContain('font-bold')
  })

  it('正确处理负值现金流', () => {
    const wrapper = mount(AnnualTable, {
      props: {
        results: [
          createResult({
            month: 202601,
            columnValues: [
              { id: 'col1', name: '工资', amount: 10000, isEdited: true },
              { id: 'col2', name: '房租', amount: -5000, isEdited: true },
            ],
            totalFlow: 5000,
            investReturn: 100,
            monthlyIncome: 5100,
            monthlyExpense: 0,
            monthlyBalance: 5100,
            cumSavings: 5100,
          }),
          createResult({
            month: 202602,
            columnValues: [
              { id: 'col1', name: '工资', amount: 10000, isEdited: false },
              { id: 'col2', name: '房租', amount: -5000, isEdited: false },
            ],
            totalFlow: 5000,
            investReturn: 120,
            monthlyIncome: 5120,
            monthlyExpense: 0,
            monthlyBalance: 5120,
            cumSavings: 10220,
          }),
          createResult({
            month: 202603,
            columnValues: [
              { id: 'col1', name: '工资', amount: 10000, isEdited: false },
              { id: 'col2', name: '房租', amount: -5000, isEdited: false },
            ],
            totalFlow: 5000,
            investReturn: 130,
            monthlyIncome: 5130,
            monthlyExpense: 0,
            monthlyBalance: 5130,
            cumSavings: 15350,
          }),
        ],
      },
    })

    expect(rowText(wrapper, '工资')).toEqual(['工资', '30,000'])
    expect(rowText(wrapper, '房租')).toEqual(['房租', '-15,000'])
    expect(rowText(wrapper, '理财收益')).toEqual(['理财收益', '350'])
    expect(rowText(wrapper, '年度结余')).toEqual(['年度结余', '15,350'])
    expect(rowText(wrapper, '年末存款')).toEqual(['年末存款', '15,350'])
  })

  it('使用紧凑表格样式并保持金额列等宽右对齐', () => {
    const wrapper = mount(AnnualTable, {
      props: {
        results: [
          createResult({
            month: 202601,
            columnValues: [{ id: 'col1', name: '工资', amount: 10000, isEdited: true }],
            totalFlow: 10000,
            investReturn: 100,
            monthlyIncome: 10100,
            monthlyExpense: 0,
            monthlyBalance: 10100,
            cumSavings: 10100,
          }),
        ],
      },
    })

    expect(wrapper.get('table').classes()).toEqual(
      expect.arrayContaining(['text-[11px]', 'leading-tight'])
    )
    expect(wrapper.get('thead').classes()).toEqual(expect.arrayContaining(['sticky', 'top-0', 'bg-gray-50']))
    expect(wrapper.get('th').classes()).toEqual(expect.arrayContaining(['px-1', 'py-0']))

    const yearValueCell = wrapper.findAll('tbody tr')[0].findAll('td')[1]
    expect(yearValueCell.classes()).toEqual(expect.arrayContaining(['px-1', 'py-0', 'text-right', 'tabular-nums']))
  })

  it('负值显示红色', () => {
    const wrapper = mount(AnnualTable, {
      props: {
        results: [
          createResult({
            month: 202601,
            columnValues: [
              { id: 'col1', name: '工资', amount: 10000, isEdited: true },
              { id: 'col2', name: '房租', amount: -5000, isEdited: true },
            ],
            totalFlow: 5000,
            investReturn: 100,
            monthlyIncome: 5100,
            monthlyExpense: 0,
            monthlyBalance: 5100,
            cumSavings: 5100,
          }),
        ],
      },
    })

    // 房租行（负值）应该有斜体
    const rentRow = wrapper.findAll('tbody tr').find((row) => row.find('td').text() === '房租')
    expect(rentRow?.findAll('td')[1].classes()).toContain('italic')
  })

  it('年初余额为负时显示红色', () => {
    const wrapper = mount(AnnualTable, {
      props: {
        results: [
          createResult({
            month: 202601,
            cumSavings: -10000,
          }),
        ],
      },
    })

    const startSavingsCell = wrapper.findAll('tbody tr')[0].findAll('td')[1]
    expect(startSavingsCell.classes()).toContain('italic')
  })
})
