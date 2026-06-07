import { mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'

async function loadUseStore() {
  return (await import('../../src/composables/useStore')).useStore
}

async function loadParamPanel() {
  return (await import('../../src/components/ParamPanel.vue')).default
}

describe('ParamPanel', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.resetModules()
  })

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

  it('接收项目更新后替换原项目并保存', async () => {
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
    expect(JSON.parse(localStorage.getItem('family-finance-plan') ?? '{}').items[0]).toMatchObject({
      id: original.id,
      name: '工资调整',
      segments: [{ amount: 10000, startMonth: 202601, endMonth: 202612 }],
    })
  })
})
