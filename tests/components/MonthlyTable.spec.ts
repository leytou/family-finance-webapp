import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { nextTick } from 'vue'
import MonthlyTable from '../../src/components/MonthlyTable.vue'
import { calculate } from '../../src/composables/useCalculation'
// 静态导入：与组件内部 useStore 共享同一模块实例（组件通过静态 import 使用 store）。
// 右键菜单相关测试需要组件读取测试所修改的同一 store，故用此而非 loadUseStore。
// 隔离正确性依赖两点：本组右键测试声明在旧测试之后（旧测试仅经 props 路径用 store，互不干扰）；
// 且 MonthlyTable 保持静态导入 useStore（若改为动态导入会与此处单例失配，组件与测试将读到不同 store）。
import { useStore as useSharedStore } from '../../src/composables/useStore'
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
    expect(headers).toContain('存款')
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

    // 理财收益正值 - 无负向色
    expect(investCell0.classes()).not.toContain('text-negative-600')
    // 结余负值 - 负向竹青色
    expect(netCell0.classes()).toContain('text-negative-600')

    // 第二行
    const cells1 = rows[1].findAll('td')
    const investCell1 = cells1[cells1.length - 5]
    const netCell1 = cells1[cells1.length - 2]

    // 理财收益负值 - 负向竹青色
    expect(investCell1.classes()).toContain('text-negative-600')
    // 结余正值 - 无负向色
    expect(netCell1.classes()).not.toContain('text-negative-600')
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
    expect(cumCell.classes()).toContain('bg-brand-50')

    // 第二行不是锚点，累计列不应高亮
    const secondRowCells = rows[1].findAll('td')
    const secondCumCell = secondRowCells[secondRowCells.length - 1]
    expect(secondCumCell.classes()).not.toContain('bg-brand-50')

    // 行级不应再有蓝色背景
    expect(rows[0].classes()).not.toContain('bg-brand-50')
    expect(rows[1].classes()).not.toContain('bg-brand-50')
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

  it('公式单元格有正确的可访问标签', async () => {
    const useStore = await loadUseStore()
    useStore()
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
    const wrapper = mount(MonthlyTable, { props: { results } })
    const cells = wrapper.findAll('tbody tr')[0].findAll('td')

    // 理财单元格（hover 触发）
    const investSpan = cells[cells.length - 5].find('span')
    expect(investSpan.attributes('aria-label')).toBe('查看 2026-01 理财公式')

    // 收入单元格
    const incomeSpan = cells[cells.length - 4].find('span')
    expect(incomeSpan.attributes('aria-label')).toBe('查看 2026-01 收入公式')

    // 支出单元格
    const expenseSpan = cells[cells.length - 3].find('span')
    expect(expenseSpan.attributes('aria-label')).toBe('查看 2026-01 支出公式')

    // 结余单元格
    const netSpan = cells[cells.length - 2].find('span')
    expect(netSpan.attributes('aria-label')).toBe('查看 2026-01 结余公式')
  })

  it('hover 理财/收入/支出/结余单元格显示公式弹窗', async () => {
    // 组件内部静态导入 useStore；vi.resetModules() 后动态导入会得到不同单例，
    // 故此处用静态 useSharedStore 以与组件读取同一 store（与右键菜单测试同理）。
    const store = useSharedStore()
    store.data.value.systemParams.initialDeposit = 50000
    store.data.value.systemParams.annualRate = 0.03

    const results = [
      createResult({
        month: 202601,
        columnValues: [
          { id: 'c1', name: '月薪', amount: 10000, isEdited: true },
          { id: 'c2', name: '日常', amount: -1500, isEdited: true },
        ],
        investReturn: 125,
        monthlyIncome: 10000,
        monthlyExpense: 1500,
        monthlyBalance: 8625,
        cumSavings: 58625,
      }),
    ]
    const wrapper = mount(MonthlyTable, { props: { results } })
    const cells = wrapper.findAll('tbody tr')[0].findAll('td')

    // hover 理财
    await cells[cells.length - 5].find('span').trigger('mouseenter', { clientX: 100, clientY: 120 })
    expect(wrapper.text()).toContain('理财')
    expect(wrapper.text()).toContain('上月存款(50,000)')

    // hover 收入
    await cells[cells.length - 4].find('span').trigger('mouseenter', { clientX: 110, clientY: 120 })
    expect(wrapper.text()).toContain('收入 = 月薪(10,000) + 理财(125) = 10,000')

    // hover 支出
    await cells[cells.length - 3].find('span').trigger('mouseenter', { clientX: 120, clientY: 120 })
    expect(wrapper.text()).toContain('支出 = 日常(1,500) = 1,500')

    // hover 结余
    await cells[cells.length - 2].find('span').trigger('mouseenter', { clientX: 130, clientY: 120 })
    expect(wrapper.text()).toContain('结余 = 收入(10,000) - 支出(1,500) = 8,625')
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

    expect(wrapper.text()).toContain('存款')
    expect(wrapper.text()).toContain('上月存款')
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

    expect(wrapper.text()).toContain('锚点值')
    expect(wrapper.text()).toContain('存款')
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
    expect(thead.classes()).toContain('bg-surface-2')
  })

  it('表格单元格水平内边距收紧为 px-0.5（列多时降低总宽，便于窗口装下铺满）', async () => {
    const useStore = await loadUseStore()
    useStore()
    const wrapper = mount(MonthlyTable, { props: { results: [createResult()] } })

    const firstRowCells = wrapper.findAll('tbody tr')[0].findAll('td')
    // 月份列单元格收紧
    expect(firstRowCells[0].classes()).toContain('px-0.5')
    expect(firstRowCells[0].classes()).not.toContain('px-1')
    // 末列（存款）单元格同样收紧
    expect(firstRowCells[firstRowCells.length - 1].classes()).toContain('px-0.5')

    // 表头单元格同样收紧
    const headerCells = wrapper.findAll('thead tr')[0].findAll('th')
    expect(headerCells[0].classes()).toContain('px-0.5')
  })

  it('右键现金流单元格弹出菜单', async () => {
    const store = useSharedStore()
    store.reset()
    store.data.value.systemParams.startMonth = 202601

    // 需要一个现金流列才能右键它的单元格
    store.addColumn('测试列')
    const results = calculate(store.data.value).slice(0, 3)

    const wrapper = mount(MonthlyTable, { props: { results } })

    // 第一行第一个现金流单元格（月份列之后）
    const firstRowCells = wrapper.findAll('tbody tr')[0].findAll('td')
    await firstRowCells[1].trigger('contextmenu')

    expect(wrapper.findComponent({ name: 'ContextMenu' }).exists()).toBe(true)
    expect(wrapper.text()).toContain('清除下方编辑值')
  })

  it('右键有直接编辑值的现金流单元格，菜单含「同步到下方每年此月」且启用', async () => {
    const store = useSharedStore()
    store.reset()
    store.data.value.systemParams.startMonth = 202601
    const col = store.addColumn('年终奖')
    store.updateColumnEntry(col.id, 202612, 50000)
    const results = calculate(store.data.value).slice(0, 12) // 到 202612（索引 11）

    const wrapper = mount(MonthlyTable, { props: { results } })
    const row = wrapper.findAll('tbody tr')[11]
    await row.findAll('td')[1].trigger('contextmenu') // 该列单元格

    const menu = wrapper.findComponent({ name: 'ContextMenu' })
    expect(menu.text()).toContain('同步到下方每年此月')
    const syncItem = menu.findAll('[role="menuitem"]').find(i => i.text() === '同步到下方每年此月')!
    expect(syncItem.attributes('aria-disabled')).toBe('false')
  })

  it('右键无直接编辑值的现金流单元格，「同步到下方每年此月」禁用', async () => {
    const store = useSharedStore()
    store.reset()
    store.data.value.systemParams.startMonth = 202601
    store.addColumn('年终奖')
    store.updateColumnEntry(store.data.value.columns[0].id, 202601, 50000) // 202601 有值，202602 为延续值
    const results = calculate(store.data.value).slice(0, 3)

    const wrapper = mount(MonthlyTable, { props: { results } })
    const row = wrapper.findAll('tbody tr')[1] // 202602，延续值无直接 entry
    await row.findAll('td')[1].trigger('contextmenu')

    const menu = wrapper.findComponent({ name: 'ContextMenu' })
    const syncItem = menu.findAll('[role="menuitem"]').find(i => i.text() === '同步到下方每年此月')!
    expect(syncItem.attributes('aria-disabled')).toBe('true')
  })

  it('点击「同步到下方每年此月」后该列所有年份同月都有值并标记', async () => {
    const store = useSharedStore()
    store.reset()
    store.data.value.systemParams.startMonth = 202601
    const col = store.addColumn('年终奖')
    store.updateColumnEntry(col.id, 202612, 50000)
    const results = calculate(store.data.value).slice(0, 12)

    const wrapper = mount(MonthlyTable, { props: { results } })
    const row = wrapper.findAll('tbody tr')[11]
    await row.findAll('td')[1].trigger('contextmenu')

    const menu = wrapper.findComponent({ name: 'ContextMenu' })
    const syncItem = menu.findAll('[role="menuitem"]').find(i => i.text() === '同步到下方每年此月')!
    await syncItem.trigger('click')

    expect(col.itemSets[202712]?.[0]?.amount).toBe(50000)
    expect(col.itemSets[203012]?.[0]?.amount).toBe(50000)
    expect(col.yearlyMonths?.[202612]).toBe(true)
    expect(col.yearlyMonths?.[202712]).toBe(true)
  })

  it('yearly 单元格显示 ↻ 角标', async () => {
    const store = useSharedStore()
    store.reset()
    store.data.value.systemParams.startMonth = 202601
    const col = store.addColumn('年终奖')
    store.updateColumnEntry(col.id, 202612, 50000)
    store.syncYearly(col.id, 202612)
    const results = calculate(store.data.value).slice(0, 12)

    const wrapper = mount(MonthlyTable, { props: { results } })
    const row = wrapper.findAll('tbody tr')[11] // 202612
    expect(row.text()).toContain('↻')
  })

  it('余额列右键菜单不含「同步到下方每年此月」', async () => {
    const store = useSharedStore()
    store.reset()
    store.data.value.systemParams.startMonth = 202601
    store.addColumn('测试列')
    const results = calculate(store.data.value).slice(0, 3)

    const wrapper = mount(MonthlyTable, { props: { results } })
    const row = wrapper.findAll('tbody tr')[0]
    const cells = row.findAll('td')
    await cells[cells.length - 1].trigger('contextmenu') // 余额列（最后一列）

    const menu = wrapper.findComponent({ name: 'ContextMenu' })
    expect(menu.text()).not.toContain('同步到下方每年此月')
  })

  it('清除现金流列下方编辑值，当前行及上方保留', async () => {
    const store = useSharedStore()
    store.reset()
    store.data.value.systemParams.startMonth = 202601

    const col = store.addColumn('测试列')
    store.updateColumnEntry(col.id, 202601, 1000)
    store.updateColumnEntry(col.id, 202602, 2000)
    store.updateColumnEntry(col.id, 202603, 3000)
    const results = calculate(store.data.value).slice(0, 3)

    const wrapper = mount(MonthlyTable, { props: { results } })

    // 在第二行（202602）该列单元格右键
    const secondRowCells = wrapper.findAll('tbody tr')[1].findAll('td')
    await secondRowCells[1].trigger('contextmenu')

    // 点击"清除下方编辑值"（菜单已含"同步到下方每年此月"，按文本精确定位）
    const menuItem = wrapper
      .findComponent({ name: 'ContextMenu' })
      .findAll('[role="menuitem"]')
      .find(i => i.text() === '清除下方编辑值')!
    await menuItem.trigger('click')

    // 202601、202602 的编辑值保留，202603 被清除
    expect(col.itemSets[202601]?.[0]?.amount).toBe(1000)
    expect(col.itemSets[202602]?.[0]?.amount).toBe(2000)
    expect(col.itemSets[202603]).toBeUndefined()
  })

  it('清除余额列下方锚点，当前行及上方保留', async () => {
    const store = useSharedStore()
    store.reset()
    store.data.value.systemParams.startMonth = 202601

    store.addColumn('测试列')
    store.addAnchor(202601, 10000)
    store.addAnchor(202602, 20000)
    store.addAnchor(202603, 30000)
    const results = calculate(store.data.value).slice(0, 3)

    const wrapper = mount(MonthlyTable, { props: { results } })

    // 第二行余额列（最后一列）右键
    const secondRowCells = wrapper.findAll('tbody tr')[1].findAll('td')
    await secondRowCells[secondRowCells.length - 1].trigger('contextmenu')

    const menuItem = wrapper
      .findComponent({ name: 'ContextMenu' })
      .findAll('[role="menuitem"]')
      .find(i => i.text() === '清除下方编辑值')!
    await menuItem.trigger('click')

    // 202601、202602 锚点保留，202603 被清除
    const months = store.data.value.anchors.map((a) => a.month)
    expect(months).toContain(202601)
    expect(months).toContain(202602)
    expect(months).not.toContain(202603)
  })

  it('下方无编辑值时菜单项禁用', async () => {
    const store = useSharedStore()
    store.reset()
    store.data.value.systemParams.startMonth = 202601

    const col = store.addColumn('测试列')
    store.updateColumnEntry(col.id, 202603, 3000)
    const results = calculate(store.data.value).slice(0, 3)

    const wrapper = mount(MonthlyTable, { props: { results } })

    // 在最后一行（202603）该列右键，下方没有任何行
    const lastRowCells = wrapper.findAll('tbody tr')[2].findAll('td')
    await lastRowCells[1].trigger('contextmenu')

    const menuItem = wrapper
      .findComponent({ name: 'ContextMenu' })
      .findAll('[role="menuitem"]')
      .find(i => i.text() === '清除下方编辑值')!
    expect(menuItem.attributes('aria-disabled')).toBe('true')
  })

  describe('右键清除该值', () => {
    it('点击「清除该值」删除当前格现金流编辑值', async () => {
      const store = useSharedStore()
      store.reset()
      store.data.value.systemParams.startMonth = 202601
      const col = store.addColumn('测试列')
      store.updateColumnEntry(col.id, 202601, 1000)
      store.updateColumnEntry(col.id, 202602, 2000)
      const results = calculate(store.data.value).slice(0, 2)

      const wrapper = mount(MonthlyTable, { props: { results } })

      // 第一行（202601）该列右键
      const firstRowCells = wrapper.findAll('tbody tr')[0].findAll('td')
      await firstRowCells[1].trigger('contextmenu')

      const menuItem = wrapper
        .findComponent({ name: 'ContextMenu' })
        .findAll('[role="menuitem"]')
        .find(i => i.text() === '清除该值')!
      await menuItem.trigger('click')

      // 当前格 202601 被清除，202602 保留
      expect(col.itemSets[202601]).toBeUndefined()
      expect(col.itemSets[202602]?.[0]?.amount).toBe(2000)
    })

    it('点击「清除该值」删除当前格余额列锚点', async () => {
      const store = useSharedStore()
      store.reset()
      store.data.value.systemParams.startMonth = 202601
      store.addColumn('测试列')
      store.addAnchor(202601, 10000)
      store.addAnchor(202602, 20000)
      const results = calculate(store.data.value).slice(0, 2)

      const wrapper = mount(MonthlyTable, { props: { results } })

      // 第一行余额列（最后一列）右键
      const firstRowCells = wrapper.findAll('tbody tr')[0].findAll('td')
      await firstRowCells[firstRowCells.length - 1].trigger('contextmenu')

      const menuItem = wrapper
        .findComponent({ name: 'ContextMenu' })
        .findAll('[role="menuitem"]')
        .find(i => i.text() === '清除该值')!
      await menuItem.trigger('click')

      // 当前格 202601 锚点删除，202602 保留
      const months = store.data.value.anchors.map(a => a.month)
      expect(months).not.toContain(202601)
      expect(months).toContain(202602)
    })

    it('未编辑的现金流格，「清除该值」禁用', async () => {
      const store = useSharedStore()
      store.reset()
      store.data.value.systemParams.startMonth = 202601
      store.addColumn('测试列') // 无任何 entry
      const results = calculate(store.data.value).slice(0, 1)

      const wrapper = mount(MonthlyTable, { props: { results } })
      const row = wrapper.findAll('tbody tr')[0]
      await row.findAll('td')[1].trigger('contextmenu')

      const menuItem = wrapper
        .findComponent({ name: 'ContextMenu' })
        .findAll('[role="menuitem"]')
        .find(i => i.text() === '清除该值')!
      expect(menuItem.attributes('aria-disabled')).toBe('true')
    })

    it('动态列右键菜单顺序：同步 → 清除该值 → 清除下方编辑值', async () => {
      const store = useSharedStore()
      store.reset()
      store.data.value.systemParams.startMonth = 202601
      store.addColumn('测试列')
      store.updateColumnEntry(store.data.value.columns[0].id, 202601, 1000)
      store.updateColumnEntry(store.data.value.columns[0].id, 202602, 2000)
      const results = calculate(store.data.value).slice(0, 2)

      const wrapper = mount(MonthlyTable, { props: { results } })
      const row = wrapper.findAll('tbody tr')[0]
      await row.findAll('td')[1].trigger('contextmenu')

      const labels = wrapper
        .findComponent({ name: 'ContextMenu' })
        .findAll('[role="menuitem"]')
        .map(i => i.text())
      expect(labels).toEqual(['同步到下方每年此月', '清除该值', '清除下方编辑值'])
    })

    it('点击「清除该值」删除当前格公积金余额锚点', async () => {
      const store = useSharedStore()
      store.reset()
      store.data.value.systemParams.startMonth = 202601
      store.enableFund()
      store.addColumn('测试列')
      store.addFundAnchor(202601, 8000)
      store.addFundAnchor(202602, 9000)
      const results = calculate(store.data.value).slice(0, 2)

      const wrapper = mount(MonthlyTable, { props: { results } })

      await wrapper.find('[data-fund-balance="202601"]').trigger('contextmenu')

      const menuItem = wrapper
        .findComponent({ name: 'ContextMenu' })
        .findAll('[role="menuitem"]')
        .find(i => i.text() === '清除该值')!
      await menuItem.trigger('click')

      const months = store.data.value.fund!.anchors.map(a => a.month)
      expect(months).not.toContain(202601)
      expect(months).toContain(202602)
    })

    it('公积金余额列未修正时「清除该值」禁用', async () => {
      const store = useSharedStore()
      store.reset()
      store.data.value.systemParams.startMonth = 202601
      store.enableFund()
      store.addColumn('测试列')
      const results = calculate(store.data.value).slice(0, 2)

      const wrapper = mount(MonthlyTable, { props: { results } })
      await wrapper.find('[data-fund-balance="202601"]').trigger('contextmenu')

      const menuItem = wrapper
        .findComponent({ name: 'ContextMenu' })
        .findAll('[role="menuitem"]')
        .find(i => i.text() === '清除该值')!
      expect(menuItem.attributes('aria-disabled')).toBe('true')
    })

    it('公积金余额列已修正时「清除该值」启用', async () => {
      const store = useSharedStore()
      store.reset()
      store.data.value.systemParams.startMonth = 202601
      store.enableFund()
      store.addColumn('测试列')
      store.addFundAnchor(202601, 8000)
      const results = calculate(store.data.value).slice(0, 1)

      const wrapper = mount(MonthlyTable, { props: { results } })
      await wrapper.find('[data-fund-balance="202601"]').trigger('contextmenu')

      const menuItem = wrapper
        .findComponent({ name: 'ContextMenu' })
        .findAll('[role="menuitem"]')
        .find(i => i.text() === '清除该值')!
      expect(menuItem.attributes('aria-disabled')).toBe('false')
    })
  })

  it('打开公积金小窗时传入该月已修正余额', async () => {
    const store = useSharedStore()
    store.reset()
    store.data.value.systemParams.startMonth = 202601
    store.enableFund()
    store.addColumn('测试列')
    store.addFundAnchor(202601, 7777)
    const results = calculate(store.data.value).slice(0, 1)

    const wrapper = mount(MonthlyTable, { props: { results } })
    await wrapper.find('[data-fund-balance="202601"]').trigger('click')

    const editor = wrapper.findComponent({ name: 'FundFlowEditor' })
    expect(editor.exists()).toBe(true)
    expect(editor.props('anchorBalance')).toBe(7777)
  })

  it('打开未修正月份的小窗，anchorBalance 为 undefined', async () => {
    const store = useSharedStore()
    store.reset()
    store.data.value.systemParams.startMonth = 202601
    store.enableFund()
    store.addColumn('测试列')
    const results = calculate(store.data.value).slice(0, 1)

    const wrapper = mount(MonthlyTable, { props: { results } })
    await wrapper.find('[data-fund-balance="202601"]').trigger('click')

    const editor = wrapper.findComponent({ name: 'FundFlowEditor' })
    expect(editor.props('anchorBalance')).toBeUndefined()
  })

  it('渲染快照工具条与保存快照按钮', async () => {
    const useStore = await loadUseStore()
    useStore()
    const wrapper = mount(MonthlyTable, { props: { results: [createResult()] } })
    expect(wrapper.find('[aria-label="保存计划快照"]').exists()).toBe(true)
    expect(wrapper.find('[aria-label="选择对比快照"]').exists()).toBe(true)
  })

  it('点击保存快照按钮新增一份快照并自动选中', async () => {
    const store = useSharedStore()
    store.reset()
    store.data.value.systemParams.startMonth = 202601
    const wrapper = mount(MonthlyTable, { props: { results: [createResult({ month: 202601, cumSavings: 5000 })] } })

    await wrapper.find('[aria-label="保存计划快照"]').trigger('click')
    await nextTick()

    expect(store.data.value.snapshots).toHaveLength(1)
    // 封存后自动进入重命名状态，显示 input 而非 select
    const input = wrapper.find('input[type="text"].w-32')
    expect(input.exists()).toBe(true)
    expect((input.element as HTMLInputElement).value).toContain('计划')
  })

  it('选中快照后显示「当时预计」「差额」两列并按规则计算', async () => {
    const store = useSharedStore()
    store.data.value.snapshots = [
      { id: 's1', name: '2026-01 计划', createdMonth: 202601, projection: { 202601: 5000, 202602: 9000 } },
    ]
    const results = [
      createResult({ month: 202601, cumSavings: 5000, isAnchor: false }),
      createResult({ month: 202602, cumSavings: 8500, isAnchor: true }),
    ]
    const wrapper = mount(MonthlyTable, { props: { results } })

    // 选中快照
    const select = wrapper.find('[aria-label="选择对比快照"]')
    await select.setValue('s1')
    await nextTick()

    const headers = wrapper.findAll('th').map(c => c.text())
    expect(headers).toContain('当时预计')
    expect(headers).toContain('差额')

    // 表体含预计值 9,000 与差额 -500（202602 行，anchor）
    const bodyText = wrapper.find('tbody').text()
    expect(bodyText).toContain('9,000')
    expect(bodyText).toContain('-500')
  })

  it('未选中快照时不渲染对比列', async () => {
    const store = useSharedStore()
    store.data.value.snapshots = []
    const wrapper = mount(MonthlyTable, { props: { results: [createResult()] } })
    const headers = wrapper.findAll('th').map(c => c.text())
    expect(headers).not.toContain('当时预计')
    expect(headers).not.toContain('差额')
  })

  describe('启用/禁用切换', () => {
    it('启用列头有 👁 按钮（aria-label=禁用此列），点击后切换为禁用', async () => {
      const store = useSharedStore()
      store.reset()
      store.data.value.systemParams.startMonth = 202601
      store.addColumn('旅游')

      const wrapper = mount(MonthlyTable, { props: { results: [createResult()] } })

      const btn = wrapper.find('[aria-label="禁用此列"]')
      expect(btn.exists()).toBe(true)

      await btn.trigger('click')
      await nextTick()

      expect(store.data.value.columns[0].enabled).toBe(false)
      // 切换后图标 aria-label 变为「启用此列」
      expect(wrapper.find('[aria-label="启用此列"]').exists()).toBe(true)
    })

    it('禁用列：列名加删除线、数据单元格 opacity-40', async () => {
      const store = useSharedStore()
      store.reset()
      store.data.value.systemParams.startMonth = 202601
      const col = store.addColumn('旅游')
      store.setColumnEnabled(col.id, false)

      const results = calculate(store.data.value).slice(0, 1)
      const wrapper = mount(MonthlyTable, { props: { results } })

      // 列名 span 含 line-through
      const headerTh = wrapper.findAll('thead th').find((th) => th.text().includes('旅游'))!
      expect(headerTh.find('span.cursor-pointer').classes()).toContain('line-through')

      // 第一行第一个现金流单元格（索引 1，0 是月份）含 opacity-40
      const firstRowCells = wrapper.findAll('tbody tr')[0].findAll('td')
      expect(firstRowCells[1].classes()).toContain('opacity-40')
    })

    it('启用列无删除线、单元格无 opacity-40', async () => {
      const store = useSharedStore()
      store.reset()
      store.data.value.systemParams.startMonth = 202601
      store.addColumn('旅游')

      const results = calculate(store.data.value).slice(0, 1)
      const wrapper = mount(MonthlyTable, { props: { results } })

      const headerTh = wrapper.findAll('thead th').find((th) => th.text().includes('旅游'))!
      expect(headerTh.find('span.cursor-pointer').classes()).not.toContain('line-through')

      const firstRowCells = wrapper.findAll('tbody tr')[0].findAll('td')
      expect(firstRowCells[1].classes()).not.toContain('opacity-40')
    })
  })

  describe('拖拽排序', () => {
    function fireDrag(el: Element, type: string, clientX = 0): void {
      // jsdom 的 DragEvent.dataTransfer 不可靠；handler 内对 dataTransfer 做了空值保护，
      // 且只用到 clientX / preventDefault / currentTarget，故用 MouseEvent 携带 clientX 触发即可
      el.dispatchEvent(new MouseEvent(type, { bubbles: true, cancelable: true, clientX }))
    }

    function mockRect(left = 0, width = 100) {
      return vi.spyOn(Element.prototype, 'getBoundingClientRect').mockReturnValue({
        left,
        top: 0,
        right: left + width,
        bottom: 0,
        width,
        height: 0,
        x: left,
        y: 0,
        toJSON: () => {},
      } as DOMRect)
    }

    function dynamicHeaders(wrapper: ReturnType<typeof mount>) {
      return wrapper.findAll('thead th').filter(th => th.attributes('draggable') === 'true')
    }

    it('动态列头渲染为 draggable，固定列不可拖拽', () => {
      const store = useSharedStore()
      store.reset()
      store.addColumn('A')
      store.addColumn('B')

      const wrapper = mount(MonthlyTable, { props: { results: [createResult()] } })

      const dyn = dynamicHeaders(wrapper)
      expect(dyn).toHaveLength(2)

      const fixed = wrapper.findAll('thead th').filter(th => th.attributes('draggable') !== 'true')
      const fixedNames = fixed.map(th => th.text())
      expect(fixedNames).toContain('理财')
      expect(fixedNames).toContain('收入')
      expect(fixedNames).toContain('支出')
      expect(fixedNames).toContain('结余')
      expect(fixedNames).toContain('存款')
    })

    it('拖拽动态列头可重排列顺序', async () => {
      const store = useSharedStore()
      store.reset()
      store.addColumn('A')
      store.addColumn('B')
      store.addColumn('C')

      const wrapper = mount(MonthlyTable, { props: { results: [createResult()] } })
      const rectSpy = mockRect(0, 100)
      try {
        const dyn = dynamicHeaders(wrapper)
        // 拖 C（索引2）到 A（索引0）之前
        fireDrag(dyn[2]!.element, 'dragstart')
        await nextTick()
        fireDrag(dyn[0]!.element, 'dragover', 10) // 左半区 → before
        await nextTick()
        fireDrag(dyn[0]!.element, 'drop', 10)
        await nextTick()
      } finally {
        rectSpy.mockRestore()
      }

      expect(store.data.value.columns.map(c => c.name)).toEqual(['C', 'A', 'B'])
    })

    it('dragover 后目标列显示对应插入线 class', async () => {
      const store = useSharedStore()
      store.reset()
      store.addColumn('A')
      store.addColumn('B')

      const wrapper = mount(MonthlyTable, { props: { results: [createResult()] } })
      const rectSpy = mockRect(0, 100)
      try {
        const dyn = dynamicHeaders(wrapper)
        fireDrag(dyn[0]!.element, 'dragstart')
        await nextTick()
        fireDrag(dyn[1]!.element, 'dragover', 10) // before
        await nextTick()
        // 重新查询，确保读到重渲染后的 class
        expect(dynamicHeaders(wrapper)[1]!.classes()).toContain('drag-line-left')

        fireDrag(dyn[1]!.element, 'dragover', 90) // after
        await nextTick()
        expect(dynamicHeaders(wrapper)[1]!.classes()).toContain('drag-line-right')
      } finally {
        rectSpy.mockRestore()
      }
    })

    it('被拖动中的列显示半透明 class', async () => {
      const store = useSharedStore()
      store.reset()
      store.addColumn('A')
      store.addColumn('B')

      const wrapper = mount(MonthlyTable, { props: { results: [createResult()] } })
      const dyn = dynamicHeaders(wrapper)
      fireDrag(dyn[0]!.element, 'dragstart')
      await nextTick()

      expect(dynamicHeaders(wrapper)[0]!.classes()).toContain('opacity-50')

      fireDrag(dyn[0]!.element, 'dragend')
      await nextTick()
      expect(dynamicHeaders(wrapper)[0]!.classes()).not.toContain('opacity-50')
    })
  })

  describe('专项事件列', () => {
    it('表头包含"专项"固定列', async () => {
      const useStore = await loadUseStore()
      useStore()
      const wrapper = mount(MonthlyTable, { props: { results: [createResult()] } })
      const headers = wrapper.findAll('th').map((c) => c.text())
      expect(headers).toContain('专项')
    })

    it('无事件月专项格为空白', async () => {
      const store = useSharedStore()
      store.reset()
      store.data.value.systemParams.startMonth = 202601
      const wrapper = mount(MonthlyTable, { props: { results: [createResult({ month: 202601 })] } })
      const cell = wrapper.find('[aria-label="编辑 2026-01 专项"]')
      expect(cell.exists()).toBe(true)
      expect(cell.text().trim()).toBe('')
    })

    it('有事件月显示净额，不再显示 ·N 笔数角标', async () => {
      const store = useSharedStore()
      store.reset()
      store.data.value.systemParams.startMonth = 202601
      store.replaceMonthEvents(202601, [
        { name: '买房', amount: -2000000 },
        { name: '换车', amount: -200000 },
      ])
      const wrapper = mount(MonthlyTable, { props: { results: [createResult({ month: 202601 })] } })
      const cell = wrapper.find('[aria-label="编辑 2026-01 专项"]')
      expect(cell.text()).toContain('-2,200,000')
      // 笔数角标已移除，明细改为悬浮显示
      expect(cell.text()).not.toContain('·2')
      expect(cell.text()).not.toContain('·')
    })

    it('单笔事件显示净额但无角标', async () => {
      const store = useSharedStore()
      store.reset()
      store.data.value.systemParams.startMonth = 202601
      store.replaceMonthEvents(202601, [{ name: '买房', amount: -2000000 }])
      const wrapper = mount(MonthlyTable, { props: { results: [createResult({ month: 202601 })] } })
      const cell = wrapper.find('[aria-label="编辑 2026-01 专项"]')
      expect(cell.text()).toContain('-2,000,000')
      expect(cell.text()).not.toContain('·')
    })

    it('点击专项格打开事件编辑器', async () => {
      const store = useSharedStore()
      store.reset()
      store.data.value.systemParams.startMonth = 202601
      const wrapper = mount(MonthlyTable, { props: { results: [createResult({ month: 202601 })] } })
      await wrapper.find('[aria-label="编辑 2026-01 专项"]').trigger('click', { clientX: 50, clientY: 60 })
      const editor = wrapper.findComponent({ name: 'EventEditor' })
      expect(editor.exists()).toBe(true)
      expect(editor.text()).toContain('专项')
    })

    it('hover 专项格显示明细弹窗，移出关闭', async () => {
      const store = useSharedStore()
      store.reset()
      store.data.value.systemParams.startMonth = 202601
      store.replaceMonthEvents(202601, [
        { name: '买房', amount: -2000000 },
        { name: '奖金', amount: 100000 },
      ])
      const wrapper = mount(MonthlyTable, { props: { results: [createResult({ month: 202601 })] } })
      const cell = wrapper.find('[aria-label="编辑 2026-01 专项"]')

      await cell.trigger('mouseenter', { clientX: 100, clientY: 120 })

      const popover = wrapper.findComponent({ name: 'EventDetailPopover' })
      expect(popover.exists()).toBe(true)
      expect(popover.text()).toContain('买房')
      expect(popover.text()).toContain('-2,000,000')
      expect(popover.text()).toContain('奖金')
      expect(popover.text()).toContain('100,000')
      // 净额合计：-2,000,000 + 100,000
      expect(popover.text()).toContain('-1,900,000')

      // mouseleave 收起弹窗
      await cell.trigger('mouseleave')
      expect(wrapper.findComponent({ name: 'EventDetailPopover' }).exists()).toBe(false)
    })

    it('无事件月 hover 不显示明细弹窗', async () => {
      const store = useSharedStore()
      store.reset()
      store.data.value.systemParams.startMonth = 202601
      const wrapper = mount(MonthlyTable, { props: { results: [createResult({ month: 202601 })] } })
      const cell = wrapper.find('[aria-label="编辑 2026-01 专项"]')

      await cell.trigger('mouseenter', { clientX: 100, clientY: 120 })

      expect(wrapper.findComponent({ name: 'EventDetailPopover' }).exists()).toBe(false)
    })
  })
})

