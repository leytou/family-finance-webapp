import { mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import AnnualTable from '../../src/components/AnnualTable.vue'
import { useStore as useSharedStore } from '../../src/composables/useStore'
import { calculate } from '../../src/composables/useCalculation'
import type { MonthResult, PlanData } from '../../src/types'
import auditPlan from '../fixtures/audit-plan.json'

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
    expect(endSavingsRow?.classes()).toContain('bg-surface-2')
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
    expect(wrapper.get('thead').classes()).toEqual(expect.arrayContaining(['bg-surface-2']))
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

    // 房租行（负值）应为竹青色（与月度表一致的负向色）
    const rentRow = wrapper.findAll('tbody tr').find((row) => row.find('td').text() === '房租')
    expect(rentRow?.findAll('td')[1].classes()).toContain('text-negative-600')
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
    expect(startSavingsCell.classes()).toContain('text-negative-600')
  })

  it('禁用列不出现在年度表、不计入年度总额', () => {
    const wrapper = mount(AnnualTable, {
      props: {
        results: [
          createResult({
            month: 202601,
            columnValues: [
              { id: 'col1', name: '工资', amount: 10000, isEdited: true, enabled: true },
              { id: 'col2', name: '旅游', amount: -3000, isEdited: true, enabled: false },
            ],
            totalFlow: 10000,
            investReturn: 100,
            monthlyIncome: 10100,
            monthlyExpense: 0,
            monthlyBalance: 10100,
            cumSavings: 10100,
          }),
          createResult({
            month: 202602,
            columnValues: [
              { id: 'col1', name: '工资', amount: 10000, isEdited: false, enabled: true },
              { id: 'col2', name: '旅游', amount: -3000, isEdited: false, enabled: false },
            ],
            totalFlow: 10000,
            investReturn: 120,
            monthlyIncome: 10120,
            monthlyExpense: 0,
            monthlyBalance: 10120,
            cumSavings: 20220,
          }),
        ],
      },
    })

    const headers = wrapper.findAll('th').map((cell) => cell.text())
    expect(headers).toEqual(['项目', '2026'])
    // 工资行存在，年度合计 20000（两月各 10000）
    expect(rowText(wrapper, '工资')).toEqual(['工资', '20,000'])
    // 旅游行不存在
    expect(() => rowText(wrapper, '旅游')).toThrow()
    // 年度结余仅含启用列 + 理财：20000 + 220 = 20220
    expect(rowText(wrapper, '年度结余')).toEqual(['年度结余', '20,220'])
  })

  it('无 enabled 字段的列按启用聚合（回归）', () => {
    const wrapper = mount(AnnualTable, {
      props: {
        results: [
          createResult({
            month: 202601,
            columnValues: [{ id: 'col1', name: '工资', amount: 10000, isEdited: true }],
          }),
        ],
      },
    })
    expect(rowText(wrapper, '工资')).toEqual(['工资', '10,000'])
  })

  it('聚合「专项」虚拟列值为年度合计行（零代码改动）', () => {
    const wrapper = mount(AnnualTable, {
      props: {
        results: [
          createResult({
            month: 202601,
            columnValues: [{ id: '__events__', name: '专项', amount: -2000000, isEdited: false, enabled: true }],
            totalFlow: -2000000,
            monthlyExpense: 2000000,
            monthlyBalance: -2000000,
            cumSavings: -2000000,
          }),
          createResult({
            month: 202602,
            columnValues: [{ id: '__events__', name: '专项', amount: -200000, isEdited: false, enabled: true }],
            totalFlow: -200000,
            monthlyExpense: 200000,
            monthlyBalance: -200000,
            cumSavings: -2200000,
          }),
        ],
      },
    })
    // 年度合计 = -2,000,000 + -200,000 = -2,200,000
    expect(rowText(wrapper, '专项')).toEqual(['专项', '-2,200,000'])
  })

  it('hover 年度结余单元格显示构成公式', async () => {
    const store = useSharedStore()
    store.reset()
    store.data.value.systemParams.startMonth = 202601

    const wrapper = mount(AnnualTable, {
      props: {
        results: [
          createResult({
            month: 202601,
            columnValues: [
              { id: 'c1', name: '工资', amount: 10000, isEdited: true },
              { id: 'c2', name: '育儿', amount: -1500, isEdited: true },
            ],
            totalFlow: 8500,
            investReturn: 100,
            monthlyIncome: 10000,
            monthlyExpense: 1500,
            monthlyBalance: 8600,
            cumSavings: 8600,
          }),
          createResult({
            month: 202602,
            columnValues: [
              { id: 'c1', name: '工资', amount: 10000, isEdited: false },
              { id: 'c2', name: '育儿', amount: -1500, isEdited: false },
            ],
            totalFlow: 8500,
            investReturn: 100,
            monthlyIncome: 10000,
            monthlyExpense: 1500,
            monthlyBalance: 8600,
            cumSavings: 17200,
          }),
        ],
      },
    })

    const balanceRow = wrapper.findAll('tbody tr').find(r => r.find('td').text() === '年度结余')!
    const valueCell = balanceRow.findAll('td')[1]
    await valueCell.find('span').trigger('mouseenter', { clientX: 100, clientY: 120 })

    const popover = wrapper.findComponent({ name: 'FormulaPopover' })
    expect(popover.exists()).toBe(true)
    expect(popover.text()).toContain('2026 - 年度结余')
    expect(popover.text()).toContain('年度结余 = 年收入(20,000) - 年支出(3,000) = 17,200')

    await valueCell.find('span').trigger('mouseleave')
    expect(wrapper.findComponent({ name: 'FormulaPopover' }).exists()).toBe(false)
  })

  it('hover 专项行显示各事件之和公式', async () => {
    const store = useSharedStore()
    store.reset()
    store.data.value.systemParams.startMonth = 202601
    store.replaceMonthEvents(202601, [
      { name: '买房', amount: -500000 },
      { name: '卖房', amount: 300000 },
    ])
    // results 需含虚拟专项列，使年度表渲染出「专项」行
    const results = [
      createResult({
        month: 202601,
        columnValues: [{ id: '__events__', name: '专项', amount: -200000, isEdited: false, enabled: true }],
        totalFlow: -200000,
        monthlyExpense: 200000,
        monthlyBalance: -200000,
        cumSavings: -200000,
      }),
    ]

    const wrapper = mount(AnnualTable, { props: { results } })
    const eventRow = wrapper.findAll('tbody tr').find(r => r.find('td').text() === '专项')!
    const valueCell = eventRow.findAll('td')[1]
    await valueCell.find('span').trigger('mouseenter', { clientX: 100, clientY: 120 })

    const popover = wrapper.findComponent({ name: 'FormulaPopover' })
    expect(popover.exists()).toBe(true)
    expect(popover.text()).toContain('2026 - 专项')
    expect(popover.text()).toContain('专项 = -买房(500,000) + 卖房(300,000) = -200,000')
  })

  it('首月锚点时 hover 年初存款显示锚点值（与单元格一致）', async () => {
    const store = useSharedStore()
    store.reset()
    store.data.value.systemParams.startMonth = 202601

    const wrapper = mount(AnnualTable, {
      props: {
        results: [
          createResult({
            month: 202601,
            columnValues: [{ id: 'c1', name: '工资', amount: 10000, isEdited: true }],
            totalFlow: 10000,
            investReturn: 0,
            monthlyIncome: 10000,
            monthlyExpense: 0,
            monthlyBalance: 10000,
            cumSavings: 150000,
            isAnchor: true,
          }),
        ],
      },
    })

    // 单元格年初存款 = 锚点 cumSavings = 150,000
    const startRow = wrapper.findAll('tbody tr').find(r => r.find('td').text() === '年初存款')!
    expect(startRow.findAll('td')[1].text()).toContain('150,000')

    // hover 显示锚点值（非初始存款）
    await startRow.findAll('td')[1].find('span').trigger('mouseenter', { clientX: 100, clientY: 120 })
    const popover = wrapper.findComponent({ name: 'FormulaPopover' })
    expect(popover.exists()).toBe(true)
    expect(popover.text()).toContain('年初存款 = 锚点值(150,000)')
    expect(popover.text()).not.toContain('初始存款')
  })

  it('展示「年收入」「年支出」两行，且收入−支出=年度结余', () => {
    const wrapper = mount(AnnualTable, {
      props: {
        results: [
          createResult({
            month: 202601,
            columnValues: [{ id: 'c1', name: '工资', amount: 10000, isEdited: true }],
            totalFlow: 10000, investReturn: 100,
            monthlyIncome: 10100, monthlyExpense: 0, monthlyBalance: 10100, cumSavings: 10100,
          }),
          createResult({
            month: 202602,
            columnValues: [
              { id: 'c1', name: '工资', amount: 10000, isEdited: false },
              { id: 'c2', name: '育儿', amount: -2000, isEdited: true },
            ],
            totalFlow: 8000, investReturn: 120,
            monthlyIncome: 10120, monthlyExpense: 2000, monthlyBalance: 8120, cumSavings: 18220,
          }),
        ],
      },
    })
    expect(rowText(wrapper, '年收入')).toEqual(['年收入', '20,220'])
    expect(rowText(wrapper, '年支出')).toEqual(['年支出', '2,000'])
    expect(rowText(wrapper, '年度结余')).toEqual(['年度结余', '18,220'])
  })
})

