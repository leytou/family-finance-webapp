import { enableAutoUnmount, mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'

enableAutoUnmount(afterEach)

async function loadApp() {
  return (await import('../src/App.vue')).default
}

async function loadUseStore() {
  return (await import('../src/composables/useStore')).useStore
}

function findButton(wrapper: ReturnType<typeof mount>, text: string) {
  return wrapper.findAll('button').find(button => button.text() === text)
}

describe('App', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.resetModules()
  })

  afterEach(() => {
    vi.clearAllTimers()
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  const globalStubs = {
    AnnualTable: true,
    MonthlyTable: true,
    ScenarioTabs: true,
    ComparisonView: true,
    ToolsMenu: true,
    FinanceChart: true,
  }

  it('渲染头部包含系统参数输入', async () => {
    const App = await loadApp()
    const wrapper = mount(App, { global: { stubs: globalStubs } })

    const header = wrapper.get('header')
    expect(header.exists()).toBe(true)
    expect(header.text()).toContain('家庭财务规划')

    // 起始月份已改为 MonthPicker 触发器（按钮），不再是 placeholder=YYYYMM 的 input
    expect(wrapper.find('button[aria-haspopup="dialog"]').exists()).toBe(true)

    const annualRateInput = wrapper.findAll('input').find(input => input.attributes('step') === '0.001')
    expect(annualRateInput?.exists()).toBe(true)
  })

  it('渲染两个表格区域（非对比模式）', async () => {
    const App = await loadApp()
    const wrapper = mount(App, { global: { stubs: globalStubs } })

    const main = wrapper.get('main')
    const divs = main.findAll(':scope > div')
    // v-else 分支会渲染两个 div
    expect(divs).toHaveLength(2)

    // 第一个 div 是年度表区域
    expect(divs[0].classes()).toContain('max-h-[35%]')
    expect(divs[0].classes()).toContain('border-b')

    // 第二个 div 是月度表区域
    expect(divs[1].classes()).toContain('flex-1')
  })

  it('头部包含 ScenarioTabs 和对比按钮', async () => {
    const App = await loadApp()
    const wrapper = mount(App, { global: { stubs: globalStubs } })

    expect(wrapper.findComponent({ name: 'ScenarioTabs' }).exists()).toBe(true)
    expect(findButton(wrapper, '对比')).toBeDefined()
  })

  it('点击对比按钮切换到对比视图', async () => {
    const App = await loadApp()
    const wrapper = mount(App, { global: { stubs: globalStubs } })

    // 初始不显示对比视图
    expect(wrapper.findComponent({ name: 'ComparisonView' }).exists()).toBe(false)

    await findButton(wrapper, '对比')?.trigger('click')

    // 显示对比视图
    expect(wrapper.findComponent({ name: 'ComparisonView' }).exists()).toBe(true)
  })

  it('点击图表按钮切换到图表视图', async () => {
    const App = await loadApp()
    const wrapper = mount(App, { global: { stubs: globalStubs } })

    expect(wrapper.findComponent({ name: 'AnnualTable' }).exists()).toBe(true)

    await findButton(wrapper, '图表')?.trigger('click')

    expect(wrapper.findComponent({ name: 'AnnualTable' }).exists()).toBe(false)
    expect(wrapper.findComponent({ name: 'FinanceChart' }).exists()).toBe(true)
  })

  it('视图切换为显式三按钮（表格/图表/对比）', async () => {
    const App = await loadApp()
    const wrapper = mount(App, { global: { stubs: globalStubs } })

    expect(findButton(wrapper, '表格')).toBeDefined()
    expect(findButton(wrapper, '图表')).toBeDefined()
    expect(findButton(wrapper, '对比')).toBeDefined()
  })

  it('点击表格按钮从图表视图回到表格', async () => {
    const App = await loadApp()
    const wrapper = mount(App, { global: { stubs: globalStubs } })

    // 初始为表格视图
    expect(wrapper.findComponent({ name: 'AnnualTable' }).exists()).toBe(true)

    // 切到图表
    await findButton(wrapper, '图表')?.trigger('click')
    expect(wrapper.findComponent({ name: 'FinanceChart' }).exists()).toBe(true)
    expect(wrapper.findComponent({ name: 'AnnualTable' }).exists()).toBe(false)

    // 点「表格」按钮显式回到表格（覆盖新增按钮，取代旧 toggle）
    await findButton(wrapper, '表格')?.trigger('click')
    expect(wrapper.findComponent({ name: 'AnnualTable' }).exists()).toBe(true)
    expect(wrapper.findComponent({ name: 'FinanceChart' }).exists()).toBe(false)
  })

  it('系统参数输入正确绑定', async () => {
    const App = await loadApp()
    const wrapper = mount(App, { global: { stubs: globalStubs } })

    const useStore = await loadUseStore()
    const store = useStore()

    // 通过 MonthPicker 选 2 月：展开 → 点 2 月格
    await wrapper.find('button[aria-haspopup="dialog"]').trigger('click')
    await wrapper.findAll('[data-testid="month-cell"]')[1]!.trigger('click')
    // 不写死年份（依赖运行时当前年），只校验月份部分被改成 2
    expect(store.data.value.systemParams.startMonth % 100).toBe(2)

    const annualRateInput = wrapper.findAll('input').find(input => input.attributes('step') === '0.001')
    await annualRateInput?.setValue('3.5')
    expect(store.data.value.systemParams.annualRate).toBeCloseTo(0.035)
  })

  it('整体布局结构正确', async () => {
    const App = await loadApp()
    const wrapper = mount(App, { global: { stubs: globalStubs } })

    expect(wrapper.get('.h-screen').classes()).toContain('flex-col')
    expect(wrapper.get('header').classes()).toContain('h-12')
    expect(wrapper.get('header').classes()).toContain('border-b')

    const main = wrapper.get('main')
    expect(main.classes()).toContain('flex-1')
    expect(main.classes()).toContain('flex-col')
  })

  it('初始存款输入框正确绑定', async () => {
    const App = await loadApp()
    const wrapper = mount(App, { global: { stubs: globalStubs } })

    const useStore = await loadUseStore()
    const store = useStore()

    const initialDepositInput = wrapper.find('input[placeholder="元"]')
    expect(initialDepositInput.exists()).toBe(true)

    await initialDepositInput.setValue('50000')
    expect(store.data.value.systemParams.initialDeposit).toBe(50000)
  })

  it('撤销/重做按钮初始禁用，Ctrl+Z 撤销、Ctrl+Shift+Z 重做', async () => {
    vi.useFakeTimers()
    const App = await loadApp()
    const useStore = await loadUseStore()
    const store = useStore()
    const wrapper = mount(App, { global: { stubs: globalStubs } })

    const undoBtn = wrapper.get('[data-testid="undo-btn"]')
    const redoBtn = wrapper.get('[data-testid="redo-btn"]')

    // 初始无历史：均禁用
    expect(undoBtn.attributes('disabled')).toBeDefined()
    expect(redoBtn.attributes('disabled')).toBeDefined()

    // 产生一次编辑并等捕获落盘（500ms 防抖）
    store.addColumn('工资')
    await nextTick()
    await vi.advanceTimersByTimeAsync(500)
    await nextTick()

    // 撤销按钮启用
    expect(wrapper.get('[data-testid="undo-btn"]').attributes('disabled')).toBeUndefined()

    // Ctrl+Z 触发撤销 → 列被移除；redo 按钮随之启用（canRedo 转为 true）
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'z', ctrlKey: true }))
    await nextTick()
    await nextTick()

    expect(store.data.value.columns).toHaveLength(0)
    expect(wrapper.get('[data-testid="redo-btn"]').attributes('disabled')).toBeUndefined()

    // Ctrl+Shift+Z 触发重做 → 被撤销的编辑恢复（覆盖 redo 快捷键分支）
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'z', ctrlKey: true, shiftKey: true }))
    await nextTick()
    await nextTick()

    expect(store.data.value.columns).toHaveLength(1)

    // 按钮点击路径触发撤销 → 列再次移除（覆盖 @click="doUndo"，与键盘共享同一 doUndo）
    await wrapper.get('[data-testid="undo-btn"]').trigger('click')
    await nextTick()
    await nextTick()

    expect(store.data.value.columns).toHaveLength(0)
  })
})
