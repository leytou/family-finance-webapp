import type { MonthResult, YearSummary } from '../types'
import { formatCurrency } from './format'
import { formatMonth } from './month'

export type MonthFormulaField =
  | 'investReturn' | 'monthlyIncome' | 'monthlyExpense' | 'monthlyBalance' | 'cumSavings'
  | 'fundOffset' | 'fundOffsetShortfall' | 'fundBalance' | 'fundInterest' | 'totalAssets'

export interface MonthFormulaContext {
  /** 年利率，小数（0.03 表示 3%） */
  annualRate: number
  /** 上月累计储蓄；首月取初始存款 */
  prevCum: number
  // —— 公积金公式上下文（仅 fund 字段 hover 时使用）——
  prevFundBalance?: number
  fundContribution?: number
  fundWithdrawal?: number
  fundOffset?: number
  fundInterest?: number
  fundBalance?: number
  fundRate?: number
  /** 房贷月供绝对值（月冲自动联动展示用） */
  mortgageAbs?: number
  /** 月冲是否自动联动房贷月供（false=手填） */
  offsetAutoLinked?: boolean
  /** 月冲目标值（未截断：手填值或自动联动的房贷月供绝对值），用于区分「目标」与「实际冲额」 */
  fundOffsetTarget?: number
}

const MONTH_LABELS: Record<MonthFormulaField, string> = {
  investReturn: '理财',
  monthlyIncome: '收入',
  monthlyExpense: '支出',
  monthlyBalance: '结余',
  cumSavings: '存款',
  fundOffset: '月冲',
  fundOffsetShortfall: '存款补扣',
  fundBalance: '公积金',
  fundInterest: '结息',
  totalAssets: '总资产',
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
    case 'monthlyExpense': {
      // 房贷月供是公积金专区列（不在 columnValues），但计入可支配支出，需补进展开
      const items = [...negatives]
      const mort = ctx.mortgageAbs ?? 0
      if (mort > 0) items.push({ name: '房贷月供', amount: mort })
      line = items.length === 0
        ? `支出 = ${formatCurrency(result.monthlyExpense)}`
        : `支出 = ${formatItems(items)} = ${formatCurrency(result.monthlyExpense)}`
      break
    }
    case 'monthlyBalance': {
      // 公积金转入可支配（月冲抵扣 + 提取）；仅当非 0 才显示，无公积金时不多一项
      const inflow = (ctx.fundWithdrawal ?? 0) + (ctx.fundOffset ?? 0)
      const base = `结余 = 收入(${formatCurrency(result.monthlyIncome)}) - 支出(${formatCurrency(result.monthlyExpense)}) + 理财(${formatCurrency(result.investReturn)})`
      line = inflow > 0
        ? `${base} + 公积金转入(${formatCurrency(inflow)}) = ${formatCurrency(result.monthlyBalance)}`
        : `${base} = ${formatCurrency(result.monthlyBalance)}`
      break
    }
    case 'cumSavings':
      line = result.isAnchor
        ? `存款 = 锚点值(${formatCurrency(result.cumSavings)})`
        : `存款 = 上月存款(${formatCurrency(ctx.prevCum)}) + 当月结余(${formatCurrency(result.monthlyBalance)}) = ${formatCurrency(result.cumSavings)}`
      break
    case 'fundOffset': {
      // 目标值（未截断）vs 实际冲额（受公积金余额 min 截断）；两者不等=被截断
      const actual = formatCurrency(result.fundOffset)
      const target = ctx.fundOffsetTarget ?? result.fundOffset
      const truncated = Math.abs(target - result.fundOffset) > 1
      const targetFmt = formatCurrency(target)
      if (ctx.offsetAutoLinked) {
        line = truncated
          ? `月冲 = 房贷月供(${targetFmt}) [自动联动]，余额不足实际冲(${actual}) = ${actual}`
          : `月冲 = 房贷月供(${targetFmt}) [自动联动] = ${actual}`
      } else {
        line = truncated
          ? `月冲 = 手填值(${targetFmt})，余额不足实际冲(${actual}) = ${actual}`
          : `月冲 = 手填值(${targetFmt}) = ${actual}`
      }
      break
    }
    case 'fundOffsetShortfall': {
      // 房贷月供中公积金月冲没盖住、改由可支配存款承担的部分（≥0）
      line = `存款补扣 = 房贷月供(${formatCurrency(ctx.mortgageAbs ?? 0)}) - 公积金月冲(${formatCurrency(result.fundOffset)}) = ${formatCurrency(result.fundOffsetShortfall)}`
      break
    }
    case 'fundBalance': {
      const a = formatCurrency(ctx.prevFundBalance ?? 0)
      const b = formatCurrency(ctx.fundContribution ?? 0)
      const c = formatCurrency(ctx.fundWithdrawal ?? 0)
      const d = formatCurrency(ctx.fundOffset ?? 0)
      const e = formatCurrency(ctx.fundInterest ?? 0)
      const f = formatCurrency(result.fundBalance)
      line = `公积金 = 上月余额(${a}) + 缴存(${b}) - 提取(${c}) - 月冲(${d}) + 结息(${e}) = ${f}`
      break
    }
    case 'fundInterest': {
      const ratePct = +((ctx.fundRate ?? 0) * 100).toFixed(1)
      line = `结息 = 应计利息(${formatCurrency(result.fundInterest)}) [年利率 ${ratePct}%]`
      break
    }
    case 'totalAssets': {
      line = `总资产 = 存款(${formatCurrency(result.cumSavings)}) + 公积金(${formatCurrency(result.fundBalance)}) = ${formatCurrency(result.totalAssets)}`
      break
    }
  }

  return { title, lines: [line] }
}