describe('AnnualTable · 公积金', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.resetModules()
  })

  it('未启用 fund 时不渲染公积金行', async () => {
    const useStore = (await import('../../src/composables/useStore')).useStore
    useStore()
    const AnnualTable = (await import('../../src/components/AnnualTable.vue')).default
    const results = calculate(useStore().data.value)
    const wrapper = mount(AnnualTable, { props: { results } })
    const rowLabels = wrapper.findAll('tbody td:first-child').map(td => td.text())
    expect(rowLabels).not.toContain('公积金')
    expect(rowLabels).not.toContain('总资产')
  })

  it('启用 fund 后渲染公积金行、不出现总资产行', async () => {
    const useStore = (await import('../../src/composables/useStore')).useStore
    const store = useStore()
    store.enableFund()
    store.updateFundEntry('contribution', store.data.value.systemParams.startMonth, 1000)
    const results = calculate(store.data.value)

    const AnnualTable = (await import('../../src/components/AnnualTable.vue')).default
    const wrapper = mount(AnnualTable, { props: { results } })
    const rowLabels = wrapper.findAll('tbody td:first-child').map(td => td.text())
    expect(rowLabels).toContain('年末公积金')
    expect(rowLabels).not.toContain('总资产')
  })

  it('aggregateByYear 含 totalAssets/fundBalance 年末值', async () => {
    const { aggregateByYear } = await import('../../src/composables/useCalculation')
    const useStore = (await import('../../src/composables/useStore')).useStore
    const store = useStore()
    store.enableFund()
    store.updateFundEntry('contribution', store.data.value.systemParams.startMonth, 1000)
    const results = calculate(store.data.value)
    const years = aggregateByYear(results)
    for (const y of years) {
      expect(typeof y.totalAssets).toBe('number')
      expect(typeof y.fundBalance).toBe('number')
    }
  })

  it('年度结余 = 年末存款 − 年初存款（含房贷月供与公积金转入）', async () => {
    // 用含公积金的真实数据：年度结余必须把房贷月供（支出）和
    // 公积金月冲/提取（转入可支配）都算进去，否则与「年末−年初」对不上
    localStorage.setItem('family-finance-plan', JSON.stringify({
      version: 1,
      scenarios: [{ id: 's1', name: '默认方案', plan: auditPlan as PlanData }],
      activeId: 's1',
    }))
    vi.resetModules()
    const useStore = (await import('../../src/composables/useStore')).useStore
    const store = useStore()
    const results = calculate(store.data.value)
    const AnnualTableCmp = (await import('../../src/components/AnnualTable.vue')).default
    const wrapper = mount(AnnualTableCmp, { props: { results } })

    const parse = (vals: string[]) => vals.map(v => Number(v.replace(/,/g, '')))
    const start = parse(rowText(wrapper, '年初存款').slice(1))
    const bal = parse(rowText(wrapper, '年度结余').slice(1))
    const end = parse(rowText(wrapper, '年末存款').slice(1))
    // 每一年的年度结余都应等于「年末存款 − 年初存款」（容差 2 容纳四舍五入）
    for (let i = 0; i < start.length; i++) {
      expect(Math.abs(bal[i] - (end[i] - start[i])), `${2026 + i}年`).toBeLessThan(2)
    }
  })
})
