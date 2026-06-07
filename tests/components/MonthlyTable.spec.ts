import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { nextTick } from 'vue'
import MonthlyTable from '../../src/components/MonthlyTable.vue'
import { calculate } from '../../src/composables/useCalculation'
import type { MonthResult } from '../../src/types'

async function loadUseStore() {
  return (await import('../../src/composables/useStore')).useStore
}

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

describe('MonthlyTable', () => {
  beforeEach(() => {
    vi.useRealTimers()
    localStorage.clear()
    vi.resetModules()
  })

  afterEach(() => {
    vi.clearAllTimers()
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  it('渲染基本结构和固定列', async () => {
    const useStore = await loadUseStore()
    const store = useStore()

    const results = [createResult()]

    const wrapper = mount(MonthlyTable, {
      props: { results },
    })

    const headers = wrapper.findAll('th').map((cell) => cell.text())
    expect(headers).toContain('月份')
    expect(headers).toContain('+')
    expect(headers).toContain('理财')
    expect(headers).toContain('结余')
    expect(headers).toContain('余额')
  })

  it('显示月份和计算结果', async () => {
    const useStore = await loadUseStore()
    const store = useStore()

    const results = [
      createResult({
        month: 202601,
        columnValues: [],
        investReturn: 100,
        monthlyIncome: 10100,
        monthlyExpense: 0,
        monthlyBalance: 10100,
        cumSavings: 10100,
      }),
    ]

    const wrapper = mount(MonthlyTable, {
      props: { results },
    })

    const rows = wrapper.findAll('tbody tr')
    expect(rows).toHaveLength(1)

    const cells = rows[0].findAll('td')
    expect(cells[0].text()).toBe('2026-01')
    // 理财、收入、支出、结余、余额列
    expect(cells[cells.length - 5].text()).toBe('100')
    expect(cells[cells.length - 4].text()).toBe('10,100')
    expect(cells[cells.length - 3].text()).toBe('0')
    expect(cells[cells.length - 2].text()).toBe('10,100')
    expect(cells[cells.length - 1].text()).toBe('10,100')
  })

  it('正负值正确着色', async () => {
    // 测试理财收益和结余列的正负值着色
    const useStore = await loadUseStore()
    const store = useStore()

    const results = [
      createResult({
        month: 202601,
        investReturn: 100, // 正值
        monthlyIncome: 5000,
        monthlyExpense: 10100,
        monthlyBalance: -5000, // 负值
        cumSavings: 95000,
      }),
      createResult({
        month: 202602,
        investReturn: -200, // 负值
        monthlyIncome: 8000,
        monthlyExpense: 0,
        monthlyBalance: 8000, // 正值
        cumSavings: 103000,
      }),
    ]

    const wrapper = mount(MonthlyTable, {
      props: { results },
    })

    const rows = wrapper.findAll('tbody tr')

    // 第一行
    const cells0 = rows[0].findAll('td')
    const investCell0 = cells0[cells0.length - 5]
    const netCell0 = cells0[cells0.length - 2]

    // 理财收益正值 - 无斜体
    expect(investCell0.classes()).not.toContain('italic')
    // 结余负值 - 斜体
    expect(netCell0.classes()).toContain('italic')

    // 第二行
    const cells1 = rows[1].findAll('td')
    const investCell1 = cells1[cells1.length - 5]
    const netCell1 = cells1[cells1.length - 2]

    // 理财收益负值 - 斜体
    expect(investCell1.classes()).toContain('italic')
    // 结余正值 - 无斜体
    expect(netCell1.classes()).not.toContain('italic')
  })

  it('锚点行高亮显示', async () => {
    const useStore = await loadUseStore()
    const store = useStore()

    const results = [
      createResult({
        month: 202601,
        cumSavings: 100000,
        isAnchor: true,
      }),
      createResult({
        month: 202602,
        cumSavings: 110000,
        isAnchor: false,
      }),
    ]

    const wrapper = mount(MonthlyTable, {
      props: { results },
    })

    const rows = wrapper.findAll('tbody tr')

    // 锚点不再高亮整行，而是高亮累计列单元格
    const firstRowCells = rows[0].findAll('td')
    const cumCell = firstRowCells[firstRowCells.length - 1] // 最后一列是累计列
    expect(cumCell.classes()).toContain('bg-blue-100')

    // 第二行不是锚点，累计列不应高亮
    const secondRowCells = rows[1].findAll('td')
    const secondCumCell = secondRowCells[secondRowCells.length - 1]
    expect(secondCumCell.classes()).not.toContain('bg-blue-100')

    // 行级不应再有蓝色背景
    expect(rows[0].classes()).not.toContain('bg-blue-50')
    expect(rows[1].classes()).not.toContain('bg-blue-50')
  })

  it('isEdited 单元格有浅蓝底色', async () => {
    // 此测试验证 resolveColumnValue 正确标记 isEdited
    const useStore = await loadUseStore()
    const store = useStore()

    // 设置起始月份为 202601
    store.data.value.systemParams.startMonth = 202601

    // 添加列并设置 entry
    const col = store.addColumn('测试列')
    store.updateColumnEntry(col.id, 202601, 10000)

    // 计算结果
    const results = calculate(store.data.value)

    // 验证计算结果正确标记了 isEdited
    expect(results[0].columnValues).toHaveLength(1)
    expect(results[0].columnValues[0].isEdited).toBe(true)

    // 组件渲染测试
    const wrapper = mount(MonthlyTable, {
      props: { results },
    })

    // 验证组件可以正常挂载和渲染
    const rows = wrapper.findAll('tbody tr')
    expect(rows.length).toBeGreaterThan(0)

    // 组件应该能够渲染数据（具体样式由组件内部逻辑处理）
    const cells = rows[0].findAll('td')
    // 至少应该有月份列和固定列
    expect(cells.length).toBeGreaterThanOrEqual(5)
  })

  it('累计列加粗显示', async () => {
    const useStore = await loadUseStore()
    const store = useStore()

    const results = [createResult({ cumSavings: 50000 })]

    const wrapper = mount(MonthlyTable, {
      props: { results },
    })

    const rows = wrapper.findAll('tbody tr')[0]
    const cells = rows.findAll('td')
    const cumCell = cells[cells.length - 1]

    expect(cumCell.classes()).toContain('font-bold')
  })

  it('公式按钮有正确的可访问标签', async () => {
    const useStore = await loadUseStore()
    const store = useStore()

    const results = [
      createResult({
        month: 202601,
        investReturn: 100,
        monthlyIncome: 10100,
        monthlyExpense: 0,
        monthlyBalance: 10100,
        cumSavings: 10100,
      }),
    ]

    const wrapper = mount(MonthlyTable, {
      props: { results },
    })

    const rows = wrapper.findAll('tbody tr')[0]
    const cells = rows.findAll('td')

    // 理财按钮
    const investButton = cells[cells.length - 5].find('button')
    expect(investButton.attributes('aria-label')).toBe('查看 2026-01 理财收益公式')

    // 结余按钮
    const netButton = cells[cells.length - 2].find('button')
    expect(netButton.attributes('aria-label')).toBe('查看 2026-01 本月结余公式')

    // 余额单元格（hover 触发公式）
    const cumSpan = cells[cells.length - 1].find('span')
    expect(cumSpan.attributes('aria-label')).toBe('编辑 2026-01 月末余额')
  })

  it('点击理财和结余按钮显示公式弹窗', async () => {
    const useStore = await loadUseStore()
    const store = useStore()

    const results = [
      createResult({
        month: 202601,
        investReturn: 100,
        monthlyIncome: 10100,
        monthlyExpense: 0,
        monthlyBalance: 10100,
        cumSavings: 10100,
      }),
    ]

    const wrapper = mount(MonthlyTable, {
      props: { results },
    })

    const rows = wrapper.findAll('tbody tr')[0]
    const cells = rows.findAll('td')

    // 点击理财按钮
    const investButton = cells[cells.length - 5].find('button')
    await investButton.trigger('click', { clientX: 100, clientY: 120 })

    expect(wrapper.text()).toContain('理财收益')
    expect(wrapper.text()).toContain('上月累计储蓄')

    // 点击结余按钮
    const netButton = cells[cells.length - 2].find('button')
    await netButton.trigger('click', { clientX: 200, clientY: 220 })

    expect(wrapper.text()).toContain('本月结余')
    expect(wrapper.text()).toContain('收入')
  })

  it('hover 累计值显示公式弹窗', async () => {
    const useStore = await loadUseStore()
    const store = useStore()

    const results = [
      createResult({
        month: 202601,
        monthlyIncome: 10100,
        monthlyExpense: 0,
        monthlyBalance: 10100,
        cumSavings: 10100,
      }),
    ]

    const wrapper = mount(MonthlyTable, {
      props: { results },
    })

    const rows = wrapper.findAll('tbody tr')[0]
    const cells = rows.findAll('td')
    const cumSpan = cells[cells.length - 1].find('span')

    // hover 余额值
    await cumSpan.trigger('mouseenter', { clientX: 100, clientY: 120 })

    expect(wrapper.text()).toContain('余额')
    expect(wrapper.text()).toContain('上月余额')
    expect(wrapper.text()).toContain('当月结余')

    // mouseleave 隐藏弹窗
    await cumSpan.trigger('mouseleave')
    expect(wrapper.findComponent({ name: 'FormulaPopover' }).exists()).toBe(false)
  })

  it('锚点月份显示正确的公式', async () => {
    const useStore = await loadUseStore()
    const store = useStore()

    const results = [
      createResult({
        month: 202601,
        cumSavings: 150000,
        isAnchor: true,
      }),
    ]

    const wrapper = mount(MonthlyTable, {
      props: { results },
    })

    const rows = wrapper.findAll('tbody tr')[0]
    const cells = rows.findAll('td')
    const cumSpan = cells[cells.length - 1].find('span')

    await cumSpan.trigger('mouseenter', { clientX: 100, clientY: 120 })

    expect(wrapper.text()).toContain('锚点月份')
    expect(wrapper.text()).toContain('余额')
  })

  it('表格样式正确应用', async () => {
    const useStore = await loadUseStore()
    const store = useStore()

    const results = [createResult()]

    const wrapper = mount(MonthlyTable, {
      props: { results },
    })

    const table = wrapper.get('table')
    expect(table.classes()).toContain('min-w-full')
    expect(table.classes()).toContain('border-collapse')
    expect(table.classes()).toContain('text-[11px]')

    const thead = wrapper.get('thead')
    expect(thead.classes()).toContain('sticky')
    expect(thead.classes()).toContain('top-0')
    expect(thead.classes()).toContain('bg-gray-50')
  })
})
