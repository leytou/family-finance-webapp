import { nextTick } from 'vue'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { MORTGAGE_TERMS } from '../../src/utils/calculator'

async function loadUseCalculator() {
  return (await import('../../src/composables/useCalculator')).useCalculator
}

describe('useCalculator', () => {
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

  async function flushSave(ms = 300) {
    await nextTick()
    await vi.advanceTimersByTimeAsync(ms)
  }

  it('初次加载返回全 0 默认值', async () => {
    const useCalculator = await loadUseCalculator()
    const calc = useCalculator()
    expect(calc.state.value.loanAmount).toBe(0)
    expect(calc.state.value.fundBase).toBe(0)
    expect(calc.state.value.personalRate).toBe(0)
    expect(calc.state.value.employerRate).toBe(0)
    for (const t of MORTGAGE_TERMS) {
      expect(calc.state.value.rates[t]).toBe(0)
    }
  })

  it('改动字段后写入 family-finance-calculator（300ms 防抖）', async () => {
    vi.useFakeTimers()
    const useCalculator = await loadUseCalculator()
    const calc = useCalculator()
    calc.setLoanAmount(1000000)
    calc.setRate(30, 3.5)
    await flushSave()

    const saved = JSON.parse(localStorage.getItem('family-finance-calculator') ?? '{}')
    expect(saved.loanAmount).toBe(1000000)
    expect(saved.rates[30]).toBe(3.5)
  })

  it('不写入规划数据键 family-finance-plan', async () => {
    vi.useFakeTimers()
    const useCalculator = await loadUseCalculator()
    const calc = useCalculator()
    calc.setLoanAmount(1000000)
    await flushSave()
    expect(localStorage.getItem('family-finance-plan')).toBeNull()
  })

  it('save() 立即落盘', async () => {
    const useCalculator = await loadUseCalculator()
    const calc = useCalculator()
    calc.setFundBase(10000)
    calc.save()
    expect(JSON.parse(localStorage.getItem('family-finance-calculator') ?? '{}').fundBase).toBe(10000)
  })

  it('重新加载读回上次输入', async () => {
    const useCalculator = await loadUseCalculator()
    const c1 = useCalculator()
    c1.setLoanAmount(888888)
    c1.setFundBase(10000)
    c1.setPersonalRate(12)
    c1.setEmployerRate(12)
    c1.setRate(15, 4.2)
    c1.save()

    vi.resetModules()
    const useCalculator2 = await loadUseCalculator()
    const c2 = useCalculator2()
    expect(c2.state.value.loanAmount).toBe(888888)
    expect(c2.state.value.fundBase).toBe(10000)
    expect(c2.state.value.personalRate).toBe(12)
    expect(c2.state.value.employerRate).toBe(12)
    expect(c2.state.value.rates[15]).toBe(4.2)
  })

  it('存档损坏（非法 JSON）回退默认', async () => {
    localStorage.setItem('family-finance-calculator', '{bad json')
    const useCalculator = await loadUseCalculator()
    const calc = useCalculator()
    expect(calc.state.value.loanAmount).toBe(0)
  })

  it('存档字段非法（缺 rates）回退默认', async () => {
    localStorage.setItem(
      'family-finance-calculator',
      JSON.stringify({ version: 1, loanAmount: 100 }),
    )
    const useCalculator = await loadUseCalculator()
    const calc = useCalculator()
    expect(calc.state.value.loanAmount).toBe(0)
    expect(calc.state.value.rates[30]).toBe(0)
  })

  it('多次调用共享同一响应式源', async () => {
    const useCalculator = await loadUseCalculator()
    const a = useCalculator()
    const b = useCalculator()
    a.setFundBase(5000)
    expect(b.state.value.fundBase).toBe(5000)
  })

  it('负数 setter 原样存（不归 0），交由显示层 calc 处理', async () => {
    const useCalculator = await loadUseCalculator()
    const calc = useCalculator()
    calc.setLoanAmount(-100)
    expect(calc.state.value.loanAmount).toBe(-100)
    calc.save()
    expect(JSON.parse(localStorage.getItem('family-finance-calculator') ?? '{}').loanAmount).toBe(-100)
  })

  it('多次调用 useCalculator 不重复装 watch（写入后 setItem 仅一次）', async () => {
    vi.useFakeTimers()
    const setItem = vi.spyOn(Storage.prototype, 'setItem')
    const useCalculator = await loadUseCalculator()
    useCalculator()
    useCalculator()
    useCalculator().setLoanAmount(1)
    await nextTick()
    await vi.advanceTimersByTimeAsync(300)
    expect(setItem).toHaveBeenCalledTimes(1)
  })

  it('连续改动只保存最后一次（防抖合并）', async () => {
    vi.useFakeTimers()
    const setItem = vi.spyOn(Storage.prototype, 'setItem')
    const useCalculator = await loadUseCalculator()
    const calc = useCalculator()
    calc.setLoanAmount(1)
    await nextTick()
    await vi.advanceTimersByTimeAsync(299)
    calc.setLoanAmount(2)
    await nextTick()
    await vi.advanceTimersByTimeAsync(299)
    expect(setItem).not.toHaveBeenCalled()
    await vi.advanceTimersByTimeAsync(1)
    expect(setItem).toHaveBeenCalledTimes(1)
    expect(JSON.parse(localStorage.getItem('family-finance-calculator') ?? '{}').loanAmount).toBe(2)
  })
})
