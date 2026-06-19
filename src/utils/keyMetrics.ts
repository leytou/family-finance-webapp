import type { MonthResult } from '../types'

export interface KeyMetrics {
  finalCum: number       // 最终累计存款（末月 cumSavings）
  minCum: number         // 期间最低累计存款
  minMonth: number       // 最低点所在月（YYYYMM；空结果为 0）
  totalReturn: number    // 累计理财收益
  totalExpense: number   // 累计总支出（正数金额）
  totalIncome: number    // 累计总收入（各月 monthlyIncome 求和，不含初始本金）
  fundBalance: number | null  // 末月公积金余额；未启用公积金为 null
}

/** 由月度计算结果聚合首屏关键指标。纯函数，不含展示逻辑。 */
export function computeKeyMetrics(results: MonthResult[], fundEnabled: boolean): KeyMetrics {
  if (results.length === 0) {
    return { finalCum: 0, minCum: 0, minMonth: 0, totalReturn: 0, totalExpense: 0, totalIncome: 0, fundBalance: null }
  }
  let minCum = results[0].cumSavings
  let minMonth = results[0].month
  let totalReturn = 0
  let totalExpense = 0
  let totalIncome = 0
  for (const r of results) {
    if (r.cumSavings < minCum) {
      minCum = r.cumSavings
      minMonth = r.month
    }
    totalReturn += r.investReturn
    totalExpense += r.monthlyExpense
    totalIncome += r.monthlyIncome
  }
  const last = results[results.length - 1]
  return {
    finalCum: last.cumSavings,
    minCum,
    minMonth,
    totalReturn,
    totalExpense,
    totalIncome,
    fundBalance: fundEnabled ? last.fundBalance : null,
  }
}