export type YearFormulaField = 'startSavings' | 'investReturn' | 'yearBalance' | 'endSavings' | 'events' | 'fundBalance' | 'totalAssets'

export interface YearFormulaContext {
  isFirstYear: boolean
  firstMonthIsAnchor: boolean   // 首年首月是否锚点（仅 startSavings 首年分支使用）
  initialDeposit: number
  prevYearEndSavings: number
  events: { name: string; amount: number }[]
  /** 年末公积金余额（fundBalance 公式用） */
  yearEndFundBalance?: number
  /** 年末总资产（totalAssets 公式用） */
  yearEndTotalAssets?: number
  /** 年度房贷月供合计（公积金专区列，未计入 columnSummaries；负数=支出） */
  yearMortgage?: number
  /** 年度公积金转入可支配合计（月冲+提取，正数） */
  yearFundInflow?: number
}

const YEAR_LABELS: Record<YearFormulaField, string> = {
  startSavings: '年初存款',
  investReturn: '理财收益',
  yearBalance: '年度结余',
  endSavings: '年末存款',
  events: '专项',
  fundBalance: '年末公积金',
  totalAssets: '年末总资产',
}

export function buildYearFormula(
  summary: YearSummary,
  field: YearFormulaField,
  ctx: YearFormulaContext,
): { title: string; lines: string[] } {
  const title = `${summary.year} - ${YEAR_LABELS[field]}`

  let line: string
  switch (field) {
    case 'startSavings':
      if (ctx.isFirstYear) {
        line = ctx.firstMonthIsAnchor
          ? `年初存款 = 锚点值(${formatCurrency(summary.startSavings)})`
          : `年初存款 = 初始存款(${formatCurrency(ctx.initialDeposit)})`
      } else {
        line = `年初存款 = 上年年末存款(${formatCurrency(ctx.prevYearEndSavings)})`
      }
      break
    case 'investReturn':
      line = `理财收益 = 全年各月理财收益合计 = ${formatCurrency(summary.investReturn)}`
      break
    case 'yearBalance': {
      const items = summary.columnSummaries.map(c => ({ name: c.name, amount: c.total }))
      // 房贷月供是公积金专区列（不在 columnSummaries），但计入可支配支出
      const mort = ctx.yearMortgage ?? 0
      if (mort !== 0) items.push({ name: '房贷月供', amount: mort })
      items.push({ name: '理财收益', amount: summary.investReturn })
      // 公积金转入可支配（月冲 + 提取）；仅当非 0 才显示
      const inflow = ctx.yearFundInflow ?? 0
      const base = `年度结余 = ${formatItems(items)}`
      line = inflow > 0
        ? `${base} + 公积金转入(${formatCurrency(inflow)}) = ${formatCurrency(summary.yearBalance)}`
        : `${base} = ${formatCurrency(summary.yearBalance)}`
      break
    }
    case 'endSavings':
      line = `年末存款 = 年初存款(${formatCurrency(summary.startSavings)}) + 年度结余(${formatCurrency(summary.yearBalance)}) = ${formatCurrency(summary.endSavings)}`
      break
    case 'events': {
      const net = ctx.events.reduce((sum, e) => sum + e.amount, 0)
      line = ctx.events.length === 0
        ? `专项 = ${formatCurrency(net)}`
        : `专项 = ${formatItems(ctx.events)} = ${formatCurrency(net)}`
      break
    }
    case 'fundBalance':
      line = `年末公积金 = ${formatCurrency(ctx.yearEndFundBalance ?? 0)}`
      break
    case 'totalAssets':
      line = `年末总资产 = ${formatCurrency(ctx.yearEndTotalAssets ?? 0)}`
      break
  }

  return { title, lines: [line] }
}
