import type { PlanData } from '../types'
import { calculate } from './useCalculation'

export interface ScenarioMetrics {
  scenarioId: string
  scenarioName: string
  yearEndSavings: number[]      // 5 个元素：第 1 年末 ~ 第 5 年末
  totalIncome: number           // 5 年总收入
  totalExpense: number          // 5 年总支出
  netSavings: number            // 5 年净储蓄
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

  // 各年末累计储蓄（每 12 个月取一次）
  const yearEndSavings: number[] = []
  for (let year = 1; year <= 5; year++) {
    const monthIndex = year * 12 - 1  // 0-indexed
    if (monthIndex < results.length) {
      yearEndSavings.push(results[monthIndex].cumSavings)
    }
  }

  // 5 年汇总
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
