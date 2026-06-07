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
  let originalCreateObjectURLDescriptor: PropertyDescriptor | undefined
  let originalRevokeObjectURLDescriptor: PropertyDescriptor | undefined

  beforeEach(() => {
    localStorage.clear()
    vi.resetModules()
    originalCreateObjectURLDescriptor = Object.getOwnPropertyDescriptor(URL, 'createObjectURL')
    originalRevokeObjectURLDescriptor = Object.getOwnPropertyDescriptor(URL, 'revokeObjectURL')
  })

  afterEach(() => {
    vi.clearAllTimers()
    vi.useRealTimers()
    vi.restoreAllMocks()
    restoreUrlProperty('createObjectURL', originalCreateObjectURLDescriptor)
    restoreUrlProperty('revokeObjectURL', originalRevokeObjectURLDescriptor)
  })

  function restoreUrlProperty(name: 'createObjectURL' | 'revokeObjectURL', descriptor: PropertyDescriptor | undefined) {
    if (descriptor) {
      Object.defineProperty(URL, name, descriptor)
    } else {
      Reflect.deleteProperty(URL, name)
    }
  }

  function readBlobAsText(blob: Blob): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader()

      reader.addEventListener('load', () => resolve(String(reader.result)))
      reader.addEventListener('error', () => reject(reader.error))
      reader.readAsText(blob)
    })
  }

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

  it('点击导出按钮创建并点击下载链接', async () => {
    const useStore = await loadUseStore()
    const store = useStore()
    store.data.value.systemParams.annualRate = 0.05
    await nextTick()
    store.save()

    const createObjectURL = vi.fn(() => 'blob:finance-plan')
    const revokeObjectURL = vi.fn()
    Object.defineProperty(URL, 'createObjectURL', {
      configurable: true,
      value: createObjectURL,
    })
    Object.defineProperty(URL, 'revokeObjectURL', {
      configurable: true,
      value: revokeObjectURL,
    })

    const createdAnchors: HTMLAnchorElement[] = []
    const originalCreateElement = document.createElement.bind(document)
    vi.spyOn(document, 'createElement').mockImplementation((tagName: string) => {
      const element = originalCreateElement(tagName)

      if (tagName.toLowerCase() === 'a') {
        vi.spyOn(element, 'click').mockImplementation(() => {})
        createdAnchors.push(element as HTMLAnchorElement)
      }

      return element
    })

    const App = await loadApp()
    const wrapper = mount(App, {
      global: {
        stubs: {
          AnnualTable: true,
          MonthlyTable: true,
        },
      },
    })

    await findButton(wrapper, '导出')?.trigger('click')

    expect(createObjectURL).toHaveBeenCalledTimes(1)
    expect(createObjectURL.mock.calls[0][0]).toBeInstanceOf(Blob)
    expect(createdAnchors).toHaveLength(1)
    expect(createdAnchors[0].href).toBe('blob:finance-plan')
    expect(createdAnchors[0].download).toBe('finance-plan.json')
    expect(createdAnchors[0].click).toHaveBeenCalledTimes(1)
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:finance-plan')
  })

  it('导出数据包含正确结构', async () => {
    const useStore = await loadUseStore()
    const store = useStore()

    // 添加一些测试数据
    store.data.value.systemParams.annualRate = 0.03
    const col = store.addColumn('工资')
    store.updateColumnEntry(col.id, 202601, 10000)
    store.addAnchor(202606, 50000)

    let exportedBlob: Blob | undefined

    const createObjectURL = vi.fn((blob: Blob) => {
      exportedBlob = blob
      return 'blob:finance-plan'
    })

    Object.defineProperty(URL, 'createObjectURL', {
      configurable: true,
      value: createObjectURL,
    })
    Object.defineProperty(URL, 'revokeObjectURL', {
      configurable: true,
      value: vi.fn(),
    })

    const originalCreateElement = document.createElement.bind(document)
    vi.spyOn(document, 'createElement').mockImplementation((tagName: string) => {
      const element = originalCreateElement(tagName)

      if (tagName.toLowerCase() === 'a') {
        vi.spyOn(element, 'click').mockImplementation(() => {})
      }

      return element
    })

    const App = await loadApp()
    const wrapper = mount(App, {
      global: {
        stubs: {
          AnnualTable: true,
          MonthlyTable: true,
        },
      },
    })

    await findButton(wrapper, '导出')?.trigger('click')

    const exported = JSON.parse(await readBlobAsText(exportedBlob!))

    expect(exported.version).toBe(2)
    expect(exported.systemParams).toEqual({
      startMonth: expect.any(Number),
      annualRate: 0.03,
    })
    expect(exported.columns).toHaveLength(1)
    expect(exported.columns[0]).toMatchObject({
      name: '工资',
      entries: { 202601: 10000 },
    })
    expect(exported.anchors).toEqual([{ month: 202606, actualSavings: 50000 }])
  })

  it('确认重置时清空数据', async () => {
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

    expect(window.confirm).toHaveBeenCalledWith('确定要重置所有数据？此操作不可撤销。')
    expect(store.data.value.columns).toEqual([])
    expect(store.data.value.anchors).toEqual([])
    expect(store.data.value.systemParams.annualRate).toBe(0.025)
    expect(localStorage.getItem('family-finance-plan')).toBeNull()
  })

  it('取消重置时保留数据', async () => {
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
    expect(JSON.parse(localStorage.getItem('family-finance-plan') ?? '{}').columns).toHaveLength(1)
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
