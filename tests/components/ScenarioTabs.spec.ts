import { enableAutoUnmount, mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'

enableAutoUnmount(afterEach)

async function loadScenarioTabs() {
  return (await import('../../src/components/ScenarioTabs.vue')).default
}

async function loadUseStore() {
  return (await import('../../src/composables/useStore')).useStore
}

describe('ScenarioTabs', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.resetModules()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('渲染所有方案 tab，高亮当前方案', async () => {
    const useStore = await loadUseStore()
    const store = useStore()
    store.renameScenario(store.workspace.value.scenarios[0].id, '买房方案')
    const s2 = store.addScenario()
    store.renameScenario(s2.id, '租房方案')

    const ScenarioTabs = await loadScenarioTabs()
    const wrapper = mount(ScenarioTabs)

    const tabs = wrapper.findAll('[data-test="scenario-tab"]')
    expect(tabs).toHaveLength(2)
    expect(tabs[0].text()).toContain('买房方案')
    expect(tabs[1].text()).toContain('租房方案')
    // s2 是当前激活，第二个 tab 高亮
    expect(tabs[1].classes()).toContain('bg-brand-50')
  })

  it('点击 tab 切换激活方案', async () => {
    const useStore = await loadUseStore()
    const store = useStore()
    store.renameScenario(store.workspace.value.scenarios[0].id, '方案A')
    const s2 = store.addScenario()
    store.renameScenario(s2.id, '方案B')

    const ScenarioTabs = await loadScenarioTabs()
    const wrapper = mount(ScenarioTabs)

    const tabs = wrapper.findAll('[data-test="scenario-tab"]')
    await tabs[0].trigger('click')

    expect(store.workspace.value.activeId).toBe(store.workspace.value.scenarios[0].id)
  })

  it('双击 tab 进入行内重命名', async () => {
    const useStore = await loadUseStore()
    const store = useStore()
    store.renameScenario(store.workspace.value.scenarios[0].id, '方案A')

    const ScenarioTabs = await loadScenarioTabs()
    const wrapper = mount(ScenarioTabs)

    const tabName = wrapper.find('[data-test="scenario-name"]')
    await tabName.trigger('dblclick')

    const input = wrapper.find('input[data-test="rename-input"]')
    expect(input.exists()).toBe(true)
    expect(input.element.value).toBe('方案A')
  })

  it('重命名输入回车确认', async () => {
    const useStore = await loadUseStore()
    const store = useStore()
    store.renameScenario(store.workspace.value.scenarios[0].id, '方案A')

    const ScenarioTabs = await loadScenarioTabs()
    const wrapper = mount(ScenarioTabs)

    const tabName = wrapper.find('[data-test="scenario-name"]')
    await tabName.trigger('dblclick')

    const input = wrapper.find('input[data-test="rename-input"]')
    await input.setValue('买房方案')
    await input.trigger('keyup.enter')

    expect(store.workspace.value.scenarios[0].name).toBe('买房方案')
    expect(wrapper.find('input[data-test="rename-input"]').exists()).toBe(false)
  })

  it('重命名输入 Esc 取消', async () => {
    const useStore = await loadUseStore()
    const store = useStore()
    store.renameScenario(store.workspace.value.scenarios[0].id, '方案A')

    const ScenarioTabs = await loadScenarioTabs()
    const wrapper = mount(ScenarioTabs)

    const tabName = wrapper.find('[data-test="scenario-name"]')
    await tabName.trigger('dblclick')

    const input = wrapper.find('input[data-test="rename-input"]')
    await input.setValue('新名字')
    await input.trigger('keyup.escape')

    expect(store.workspace.value.scenarios[0].name).toBe('方案A')
  })

  it('hover 显示删除按钮，仅剩一个方案时不显示', async () => {
    const useStore = await loadUseStore()
    const store = useStore()
    store.renameScenario(store.workspace.value.scenarios[0].id, '方案A')

    const ScenarioTabs = await loadScenarioTabs()
    const wrapper = mount(ScenarioTabs)

    // 仅一个方案，无删除按钮
    expect(wrapper.find('[data-test="remove-scenario"]').exists()).toBe(false)

    // 添加第二个方案
    const s2 = store.addScenario()
    store.renameScenario(s2.id, '方案B')
    await nextTick()

    // 有删除按钮
    const removeButtons = wrapper.findAll('[data-test="remove-scenario"]')
    expect(removeButtons).toHaveLength(2)
  })

  it('点击删除按钮弹出确认后删除', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    const useStore = await loadUseStore()
    const store = useStore()
    store.renameScenario(store.workspace.value.scenarios[0].id, '方案A')
    const s2 = store.addScenario()
    store.renameScenario(s2.id, '方案B')

    const ScenarioTabs = await loadScenarioTabs()
    const wrapper = mount(ScenarioTabs)

    const removeButtons = wrapper.findAll('[data-test="remove-scenario"]')
    await removeButtons[1].trigger('click')

    expect(store.workspace.value.scenarios).toHaveLength(1)
    expect(store.workspace.value.scenarios[0].name).toBe('方案A')
  })

  it('点击新建按钮创建新方案并进入命名编辑', async () => {
    const useStore = await loadUseStore()
    const store = useStore()

    const ScenarioTabs = await loadScenarioTabs()
    const wrapper = mount(ScenarioTabs)

    await wrapper.find('[data-test="add-scenario"]').trigger('click')
    await nextTick()

    expect(store.workspace.value.scenarios).toHaveLength(2)
    const input = wrapper.find('input[data-test="rename-input"]')
    expect(input.exists()).toBe(true)
  })

  it('点击复制按钮深拷贝当前方案并进入命名编辑', async () => {
    const useStore = await loadUseStore()
    const store = useStore()
    store.addColumn('工资')

    const ScenarioTabs = await loadScenarioTabs()
    const wrapper = mount(ScenarioTabs)

    await wrapper.find('[data-test="duplicate-scenario"]').trigger('click')
    await nextTick()

    expect(store.workspace.value.scenarios).toHaveLength(2)
    const newScenario = store.workspace.value.scenarios[1]
    expect(newScenario.plan.columns).toHaveLength(1)
    expect(newScenario.plan.columns[0].name).toBe('工资')
    const input = wrapper.find('input[data-test="rename-input"]')
    expect(input.exists()).toBe(true)
  })
})
