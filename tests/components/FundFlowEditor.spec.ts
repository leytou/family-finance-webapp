import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import type { MonthResult, FundWithdrawal } from '../../src/types'

// 全局 spy：捕获每次 useStore() 返回对象的 addFundCorrection 调用。
// useStore() 每次返回独立的新对象，直接 spyOn(测试自身的 store) 抓不到组件内部的调用，
// 故用 vi.mock 包装，给每个返回对象都装上同一个 spy。
const { addFundCorrectionSpy } = vi.hoisted(() => ({ addFundCorrectionSpy: vi.fn() }))
vi.mock('../../src/composables/useStore', async () => {
  const actual = await vi.importActual<typeof import('../../src/composables/useStore')>('../../src/composables/useStore')
  return {
    ...actual,
    useStore: () => {
      const store = actual.useStore()
      // 仅在尚未替换时挂 spy（避免重复包裹导致递归）
      if (!(store.addFundCorrection as unknown as { __spied?: boolean }).__spied) {
        const original = store.addFundCorrection.bind(store)
        ;(store.addFundCorrection as unknown as { __spied?: boolean }).__spied = true
        store.addFundCorrection = (month: number, actualBalance: number) => {
          addFundCorrectionSpy(month, actualBalance)
          return original(month, actualBalance)
        }
      }
      return store
    },
  }
})

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
    isCorrected: false,
    fundBalance: 3000, fundInterest: 0, fundContribution: 2000,
    fundOffset: 1000, fundWithdrawal: 1000, fundOutflow: 2000,
    isFundCorrected: false, totalAssets: 6000,
    ...overrides,
  }
}

describe('FundFlowEditor', () => {
  beforeEach(() => {
    vi.useRealTimers()
    localStorage.clear()
    vi.resetModules()
    addFundCorrectionSpy.mockClear()
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
    expect(text).toContain('999,999')   // 编辑行请求值
    expect(text).toContain('已截断')
    expect(text).toContain('2,000')     // 流水行实际值（result.fundWithdrawal=2000）
  })

  it('按传入坐标定位', async () => {
    const FundFlowEditor = await loadFundFlowEditor()
    const wrapper = mount(FundFlowEditor, {
      props: { month: 202602, result: makeResult(), prevFundBalance: 0, withdrawals: [], x: 80, y: 90 },
    })
    expect(wrapper.attributes('style')).toContain('left: 80px')
    expect(wrapper.attributes('style')).toContain('top: 90px')
  })

  it('填实际余额并完成，写入公积金修正', async () => {
    const useStore = await loadUseStore()
    const store = useStore()
    store.enableFund()
    const FundFlowEditor = await loadFundFlowEditor()
    const wrapper = mount(FundFlowEditor, {
      props: { month: 202602, result: makeResult(), prevFundBalance: 2000, withdrawals: [], x: 10, y: 10 },
    })
    await wrapper.find('input[data-correction-input]').setValue('12345')
    await wrapper.find('[aria-label="完成"]').trigger('click')

    const correction = store.data.value.fund!.corrections.find(a => a.month === 202602)
    expect(correction?.actualBalance).toBe(12345)
  })

  it('清空修正框并完成，移除公积金修正', async () => {
    const useStore = await loadUseStore()
    const store = useStore()
    store.enableFund()
    store.addFundCorrection(202602, 12345)
    const FundFlowEditor = await loadFundFlowEditor()
    const wrapper = mount(FundFlowEditor, {
      props: { month: 202602, result: makeResult(), prevFundBalance: 2000, withdrawals: [], x: 10, y: 10, actualBalance: 12345 },
    })
    await wrapper.find('input[data-correction-input]').setValue('')
    await wrapper.find('[aria-label="完成"]').trigger('click')

    expect(store.data.value.fund!.corrections.find(a => a.month === 202602)).toBeUndefined()
  })

  it('已修正时修正框预填实际余额', async () => {
    const FundFlowEditor = await loadFundFlowEditor()
    const wrapper = mount(FundFlowEditor, {
      props: { month: 202602, result: makeResult(), prevFundBalance: 2000, withdrawals: [], x: 10, y: 10, actualBalance: 9999 },
    })
    expect((wrapper.find('input[data-correction-input]').element as HTMLInputElement).value).toBe('9999')
  })

  it('值未变化不重复写入修正', async () => {
    const useStore = await loadUseStore()
    const store = useStore()
    store.enableFund()
    store.addFundCorrection(202602, 5000)
    addFundCorrectionSpy.mockClear()   // 忽略上面初始化写入的调用，仅观察「完成」之后的
    const FundFlowEditor = await loadFundFlowEditor()
    const wrapper = mount(FundFlowEditor, {
      props: { month: 202602, result: makeResult(), prevFundBalance: 2000, withdrawals: [], x: 10, y: 10, actualBalance: 5000 },
    })
    // 不改动修正框，直接完成
    await wrapper.find('[aria-label="完成"]').trigger('click')

    // 值未变化 → 不应调用 addFundCorrection（真正锁住"跳过写入"契约）
    expect(addFundCorrectionSpy).not.toHaveBeenCalled()
    // 修正仍存在且值不变
    const correction = store.data.value.fund!.corrections.find(a => a.month === 202602)
    expect(correction?.actualBalance).toBe(5000)
  })
})
