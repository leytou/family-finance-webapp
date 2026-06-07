import { mount } from '@vue/test-utils'
import { nextTick } from 'vue'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

async function loadUseStore() {
  return (await import('../../src/composables/useStore')).useStore
}

async function loadParamPanel() {
  return (await import('../../src/components/ParamPanel.vue')).default
}

describe('ParamPanel', () => {
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

  async function flushAutoSave(ms = 300) {
    await nextTick()
    await vi.advanceTimersByTimeAsync(ms)
  }

  it('保留系统参数并支持新增收入和支出项目', async () => {
    const ParamPanel = await loadParamPanel()
    const wrapper = mount(ParamPanel)

    expect(wrapper.text()).toContain('系统参数')
    expect(wrapper.text()).toContain('现金流项目')

    await wrapper.get('[aria-label="添加收入项目"]').trigger('click')
    await wrapper.get('[aria-label="添加支出项目"]').trigger('click')

    const useStore = await loadUseStore()
    const { data } = useStore()

    expect(data.value.items).toMatchObject([
      { name: '新收入', type: 'income' },
      { name: '新支出', type: 'expense' },
    ])
  })

  it('接收项目更新后替换原项目并自动保存', async () => {
    vi.useFakeTimers()
    const useStore = await loadUseStore()
    const { addItem, data } = useStore()
    addItem('工资', 'income')
    const original = data.value.items[0]

    const ParamPanel = await loadParamPanel()
    const wrapper = mount(ParamPanel)
    await wrapper.getComponent({ name: 'CashFlowItemEditor' }).vm.$emit('update', {
      ...original,
      name: '工资调整',
      segments: [{ amount: 10000, startMonth: 202601, endMonth: 202612 }],
    })

    expect(data.value.items[0]).toMatchObject({
      id: original.id,
      name: '工资调整',
      segments: [{ amount: 10000, startMonth: 202601, endMonth: 202612 }],
    })
    await flushAutoSave()

    expect(JSON.parse(localStorage.getItem('family-finance-plan') ?? '{}').items[0]).toMatchObject({
      id: original.id,
      name: '工资调整',
      segments: [{ amount: 10000, startMonth: 202601, endMonth: 202612 }],
    })
  })

  it('向现金流编辑器传递系统起始月份', async () => {
    const useStore = await loadUseStore()
    const { addItem, data } = useStore()
    data.value.systemParams.startMonth = 202704
    addItem('工资', 'income')

    const ParamPanel = await loadParamPanel()
    const wrapper = mount(ParamPanel)

    expect(wrapper.getComponent({ name: 'CashFlowItemEditor' }).props('startMonth')).toBe(202704)
  })

  it('使用紧凑侧栏表单样式', async () => {
    const ParamPanel = await loadParamPanel()
    const wrapper = mount(ParamPanel)

    expect(wrapper.get('section h2').classes()).toEqual(
      expect.arrayContaining(['text-xs', 'font-bold', 'uppercase', 'tracking-wider', 'text-gray-500'])
    )
    expect(wrapper.get('section div').classes()).toContain('space-y-1')
    expect(wrapper.get('input').classes()).toEqual(expect.arrayContaining(['h-7', 'text-xs']))
  })

  it('系统参数输入变化不依赖 change 手动保存但仍更新 store 数据', async () => {
    vi.useFakeTimers()
    const setItem = vi.spyOn(Storage.prototype, 'setItem')
    const ParamPanel = await loadParamPanel()
    const wrapper = mount(ParamPanel)
    const input = wrapper.findAll('input')[0]

    ;(input.element as HTMLInputElement).value = '123456'
    await input.trigger('input')

    const useStore = await loadUseStore()
    const { data } = useStore()

    expect(data.value.systemParams.currentSavings).toBe(123456)
    expect(setItem).not.toHaveBeenCalled()

    await input.trigger('change')
    expect(setItem).not.toHaveBeenCalled()

    await flushAutoSave()

    expect(setItem).toHaveBeenCalledTimes(1)
    expect(JSON.parse(localStorage.getItem('family-finance-plan') ?? '{}').systemParams.currentSavings).toBe(
      123456,
    )
  })
})
