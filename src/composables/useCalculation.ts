import type { CashFlowItem, MonthResult, PlanData } from '../types'
import { addMonths, isInRange } from '../utils/month'

const PROJECTION_MONTHS = 60

export function calculate(plan: PlanData): MonthResult[] {
  const results: MonthResult[] = []

  for (let index = 0; index < PROJECTION_MONTHS; index++) {
    const month = addMonths(plan.systemParams.startMonth, index)
    const prevCum =
      index === 0 ? plan.systemParams.currentSavings : results[index - 1].cumSavings
    const incomeItems = getMonthlyItems(plan.items, month, 'income')
    const expenseItems = getMonthlyItems(plan.items, month, 'expense')
    const totalIncome = sumAmounts(incomeItems)
    const totalExpense = sumAmounts(expenseItems)
    const investReturn = (prevCum * plan.systemParams.annualRate) / 12
    const netSavings = totalIncome - totalExpense + investReturn
    const anchor = plan.anchors.find((item) => item.month === month)

    results.push({
      month,
      incomeItems,
      expenseItems,
      totalIncome,
      totalExpense,
      investReturn,
      netSavings,
      cumSavings: anchor ? anchor.actualSavings : prevCum + netSavings,
      isAnchor: Boolean(anchor),
    })
  }

  return results
}

function getMonthlyItems(
  items: CashFlowItem[],
  month: number,
  type: CashFlowItem['type'],
): { name: string; amount: number }[] {
  return items
    .filter((item) => item.type === type)
    .map((item) => ({
      name: item.name,
      amount: getActiveAmount(item, month),
    }))
    .filter((item) => item.amount !== 0)
}

function getActiveAmount(item: CashFlowItem, month: number): number {
  return item.segments.reduce((amount, segment) => {
    return isInRange(month, segment.startMonth, segment.endMonth) ? segment.amount : amount
  }, 0)
}

function sumAmounts(items: { amount: number }[]): number {
  return items.reduce((sum, item) => sum + item.amount, 0)
}
