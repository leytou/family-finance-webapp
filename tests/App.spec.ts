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

function getTableRows(wrapper: ReturnType<typeof mount>, tableIndex: number): string[][] {
  return wrapper
    .findAll('table')
    [tableIndex].findAll('tbody tr')
    .map(row => row.findAll('td').map(cell => cell.text()))
}

function findRow(wrapper: ReturnType<typeof mount>, tableIndex: number, firstCell: string): string[] {
  const row = getTableRows(wrapper, tableIndex).find(cells => cells[0] === firstCell)

  if (!row) {
    throw new Error(`找不到行：${firstCell}`)
  }

  return row
}

async function flushAutoSave(ms = 300) {
  await nextTick()
  await vi.advanceTimersByTimeAsync(ms)
}

function readBlobAsText(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()

    reader.addEventListener('load', () => resolve(String(reader.result)))
    reader.addEventListener('error', () => reject(reader.error))
    reader.readAsText(blob)
  })
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
    vi.clearAllTimers()
    vi.useRealTimers()
    vi.restoreAllMocks()
    restoreUrlProperty('createObjectURL', originalCreateObjectURLDescriptor)
    restoreUrlProperty('revokeObjectURL', originalRevokeObjectURLDescriptor)
  })

  it('点击导出按钮创建并点击下载链接', async () => {
    const useStore = await loadUseStore()
    const store = useStore()
    store.data.value.systemParams.currentSavings = 888888
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
          ParamPanel: true,
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

  it('完成收入支出、锚点、分段、公式、刷新恢复、导出和重置流程', async () => {
    vi.useFakeTimers()
    const createObjectURL = vi.fn(() => 'blob:finance-plan')
    const revokeObjectURL = vi.fn()
    const anchors: HTMLAnchorElement[] = []
    let exportedBlob: Blob | undefined
    const initialConfirm = vi.spyOn(window, 'confirm').mockReturnValue(true)

    Object.defineProperty(URL, 'createObjectURL', {
      configurable: true,
      value: (blob: Blob) => {
        exportedBlob = blob
        return createObjectURL(blob)
      },
    })
    Object.defineProperty(URL, 'revokeObjectURL', {
      configurable: true,
      value: revokeObjectURL,
    })

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
    const wrapper = mount(App)

    const systemInputs = wrapper.findAll('aside section:first-child input')
    await systemInputs[0].setValue(100000)
    await systemInputs[1].setValue(202601)
    await systemInputs[2].setValue(0.025)

    await wrapper.get('[aria-label="添加收入项目"]').trigger('click')
    await wrapper.get('[aria-label="添加支出项目"]').trigger('click')

    const editors = wrapper.findAllComponents({ name: 'CashFlowItemEditor' })
    await editors[0].get('[aria-label="项目名称"]').setValue('工资')
    await editors[0].get('[aria-label="展开金额段"]').trigger('click')
    await editors[0].get('[aria-label="添加金额段"]').trigger('click')
    await editors[0].get('[aria-label="金额"]').setValue(20000)

    await editors[1].get('[aria-label="项目名称"]').setValue('房租')
    await editors[1].get('[aria-label="展开金额段"]').trigger('click')
    await editors[1].get('[aria-label="添加金额段"]').trigger('click')
    await editors[1].get('[aria-label="金额"]').setValue(5000)
    await nextTick()

    expect(findRow(wrapper, 1, '2026-01')).toEqual([
      '2026-01',
      '20,000',
      '5,000',
      '208',
      '15,208',
      '115,208',
    ])
    expect(findRow(wrapper, 0, '工资')[1]).toBe('240,000')
    expect(findRow(wrapper, 0, '房租')[1]).toBe('60,000')
    expect(findRow(wrapper, 0, '年度结余')[1]).toBe('184,606')

    await wrapper.get('[aria-label="锚点月份"]').setValue(202612)
    await wrapper.get('[aria-label="锚点金额"]').setValue(250000)
    await wrapper.get('[aria-label="添加月度锚点"]').trigger('click')
    await nextTick()

    expect(findRow(wrapper, 1, '2026-12')[5]).toBe('250,000')
    expect(findRow(wrapper, 1, '2027-01')).toEqual([
      '2027-01',
      '20,000',
      '5,000',
      '521',
      '15,521',
      '265,521',
    ])

    const salaryEditor = wrapper.findAllComponents({ name: 'CashFlowItemEditor' })[0]
    await salaryEditor.findAll('[aria-label="删除金额段"]')[0].trigger('click')
    await salaryEditor.get('[aria-label="添加金额段"]').trigger('click')
    let salaryInputs = salaryEditor.findAll('[aria-label="金额"]')
    await salaryInputs[0].setValue(20000)
    let salaryCells = salaryEditor.findAll('[data-testid="grid-cell"]')
    await salaryCells[0].trigger('mousedown')
    await salaryCells[11].trigger('mousemove')
    await salaryCells[11].trigger('mouseup')

    await salaryEditor.get('[aria-label="添加金额段"]').trigger('click')
    salaryInputs = salaryEditor.findAll('[aria-label="金额"]')
    await salaryInputs[1].setValue(25000)
    salaryCells = salaryEditor.findAll('[data-testid="grid-cell"]')
    await salaryCells[72].trigger('mousedown')
    await salaryCells[119].trigger('mousemove')
    await salaryCells[119].trigger('mouseup')
    await nextTick()

    expect(findRow(wrapper, 1, '2026-12')[1]).toBe('20,000')
    expect(findRow(wrapper, 1, '2027-01')[1]).toBe('25,000')
    expect(findRow(wrapper, 0, '工资')[1]).toBe('240,000')
    expect(findRow(wrapper, 0, '工资')[2]).toBe('300,000')

    await wrapper.get('[aria-label="编辑 2027-01 累计储蓄"]').trigger('mouseenter', {
      clientX: 100,
      clientY: 120,
    })
    expect(wrapper.text()).toContain('2027-01 - 累计储蓄')
    expect(wrapper.text()).toContain('累计储蓄 = 上月累计 + 当月净储蓄(20,521)')

    await flushAutoSave()
    expect(JSON.parse(localStorage.getItem('family-finance-plan') ?? '{}').items).toMatchObject([
      {
        name: '工资',
        type: 'income',
        segments: [
          { amount: 20000, startMonth: 202601, endMonth: 202612 },
          { amount: 25000, startMonth: 202701, endMonth: 203012 },
        ],
      },
      {
        name: '房租',
        type: 'expense',
        segments: [{ amount: 5000, startMonth: 202601, endMonth: 203012 }],
      },
    ])
    wrapper.unmount()
    vi.resetModules()
    initialConfirm.mockRestore()
    const reloadedConfirm = vi.spyOn(window, 'confirm').mockReturnValue(true)

    const ReloadedApp = await loadApp()
    const reloaded = mount(ReloadedApp)
    expect(findRow(reloaded, 1, '2027-01')).toEqual([
      '2027-01',
      '25,000',
      '5,000',
      '521',
      '20,521',
      '270,521',
    ])

    await findButton(reloaded, '导出')?.trigger('click')
    const exportAnchor = anchors.find(element => element.download === 'finance-plan.json')
    expect(exportAnchor).toBeTruthy()
    expect(exportAnchor?.download).toBe('finance-plan.json')
    expect(exportAnchor?.click).toHaveBeenCalledTimes(1)
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:finance-plan')

    const resetButton = findButton(reloaded, '重置')
    expect(resetButton).toBeTruthy()
    if (!resetButton) {
      throw new Error('找不到重置按钮')
    }
    expect(resetButton.text()).toBe('重置')
    await resetButton.trigger('click')
    await nextTick()

    expect(reloadedConfirm).toHaveBeenCalledWith('确定要重置所有数据？此操作不可撤销。')
    expect(localStorage.getItem('family-finance-plan')).toBeNull()
    expect(reloaded.findAllComponents({ name: 'CashFlowItemEditor' })).toHaveLength(0)
    expect(getTableRows(reloaded, 1)).toHaveLength(60)
    expect(getTableRows(reloaded, 1)[0].slice(1)).toEqual(['0', '0', '0'])

    vi.useRealTimers()
    const exported = JSON.parse(await readBlobAsText(exportedBlob!))
    expect(exported.systemParams).toEqual({
      currentSavings: 100000,
      startMonth: 202601,
      annualRate: 0.025,
    })
    expect(exported.anchors).toEqual([{ month: 202612, actualSavings: 250000 }])
    expect(exported.items).toMatchObject([
      {
        name: '工资',
        type: 'income',
        segments: [
          { amount: 20000, startMonth: 202601, endMonth: 202612 },
          { amount: 25000, startMonth: 202701, endMonth: 203012 },
        ],
      },
      {
        name: '房租',
        type: 'expense',
        segments: [{ amount: 5000, startMonth: 202601, endMonth: 203012 }],
      },
    ])
  })

  it('确认重置时清空数据', async () => {
    const useStore = await loadUseStore()
    const store = useStore()
    store.data.value.systemParams.currentSavings = 999999
    await nextTick()
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
    await nextTick()
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

  it('使用高数据密度的响应式分割布局', async () => {
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

    expect(wrapper.get('main').classes()).toEqual(expect.arrayContaining(['flex-1', 'flex', 'overflow-hidden']))
    expect(wrapper.get('aside').classes()).toEqual(
      expect.arrayContaining(['w-72', 'min-w-72', 'border-r', 'overflow-y-auto', 'p-3', 'text-xs'])
    )

    const tablePanes = wrapper.find('main section').findAll(':scope > div')
    expect(tablePanes[0].classes()).toEqual(
      expect.arrayContaining(['flex-none', 'max-h-[35%]', 'overflow-auto', 'border-b'])
    )
    expect(tablePanes[1].classes()).toEqual(expect.arrayContaining(['flex-1', 'overflow-auto']))
  })
})
