import { mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

async function loadApp() {
  return (await import('../src/App.vue')).default
}

async function loadUseStore() {
  return (await import('../src/composables/useStore')).useStore
}

function findButton(wrapper: ReturnType<typeof mount>, text: string) {
  return wrapper.findAll('button').find(button => button.text() === text)
}

function restoreUrlProperty(name: 'createObjectURL' | 'revokeObjectURL', descriptor: PropertyDescriptor | undefined) {
  if (descriptor) {
    Object.defineProperty(URL, name, descriptor)
  } else {
    Reflect.deleteProperty(URL, name)
  }
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
    vi.restoreAllMocks()
    restoreUrlProperty('createObjectURL', originalCreateObjectURLDescriptor)
    restoreUrlProperty('revokeObjectURL', originalRevokeObjectURLDescriptor)
  })

  it('点击导出按钮创建并点击下载链接', async () => {
    const useStore = await loadUseStore()
    const store = useStore()
    store.data.value.systemParams.currentSavings = 888888

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

    const anchors: HTMLAnchorElement[] = []
    const originalCreateElement = document.createElement.bind(document)
    vi.spyOn(document, 'createElement').mockImplementation((tagName: string) => {
      const element = originalCreateElement(tagName)

      if (tagName.toLowerCase() === 'a') {
        vi.spyOn(element, 'click').mockImplementation(() => {})
        anchors.push(element as HTMLAnchorElement)
      }

      return element
    })

    const App = await loadApp()
    const wrapper = mount(App, {
      global: {
        stubs: {
          AnnualTable: true,
          MonthlyTable: true,
          ParamPanel: true,
        },
      },
    })

    await findButton(wrapper, '导出')?.trigger('click')

    expect(createObjectURL).toHaveBeenCalledTimes(1)
    expect(createObjectURL.mock.calls[0][0]).toBeInstanceOf(Blob)
    expect(anchors).toHaveLength(1)
    expect(anchors[0].href).toBe('blob:finance-plan')
    expect(anchors[0].download).toBe('finance-plan.json')
    expect(anchors[0].click).toHaveBeenCalledTimes(1)
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:finance-plan')
  })

  it('确认重置时清空数据', async () => {
    const useStore = await loadUseStore()
    const store = useStore()
    store.data.value.systemParams.currentSavings = 999999
    store.save()

    vi.spyOn(window, 'confirm').mockReturnValue(true)

    const App = await loadApp()
    const wrapper = mount(App, {
      global: {
        stubs: {
          AnnualTable: true,
          MonthlyTable: true,
          ParamPanel: true,
        },
      },
    })

    await findButton(wrapper, '重置')?.trigger('click')

    expect(window.confirm).toHaveBeenCalledWith('确定要重置所有数据？此操作不可撤销。')
    expect(store.data.value.systemParams.currentSavings).toBe(0)
    expect(localStorage.getItem('family-finance-plan')).toBeNull()
  })

  it('取消重置时保留数据', async () => {
    const useStore = await loadUseStore()
    const store = useStore()
    store.data.value.systemParams.currentSavings = 999999
    store.save()

    vi.spyOn(window, 'confirm').mockReturnValue(false)

    const App = await loadApp()
    const wrapper = mount(App, {
      global: {
        stubs: {
          AnnualTable: true,
          MonthlyTable: true,
          ParamPanel: true,
        },
      },
    })

    await findButton(wrapper, '重置')?.trigger('click')

    expect(store.data.value.systemParams.currentSavings).toBe(999999)
    expect(JSON.parse(localStorage.getItem('family-finance-plan') ?? '{}').systemParams.currentSavings).toBe(999999)
  })
})