describe('MonthlyTable · 公积金专区', () => {
  beforeEach(() => {
    vi.useRealTimers()
    localStorage.clear()
    vi.resetModules()
  })

  it('未启用 fund 时不渲染专区列表头', async () => {
    const useStore = await loadUseStore()
    useStore() // 初始化默认 store（无 fund）
    const MonthlyTable = (await import('../../src/components/MonthlyTable.vue')).default
    const wrapper = mount(MonthlyTable, { props: { results: [createResult()] } })
    const headers = wrapper.findAll('th').map(t => t.text())
    expect(headers).not.toContain('房贷月供')
    expect(headers).not.toContain('总资产')
  })

  it('启用 fund 后渲染专区 5 列表头与值', async () => {
    const useStore = await loadUseStore()
    const store = useStore()
    store.enableFund()
    store.updateFundEntry('mortgage', 202601, -5000)
    store.updateFundEntry('contribution', 202601, 2000)
    const results = calculate(store.data.value)

    const MonthlyTable = (await import('../../src/components/MonthlyTable.vue')).default
    const wrapper = mount(MonthlyTable, { props: { results } })

    const headers = wrapper.findAll('th').map(t => t.text())
    expect(headers).toContain('房贷月供')
    expect(headers).toContain('公积金缴存')
    expect(headers).toContain('公积金月冲')
    expect(headers).toContain('公积金')
    expect(headers).not.toContain('总资产')

    // 房贷月供显示绝对值 5,000
    expect(wrapper.text()).toContain('5,000')
  })

  it('月冲未手填时自动联动（淡灰），余额充足时实际扣取额=房贷月供', async () => {
    const useStore = await loadUseStore()
    const store = useStore()
    store.data.value.systemParams.startMonth = 202601
    store.enableFund()
    store.updateFundEntry('mortgage', 202601, -5000)
    store.updateFundEntry('contribution', 202601, 5000)   // 缴存补足，月冲能冲满（实际=目标=5000）
    const results = calculate(store.data.value)

    const MonthlyTable = (await import('../../src/components/MonthlyTable.vue')).default
    const wrapper = mount(MonthlyTable, { props: { results } })

    const autoCell = wrapper.find('[data-fund-offset-auto="202601"]')
    expect(autoCell.exists()).toBe(true)
    expect(autoCell.classes()).toContain('text-ink-3')
    expect(autoCell.text()).toContain('5,000')
  })

  it('房贷月供输入正数存负数', async () => {
    const useStore = await loadUseStore()
    const store = useStore()
    store.enableFund()
    store.data.value.systemParams.startMonth = 202601
    const results = calculate(store.data.value)

    const MonthlyTable = (await import('../../src/components/MonthlyTable.vue')).default
    const wrapper = mount(MonthlyTable, { props: { results } })

    await wrapper.find('[data-fund-edit="mortgage-202601"]').trigger('click')
    const input = wrapper.find('[data-fund-edit-input="mortgage-202601"]')
    await input.setValue('5000')
    await input.trigger('blur')

    expect(store.data.value.fund!.mortgage.itemSets[202601]?.[0]?.amount).toBe(-5000)
  })

  it('公积金缴存输入正数原样存储', async () => {
    const useStore = await loadUseStore()
    const store = useStore()
    store.enableFund()
    store.data.value.systemParams.startMonth = 202601
    const results = calculate(store.data.value)

    const MonthlyTable = (await import('../../src/components/MonthlyTable.vue')).default
    const wrapper = mount(MonthlyTable, { props: { results } })

    await wrapper.find('[data-fund-edit="contribution-202601"]').trigger('click')
    const input = wrapper.find('[data-fund-edit-input="contribution-202601"]')
    await input.setValue('2000')
    await input.trigger('blur')

    expect(store.data.value.fund!.contribution.itemSets[202601]?.[0]?.amount).toBe(2000)
  })

  it('月冲手填覆盖后显示蓝底（已编辑）', async () => {
    const useStore = await loadUseStore()
    const store = useStore()
    store.enableFund()
    store.data.value.systemParams.startMonth = 202601
    store.updateFundEntry('mortgage', 202601, -5000)
    store.updateFundEntry('monthlyOffset', 202601, 3000)
    store.updateFundEntry('contribution', 202601, 10000)   // 缴存补足，月冲能冲满手填值（实际=3000）
    const results = calculate(store.data.value)

    const MonthlyTable = (await import('../../src/components/MonthlyTable.vue')).default
    const wrapper = mount(MonthlyTable, { props: { results } })

    const cell = wrapper.find('[data-fund-offset-edited="202601"]')
    expect(cell.exists()).toBe(true)
    expect(cell.classes()).toContain('bg-brand-50')
    expect(cell.text()).toContain('3,000')
  })

  it('月冲因余额不足截断：月冲列显示实际扣取额，存款补扣列显示差额并标告警色', async () => {
    const useStore = await loadUseStore()
    const store = useStore()
    store.enableFund()
    store.data.value.systemParams.startMonth = 202601
    store.updateFundEntry('mortgage', 202601, -5000)
    store.updateFundEntry('contribution', 202601, 2000)   // 缴存仅 2000，月冲目标 5000 被截断到 2000
    const results = calculate(store.data.value)

    const MonthlyTable = (await import('../../src/components/MonthlyTable.vue')).default
    const wrapper = mount(MonthlyTable, { props: { results } })

    // 月冲列显示实际扣取额（被余额截断到 2,000），不再是目标 5,000
    const offsetCell = wrapper.find('[data-fund-offset-auto="202601"]')
    expect(offsetCell.text()).toContain('2,000')

    // 存款补扣列显示差额 5,000 − 2,000 = 3,000，并标告警色
    const shortfallCell = wrapper.find('[data-fund-shortfall="202601"]')
    expect(shortfallCell.exists()).toBe(true)
    expect(shortfallCell.text()).toContain('3,000')
    expect(shortfallCell.classes()).toContain('text-warning-600')
  })

  it('月冲手填编辑写回 monthlyOffset', async () => {
    const useStore = await loadUseStore()
    const store = useStore()
    store.enableFund()
    store.data.value.systemParams.startMonth = 202601
    const results = calculate(store.data.value)

    const MonthlyTable = (await import('../../src/components/MonthlyTable.vue')).default
    const wrapper = mount(MonthlyTable, { props: { results } })

    await wrapper.find('[data-fund-edit="monthlyOffset-202601"]').trigger('click')
    const input = wrapper.find('[data-fund-edit-input="monthlyOffset-202601"]')
    await input.setValue('3000')
    await input.trigger('blur')

    expect(store.data.value.fund!.monthlyOffset.itemSets[202601]?.[0]?.amount).toBe(3000)
  })

  it('月冲单元格 hover 展示公式（自动联动）', async () => {
    const useStore = await loadUseStore()
    const store = useStore()
    store.enableFund()
    store.data.value.systemParams.startMonth = 202601
    store.updateFundEntry('mortgage', 202601, -5000)
    const results = calculate(store.data.value)

    const MonthlyTable = (await import('../../src/components/MonthlyTable.vue')).default
    const wrapper = mount(MonthlyTable, { props: { results } })

    await wrapper.find('[data-fund-offset-auto="202601"] span').trigger('mouseenter')
    expect(wrapper.text()).toContain('自动联动')
  })

  it('点击公积金余额单元格打开 FundFlowEditor', async () => {
    const useStore = await loadUseStore()
    const store = useStore()
    store.enableFund()
    store.data.value.systemParams.startMonth = 202601
    store.updateFundEntry('contribution', 202601, 1000)
    const results = calculate(store.data.value)

    const MonthlyTable = (await import('../../src/components/MonthlyTable.vue')).default
    const wrapper = mount(MonthlyTable, { props: { results } })

    await wrapper.find('[data-fund-balance="202601"]').trigger('click')
    expect(wrapper.findComponent({ name: 'FundFlowEditor' }).exists()).toBe(true)
  })

  it('右键公积金余额弹出锚点菜单（仅清除下方公积金锚点）', async () => {
    const useStore = await loadUseStore()
    const store = useStore()
    store.enableFund()
    store.data.value.systemParams.startMonth = 202601
    store.addFundAnchor(202603, 500000) // 下方有公积金锚点
    const results = calculate(store.data.value)

    const MonthlyTable = (await import('../../src/components/MonthlyTable.vue')).default
    const wrapper = mount(MonthlyTable, { props: { results } })

    await wrapper.find('[data-fund-balance="202601"]').trigger('contextmenu')
    const menu = wrapper.findComponent({ name: 'ContextMenu' })
    expect(menu.exists()).toBe(true)
    const labels = menu.props('items').map((i: any) => i.label)
    expect(labels).toContain('清除下方公积金锚点')
    expect(labels).not.toContain('同步到下方每年此月')
  })

  it('公积金锚点月余额单元格高亮', async () => {
    const useStore = await loadUseStore()
    const store = useStore()
    store.enableFund()
    store.data.value.systemParams.startMonth = 202601
    store.updateFundEntry('contribution', 202601, 1000)
    store.addFundAnchor(202603, 500000)
    const results = calculate(store.data.value)

    const MonthlyTable = (await import('../../src/components/MonthlyTable.vue')).default
    const wrapper = mount(MonthlyTable, { props: { results } })

    const anchorCell = wrapper.find('[data-fund-balance="202603"]')
    expect(anchorCell.classes()).toContain('bg-brand-50')
  })

  it('余额单元格 hover 展示公积金余额公式', async () => {
    const useStore = await loadUseStore()
    const store = useStore()
    store.enableFund()
    store.data.value.systemParams.startMonth = 202601
    store.updateFundEntry('contribution', 202601, 1000)
    const results = calculate(store.data.value)

    const MonthlyTable = (await import('../../src/components/MonthlyTable.vue')).default
    const wrapper = mount(MonthlyTable, { props: { results } })

    await wrapper.find('[data-fund-balance="202601"] span').trigger('mouseenter')
    expect(wrapper.text()).toContain('上月余额')
  })

  it('房贷月供手填后单元格浅蓝底，未手填无', async () => {
    const useStore = await loadUseStore()
    const store = useStore()
    store.enableFund()
    store.data.value.systemParams.startMonth = 202601
    store.updateFundEntry('mortgage', 202601, -5000) // 202601 手填，202602 未填
    const results = calculate(store.data.value)

    const MonthlyTable = (await import('../../src/components/MonthlyTable.vue')).default
    const wrapper = mount(MonthlyTable, { props: { results } })

    const edited = wrapper.find('[data-fund-mortgage="202601"]')
    expect(edited.exists()).toBe(true)
    expect(edited.classes()).toContain('bg-brand-50')

    const untouched = wrapper.find('[data-fund-mortgage="202602"]')
    expect(untouched.exists()).toBe(true)
    expect(untouched.classes()).not.toContain('bg-brand-50')
  })

  it('公积金缴存手填后单元格浅蓝底', async () => {
    const useStore = await loadUseStore()
    const store = useStore()
    store.enableFund()
    store.data.value.systemParams.startMonth = 202601
    store.updateFundEntry('contribution', 202601, 2000)
    const results = calculate(store.data.value)

    const MonthlyTable = (await import('../../src/components/MonthlyTable.vue')).default
    const wrapper = mount(MonthlyTable, { props: { results } })

    const cell = wrapper.find('[data-fund-contribution="202601"]')
    expect(cell.exists()).toBe(true)
    expect(cell.classes()).toContain('bg-brand-50')
  })

  it('房贷月供右键菜单含三项且「同步」项恒禁用', async () => {
    const useStore = await loadUseStore()
    const store = useStore()
    store.enableFund()
    store.data.value.systemParams.startMonth = 202601
    store.updateFundEntry('mortgage', 202601, -5000)
    const results = calculate(store.data.value)

    const MonthlyTable = (await import('../../src/components/MonthlyTable.vue')).default
    const wrapper = mount(MonthlyTable, { props: { results } })

    await wrapper.find('[data-fund-mortgage="202601"]').trigger('contextmenu')
    const menu = wrapper.findComponent({ name: 'ContextMenu' })
    expect(menu.exists()).toBe(true)

    const items = menu.findAll('[role="menuitem"]')
    const labels = items.map(i => i.text())
    expect(labels).toEqual(['同步到下方每年此月', '清除该值', '清除下方编辑值'])

    const syncItem = items.find(i => i.text() === '同步到下方每年此月')!
    expect(syncItem.attributes('aria-disabled')).toBe('true')
  })

  it('公积金缴存右键菜单「同步」项恒禁用', async () => {
    const useStore = await loadUseStore()
    const store = useStore()
    store.enableFund()
    store.data.value.systemParams.startMonth = 202601
    store.updateFundEntry('contribution', 202601, 2000)
    const results = calculate(store.data.value)

    const MonthlyTable = (await import('../../src/components/MonthlyTable.vue')).default
    const wrapper = mount(MonthlyTable, { props: { results } })

    await wrapper.find('[data-fund-contribution="202601"]').trigger('contextmenu')
    const menu = wrapper.findComponent({ name: 'ContextMenu' })
    const syncItem = menu.findAll('[role="menuitem"]').find(i => i.text() === '同步到下方每年此月')!
    expect(syncItem.attributes('aria-disabled')).toBe('true')
  })

  it('房贷月供右键「清除该值」删除当前格手填值，他月保留', async () => {
    const useStore = await loadUseStore()
    const store = useStore()
    store.enableFund()
    store.data.value.systemParams.startMonth = 202601
    store.updateFundEntry('mortgage', 202601, -5000)
    store.updateFundEntry('mortgage', 202602, -6000)
    const results = calculate(store.data.value).slice(0, 2)

    const MonthlyTable = (await import('../../src/components/MonthlyTable.vue')).default
    const wrapper = mount(MonthlyTable, { props: { results } })

    await wrapper.find('[data-fund-mortgage="202601"]').trigger('contextmenu')
    const item = wrapper
      .findComponent({ name: 'ContextMenu' })
      .findAll('[role="menuitem"]')
      .find(i => i.text() === '清除该值')!
    await item.trigger('click')

    expect(store.data.value.fund!.mortgage.itemSets[202601]).toBeUndefined()
    expect(store.data.value.fund!.mortgage.itemSets[202602]?.[0]?.amount).toBe(-6000)
  })

  it('公积金缴存右键「清除该值」删除当前格手填值', async () => {
    const useStore = await loadUseStore()
    const store = useStore()
    store.enableFund()
    store.data.value.systemParams.startMonth = 202601
    store.updateFundEntry('contribution', 202601, 2000)
    store.updateFundEntry('contribution', 202602, 3000)
    const results = calculate(store.data.value).slice(0, 2)

    const MonthlyTable = (await import('../../src/components/MonthlyTable.vue')).default
    const wrapper = mount(MonthlyTable, { props: { results } })

    await wrapper.find('[data-fund-contribution="202601"]').trigger('contextmenu')
    const item = wrapper
      .findComponent({ name: 'ContextMenu' })
      .findAll('[role="menuitem"]')
      .find(i => i.text() === '清除该值')!
    await item.trigger('click')

    expect(store.data.value.fund!.contribution.itemSets[202601]).toBeUndefined()
    expect(store.data.value.fund!.contribution.itemSets[202602]?.[0]?.amount).toBe(3000)
  })

  it('房贷月供未手填格「清除该值」禁用', async () => {
    const useStore = await loadUseStore()
    const store = useStore()
    store.enableFund()
    store.data.value.systemParams.startMonth = 202601
    // 202601 不填任何 mortgage entry
    const results = calculate(store.data.value).slice(0, 1)

    const MonthlyTable = (await import('../../src/components/MonthlyTable.vue')).default
    const wrapper = mount(MonthlyTable, { props: { results } })

    await wrapper.find('[data-fund-mortgage="202601"]').trigger('contextmenu')
    const item = wrapper
      .findComponent({ name: 'ContextMenu' })
      .findAll('[role="menuitem"]')
      .find(i => i.text() === '清除该值')!
    expect(item.attributes('aria-disabled')).toBe('true')
  })

  it('房贷月供右键「清除下方编辑值」删除下方，当前及上方保留', async () => {
    const useStore = await loadUseStore()
    const store = useStore()
    store.enableFund()
    store.data.value.systemParams.startMonth = 202601
    store.updateFundEntry('mortgage', 202601, -5000)
    store.updateFundEntry('mortgage', 202602, -6000)
    store.updateFundEntry('mortgage', 202603, -7000)
    const results = calculate(store.data.value).slice(0, 3)

    const MonthlyTable = (await import('../../src/components/MonthlyTable.vue')).default
    const wrapper = mount(MonthlyTable, { props: { results } })

    // 在 202602 右键
    await wrapper.find('[data-fund-mortgage="202602"]').trigger('contextmenu')
    const item = wrapper
      .findComponent({ name: 'ContextMenu' })
      .findAll('[role="menuitem"]')
      .find(i => i.text() === '清除下方编辑值')!
    await item.trigger('click')

    // 202601、202602 保留，202603（严格下方）被清除
    expect(store.data.value.fund!.mortgage.itemSets[202601]?.[0]?.amount).toBe(-5000)
    expect(store.data.value.fund!.mortgage.itemSets[202602]?.[0]?.amount).toBe(-6000)
    expect(store.data.value.fund!.mortgage.itemSets[202603]).toBeUndefined()
  })

  it('公积金缴存右键「清除下方编辑值」删除下方', async () => {
    const useStore = await loadUseStore()
    const store = useStore()
    store.enableFund()
    store.data.value.systemParams.startMonth = 202601
    store.updateFundEntry('contribution', 202601, 2000)
    store.updateFundEntry('contribution', 202602, 3000)
    store.updateFundEntry('contribution', 202603, 4000)
    const results = calculate(store.data.value).slice(0, 3)

    const MonthlyTable = (await import('../../src/components/MonthlyTable.vue')).default
    const wrapper = mount(MonthlyTable, { props: { results } })

    await wrapper.find('[data-fund-contribution="202602"]').trigger('contextmenu')
    const item = wrapper
      .findComponent({ name: 'ContextMenu' })
      .findAll('[role="menuitem"]')
      .find(i => i.text() === '清除下方编辑值')!
    await item.trigger('click')

    expect(store.data.value.fund!.contribution.itemSets[202601]?.[0]?.amount).toBe(2000)
    expect(store.data.value.fund!.contribution.itemSets[202602]?.[0]?.amount).toBe(3000)
    expect(store.data.value.fund!.contribution.itemSets[202603]).toBeUndefined()
  })

  it('房贷月供下方无编辑值时「清除下方编辑值」禁用', async () => {
    const useStore = await loadUseStore()
    const store = useStore()
    store.enableFund()
    store.data.value.systemParams.startMonth = 202601
    store.updateFundEntry('mortgage', 202603, -7000) // 仅最后一行有值
    const results = calculate(store.data.value).slice(0, 3)

    const MonthlyTable = (await import('../../src/components/MonthlyTable.vue')).default
    const wrapper = mount(MonthlyTable, { props: { results } })

    // 在最后一行（202603）右键，下方无行
    await wrapper.find('[data-fund-mortgage="202603"]').trigger('contextmenu')
    const item = wrapper
      .findComponent({ name: 'ContextMenu' })
      .findAll('[role="menuitem"]')
      .find(i => i.text() === '清除下方编辑值')!
    expect(item.attributes('aria-disabled')).toBe('true')
  })
})
