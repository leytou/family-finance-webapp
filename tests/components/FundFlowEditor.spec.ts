import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import type { MonthResult, FundWithdrawal } from '../../src/types'

async function loadFundFlowEditor() {
  return (await import('../../src/components/FundFlowEditor.vue')).default
}
async function loadUseStore() {
  return (await import('../../src/composables/useStore')).useStore
}

function makeResult(overrides: Partial<MonthResult> = {}): MonthResult {
  return {
    month: 202602, columnValues: [], totalFlow: 0, investReturn: 0,
    monthlyIncome: 0, monthlyExpense: 0, monthlyBalance: 0, cumSavings: 3000,
    isAnchor: false,
    fundBalance: 3000, fundInterest: 0, fundContribution: 2000,
    fundOffset: 1000, fundWithdrawal: 1000, fundOutflow: 2000,
    isFundAnchor: false, totalAssets: 6000,
    ...overrides,
  }
}

describe('FundFlowEditor', () => {
  beforeEach(() => {
    vi.useRealTimers()
    localStorage.clear()
    vi.resetModules()
  })
  afterEach(() => {
    vi.clearAllMocks()
    vi.useRealTimers()
  })

  it('展示流水：期初/缴存/提取/月冲/结息/期末', async () => {
    const FundFlowEditor = await loadFundFlowEditor()
    const withdrawals: FundWithdrawal[] = [{ id: 'w1', name: '首付提取', month: 202602, amount: 1000 }]
    const wrapper = mount(FundFlowEditor, {
      props: { month: 202602, result: makeResult(), prevFundBalance: 2000, withdrawals, x: 10, y: 10 },
    })
    const text = wrapper.text()
    expect(text).toContain('2026-02 公积金')
    expect(text).toContain('期初余额')
    expect(text).toContain('2,000')
    expect(text).toContain('缴存')
    expect(text).toContain('提取')
    expect(text).toContain('月冲')
    expect(text).toContain('期末余额')
    expect(text).toContain('3,000')
  })

  it('提取行预填并可增删', async () => {
    const FundFlowEditor = await loadFundFlowEditor()
    const withdrawals: FundWithdrawal[] = [{ id: 'w1', name: '首付提取', month: 202602, amount: 1000 }]
    const wrapper = mount(FundFlowEditor, {
      props: { month: 202602, result: makeResult(), prevFundBalance: 2000, withdrawals, x: 10, y: 10 },
    })
    expect(wrapper.find('[aria-label="删除该提取"]').exists()).toBe(true)
    await wrapper.find('[aria-label="添加提取"]').trigger('click')
    expect(wrapper.findAll('[aria-label="删除该提取"]')).toHaveLength(2)
    await wrapper.findAll('[aria-label="删除该提取"]')[0]!.trigger('click')
    expect(wrapper.findAll('[aria-label="删除该提取"]')).toHaveLength(1)
  })

  it('点完成写回 replaceMonthWithdrawals', async () => {
    const useStore = await loadUseStore()
    const store = useStore()
    store.enableFund()
    const FundFlowEditor = await loadFundFlowEditor()
    const wrapper = mount(FundFlowEditor, {
      props: { month: 202602, result: makeResult(), prevFundBalance: 2000, withdrawals: [], x: 10, y: 10 },
    })
    await wrapper.find('[aria-label="添加提取"]').trigger('click')
    const inputs = wrapper.findAll('input')
    await inputs[0]!.setValue('装修提取')
    await inputs[1]!.setValue('5000')
    await wrapper.find('[aria-label="完成"]').trigger('click')

    expect(store.data.value.fund!.withdrawals).toHaveLength(1)
    expect(store.data.value.fund!.withdrawals[0]!.name).toBe('装修提取')
    expect(store.data.value.fund!.withdrawals[0]!.amount).toBe(5000)
    expect(store.data.value.fund!.withdrawals[0]!.month).toBe(202602)
  })

  it('截断时编辑行显示请求值，流水行显示实际值，附「已截断」', async () => {
    const FundFlowEditor = await loadFundFlowEditor()
    const withdrawals: FundWithdrawal[] = [{ id: 'w1', name: '超额', month: 202602, amount: 999999 }]
    const result = makeResult({ fundWithdrawal: 2000 })
    const wrapper = mount(FundFlowEditor, {
      props: { month: 202602, result, prevFundBalance: 10000, withdrawals, x: 10, y: 10 },
    })
    const text = wrapper.text()
    expect(text).toContain('999,999')
    expect(text).toContain('已截断')
  })

  it('按传入坐标定位', async () => {
    const FundFlowEditor = await loadFundFlowEditor()
    const wrapper = mount(FundFlowEditor, {
      props: { month: 202602, result: makeResult(), prevFundBalance: 0, withdrawals: [], x: 80, y: 90 },
    })
    expect(wrapper.attributes('style')).toContain('left: 80px')
    expect(wrapper.attributes('style')).toContain('top: 90px')
  })
})
