import { enableAutoUnmount, mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'

enableAutoUnmount(afterEach)

async function loadComparisonView() {
  return (await import('../../src/components/ComparisonView.vue')).default
}

async function loadUseStore() {
  return (await import('../../src/composables/useStore')).useStore
}

describe('ComparisonView', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.resetModules()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  async function setupMultipleScenarios() {
    const useStore = await loadUseStore()
    const store = useStore()
    store.renameScenario(store.workspace.value.scenarios[0].id, '买房方案')
    const col1 = store.addColumn('工资')
    store.updateColumnEntry(col1.id, 202601, 10000)

    const s2 = store.addScenario()
    store.renameScenario(s2.id, '租房方案')
    store.switchScenario(s2.id)
    const col2 = store.addColumn('工资')
    store.updateColumnEntry(col2.id, 202601, 10000)
    const rent = store.addColumn('房租')
    store.updateColumnEntry(rent.id, 202601, -3000)

    // 切回第一个方案，使 store 状态确定
    store.switchScenario(store.workspace.value.scenarios[0].id)
    return store
  }

  it('渲染所有方案的复选框', async () => {
    await setupMultipleScenarios()
    const ComparisonView = await loadComparisonView()
    const wrapper = mount(ComparisonView)

    const checkboxes = wrapper.findAll('input[type="checkbox"]')
    expect(checkboxes).toHaveLength(2)
    // 默认全选
    expect((checkboxes[0].element as HTMLInputElement).checked).toBe(true)
    expect((checkboxes[1].element as HTMLInputElement).checked).toBe(true)
  })

  it('默认全选且显示对比表', async () => {
    await setupMultipleScenarios()
    const ComparisonView = await loadComparisonView()
    const wrapper = mount(ComparisonView)

    // 应显示对比表
    expect(wrapper.find('table').exists()).toBe(true)
    // 表头含两个方案名
    const headers = wrapper.findAll('thead th')
    const headerTexts = headers.map(h => h.text())
    expect(headerTexts).toContain('买房方案')
    expect(headerTexts).toContain('租房方案')
  })

  it('取消选择至不足 2 个时显示提示', async () => {
    await setupMultipleScenarios()
    const ComparisonView = await loadComparisonView()
    const wrapper = mount(ComparisonView)

    // 取消所有选择
    const checkboxes = wrapper.findAll('input[type="checkbox"]')
    await checkboxes[0].setValue(false)
    await checkboxes[1].setValue(false)

    // 应显示提示信息
    expect(wrapper.find('table').exists()).toBe(false)
    expect(wrapper.text()).toContain('请至少选择 2 个方案进行对比')
  })

  it('对比表包含所有指标行', async () => {
    await setupMultipleScenarios()
    const ComparisonView = await loadComparisonView()
    const wrapper = mount(ComparisonView)

    const rows = wrapper.findAll('tbody tr')
    const labels = rows.map(r => r.find('td').text())
    expect(labels).toContain('第1年末')
    expect(labels).toContain('第2年末')
    expect(labels).toContain('第3年末')
    expect(labels).toContain('第4年末')
    expect(labels).toContain('第5年末')
    expect(labels).toContain('5年总收入')
    expect(labels).toContain('5年总支出')
    expect(labels).toContain('5年净储蓄')
    expect(labels).toContain('最终累计储蓄')
    expect(labels).toContain('期间最低储蓄')
  })

  it('差异列以第一个选中方案为基准标注正负差额', async () => {
    await setupMultipleScenarios()
    const ComparisonView = await loadComparisonView()
    const wrapper = mount(ComparisonView)

    // 找到「5年总支出」行
    const rows = wrapper.findAll('tbody tr')
    const expenseRow = rows.find(r => r.find('td').text().includes('5年总支出'))
    expect(expenseRow).toBeDefined()

    const cells = expenseRow!.findAll('td')
    // 第一个是标签，第二个是基准方案值（买房方案无房租），第三个是对比方案值（有房租）
    // 买房方案支出为 0（无负数列），租房方案支出为 3000×60=180000
    // 差额：180000 - 0 = +180000，应显示绿色
    const diffCell = cells[2]
    expect(diffCell.text()).toContain('+')
    // 差额显示在内部 span 上
    const diffSpan = diffCell.find('span.text-green-600')
    expect(diffSpan.exists()).toBe(true)
    expect(diffSpan.text()).toContain('+')
  })

  it('点击关闭按钮触发 close 事件', async () => {
    await setupMultipleScenarios()
    const ComparisonView = await loadComparisonView()
    const wrapper = mount(ComparisonView)

    await wrapper.find('[data-test="close-comparison"]').trigger('click')
    expect(wrapper.emitted('close')).toHaveLength(1)
  })

  it('仅 1 个方案时不显示对比表', async () => {
    const useStore = await loadUseStore()
    useStore()

    const ComparisonView = await loadComparisonView()
    const wrapper = mount(ComparisonView)

    expect(wrapper.text()).toContain('请至少选择 2 个方案进行对比')
  })
})
