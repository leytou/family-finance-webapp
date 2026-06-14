import type { PlanData } from '../types'
import { calculate } from './useCalculation'

export interface ScenarioMetrics {
  scenarioId: string
  scenarioName: string
  yearEndSavings: number[]      // 各年末累计储蓄（长度 = 期限年数 = ceil(results.length / 12)）
  totalIncome: number           // 全程总收入
  totalExpense: number          // 全程总支出
  netSavings: number            // 全程净储蓄
  finalCumSavings: number       // 最终累计储蓄
  minCumSavings: number         // 期间最低储蓄点
}

/**
 * 计算单个方案的关键指标
 */
export function computeScenarioMetrics(
  scenarioId: string,
  scenarioName: string,
  plan: PlanData,
): ScenarioMetrics {
  const results = calculate(plan)

  // 各年末累计储蓄（每 12 个月取一次），年数跟随实际期限
  const totalYears = Math.ceil(results.length / 12)
  const yearEndSavings: number[] = []
  for (let year = 1; year <= totalYears; year++) {
    const monthIndex = year * 12 - 1  // 0-indexed
    if (monthIndex < results.length) {
      yearEndSavings.push(results[monthIndex].cumSavings)
    }
  }

  // 全程汇总（覆盖实际期限内的全部月份）
  const totalIncome = results.reduce((sum, r) => sum + r.monthlyIncome, 0)
  const totalExpense = results.reduce((sum, r) => sum + r.monthlyExpense, 0)
  const netSavings = results.reduce((sum, r) => sum + r.monthlyBalance, 0)

  // 最终累计储蓄
  const finalCumSavings = results.length > 0 ? results[results.length - 1].cumSavings : 0

  // 期间最低储蓄点
  const minCumSavings = results.length > 0 ? Math.min(...results.map(r => r.cumSavings)) : 0

  return {
    scenarioId,
    scenarioName,
    yearEndSavings,
    totalIncome,
    totalExpense,
    netSavings,
    finalCumSavings,
    minCumSavings,
  }
}
