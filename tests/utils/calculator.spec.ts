import { describe, expect, it } from 'vitest'

import { calcEqualPayment, calcHousingFund, MORTGAGE_TERMS } from '../../src/utils/calculator'

describe('calcEqualPayment', () => {
  it('100万、3.5%、各期限月供命中基准值（设计文档 §3.1）', () => {
    expect(Math.round(calcEqualPayment(1000000, 3.5, 5).monthlyPayment)).toBe(18192)
    expect(Math.round(calcEqualPayment(1000000, 3.5, 10).monthlyPayment)).toBe(9889)
    expect(Math.round(calcEqualPayment(1000000, 3.5, 15).monthlyPayment)).toBe(7149)
    expect(Math.round(calcEqualPayment(1000000, 3.5, 20).monthlyPayment)).toBe(5800)
    expect(Math.round(calcEqualPayment(1000000, 3.5, 30).monthlyPayment)).toBe(4490)
  })

  it('30年总利息与还款总额命中基准', () => {
    const r = calcEqualPayment(1000000, 3.5, 30)
    expect(Math.round(r.totalRepayment)).toBe(1616561)
    expect(Math.round(r.totalInterest)).toBe(616561)
  })

  it('不变量：总利息 = 还款总额 − 本金', () => {
    for (const years of MORTGAGE_TERMS) {
      const r = calcEqualPayment(1000000, 3.5, years)
      expect(Math.round(r.totalInterest)).toBe(Math.round(r.totalRepayment) - 1000000)
    }
  })

  it('0 利率：月供 = 本金/月数，总利息 0，不抛错', () => {
    const r = calcEqualPayment(120000, 0, 10) // 120 月
    expect(r.monthlyPayment).toBe(1000)
    expect(r.totalInterest).toBe(0)
    expect(r.totalRepayment).toBe(120000)
  })

  it('0 本金：全部为 0', () => {
    const r = calcEqualPayment(0, 3.5, 30)
    expect(r.monthlyPayment).toBe(0)
    expect(r.totalInterest).toBe(0)
    expect(r.totalRepayment).toBe(0)
  })

  it('负数 / NaN 输入按 0 处理', () => {
    expect(calcEqualPayment(-100, 3.5, 30).monthlyPayment).toBe(0)
    expect(calcEqualPayment(NaN, 3.5, 30).monthlyPayment).toBe(0)
    const neg = calcEqualPayment(1000000, -2, 30)
    expect(neg.monthlyPayment).toBeCloseTo(1000000 / 360)
    expect(neg.totalInterest).toBe(0)
    expect(calcEqualPayment(1000000, NaN, 30).monthlyPayment).toBeCloseTo(1000000 / 360)
    // NaN 期限 → 归 0
    expect(calcEqualPayment(1000000, 3.5, NaN).monthlyPayment).toBe(0)
  })
})

describe('calcHousingFund', () => {
  it('个人/单位 = 基数×比例，合计为两者之和', () => {
    const r = calcHousingFund(10000, 12, 12)
    expect(r.personal).toBe(1200)
    expect(r.employer).toBe(1200)
    expect(r.total).toBe(2400)
    expect(r.personalRate).toBe(12)
    expect(r.employerRate).toBe(12)
  })

  it('支持小数比例', () => {
    const r = calcHousingFund(10000, 7.5, 7.5)
    expect(r.personal).toBe(750)
    expect(r.total).toBe(1500)
  })

  it('0 基数 → 全 0', () => {
    expect(calcHousingFund(0, 12, 12).total).toBe(0)
  })

  it('比例超过 100% 也照算', () => {
    expect(calcHousingFund(10000, 20, 20).total).toBe(4000)
  })

  it('负数 / NaN 输入按 0', () => {
    expect(calcHousingFund(-100, 12, 12).total).toBe(0)
    const r2 = calcHousingFund(10000, NaN, 12)
    expect(r2.personal).toBe(0)
    expect(r2.employer).toBe(1200)
  })
})
