import { enableAutoUnmount, mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

enableAutoUnmount(afterEach)

async function loadView() {
  return (await import('../../src/components/CalculatorView.vue')).default
}
async function loadCalc() {
  return (await import('../../src/composables/useCalculator')).useCalculator
}

describe('CalculatorView', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.resetModules()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('渲染房贷表 5 个期限利率输入与公积金个人/单位输入', async () => {
    const CalculatorView = await loadView()
    const wrapper = mount(CalculatorView)

    expect(wrapper.find('[data-testid="calc-rate-5"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="calc-rate-30"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="calc-personal-rate"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="calc-employer-rate"]').exists()).toBe(true)
    expect(wrapper.text()).toContain('5 年')
    expect(wrapper.text()).toContain('30 年')
    expect(wrapper.text()).toContain('合计')
  })

  it('改贷款金额 + 30年利率 → 月供/总利息/还款总额更新', async () => {
    const CalculatorView = await loadView()
    const useCalculator = await loadCalc()
    const calc = useCalculator()
    const wrapper = mount(CalculatorView)

    await wrapper.get('[data-testid="calc-loan-amount"]').setValue('1000000')
    await wrapper.get('[data-testid="calc-rate-30"]').setValue('3.5')

    expect(calc.state.value.loanAmount).toBe(1000000)
    // 月供 4,490、总利息 616,561（formatCurrency 取整千分位）
    expect(wrapper.get('[data-testid="calc-mort-30-payment"]').text()).toBe('4,490')
    expect(wrapper.get('[data-testid="calc-mort-30-interest"]').text()).toBe('616,561')
  })

  it('只改 5 年利率 → 仅该行走等额本息，未填利率的 10 年按本金/月数', async () => {
    const CalculatorView = await loadView()
    const wrapper = mount(CalculatorView)

    await wrapper.get('[data-testid="calc-loan-amount"]').setValue('1000000')
    await wrapper.get('[data-testid="calc-rate-5"]').setValue('3.5')

    // 5 年等额本息月供 18,192；10 年利率 0 → 1,000,000/120 = 8,333
    expect(wrapper.get('[data-testid="calc-mort-5-payment"]').text()).toBe('18,192')
    expect(wrapper.get('[data-testid="calc-mort-10-payment"]').text()).toBe('8,333')
  })

  it('改公积金基数与比例 → 个人/单位/合计与比例合计更新', async () => {
    const CalculatorView = await loadView()
    const wrapper = mount(CalculatorView)

    await wrapper.get('[data-testid="calc-fund-base"]').setValue('10000')
    await wrapper.get('[data-testid="calc-personal-rate"]').setValue('12')
    await wrapper.get('[data-testid="calc-employer-rate"]').setValue('12')

    expect(wrapper.text()).toContain('1,200') // 个人、单位各 1,200
    expect(wrapper.text()).toContain('2,400') // 合计
    expect(wrapper.text()).toContain('24%') // 比例合计
  })

  it('默认全 0 时不抛错、渲染正常', async () => {
    const CalculatorView = await loadView()
    const wrapper = mount(CalculatorView)
    expect(wrapper.text()).toContain('合计')
    expect(wrapper.findAll('input').length).toBeGreaterThan(0)
  })
})
