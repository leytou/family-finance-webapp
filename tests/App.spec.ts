import { enableAutoUnmount, mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

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
  }

  it('渲染头部包含系统参数输入', async () => {
    const App = await loadApp()
    const wrapper = mount(App, { global: { stubs: globalStubs } })

    const header = wrapper.get('header')
    expect(header.exists()).toBe(true)
    expect(header.text()).toContain('家庭财务规划')

    const startMonthInput = wrapper.find('input[placeholder="YYYYMM"]')
    expect(startMonthInput.exists()).toBe(true)

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

  it('确认重置时清空当前方案数据', async () => {
    const useStore = await loadUseStore()
    const store = useStore()

    const col = store.addColumn('工资')
    store.updateColumnEntry(col.id, 202601, 10000)

    vi.spyOn(window, 'confirm').mockReturnValue(true)

    const App = await loadApp()
    const wrapper = mount(App, { global: { stubs: globalStubs } })

    await findButton(wrapper, '重置')?.trigger('click')

    expect(window.confirm).toHaveBeenCalledWith('确定要重置当前方案？此操作不可撤销。')
    expect(store.data.value.columns).toEqual([])
    expect(store.data.value.anchors).toEqual([])
    expect(store.data.value.systemParams.annualRate).toBe(0.025)
  })

  it('取消重置时保留数据', async () => {
    const useStore = await loadUseStore()
    const store = useStore()

    const col = store.addColumn('工资')
    store.updateColumnEntry(col.id, 202601, 10000)

    vi.spyOn(window, 'confirm').mockReturnValue(false)

    const App = await loadApp()
    const wrapper = mount(App, { global: { stubs: globalStubs } })

    await findButton(wrapper, '重置')?.trigger('click')

    expect(store.data.value.columns).toHaveLength(1)
    expect(store.data.value.columns[0].name).toBe('工资')
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

  it('系统参数输入正确绑定', async () => {
    const App = await loadApp()
    const wrapper = mount(App, { global: { stubs: globalStubs } })

    const useStore = await loadUseStore()
    const store = useStore()

    const startMonthInput = wrapper.find('input[placeholder="YYYYMM"]')
    await startMonthInput.setValue(202602)
    expect(store.data.value.systemParams.startMonth).toBe(202602)

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
})
