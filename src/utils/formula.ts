import type { MonthResult, YearSummary } from '../types'
import { formatCurrency } from './format'
import { formatMonth } from './month'

export type MonthFormulaField =
  | 'investReturn' | 'monthlyIncome' | 'monthlyExpense' | 'monthlyBalance' | 'cumSavings'

export interface MonthFormulaContext {
  /** 年利率，小数（0.03 表示 3%） */
  annualRate: number
  /** 上月累计储蓄；首月取初始存款 */
  prevCum: number
}

const MONTH_LABELS: Record<MonthFormulaField, string> = {
  investReturn: '理财',
  monthlyIncome: '收入',
  monthlyExpense: '支出',
  monthlyBalance: '结余',
  cumSavings: '存款',
}

/**
 * 把「名称+金额」项序列拼成带正负号的表达式：
 * 正项 " + 名称(额)"、负项 " - 名称(额)"；首项不输出前置运算符，但负号保留。
 * 月度收入/支出均传入非负序列（全正号展示）；
 * 负号分支用于年度结余、专项等正负混排场景（见 buildYearFormula）。
 * 例：[{月薪,10000},{育儿,-1400}] → "月薪(10,000) - 育儿(1,400)"
 */
function formatItems(items: { name: string; amount: number }[]): string {
  let result = ''
  items.forEach((item, index) => {
    const value = formatCurrency(Math.abs(item.amount))
    if (index === 0) {
      result += item.amount < 0 ? `-${item.name}(${value})` : `${item.name}(${value})`
    } else {
      result += item.amount < 0 ? ` - ${item.name}(${value})` : ` + ${item.name}(${value})`
    }
  })
  return result
}

export function buildMonthFormula(
  result: MonthResult,
  field: MonthFormulaField,
  ctx: MonthFormulaContext,
): { title: string; lines: string[] } {
  const title = `${formatMonth(result.month)} - ${MONTH_LABELS[field]}`
  const active = result.columnValues.filter(cv => cv.enabled !== false)
  const positives = active.filter(cv => cv.amount > 0).map(cv => ({ name: cv.name, amount: cv.amount }))
  const negatives = active.filter(cv => cv.amount < 0).map(cv => ({ name: cv.name, amount: Math.abs(cv.amount) }))

  let line: string
  switch (field) {
    case 'investReturn': {
      // 利率展示精度为一位小数（如 0.025 → 2.5、0.03 → 3）
      const ratePct = +(ctx.annualRate * 100).toFixed(1)
      line = `理财 = 上月存款(${formatCurrency(ctx.prevCum)}) × ${ratePct}% ÷ 12 = ${formatCurrency(result.investReturn)}`
      break
    }
    case 'monthlyIncome':
      line = positives.length === 0
        ? `收入 = ${formatCurrency(result.monthlyIncome)}`
        : `收入 = ${formatItems(positives)} = ${formatCurrency(result.monthlyIncome)}`
      break
    case 'monthlyExpense':
      line = negatives.length === 0
        ? `支出 = ${formatCurrency(result.monthlyExpense)}`
        : `支出 = ${formatItems(negatives)} = ${formatCurrency(result.monthlyExpense)}`
      break
    case 'monthlyBalance':
      line = `结余 = 收入(${formatCurrency(result.monthlyIncome)}) - 支出(${formatCurrency(result.monthlyExpense)}) + 理财(${formatCurrency(result.investReturn)}) = ${formatCurrency(result.monthlyBalance)}`
      break
    case 'cumSavings':
      line = result.isAnchor
        ? `存款 = 锚点值(${formatCurrency(result.cumSavings)})`
        : `存款 = 上月存款(${formatCurrency(ctx.prevCum)}) + 当月结余(${formatCurrency(result.monthlyBalance)}) = ${formatCurrency(result.cumSavings)}`
      break
  }

  return { title, lines: [line] }
}

// buildYearFormula 在 Task 3 实现；此处先占位导出，避免下游 import 报错
export type YearFormulaField = 'startSavings' | 'investReturn' | 'yearBalance' | 'endSavings' | 'events'

export interface YearFormulaContext {
  isFirstYear: boolean
  initialDeposit: number
  prevYearEndSavings: number
  events: { name: string; amount: number }[]
}

export function buildYearFormula(
  _summary: YearSummary,
  _field: YearFormulaField,
  _ctx: YearFormulaContext,
): { title: string; lines: string[] } {
  throw new Error('buildYearFormula: 尚未实现（Task 3）')
}
