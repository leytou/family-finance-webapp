import { describe, expect, it } from 'vitest'
import type { PlanData } from '../../src/types'
import { computeScenarioMetrics } from '../../src/composables/useComparison'

// 创建用于测试的 PlanData
function createTestPlan(overrides: Partial<PlanData> = {}): PlanData {
  return {
    version: 2,
    systemParams: { startMonth: 202601, annualRate: 0 },
    columns: [],
    corrections: [],
    snapshots: [],
    events: [],
    ...overrides,
  }
}

describe('computeScenarioMetrics', () => {
  it('计算各年末累计储蓄', () => {
    const plan = createTestPlan({
      systemParams: { startMonth: 202601, annualRate: 0 },
      columns: [
        { id: 'salary', name: '工资', itemSets: { 202601: [{ id: 'i1', name: '', amount: 10000 }] } },
      ],
      corrections: [],
    })

    const metrics = computeScenarioMetrics('s1', '方案A', plan)

    expect(metrics.yearEndSavings).toHaveLength(5)
    // 每月 10000，第 12 月末累计 = 120000
    expect(metrics.yearEndSavings[0]).toBe(120000)
    // 第 24 月末累计 = 240000
    expect(metrics.yearEndSavings[1]).toBe(240000)
  })

  it('计算 5 年总收入和总支出', () => {
    const plan = createTestPlan({
      systemParams: { startMonth: 202601, annualRate: 0 },
      columns: [
        { id: 'salary', name: '工资', itemSets: { 202601: [{ id: 'i1', name: '', amount: 10000 }] } },
        { id: 'rent', name: '房租', itemSets: { 202601: [{ id: 'i1', name: '', amount: -3000 }] } },
      ],
    })

    const metrics = computeScenarioMetrics('s1', '方案A', plan)

    expect(metrics.totalIncome).toBe(600000)   // 10000 × 60
    expect(metrics.totalExpense).toBe(180000)   // 3000 × 60
  })

  it('计算 5 年净储蓄', () => {
    const plan = createTestPlan({
      systemParams: { startMonth: 202601, annualRate: 0 },
      columns: [
        { id: 'salary', name: '工资', itemSets: { 202601: [{ id: 'i1', name: '', amount: 10000 }] } },
        { id: 'rent', name: '房租', itemSets: { 202601: [{ id: 'i1', name: '', amount: -3000 }] } },
      ],
    })

    const metrics = computeScenarioMetrics('s1', '方案A', plan)

    // 净储蓄 = 每月结余 × 60 = (10000 - 3000) × 60 = 420000
    expect(metrics.netSavings).toBe(420000)
  })

  it('计算最终累计储蓄', () => {
    const plan = createTestPlan({
      systemParams: { startMonth: 202601, annualRate: 0 },
      columns: [
        { id: 'salary', name: '工资', itemSets: { 202601: [{ id: 'i1', name: '', amount: 10000 }] } },
      ],
    })

    const metrics = computeScenarioMetrics('s1', '方案A', plan)

    // 10000 × 60 = 600000
    expect(metrics.finalCumSavings).toBe(600000)
  })

  it('计算期间最低储蓄点', () => {
    const plan = createTestPlan({
      systemParams: { startMonth: 202601, annualRate: 0 },
      columns: [
        { id: 'salary', name: '工资', itemSets: { 202601: [{ id: 'i1', name: '', amount: 10000 }] } },
        { id: 'house', name: '买房', itemSets: { 202606: [{ id: 'i1', name: '', amount: -200000 }], 202607: [{ id: 'i2', name: '', amount: 0 }] } },
      ],
    })

    const metrics = computeScenarioMetrics('s1', '方案A', plan)

    // 1-5月累计 50000，6月 50000 + 10000 - 200000 = -140000
    // 7月开始买房支出归零，之后累计回升，所以最低点在6月末
    expect(metrics.minCumSavings).toBe(-140000)
  })

  it('考虑投资收益的影响', () => {
    // 使用修正设置初始资金
    const plan = createTestPlan({
      systemParams: { startMonth: 202601, annualRate: 0.12 },
      columns: [],
      corrections: [{ month: 202601, actualSavings: 100000 }],
    })

    const metrics = computeScenarioMetrics('s1', '方案A', plan)

    // 有投资收益，最终累计 > 初始 100000
    expect(metrics.finalCumSavings).toBeGreaterThan(100000)
    // 第一年的投资收益：约 100000 × 12% / 12 × 12 ≈ 但有复利效果
    expect(metrics.yearEndSavings[0]).toBeGreaterThan(100000)
  })

  it('返回正确的 scenarioId 和 scenarioName', () => {
    const plan = createTestPlan()
    const metrics = computeScenarioMetrics('test-id', '测试方案', plan)

    expect(metrics.scenarioId).toBe('test-id')
    expect(metrics.scenarioName).toBe('测试方案')
  })

  it('期限 10 年时 yearEndSavings 含 10 个元素', () => {
    const plan = createTestPlan({
      systemParams: { startMonth: 202601, annualRate: 0, endMonth: 203512 },
      columns: [{ id: 'salary', name: '工资', itemSets: { 202601: [{ id: 'i1', name: '', amount: 10000 }] } }],
    })

    const metrics = computeScenarioMetrics('s1', '方案A', plan)

    expect(metrics.yearEndSavings).toHaveLength(10)
  })

  it('期限 2 年时 yearEndSavings 含 2 个元素', () => {
    const plan = createTestPlan({
      systemParams: { startMonth: 202601, annualRate: 0, endMonth: 202712 },
      columns: [{ id: 'salary', name: '工资', itemSets: { 202601: [{ id: 'i1', name: '', amount: 10000 }] } }],
    })

    const metrics = computeScenarioMetrics('s1', '方案A', plan)

    expect(metrics.yearEndSavings).toHaveLength(2)
  })
})
