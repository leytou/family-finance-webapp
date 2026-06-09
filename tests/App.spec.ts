import { enableAutoUnmount, mount } from '@vue/test-utils'
import { nextTick } from 'vue'
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

  it('渲染头部包含系统参数输入', async () => {
    const App = await loadApp()
    const wrapper = mount(App, {
      global: {
        stubs: {
          AnnualTable: true,
          MonthlyTable: true,
        },
      },
    })

    const header = wrapper.get('header')
    expect(header.exists()).toBe(true)
    expect(header.text()).toContain('家庭财务规划')

    // 起始月份输入
    const startMonthInput = wrapper.find('input[placeholder="YYYYMM"]')
    expect(startMonthInput.exists()).toBe(true)

    // 年化收益率输入
    const annualRateInput = wrapper.findAll('input').find(input => input.attributes('step') === '0.001')
    expect(annualRateInput?.exists()).toBe(true)
  })

  it('渲染两个表格区域', async () => {
    const App = await loadApp()
    const wrapper = mount(App, {
      global: {
        stubs: {
          AnnualTable: true,
          MonthlyTable: true,
        },
      },
    })

    const main = wrapper.get('main')
    expect(main.exists()).toBe(true)

    const tablePanes = main.findAll(':scope > div')
    expect(tablePanes).toHaveLength(2)

    // AnnualTable 在上方
    expect(tablePanes[0].classes()).toContain('max-h-[35%]')
    expect(tablePanes[0].findComponent({ name: 'AnnualTable' }).exists()).toBe(true)

    // MonthlyTable 在下方
    expect(tablePanes[1].classes()).toContain('flex-1')
    expect(tablePanes[1].findComponent({ name: 'MonthlyTable' }).exists()).toBe(true)
  })

  it('确认重置时清空当前方案数据', async () => {
    vi.useFakeTimers()
    const useStore = await loadUseStore()
    const store = useStore()

    // 添加一些测试数据
    const col = store.addColumn('工资')
    store.updateColumnEntry(col.id, 202601, 10000)
    await nextTick()
    store.save()

    vi.spyOn(window, 'confirm').mockReturnValue(true)

    const App = await loadApp()
    const wrapper = mount(App, {
      global: {
        stubs: {
          AnnualTable: true,
          MonthlyTable: true,
        },
      },
    })

    await findButton(wrapper, '重置')?.trigger('click')
    await nextTick()
    await vi.advanceTimersByTimeAsync(300)

    expect(window.confirm).toHaveBeenCalledWith('确定要重置所有数据？此操作不可撤销。')
    // 当前方案数据被清空
    expect(store.data.value.columns).toEqual([])
    expect(store.data.value.anchors).toEqual([])
    expect(store.data.value.systemParams.annualRate).toBe(0.025)
    // Workspace 仍存在于 localStorage（只重置方案，不删除 localStorage）
    const saved = JSON.parse(localStorage.getItem('family-finance-plan') ?? '{}')
    expect(saved.version).toBe(1)
    expect(saved.scenarios).toHaveLength(1)
    expect(saved.scenarios[0].plan.columns).toEqual([])
  })

  it('取消重置时保留当前方案数据', async () => {
    const useStore = await loadUseStore()
    const store = useStore()

    // 添加一些测试数据
    const col = store.addColumn('工资')
    store.updateColumnEntry(col.id, 202601, 10000)
    await nextTick()
    store.save()

    vi.spyOn(window, 'confirm').mockReturnValue(false)

    const App = await loadApp()
    const wrapper = mount(App, {
      global: {
        stubs: {
          AnnualTable: true,
          MonthlyTable: true,
        },
      },
    })

    await findButton(wrapper, '重置')?.trigger('click')

    expect(store.data.value.columns).toHaveLength(1)
    expect(store.data.value.columns[0].name).toBe('工资')
    expect(store.data.value.columns[0].entries[202601]).toBe(10000)
    const saved = JSON.parse(localStorage.getItem('family-finance-plan') ?? '{}')
    expect(saved.scenarios[0].plan.columns).toHaveLength(1)
  })

  it('系统参数输入正确绑定', async () => {
    const App = await loadApp()
    const wrapper = mount(App, {
      global: {
        stubs: {
          AnnualTable: true,
          MonthlyTable: true,
        },
      },
    })

    const useStore = await loadUseStore()
    const store = useStore()

    // 起始月份
    const startMonthInput = wrapper.find('input[placeholder="YYYYMM"]')
    await startMonthInput.setValue(202602)
    expect(store.data.value.systemParams.startMonth).toBe(202602)

    // 年化收益率（显示为百分比，存储为小数）
    const annualRateInput = wrapper.findAll('input').find(input => input.attributes('step') === '0.001')
    await annualRateInput?.setValue('3.5')
    expect(store.data.value.systemParams.annualRate).toBeCloseTo(0.035)
  })

  it('年化收益率正确显示（百分比格式）', async () => {
    const useStore = await loadUseStore()
    const store = useStore()
    store.data.value.systemParams.annualRate = 0.025

    const App = await loadApp()
    const wrapper = mount(App, {
      global: {
        stubs: {
          AnnualTable: true,
          MonthlyTable: true,
        },
      },
    })

    const annualRateInput = wrapper.findAll('input').find(input => input.attributes('step') === '0.001')
    expect(annualRateInput?.element.value).toBe('2.500')
  })

  it('整体布局结构正确', async () => {
    const App = await loadApp()
    const wrapper = mount(App, {
      global: {
        stubs: {
          AnnualTable: true,
          MonthlyTable: true,
        },
      },
    })

    // 外层容器
    expect(wrapper.get('.h-screen').classes()).toContain('flex-col')
    expect(wrapper.get('.h-screen').classes()).toContain('flex')

    // 头部
    expect(wrapper.get('header').classes()).toContain('h-12')
    expect(wrapper.get('header').classes()).toContain('border-b')

    // 主体区域
    const main = wrapper.get('main')
    expect(main.classes()).toContain('flex-1')
    expect(main.classes()).toContain('flex-col')
    expect(main.classes()).toContain('overflow-hidden')

    // 两个表格区域
    const tablePanes = main.findAll(':scope > div')
    expect(tablePanes[0].classes()).toContain('max-h-[35%]')
    expect(tablePanes[0].classes()).toContain('border-b')
    expect(tablePanes[1].classes()).toContain('flex-1')
  })
})
